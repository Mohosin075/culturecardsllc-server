"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentServices = void 0;
const user_1 = require("../../../enum/user");
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const payment_model_1 = require("./payment.model");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const payment_constants_1 = require("./payment.constants");
const mongoose_1 = require("mongoose");
const user_model_1 = require("../user/user.model");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const webhook_service_1 = require("./webhook.service");
const emailHelper_1 = require("../../../helpers/emailHelper");
const invoiceHelper_1 = require("../../../helpers/invoiceHelper");
const createCheckoutSession = async (user, payload) => {
    try {
        const userData = await user_model_1.User.findById(user.userId);
        if (!userData) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        }
        let customerId = userData.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe_1.default.customers.create({
                email: user.email,
                name: userData.fullName || userData.name || '',
            });
            customerId = customer.id;
            userData.stripeCustomerId = customerId;
            await userData.save();
        }
        const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2023-10-16' });
        const paymentIntent = await stripe_1.default.paymentIntents.create({
            amount: Math.round(payload.amount * 100),
            currency: payload.currency || 'usd',
            customer: customerId,
            metadata: {
                userId: user.userId.toString(),
                ...(payload.bookingId && { bookingId: payload.bookingId.toString() }),
                ...payload.metadata,
            },
        });
        await payment_model_1.Payment.create({
            userId: user.userId,
            bookingId: payload.bookingId,
            userEmail: user.email,
            amount: payload.amount,
            currency: payload.currency || 'usd',
            paymentMethod: 'stripe',
            paymentIntentId: paymentIntent.id,
            status: 'pending',
            metadata: {
                ...(payload.bookingId && { bookingId: payload.bookingId.toString() }),
                ...payload.metadata,
            },
        });
        return {
            clientSecret: paymentIntent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customerId,
            paymentIntentId: paymentIntent.id,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Checkout session creation failed: ${errorMessage}`);
    }
};
const verifyCheckoutSession = async (sessionId) => {
    var _a;
    try {
        let paymentStatus = '';
        let paymentIntentId = '';
        let metadata = {};
        let fullStripeObject = null;
        if (sessionId.startsWith('pi_')) {
            const intent = await stripe_1.default.paymentIntents.retrieve(sessionId);
            paymentStatus = intent.status === 'succeeded' ? 'paid' : intent.status;
            paymentIntentId = intent.id;
            metadata = intent.metadata;
            fullStripeObject = intent;
            console.log('🔍 Verifying Payment Intent:', intent.id);
        }
        else {
            const session = await stripe_1.default.checkout.sessions.retrieve(sessionId, {
                expand: ['payment_intent'],
            });
            paymentStatus = session.payment_status;
            paymentIntentId = (typeof session.payment_intent === 'string' ? session.payment_intent : (_a = session.payment_intent) === null || _a === void 0 ? void 0 : _a.id) || '';
            metadata = session.metadata;
            fullStripeObject = session;
            console.log('🔍 Verifying Checkout Session:', session.id);
        }
        // Find payment record using either paymentIntentId (legacy/direct) or metadata.checkoutSessionId (correct for checkout)
        const payment = await payment_model_1.Payment.findOne({
            $or: [
                { paymentIntentId: sessionId },
                { 'metadata.checkoutSessionId': sessionId },
                { paymentIntentId: paymentIntentId },
            ],
        }).populate('userId', 'name email');
        if (!payment) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Payment not found');
        }
        // Update payment status based on session or intent
        if (paymentStatus === 'paid' && payment.status !== 'succeeded') {
            const dbSession = await payment_model_1.Payment.startSession();
            dbSession.startTransaction();
            try {
                // Update payment status
                payment.status = 'succeeded';
                payment.metadata = { ...payment.metadata, stripeData: fullStripeObject };
                await payment.save({ session: dbSession });
                // Booking and Wallet logic removed as requested
                // Send confirmation email
                const user = await payment.populate('userId');
                const userData = user.userId;
                if (userData) {
                    await emailHelper_1.emailHelper.sendEmail({
                        to: userData.email,
                        subject: 'Payment Successful',
                        html: `<p>Hi ${userData.name}, your payment of ${payment.amount} ${payment.currency} was successful.</p>`,
                    });
                }
                await dbSession.commitTransaction();
            }
            catch (error) {
                await dbSession.abortTransaction();
                throw error;
            }
            finally {
                dbSession.endSession();
            }
        }
        else if ((paymentStatus === 'unpaid' || paymentStatus === 'requires_payment_method') &&
            payment.status !== 'failed') {
            payment.status = 'failed';
            await payment.save();
        }
        return payment;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Payment verification failed: ${errorMessage}`);
    }
};
// ============================================
// FLUTTER STRIPE INTEGRATION METHODS
// ============================================
/**
 * Create Payment Intent for Flutter App
 * Used by flutter_stripe SDK for native mobile payments
 *
 * Supports two modes:
 * 1. NEW CARD: No paymentMethodId → returns clientSecret for Flutter SDK to collect card
 * 2. SAVED CARD: paymentMethodId provided → attaches saved card & auto-confirms off-session
 */
