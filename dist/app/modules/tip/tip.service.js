"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const auction_model_1 = require("../auction/auction.model");
const user_model_1 = require("../user/user.model");
const tip_model_1 = require("./tip.model");
const server_1 = require("../../../server");
const pushnotificationHelper_1 = require("../../../helpers/pushnotificationHelper");
const STRIPE_PERCENT_FEE = 0.029;
const STRIPE_FIXED_FEE_CENTS = 30;
/**
 * No platform fee on tips (0%). The tipper covers the Stripe card processing
 * fee (2.9% + $0.30 gross-up) so the seller retains 100% of the tip amount.
 */
const calculateTipFees = (rawAmount) => {
    const tipAmountCents = Math.round(rawAmount * 100);
    const totalChargeCents = Math.ceil((tipAmountCents + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PERCENT_FEE));
    const processingFeeCents = totalChargeCents - tipAmountCents;
    return {
        tipAmount: Number((tipAmountCents / 100).toFixed(2)),
        processingFee: Number((processingFeeCents / 100).toFixed(2)),
        platformFee: 0,
        totalCharged: Number((totalChargeCents / 100).toFixed(2)),
        sellerNetAmount: Number((tipAmountCents / 100).toFixed(2)),
        tipAmountCents,
        processingFeeCents,
        totalChargeCents,
    };
};
const getOrCreateStripeCustomer = async (userData) => {
    var _a, _b;
    let customerId = userData.stripeCustomerId;
    if (customerId) {
        try {
            await stripe_1.default.customers.retrieve(customerId);
        }
        catch (err) {
            if (((_a = err.raw) === null || _a === void 0 ? void 0 : _a.type) === 'invalid_request_error' || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('No such customer'))) {
                customerId = undefined;
            }
            else {
                throw err;
            }
        }
    }
    if (!customerId) {
        const customer = await stripe_1.default.customers.create({
            email: userData.email,
            name: userData.fullName || userData.name || undefined,
            metadata: { userId: userData._id.toString() },
        });
        customerId = customer.id;
        await user_model_1.User.findByIdAndUpdate(userData._id, { stripeCustomerId: customerId });
    }
    return customerId;
};
/**
 * 1. Create a PaymentIntent or execute a 1-tap saved card tip
 */
