"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceCharge = exports.refundMarketplacePayment = exports.findChargeAccount = exports.retrievePaymentIntentAnywhere = exports.findPayableConnectedAccount = exports.findSellerAccountId = exports.chargeSavedCardDirect = exports.clonePaymentMethodToConnectedAccount = exports.createDirectChargeIntent = exports.getOrCreateConnectedCustomer = exports.requireConnectedAccount = exports.calculateTradeFeeCharge = exports.grossUpForStripe = exports.calculateSaleFee = exports.getFeeSettings = void 0;
const http_status_codes_1 = require("http-status-codes");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const settings_model_1 = require("../dashboard/settings.model");
const seller_model_1 = require("../seller/seller.model");
const user_model_1 = require("../user/user.model");
/**
 * Marketplace money movement.
 *
 * Every sale is a **direct charge** on the seller's connected account. That is
 * what the client's spec requires: Stripe's processing fee comes out of the
 * seller's proceeds rather than ARIES's, and dispute liability sits with the
 * seller. ARIES takes its cut through `application_fee_amount`, which Stripe
 * moves to the platform automatically — no manual transfer, no payout job.
 *
 * Trade fees are different: nobody is selling anything, ARIES is just
 * collecting its own fee, so those stay as ordinary platform charges.
 */
const EPHEMERAL_KEY_API_VERSION = '2023-10-16';
const DEFAULT_FEES = {
    saleFeePercent: 6.5,
    tradeFeePercentPerSide: 4,
    stripePercent: 2.9,
    stripeFlatFee: 0.3,
};
const toCents = (dollars) => Math.round(dollars * 100);
/** Fee rates are admin-editable; fall back to the spec's numbers. */
const getFeeSettings = async () => {
    var _a, _b, _c, _d;
    try {
        const settings = await settings_model_1.SystemSettings.findOne().lean();
        const fees = settings === null || settings === void 0 ? void 0 : settings.marketplaceFees;
        if (!fees)
            return DEFAULT_FEES;
        return {
            saleFeePercent: (_a = fees.saleFeePercent) !== null && _a !== void 0 ? _a : DEFAULT_FEES.saleFeePercent,
            tradeFeePercentPerSide: (_b = fees.tradeFeePercentPerSide) !== null && _b !== void 0 ? _b : DEFAULT_FEES.tradeFeePercentPerSide,
            stripePercent: (_c = fees.stripePercent) !== null && _c !== void 0 ? _c : DEFAULT_FEES.stripePercent,
            stripeFlatFee: (_d = fees.stripeFlatFee) !== null && _d !== void 0 ? _d : DEFAULT_FEES.stripeFlatFee,
        };
    }
    catch (_e) {
        return DEFAULT_FEES;
    }
};
exports.getFeeSettings = getFeeSettings;
/**
 * ARIES's cut of a sale, in cents.
 *
 * The fee is taken on the item price only. Shipping and tax are passed through
 * to the seller untouched — charging a marketplace fee on postage would make
 * the seller's take depend on the parcel's weight.
 */
const calculateSaleFee = (itemSubtotal, fees) => toCents(itemSubtotal * (fees.saleFeePercent / 100));
exports.calculateSaleFee = calculateSaleFee;
/**
 * What a user must be charged so that ARIES nets `netWanted` after Stripe
 * takes its percentage and flat fee.
 *
 *   charge = (netWanted + flat) / (1 - percent)
 *
 * Rounded up, so a rounding cent never comes out of the platform's fee. On the
 * spec's $100 trade this gives $4.43 for a $4.00 net; the client's worked
 * example says $4.42, which nets $3.99.
 */
const grossUpForStripe = (netWanted, fees) => {
    const rate = fees.stripePercent / 100;
    if (rate >= 1)
        return toCents(netWanted);
    const gross = (netWanted + fees.stripeFlatFee) / (1 - rate);
    return Math.ceil(gross * 100);
};
exports.grossUpForStripe = grossUpForStripe;
/** Each side's trade fee, in cents, already grossed up for Stripe. */
const calculateTradeFeeCharge = (itemValue, fees) => {
    const netFee = Number((itemValue * (fees.tradeFeePercentPerSide / 100)).toFixed(2));
    return { netFee, chargeCents: (0, exports.grossUpForStripe)(netFee, fees) };
};
exports.calculateTradeFeeCharge = calculateTradeFeeCharge;
/**
 * The connected account a seller's money must land in.
 *
 * Throws rather than silently falling back to a platform charge: taking money
 * for a seller who cannot be paid out would leave funds stranded on the
 * platform, which is the problem Connect is here to solve.
 */
