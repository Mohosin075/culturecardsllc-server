"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSettlementServices = exports.markPartyPaidByIntent = exports.getSettlementStatus = exports.createPartyPaymentIntent = exports.getOrCreateSettlement = exports.buildSettlementPlan = void 0;
const http_status_codes_1 = require("http-status-codes");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const marketplaceCharge_1 = require("../payment/marketplaceCharge");
const user_model_1 = require("../user/user.model");
const trade_model_1 = require("./trade.model");
const tradeSettlement_model_1 = require("./tradeSettlement.model");
const EPHEMERAL_KEY_API_VERSION = '2023-10-16';
const round2 = (n) => Number(n.toFixed(2));
/**
 * Work out what each side of a trade owes.
 *
 * Both parties pay ARIES 4% of their own item's agreed value. If the items
 * are worth different amounts, the party with the cheaper item also pays the
 * difference in cash to the other party.
 *
 * Every charge is grossed up so Stripe's cut never eats into ARIES's fee or
 * into the cash the other party receives — the payer covers it, which is what
 * the spec's "users will pay the 2.9% + 30¢" means.
 */
const buildSettlementPlan = async (offer) => {
    var _a, _b;
    const fees = await marketplaceCharge_1.MarketplaceCharge.getFeeSettings();
    const senderValue = Number(((_a = offer.senderProductId) === null || _a === void 0 ? void 0 : _a.estValue) || 0);
    const receiverValue = Number(((_b = offer.receiverProductId) === null || _b === void 0 ? void 0 : _b.estValue) || 0);
    // cashSupplement > 0 means the sender tops up; < 0 means the receiver does.
    const cash = Number(offer.cashSupplement || 0);
    const senderCash = cash > 0 ? Math.abs(cash) : 0;
    const receiverCash = cash < 0 ? Math.abs(cash) : 0;
    const build = (userId, role, itemValue, cashNet) => {
        const feeNet = round2(itemValue * (fees.tradeFeePercentPerSide / 100));
        const chargeCents = feeNet + cashNet > 0
            ? marketplaceCharge_1.MarketplaceCharge.grossUpForStripe(feeNet + cashNet, fees)
            : 0;
        return {
            userId,
            role,
            itemValue,
            feeNet,
            cashNet,
            chargeCents,
            status: chargeCents > 0 ? 'pending' : 'paid',
            paidAt: chargeCents > 0 ? undefined : new Date(),
        };
    };
    return [
        build(offer.senderId, 'sender', senderValue, senderCash),
        build(offer.receiverId, 'receiver', receiverValue, receiverCash),
    ];
};
exports.buildSettlementPlan = buildSettlementPlan;
const getOrCreateSettlement = async (offer) => {
    const existing = await tradeSettlement_model_1.TradeSettlement.findOne({ tradeOfferId: offer._id });
    if (existing)
        return existing;
    const parties = await (0, exports.buildSettlementPlan)(offer);
    return tradeSettlement_model_1.TradeSettlement.create({
        tradeOfferId: offer._id,
        parties,
        status: parties.every(p => p.status === 'paid') ? 'settled' : 'pending',
    });
};
exports.getOrCreateSettlement = getOrCreateSettlement;
/**
 * The payment this user must make to settle their side of the trade.
 *
 * When they owe cash to the other party, the whole thing runs as a direct
 * charge on that party's connected account, with ARIES's 4% taken as the
 * application fee — one charge instead of two, and the recipient's cash lands
 * in their own Stripe account rather than sitting on the platform.
 *
 * When they only owe the fee, it is an ordinary platform charge: nobody is
 * being paid out.
 */
