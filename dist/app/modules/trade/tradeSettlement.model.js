"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSettlement = void 0;
const mongoose_1 = require("mongoose");
const PartySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['sender', 'receiver'], required: true },
    itemValue: { type: Number, default: 0, min: 0 },
    feeNet: { type: Number, default: 0, min: 0 },
    cashNet: { type: Number, default: 0, min: 0 },
    chargeCents: { type: Number, default: 0, min: 0 },
    paymentIntentId: { type: String, index: true },
    stripeAccountId: { type: String },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date },
}, { _id: false });
const TradeSettlementSchema = new mongoose_1.Schema({
    tradeOfferId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TradeOffer',
        required: true,
        unique: true,
        index: true,
    },
    parties: { type: [PartySchema], default: [] },
    status: {
        type: String,
        enum: ['pending', 'settled'],
        default: 'pending',
        index: true,
    },
    settledAt: { type: Date },
}, { timestamps: true });
exports.TradeSettlement = (0, mongoose_1.model)('TradeSettlement', TradeSettlementSchema);
exports.default = exports.TradeSettlement;