const requireConnectedAccount = async (sellerId) => {
    var _a;
    const application = await seller_model_1.SellerApplication.findOne({ userId: sellerId });
    if (!((_a = application === null || application === void 0 ? void 0 : application.stripe) === null || _a === void 0 ? void 0 : _a.accountId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This seller has not connected a Stripe account yet, so their items cannot be purchased.');
    }
    if (!application.stripe.chargesEnabled) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This seller cannot accept payments yet — their Stripe verification is incomplete.');
    }
    return application.stripe.accountId;
};
exports.requireConnectedAccount = requireConnectedAccount;
/**
 * A direct charge needs a Customer that lives on the *connected* account; the
 * platform's Customer objects are not visible there. One is created per
 * (buyer, connected account) pair and remembered on the user.
 */
const getOrCreateConnectedCustomer = async (userId, connectedAccountId) => {
    var _a, _b;
    const user = await user_model_1.User.findById(userId);
    if (!user)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    const existing = (_b = (_a = user.stripeConnectedCustomerIds) === null || _a === void 0 ? void 0 : _a.get) === null || _b === void 0 ? void 0 : _b.call(_a, connectedAccountId);
    if (existing) {
        try {
            const customer = await stripe_1.default.customers.retrieve(existing, {
                stripeAccount: connectedAccountId,
            });
            if (!customer.deleted)
                return existing;
        }
        catch (_c) {
            // Fall through and make a new one.
        }
    }
    const customer = await stripe_1.default.customers.create({
        email: user.email,
        name: user.fullName || user.name || undefined,
        metadata: { areisUserId: user._id.toString() },
    }, { stripeAccount: connectedAccountId });
    if (!user.stripeConnectedCustomerIds) {
        ;
        user.stripeConnectedCustomerIds = new Map();
    }
    ;
    user.stripeConnectedCustomerIds.set(connectedAccountId, customer.id);
    await user.save();
    return customer.id;
};
exports.getOrCreateConnectedCustomer = getOrCreateConnectedCustomer;
/**
 * Create a direct-charge PaymentIntent on the seller's connected account,
 * with ARIES's cut as the application fee.
 */
const createDirectChargeIntent = async (params) => {
    const fees = await (0, exports.getFeeSettings)();
    const connectedAccountId = await (0, exports.requireConnectedAccount)(params.sellerId);
    const customerId = await (0, exports.getOrCreateConnectedCustomer)(params.buyerId, connectedAccountId);
    const amountCents = toCents(params.totalAmount);
    // Never let the fee exceed the charge (possible if an admin sets a silly
    // rate, or on a $0 giveaway order).
    const applicationFeeAmount = Math.min((0, exports.calculateSaleFee)(params.itemSubtotal, fees), amountCents);
    const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, {
        apiVersion: EPHEMERAL_KEY_API_VERSION,
        stripeAccount: connectedAccountId,
    });
    const paymentIntent = await stripe_1.default.paymentIntents.create({
        amount: amountCents,
        currency: params.currency || 'usd',
        customer: customerId,
        application_fee_amount: applicationFeeAmount,
        metadata: {
            areisBuyerId: params.buyerId,
            areisSellerId: params.sellerId,
            areisPlatformFeeCents: String(applicationFeeAmount),
            ...params.metadata,
        },
    }, { stripeAccount: connectedAccountId });
    return {
        clientSecret: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        paymentIntentId: paymentIntent.id,
        stripeAccountId: connectedAccountId,
        applicationFeeAmount,
    };
};
exports.createDirectChargeIntent = createDirectChargeIntent;
/**
 * Copy a card saved on the platform to a connected account, so an auction
 * winner can be charged off-session by a direct charge. Stripe requires this:
 * a platform payment method is not usable on a connected account as-is.
 */