const createPaymentIntent = async (user, payload) => {
    try {
        // ---- Booking Validation ----
        if (!payload.bookingId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Booking ID is required');
        }
        // Determine payable amount from payload (as Booking is missing)
        const payableAmount = typeof payload.amount === 'number' ? Number(payload.amount.toFixed(2)) : 0;
        if (payableAmount <= 0) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No payable amount found for this booking');
        }
        // Get or create Stripe customer (needed for saved card payments)
        const userData = await user_model_1.User.findById(user.userId);
        if (!userData)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        const userEmail = userData.email;
        let customerId = userData.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe_1.default.customers.create({
                email: userData.email,
                name: userData.fullName || userData.name,
                metadata: { userId: userData._id.toString() },
            });
            customerId = customer.id;
            userData.stripeCustomerId = customer.id;
            await userData.save();
        }
        // Build PaymentIntent params
        const intentParams = {
            amount: Math.round(payableAmount * 100), // Convert to cents
            currency: 'eur',
            customer: customerId,
            metadata: {
                userId: user.userId,
                userEmail,
                bookingId: payload.bookingId,
                ...payload.metadata,
            },
        };
        // If paymentMethodId is provided → pay with saved card (off-session)
        if (payload.paymentMethodId) {
            intentParams.payment_method = payload.paymentMethodId;
            intentParams.off_session = true;
            intentParams.confirm = true; // Auto-confirm with saved card
        }
        else {
            // New card → Flutter SDK will collect card details using clientSecret
            intentParams.payment_method_types = ['card'];
        }
        const paymentIntent = await stripe_1.default.paymentIntents.create(intentParams);
        // Create payment record
        await payment_model_1.Payment.create({
            userId: user.userId,
            bookingId: payload.bookingId,
            userEmail,
            amount: payableAmount,
            currency: 'EUR',
            paymentMethod: 'stripe',
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
            metadata: {
                userId: user.userId,
                bookingId: payload.bookingId,
                usedSavedCard: !!payload.paymentMethodId,
                ...payload.metadata,
            },
        });
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: payableAmount,
            status: paymentIntent.status,
        };
    }
    catch (error) {
        if (error instanceof ApiError_1.default)
            throw error;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Payment Intent creation failed: ${errorMessage}`);
    }
};
/**
 * Create Ephemeral Key for Flutter Stripe SDK
 * Required for customer-scoped operations in flutter_stripe
 */
const createEphemeralKey = async (user, apiVersion = '2025-05-28.basil') => {
    try {
        const userData = await user_model_1.User.findById(user.userId);
        if (!userData) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        }
        let customerId = userData.stripeCustomerId;
        // Create customer if it doesn't exist in DB
        if (!customerId) {
            const customer = await stripe_1.default.customers.create({
                email: userData.email,
                name: userData.fullName || userData.name,
                metadata: {
                    userId: user.userId,
                },
            });
            customerId = customer.id;
            // Update user record with stripeCustomerId
            userData.stripeCustomerId = customer.id;
            await userData.save();
        }
        // Create ephemeral key
        const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, { apiVersion: apiVersion });
        return {
            ephemeralKey: ephemeralKey.secret,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Ephemeral key creation failed: ${errorMessage}`);
    }
};
/**
 * Handle Payment Intent Webhook Events
 * Processes payment_intent.succeeded events from Stripe
 */
