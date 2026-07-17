"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Review = void 0;
const mongoose_1 = require("mongoose");
const reviewSchema = new mongoose_1.Schema({
    // One of orderId or tradeOfferId is required at the service/validation layer
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order' },
    tradeOfferId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TradeOffer' },
    reviewer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        populate: { path: 'reviewer', select: 'name lastName fullName profile' },
    },
    reviewee: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        populate: { path: 'reviewee', select: 'name lastName fullName profile' },
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true, trim: true },
}, {
    timestamps: true,
});
exports.Review = (0, mongoose_1.model)('Review', reviewSchema);