const clonePaymentMethodToConnectedAccount = async (params) => {
    const cloned = await stripe_1.default.paymentMethods.create({
        customer: params.platformCustomerId,
        payment_method: params.paymentMethodId,
    }, { stripeAccount: params.connectedAccountId });
    await stripe_1.default.paymentMethods.attach(cloned.id, { customer: params.connectedCustomerId }, { stripeAccount: params.connectedAccountId });
    return cloned.id;
};
exports.clonePaymentMethodToConnectedAccount = clonePaymentMethodToConnectedAccount;
/**
 * Off-session direct charge, used when an auction ends and the winner has a
 * saved card. Returns null when there is no usable card, so the caller can
 * fall back to asking the winner to pay.
 */
const chargeSavedCardDirect = async (params) => {
    const buyer = await user_model_1.User.findById(params.buyerId).select('stripeCustomerId');
    if (!(buyer === null || buyer === void 0 ? void 0 : buyer.stripeCustomerId))
        return null;
    const fees = await (0, exports.getFeeSettings)();
    // Not onboarded yet → no direct charge. The caller falls back to a normal
    // checkout session rather than failing the auction.
    const connectedAccountId = await (0, exports.findPayableConnectedAccount)(params.sellerId);
    if (!connectedAccountId)
        return null;
    const methods = await stripe_1.default.paymentMethods.list({
        customer: buyer.stripeCustomerId,
        type: 'card',
        limit: 1,
    });
    const savedCard = methods.data[0];
    if (!savedCard)
        return null;
    const connectedCustomerId = await (0, exports.getOrCreateConnectedCustomer)(params.buyerId, connectedAccountId);
    const clonedPaymentMethodId = await (0, exports.clonePaymentMethodToConnectedAccount)({
        platformCustomerId: buyer.stripeCustomerId,
        paymentMethodId: savedCard.id,
        connectedAccountId,
        connectedCustomerId,
    });
    const amountCents = toCents(params.totalAmount);
    const applicationFeeAmount = Math.min((0, exports.calculateSaleFee)(params.itemSubtotal, fees), amountCents);
    const intent = await stripe_1.default.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: connectedCustomerId,
        payment_method: clonedPaymentMethodId,
        off_session: true,
        confirm: true,
        application_fee_amount: applicationFeeAmount,
        metadata: {
            areisBuyerId: params.buyerId,
            areisSellerId: params.sellerId,
            areisPlatformFeeCents: String(applicationFeeAmount),
            ...params.metadata,
        },
    }, { stripeAccount: connectedAccountId });
    if (intent.status !== 'succeeded')
        return null;
    return {
        paymentIntentId: intent.id,
        stripeAccountId: connectedAccountId,
        applicationFeeAmount,
    };
};
exports.chargeSavedCardDirect = chargeSavedCardDirect;
/**
 * The connected account a seller's charges live on, or null when they have
 * none. Unlike `requireConnectedAccount` this never throws — it is used on
 * read paths (looking a charge up, refunding it) where the account may
 * legitimately be absent on older, platform-side payments.
 */
const findSellerAccountId = async (sellerId) => {
    var _a;
    if (!sellerId)
        return null;
    const application = await seller_model_1.SellerApplication.findOne({ userId: sellerId });
    return ((_a = application === null || application === void 0 ? void 0 : application.stripe) === null || _a === void 0 ? void 0 : _a.accountId) || null;
};
exports.findSellerAccountId = findSellerAccountId;
/**
 * The seller's account only if Stripe will actually let it take money.
 *
 * Returns null rather than throwing, so a caller can fall back to a platform
 * charge for a seller who has not onboarded yet. That fallback is what keeps
 * the marketplace working while existing sellers are migrated onto Connect —
 * without it, shipping Connect would fail every purchase on the platform.
 */
