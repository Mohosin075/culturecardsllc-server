"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerEarning = exports.Partner = void 0;
const mongoose_1 = require("mongoose");
const PartnerSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    promoCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    revenueSharePercentage: { type: Number, default: 50, min: 0, max: 100 },
    bankDetails: {
        accountNumber: { type: String, default: '' },
        routingNumber: { type: String, default: '' },
        bankName: { type: String, default: '' },
        accountHolderName: { type: String, default: '' },
    },
    accessToken: { type: String, required: true, unique: true, index: true },
    otpCode: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpSessionToken: { type: String, default: null },
    totalEarnings: { type: Number, default: 0, min: 0 },
}, {
    timestamps: true,
});
const PartnerEarningSchema = new mongoose_1.Schema({
    partnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order', sparse: true },
    tradeOfferId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TradeOffer', sparse: true },
    buyerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    transactionAmount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    partnerShare: { type: Number, required: true, min: 0 },
    ownerShare: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
}, {
    timestamps: true,
});
// Idempotency: Prevent duplicate earnings on webhook retries
PartnerEarningSchema.index({ partnerId: 1, orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $exists: true, $ne: null } } });
PartnerEarningSchema.index({ partnerId: 1, tradeOfferId: 1 }, { unique: true, partialFilterExpression: { tradeOfferId: { $exists: true, $ne: null } } });
PartnerEarningSchema.index({ partnerId: 1, createdAt: -1 });
PartnerEarningSchema.index({ createdAt: 1 });
exports.Partner = (0, mongoose_1.model)('Partner', PartnerSchema);
exports.PartnerEarning = (0, mongoose_1.model)('PartnerEarning', PartnerEarningSchema);
