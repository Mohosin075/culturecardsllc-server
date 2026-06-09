"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Review = void 0;
const mongoose_1 = require("mongoose");
const reviewSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true },
    serviceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Service' },
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
    rating: { type: Number, required: true },
    review: { type: String, required: true },
}, {
    timestamps: true,
});
exports.Review = (0, mongoose_1.model)('Review', reviewSchema);