const createTipIntent = async (user, payload) => {
    const { streamId, amount, paymentMethodId, message } = payload;
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid streamId.');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream not found.');
    }
    const sender = await user_model_1.User.findById(user.userId);
    if (!sender) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Sender user not found.');
    }
    const sellerId = stream.sellerId;
    const senderName = sender.fullName || sender.name || 'A Supporter';
    const senderImage = sender.profile || sender.image || sender.photo || '';
    const customerId = await getOrCreateStripeCustomer(sender);
    const fees = calculateTipFees(amount);
    // A. 1-Tap Saved Card Charge (user pays tip + Stripe processing fee; 0% platform fee)
    if (paymentMethodId) {
        try {
            const intent = await stripe_1.default.paymentIntents.create({
                amount: fees.totalChargeCents,
                currency: 'usd',
                customer: customerId,
                payment_method: paymentMethodId,
                off_session: true,
                confirm: true,
                description: `Tip for Live Show: ${stream.title}`,
                metadata: {
                    type: 'live_stream_tip',
                    streamId,
                    senderId: user.userId,
                    sellerId: sellerId.toString(),
                    message: message || '',
                    tipAmount: fees.tipAmount.toFixed(2),
                    processingFee: fees.processingFee.toFixed(2),
                    platformFee: '0.00',
                    totalCharged: fees.totalCharged.toFixed(2),
                    sellerNetAmount: fees.sellerNetAmount.toFixed(2),
                },
            });
            if (intent.status === 'succeeded') {
                const tipRecord = await tip_model_1.Tip.create({
                    streamId: new mongoose_1.Types.ObjectId(streamId),
                    senderId: new mongoose_1.Types.ObjectId(user.userId),
                    sellerId: new mongoose_1.Types.ObjectId(sellerId.toString()),
                    amount: fees.tipAmount,
                    processingFee: fees.processingFee,
                    platformFee: 0,
                    totalCharged: fees.totalCharged,
                    sellerNetAmount: fees.sellerNetAmount,
                    currency: 'USD',
                    paymentIntentId: intent.id,
                    status: 'succeeded',
                    senderName,
                    senderImage,
                    message: message === null || message === void 0 ? void 0 : message.trim(),
                });
                await _broadcastTipSuccess({
                    stream,
                    tip: tipRecord,
                    senderName,
                    senderImage,
                    amount: fees.tipAmount,
                    message: message === null || message === void 0 ? void 0 : message.trim(),
                    senderId: user.userId,
                });
                return {
                    status: 'succeeded',
                    tipId: tipRecord._id,
                    amount: fees.tipAmount,
                    processingFee: fees.processingFee,
                    platformFee: 0,
                    totalCharged: fees.totalCharged,
                    sellerNetAmount: fees.sellerNetAmount,
                    currency: 'USD',
                };
            }
            else {
                return {
                    status: intent.status,
                    paymentIntentId: intent.id,
                    clientSecret: intent.client_secret,
                    amount: fees.tipAmount,
                    processingFee: fees.processingFee,
                    platformFee: 0,
                    totalCharged: fees.totalCharged,
                    sellerNetAmount: fees.sellerNetAmount,
                };
            }
        }
        catch (err) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, err.message || 'Payment failed.');
        }
    }
    // B. PaymentSheet / New Card Intent
    const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, { apiVersion: '2024-06-20' });
    const paymentIntent = await stripe_1.default.paymentIntents.create({
        amount: fees.totalChargeCents,
        currency: 'usd',
        customer: customerId,
        payment_method_types: ['card'],
        description: `Tip for Live Show: ${stream.title}`,
        metadata: {
            type: 'live_stream_tip',
            streamId,
            senderId: user.userId,
            sellerId: sellerId.toString(),
            message: message || '',
            tipAmount: fees.tipAmount.toFixed(2),
            processingFee: fees.processingFee.toFixed(2),
            platformFee: '0.00',
            totalCharged: fees.totalCharged.toFixed(2),
            sellerNetAmount: fees.sellerNetAmount.toFixed(2),
        },
    });
    return {
        status: 'requires_payment_method',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        ephemeralKey: ephemeralKey.secret,
        customerId,
        amount: fees.tipAmount,
        processingFee: fees.processingFee,
        platformFee: 0,
        totalCharged: fees.totalCharged,
        sellerNetAmount: fees.sellerNetAmount,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51NJLdJF5nDLFMGmox0iseTJZp42wfLi6Ub41OGs7hoMl0GSFe93a0My7PxdF2eKsxV1rvUf8vVw4p6jl9h9pCmEQ00WSln5w44',
    };
};
/**
 * 2. Confirm PaymentSheet Tip after Stripe client confirmation
 */
