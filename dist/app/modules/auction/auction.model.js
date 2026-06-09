"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionItem = exports.LiveStream = void 0;
const mongoose_1 = require("mongoose");
const LiveStreamSchema = new mongoose_1.Schema({
    sellerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    scheduledAt: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['scheduled', 'live', 'ended'],
        default: 'scheduled',
        index: true,
    },
    agoraChannelName: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    pinnedProductId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
    },
    viewersCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    likesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
const AuctionItemSchema = new mongoose_1.Schema({
    streamId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LiveStream',
        required: true,
        index: true,
    },
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'failed'],
        default: 'pending',
        index: true,
    },
    currentBid: {
        type: Number,
        default: 0,
        min: 0,
    },
    highestBidderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    bidIncrement: {
        type: Number,
        default: 5,
        min: 1,
    },
    timerDuration: {
        type: Number,
        default: 60,
        min: 5,
    },
    endsAt: {
        type: Date,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
exports.LiveStream = (0, mongoose_1.model)('LiveStream', LiveStreamSchema);
exports.AuctionItem = (0, mongoose_1.model)('AuctionItem', AuctionItemSchema);
