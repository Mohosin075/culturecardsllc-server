"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tip = void 0;
const mongoose_1 = require("mongoose");
const tipSchema = new mongoose_1.Schema({
    streamId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LiveStream',
        required: true,
        index: true,
    },
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sellerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 1,
    },
    processingFee: {
        type: Number,
        default: 0,
        min: 0,
    },
    platformFee: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalCharged: {
        type: Number,
        default: 0,
        min: 0,
    },
    sellerNetAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    currency: {
        type: String,
        default: 'USD',
    },
    paymentIntentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'succeeded', 'failed'],
        default: 'pending',
        index: true,
    },
    senderName: {
        type: String,
        required: true,
    },
    senderImage: {
        type: String,
        default: '',
    },
    message: {
        type: String,
        trim: true,
        maxlength: 200,
    },
}, {
    timestamps: true,
});
tipSchema.index({ sellerId: 1, createdAt: -1 });
tipSchema.index({ streamId: 1, createdAt: -1 });
exports.Tip = (0, mongoose_1.model)('Tip', tipSchema);
