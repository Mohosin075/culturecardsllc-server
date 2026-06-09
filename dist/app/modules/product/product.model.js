'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Product = void 0
const mongoose_1 = require('mongoose')
const ProductSchema = new mongoose_1.Schema(
  {
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
      type: String,
      enum: [
        'Fine Art',
        'Sports Cards',
        'Rare Spirits',
        'Luxury Cars',
        'Electronics',
        'Streetwear',
        'TCG',
        'Digital Assets',
      ],
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
    allowTrade: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)
exports.Product = (0, mongoose_1.model)('Product', ProductSchema)
exports.default = exports.Product