const createPartyPaymentIntent = async (offerId, userId) => {
    const offer = (await trade_model_1.TradeOffer.findById(offerId)
        .populate('senderProductId')
        .populate('receiverProductId'));
    if (!offer) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Trade offer not found');
    }
    const settlement = await (0, exports.getOrCreateSettlement)(offer);
    const party = settlement.parties.find(p => p.userId.toString() === userId.toString());
    if (!party) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not part of this trade.');
    }
    if (party.status === 'paid')
        return { alreadyPaid: true };
    // Re-use a live intent rather than stacking up new ones on every retry.
    if (party.paymentIntentId) {
        try {
            const existing = await stripe_1.default.paymentIntents.retrieve(party.paymentIntentId, party.stripeAccountId
                ? { stripeAccount: party.stripeAccountId }
                : undefined);
            if (existing.status !== 'canceled' &&
                existing.status !== 'succeeded' &&
                existing.client_secret) {
                const customerId = String(existing.customer);
                const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, party.stripeAccountId
                    ? {
                        apiVersion: EPHEMERAL_KEY_API_VERSION,
                        stripeAccount: party.stripeAccountId,
                    }
                    : { apiVersion: EPHEMERAL_KEY_API_VERSION });
                return {
                    clientSecret: existing.client_secret,
                    ephemeralKey: ephemeralKey.secret,
                    customer: customerId,
                    paymentIntentId: existing.id,
                    stripeAccountId: party.stripeAccountId,
                    feeAmount: party.feeNet,
                    cashAmount: party.cashNet,
                    totalAmount: party.chargeCents / 100,
                };
            }
        }
        catch (_a) {
            // Stale intent — fall through and make a new one.
        }
    }
    const counterparty = settlement.parties.find(p => p.userId.toString() !== userId.toString());
    const metadata = {
        purchaseType: 'trade_settlement',
        tradeOfferId: offer._id.toString(),
        areisTradeRole: party.role,
        areisTradeFeeCents: String(Math.round(party.feeNet * 100)),
        areisTradeCashCents: String(Math.round(party.cashNet * 100)),
    };
    let result;
    if (party.cashNet > 0 && counterparty) {
        // Cash flows to the other party: direct charge on their account.
        const connectedAccountId = await marketplaceCharge_1.MarketplaceCharge.requireConnectedAccount(counterparty.userId.toString());
        const customerId = await marketplaceCharge_1.MarketplaceCharge.getOrCreateConnectedCustomer(userId, connectedAccountId);
        const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, {
            apiVersion: EPHEMERAL_KEY_API_VERSION,
            stripeAccount: connectedAccountId,
        });
        const intent = await stripe_1.default.paymentIntents.create({
            amount: party.chargeCents,
            currency: 'usd',
            customer: customerId,
            // ARIES's 4% comes off the top; the rest settles to the recipient.
            application_fee_amount: Math.min(Math.round(party.feeNet * 100), party.chargeCents),
            metadata,
        }, { stripeAccount: connectedAccountId });
        party.paymentIntentId = intent.id;
        party.stripeAccountId = connectedAccountId;
        result = {
            clientSecret: intent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customerId,
            paymentIntentId: intent.id,
            stripeAccountId: connectedAccountId,
            feeAmount: party.feeNet,
            cashAmount: party.cashNet,
            totalAmount: party.chargeCents / 100,
        };
    }
    else {
        // Fee only — straight to the platform.
        const user = await user_model_1.User.findById(userId);
        if (!user)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe_1.default.customers.create({
                email: user.email,
                name: user.fullName || user.name || undefined,
                metadata: { areisUserId: user._id.toString() },
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }
        const ephemeralKey = await stripe_1.default.ephemeralKeys.create({ customer: customerId }, { apiVersion: EPHEMERAL_KEY_API_VERSION });
        const intent = await stripe_1.default.paymentIntents.create({
            amount: party.chargeCents,
            currency: 'usd',
            customer: customerId,
            metadata,
        });
        party.paymentIntentId = intent.id;
        party.stripeAccountId = undefined;
        result = {
            clientSecret: intent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customerId,
            paymentIntentId: intent.id,
            feeAmount: party.feeNet,
            cashAmount: party.cashNet,
            totalAmount: party.chargeCents / 100,
        };
    }
    settlement.markModified('parties');
    await settlement.save();
    return result;
};
exports.createPartyPaymentIntent = createPartyPaymentIntent;
/** Where both sides stand, for the trade screen. */
const getSettlementStatus = async (offerId) => {
    const settlement = await tradeSettlement_model_1.TradeSettlement.findOne({ tradeOfferId: offerId });
    if (!settlement)
        return null;
    return {
        status: settlement.status,
        parties: settlement.parties.map(p => ({
            userId: p.userId.toString(),
            role: p.role,
            feeNet: p.feeNet,
            cashNet: p.cashNet,
            totalAmount: p.chargeCents / 100,
            status: p.status,
        })),
    };
};
exports.getSettlementStatus = getSettlementStatus;
/**
 * Called from the Stripe webhook. Marks one side paid and reports whether the
 * trade is now fully settled, so the caller can swap the items.
 */
const markPartyPaidByIntent = async (paymentIntentId) => {
    const settlement = await tradeSettlement_model_1.TradeSettlement.findOne({
        'parties.paymentIntentId': paymentIntentId,
    });
    if (!settlement)
        return null;
    const party = settlement.parties.find(p => p.paymentIntentId === paymentIntentId);
    if (!party || party.status === 'paid') {
        return {
            settled: settlement.status === 'settled',
            tradeOfferId: settlement.tradeOfferId.toString(),
        };
    }
    party.status = 'paid';
    party.paidAt = new Date();
    const allPaid = settlement.parties.every(p => p.status === 'paid');
    if (allPaid) {
        settlement.status = 'settled';
        settlement.settledAt = new Date();
    }
    settlement.markModified('parties');
    await settlement.save();
    return {
        settled: allPaid,
        tradeOfferId: settlement.tradeOfferId.toString(),
    };
};
exports.markPartyPaidByIntent = markPartyPaidByIntent;
exports.TradeSettlementServices = {
    buildSettlementPlan: exports.buildSettlementPlan,
    getOrCreateSettlement: exports.getOrCreateSettlement,
    createPartyPaymentIntent: exports.createPartyPaymentIntent,
    getSettlementStatus: exports.getSettlementStatus,
    markPartyPaidByIntent: exports.markPartyPaidByIntent,
};
