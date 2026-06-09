"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeOffer = void 0;
const mongoose_1 = require("mongoose");
const TradeOfferSchema = new mongoose_1.Schema({
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    receiverId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    senderProductId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    receiverProductId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    cashSupplement: {
        type: Number,
        default: 0,
    },
    escrowStatus: {
        type: String,
        enum: ['pending', 'held', 'released', 'refunded'],
        default: 'pending',
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'completed', 'expired'],
        default: 'pending',
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
exports.TradeOffer = (0, mongoose_1.model)('TradeOffer', TradeOfferSchema);
exports.default = exports.TradeOffer;