const confirmTip = async (user, payload) => {
    var _a, _b;
    const { streamId, paymentIntentId, amount, message } = payload;
    const existingTip = await tip_model_1.Tip.findOne({ paymentIntentId });
    if (existingTip && existingTip.status === 'succeeded') {
        return existingTip;
    }
    const intent = await stripe_1.default.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Payment is not complete (Stripe status: ${intent.status}).`);
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream not found.');
    }
    const sender = await user_model_1.User.findById(user.userId);
    const senderName = (sender === null || sender === void 0 ? void 0 : sender.fullName) || (sender === null || sender === void 0 ? void 0 : sender.name) || 'A Supporter';
    const senderImage = (sender === null || sender === void 0 ? void 0 : sender.profile) || (sender === null || sender === void 0 ? void 0 : sender.image) || (sender === null || sender === void 0 ? void 0 : sender.photo) || '';
    // Use trusted amounts from Stripe PaymentIntent metadata when present
    const metaTipAmount = Number((_a = intent.metadata) === null || _a === void 0 ? void 0 : _a.tipAmount);
    const tipAmount = Number.isFinite(metaTipAmount) && metaTipAmount > 0 ? metaTipAmount : amount;
    const computedFees = calculateTipFees(tipAmount);
    const metaProcessingFee = Number((_b = intent.metadata) === null || _b === void 0 ? void 0 : _b.processingFee);
    const processingFee = Number.isFinite(metaProcessingFee) && metaProcessingFee >= 0
        ? metaProcessingFee
        : computedFees.processingFee;
    const totalCharged = Number((intent.amount / 100).toFixed(2));
    const tipRecord = await tip_model_1.Tip.findOneAndUpdate({ paymentIntentId }, {
        streamId: new mongoose_1.Types.ObjectId(streamId),
        senderId: new mongoose_1.Types.ObjectId(user.userId),
        sellerId: stream.sellerId,
        amount: tipAmount,
        processingFee,
        platformFee: 0,
        totalCharged,
        sellerNetAmount: tipAmount,
        currency: 'USD',
        paymentIntentId,
        status: 'succeeded',
        senderName,
        senderImage,
        message: message === null || message === void 0 ? void 0 : message.trim(),
    }, { upsert: true, new: true });
    await _broadcastTipSuccess({
        stream,
        tip: tipRecord,
        senderName,
        senderImage,
        amount: tipAmount,
        message: message === null || message === void 0 ? void 0 : message.trim(),
        senderId: user.userId,
    });
    return tipRecord;
};
/**
 * Helper to update stream counter, broadcast socket event, and send push notification
 */
const _broadcastTipSuccess = async (data) => {
    const { stream, tip, senderName, senderImage, amount, message, senderId } = data;
    const streamIdStr = stream._id.toString();
    // 1. Update LiveStream totals atomically
    await auction_model_1.LiveStream.findByIdAndUpdate(stream._id, {
        $inc: { tipsTotal: amount, tipsCount: 1 },
        $push: {
            chatMessages: {
                _id: new mongoose_1.Types.ObjectId(),
                user: senderName,
                userId: new mongoose_1.Types.ObjectId(senderId),
                message: `💛 Sent a $${amount.toFixed(2)} Tip!${message ? ' "' + message + '"' : ''}`,
                timestamp: new Date(),
                likedBy: [],
            },
        },
    });
    // 2. Broadcast real-time Socket Event to all participants in stream room
    if (server_1.io) {
        server_1.io.to(`stream:${streamIdStr}`).emit('stream-tip', {
            streamId: streamIdStr,
            tipId: tip._id.toString(),
            amount,
            sender: {
                _id: senderId,
                name: senderName,
                image: senderImage,
            },
            message: message || '',
            timestamp: new Date(),
        });
    }
    // 3. Send Push Notification to Seller
    try {
        const seller = await user_model_1.User.findById(stream.sellerId);
        if (seller === null || seller === void 0 ? void 0 : seller.deviceToken) {
            await (0, pushnotificationHelper_1.sendPushNotification)(seller.deviceToken, 'New Tip Received! 💛', `${senderName} tipped you $${amount.toFixed(2)} on "${stream.title}"!`, {
                type: 'live_tip',
                streamId: streamIdStr,
                tipId: tip._id.toString(),
                amount: amount.toString(),
            });
        }
    }
    catch (_) { }
};
/**
 * 3. Get all tips for a specific stream
 */
const getStreamTips = async (streamId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid streamId.');
    }
    return await tip_model_1.Tip.find({ streamId, status: 'succeeded' }).sort({ createdAt: -1 });
};
/**
 * 4. Get tips received by the authenticated seller (with total earnings)
 */
const getMySellerTips = async (userId) => {
    const tips = await tip_model_1.Tip.find({
        sellerId: new mongoose_1.Types.ObjectId(userId),
        status: 'succeeded',
    })
        .populate('streamId', 'title coverImage')
        .sort({ createdAt: -1 });
    const totalEarnings = tips.reduce((sum, item) => sum + (item.sellerNetAmount || item.amount || 0), 0);
    return {
        totalEarnings: Number(totalEarnings.toFixed(2)),
        totalCount: tips.length,
        tips,
    };
};
exports.TipServices = {
    createTipIntent,
    confirmTip,
    getStreamTips,
    getMySellerTips,
};
