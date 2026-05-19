"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = require("mongoose");
const paymentSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
    },
    userEmail: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'EUR',
    },
    paymentMethod: {
        type: String,
        enum: ['stripe'],
        required: true,
        default: 'stripe',
    },
    paymentIntentId: {
        type: String,
        required: true,
        // This now stores the CHECKOUT SESSION ID, not payment intent ID
    },
    status: {
        type: String,
        enum: ['pending', 'succeeded', 'failed', 'refunded'],
        default: 'pending',
    },
    refundAmount: {
        type: Number,
        min: 0,
    },
    refundReason: {
        type: String,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
paymentSchema.index({ userId: 1 });
paymentSchema.index({ paymentIntentId: 1 });
exports.Payment = (0, mongoose_1.model)('Payment', paymentSchema);
