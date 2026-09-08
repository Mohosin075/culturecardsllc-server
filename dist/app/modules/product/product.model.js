"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = require("mongoose");
const ProductSchema = new mongoose_1.Schema({
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
    images: {
        type: [String],
        required: true,
        default: [],
    },
    video: {
        type: String,
    },
    category: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        index: true,
    },
    condition: {
        type: String,
        enum: ['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'],
        required: true,
    },
    estValue: {
        type: Number,
        required: true,
        min: 0,
    },
    startingBid: {
        type: Number,
        min: 0,
    },
    reservePrice: {
        type: Number,
        min: 0,
    },
    buyNowPrice: {
        type: Number,
        min: 0,
    },
    status: {
        type: String,
        enum: ['active', 'sold', 'unsold', 'pending'],
        default: 'active',
        index: true,
    },
    stock: {
        type: Number,
        default: 1,
        min: 0,
    },
    isFeatured: {
        type: Boolean,
        default: false,
        index: true,
    },
    boostedUntil: {
        type: Date,
    },
    allowTrade: {
        type: Boolean,
        default: true,
        index: true,
    },
    shippingWeight: {
        type: Number,
        default: 0,
    },
    allowOffers: {
        type: Boolean,
        default: false,
    },
    minOfferAmount: {
        type: Number,
        default: 0,
    },
    shareCount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
ProductSchema.index({ status: 1, category: 1, createdAt: -1 });
ProductSchema.index({ boostedUntil: -1, createdAt: -1 });
ProductSchema.index({ status: 1, allowTrade: 1, estValue: 1 });
ProductSchema.index({ title: 'text', description: 'text' });
exports.Product = (0, mongoose_1.model)('Product', ProductSchema);
exports.default = exports.Product;