const findPayableConnectedAccount = async (sellerId) => {
    var _a;
    if (!sellerId)
        return null;
    const application = await seller_model_1.SellerApplication.findOne({ userId: sellerId });
    if (!((_a = application === null || application === void 0 ? void 0 : application.stripe) === null || _a === void 0 ? void 0 : _a.accountId))
        return null;
    if (!application.stripe.chargesEnabled)
        return null;
    return application.stripe.accountId;
};
exports.findPayableConnectedAccount = findPayableConnectedAccount;
/**
 * Retrieve a PaymentIntent without knowing which account it lives on.
 *
 * Marketplace charges sit on the seller's connected account, while tips,
 * subscriptions and pre-Connect orders sit on the platform. Callers that only
 * have an id need both looked up.
 */
const retrievePaymentIntentAnywhere = async (paymentIntentId, sellerId) => {
    const connectedAccountId = await (0, exports.findSellerAccountId)(sellerId);
    if (connectedAccountId) {
        try {
            const intent = await stripe_1.default.paymentIntents.retrieve(paymentIntentId, {
                stripeAccount: connectedAccountId,
            });
            return { intent, stripeAccountId: connectedAccountId };
        }
        catch (_a) {
            // Not on the seller's account — fall through to the platform.
        }
    }
    try {
        const intent = await stripe_1.default.paymentIntents.retrieve(paymentIntentId);
        return { intent, stripeAccountId: null };
    }
    catch (_b) {
        return null;
    }
};
exports.retrievePaymentIntentAnywhere = retrievePaymentIntentAnywhere;
/**
 * The account a charge actually lives on, for refunding it.
 *
 * Use the account recorded when the charge was made. Without one (orders from
 * before Connect), do NOT assume the seller's current account: a charge taken
 * on the platform before the seller onboarded is still on the platform. Ask
 * Stripe instead — seller account first, then the platform.
 *
 * Returns null for a platform charge; throws if Stripe has no such intent.
 */
const findChargeAccount = async (params) => {
    if (params.recordedAccountId)
        return params.recordedAccountId;
    const located = await (0, exports.retrievePaymentIntentAnywhere)(params.paymentIntentId, params.sellerId);
    if (!located) {
        throw new Error(`PaymentIntent ${params.paymentIntentId} was not found on the seller's account or the platform`);
    }
    return located.stripeAccountId;
};
exports.findChargeAccount = findChargeAccount;
/**
 * Refund a marketplace payment on whichever account it was charged on.
 *
 * On a connected-account charge the money comes out of the seller's balance,
 * which is what the client's spec asks for. `refund_application_fee` also
 * hands ARIES's cut back, so a refunded sale earns the platform nothing —
 * pass false to keep the fee on a partial or fault-based refund.
 */
const refundMarketplacePayment = async (params) => {
    const body = {
        payment_intent: params.paymentIntentId,
        ...(params.amount !== undefined && { amount: toCents(params.amount) }),
        ...(params.reason && { reason: params.reason }),
    };
    if (params.stripeAccountId) {
        body.refund_application_fee = params.refundApplicationFee !== false;
        return stripe_1.default.refunds.create(body, {
            stripeAccount: params.stripeAccountId,
        });
    }
    return stripe_1.default.refunds.create(body);
};
exports.refundMarketplacePayment = refundMarketplacePayment;
exports.MarketplaceCharge = {
    findSellerAccountId: exports.findSellerAccountId,
    findPayableConnectedAccount: exports.findPayableConnectedAccount,
    retrievePaymentIntentAnywhere: exports.retrievePaymentIntentAnywhere,
    findChargeAccount: exports.findChargeAccount,
    refundMarketplacePayment: exports.refundMarketplacePayment,
    getFeeSettings: exports.getFeeSettings,
    calculateSaleFee: exports.calculateSaleFee,
    grossUpForStripe: exports.grossUpForStripe,
    calculateTradeFeeCharge: exports.calculateTradeFeeCharge,
    requireConnectedAccount: exports.requireConnectedAccount,
    getOrCreateConnectedCustomer: exports.getOrCreateConnectedCustomer,
    createDirectChargeIntent: exports.createDirectChargeIntent,
    chargeSavedCardDirect: exports.chargeSavedCardDirect,
    clonePaymentMethodToConnectedAccount: exports.clonePaymentMethodToConnectedAccount,
};