const handlePaymentIntentWebhook = async (paymentIntent) => {
    try {
        const payment = await payment_model_1.Payment.findOne({
            paymentIntentId: paymentIntent.id,
        });
        if (!payment) {
            console.error(`Payment not found for Payment Intent: ${paymentIntent.id}`);
            return;
        }
        if (payment.status === 'succeeded') {
            console.log(`Payment already processed: ${paymentIntent.id}`);
            return;
        }
        // Start MongoDB transaction
        const session = await payment_model_1.Payment.startSession();
        session.startTransaction();
        try {
            // Update payment status
            payment.status = 'succeeded';
            payment.metadata = {
                ...payment.metadata,
                processedAt: new Date().toISOString(),
            };
            await payment.save({ session });
            await session.commitTransaction();
            console.log(`Payment processed successfully: ${paymentIntent.id}`);
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Webhook processing failed: ${errorMessage}`);
        throw error;
    }
};
// ============================================
// EXISTING METHODS
// ============================================
const getAllPayments = async (user, filterables, pagination) => {
    const { searchTerm, ...filterData } = filterables;
    const { page, skip, limit, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(pagination);
    const andConditions = [];
    // Search functionality
    if (searchTerm) {
        andConditions.push({
            $or: payment_constants_1.paymentSearchableFields.map(field => ({
                [field]: {
                    $regex: searchTerm,
                    $options: 'i',
                },
            })),
        });
    }
    // Filter functionality
    if (Object.keys(filterData).length) {
        andConditions.push({
            $and: Object.entries(filterData).map(([key, value]) => ({
                [key]: value,
            })),
        });
    }
    // Regular users can only see their own payments
    if (user.activeRole === user_1.USER_ROLES.BUYER ||
        user.activeRole === user_1.USER_ROLES.SELLER) {
        andConditions.push({
            userId: new mongoose_1.Types.ObjectId(user.userId),
        });
    }
    const whereConditions = andConditions.length ? { $and: andConditions } : {};
    const [result, total] = await Promise.all([
        payment_model_1.Payment.find(whereConditions)
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder })
            .populate('userId', 'name email')
            .populate({
            path: 'bookingId',
        }),
        payment_model_1.Payment.countDocuments(whereConditions),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: result,
    };
};
const getSinglePayment = async (id) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Payment ID');
    }
    const result = await payment_model_1.Payment.findById(id).populate('userId', 'name email');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Requested payment not found, please try again with valid id');
    }
    return result;
};
const updatePayment = async (id, payload) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Payment ID');
    }
    const result = await payment_model_1.Payment.findByIdAndUpdate(new mongoose_1.Types.ObjectId(id), { $set: payload }, {
        new: true,
        runValidators: true,
    }).populate('userId', 'name email');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Requested payment not found, please try again with valid id');
    }
    return result;
};
const refundPayment = async (id, reason) => {
    var _a;
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Payment ID');
    }
    const payment = await payment_model_1.Payment.findById(id);
    if (!payment) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Payment not found');
    }
    if (payment.status !== 'succeeded') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Only successful payments can be refunded');
    }
    // Process refund via Stripe
    try {
        let refundPaymentIntentId = payment.paymentIntentId;
        const checkoutSessionId = (_a = payment.metadata) === null || _a === void 0 ? void 0 : _a.checkoutSessionId;
        // For checkout payments, paymentIntentId may hold session ID in older records.
        if (checkoutSessionId) {
            const checkoutSession = await stripe_1.default.checkout.sessions.retrieve(checkoutSessionId);
            if (typeof checkoutSession.payment_intent === 'string') {
                refundPaymentIntentId = checkoutSession.payment_intent;
            }
        }
        const refund = await stripe_1.default.refunds.create({
            payment_intent: refundPaymentIntentId,
            amount: Math.round(payment.amount * 100),
            reason: reason ? 'requested_by_customer' : 'duplicate',
        });
        const dbSession = await payment_model_1.Payment.startSession();
        dbSession.startTransaction();
        let result = null;
        try {
            result = await payment_model_1.Payment.findByIdAndUpdate(id, {
                status: 'refunded',
                refundAmount: payment.amount,
                refundReason: reason,
                metadata: { ...payment.metadata, refundId: refund.id },
            }, { new: true, runValidators: true, session: dbSession }).populate('userId', 'name email');
            // Booking logic removed as requested
            await dbSession.commitTransaction();
        }
        catch (error) {
            await dbSession.abortTransaction();
            throw error;
        }
        finally {
            dbSession.endSession();
        }
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Refund failed: ${errorMessage}`);
    }
};
const getMyPayments = async (user, pagination) => {
    const { page, skip, limit, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(pagination);
    const [result, total] = await Promise.all([
        payment_model_1.Payment.find({ userId: new mongoose_1.Types.ObjectId(user.userId) })
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder })
            .populate('userId', 'name email'),
        payment_model_1.Payment.countDocuments({ userId: new mongoose_1.Types.ObjectId(user.userId) }),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: result,
    };
};
const generateInvoice = async (id) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Payment ID');
    }
    const payment = await payment_model_1.Payment.findById(id)
        .populate('userId')
        .populate('bookingId');
    if (!payment) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Payment not found');
    }
    // 1. If it's a Stripe payment, try to get the official receipt URL
    if (payment.paymentIntentId &&
        payment.status === 'succeeded' &&
        payment.paymentMethod === 'stripe') {
        try {
            const pi = await stripe_1.default.paymentIntents.retrieve(payment.paymentIntentId);
            if (pi.latest_charge) {
                const charge = await stripe_1.default.charges.retrieve(pi.latest_charge);
                if (charge.receipt_url) {
                    return charge.receipt_url;
                }
            }
        }
        catch (error) {
            console.error('Failed to fetch stripe receipt:', error);
        }
    }
    // 2. Fallback to custom PDF invoice generation
    return await (0, invoiceHelper_1.generatePDFInvoice)(payment);
};
/**
 * Create Setup Intent to save payment method for future use
 */
