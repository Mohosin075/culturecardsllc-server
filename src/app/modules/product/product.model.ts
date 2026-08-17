import { Schema, model } from 'mongoose'
import { IProduct } from './product.interface'

const ProductSchema = new Schema<IProduct>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

export const Product = model<IProduct>('Product', ProductSchema)
export default Product