const createSetupIntent = async (user) => {
    const userData = await user_model_1.User.findById(user.userId);
    if (!userData)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    let customerId = userData.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe_1.default.customers.create({
            email: userData.email,
            name: userData.fullName || userData.name,
            metadata: { userId: userData._id.toString() },
        });
        customerId = customer.id;
        userData.stripeCustomerId = customer.id;
        await userData.save();
    }
    const setupIntent = await stripe_1.default.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
    });
    return {
        clientSecret: setupIntent.client_secret,
    };
};
/**
 * List all saved payment methods for a user
 */
const getMyPaymentMethods = async (user) => {
    var _a;
    const userData = await user_model_1.User.findById(user.userId);
    if (!(userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId))
        return [];
    const paymentMethods = await stripe_1.default.paymentMethods.list({
        customer: userData.stripeCustomerId,
        type: 'card',
    });
    const customer = (await stripe_1.default.customers.retrieve(userData.stripeCustomerId));
    const defaultPaymentMethodId = (_a = customer.invoice_settings) === null || _a === void 0 ? void 0 : _a.default_payment_method;
    return paymentMethods.data.map(pm => {
        var _a, _b, _c, _d;
        return ({
            id: pm.id,
            brand: (_a = pm.card) === null || _a === void 0 ? void 0 : _a.brand,
            last4: (_b = pm.card) === null || _b === void 0 ? void 0 : _b.last4,
            expMonth: (_c = pm.card) === null || _c === void 0 ? void 0 : _c.exp_month,
            expYear: (_d = pm.card) === null || _d === void 0 ? void 0 : _d.exp_year,
            isDefault: pm.id === defaultPaymentMethodId,
        });
    });
};
/**
 * Delete a saved payment method
 */
const deletePaymentMethod = async (user, paymentMethodId) => {
    const userData = await user_model_1.User.findById(user.userId);
    if (!(userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId))
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No stripe customer found');
    // Verify ownership (optional check, Stripe handles detachment but good for safety)
    const pm = await stripe_1.default.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== userData.stripeCustomerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Payment method does not belong to this user');
    }
    await stripe_1.default.paymentMethods.detach(paymentMethodId);
    return { success: true };
};
/**
 * Set a payment method as default
 */
const setDefaultPaymentMethod = async (user, paymentMethodId) => {
    const userData = await user_model_1.User.findById(user.userId);
    if (!(userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId))
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No stripe customer found');
    await stripe_1.default.customers.update(userData.stripeCustomerId, {
        invoice_settings: {
            default_payment_method: paymentMethodId,
        },
    });
    return { success: true };
};
exports.PaymentServices = {
    getAllPayments,
    getSinglePayment,
    updatePayment,
    refundPayment,
    getMyPayments,
    createCheckoutSession,
    verifyCheckoutSession,
    handleWebhook: webhook_service_1.WebhookService.handleWebhook,
    createPaymentIntent,
    createEphemeralKey,
    handlePaymentIntentWebhook,
    generateInvoice,
    createSetupIntent,
    getMyPaymentMethods,
    deletePaymentMethod,
    setDefaultPaymentMethod,
};
