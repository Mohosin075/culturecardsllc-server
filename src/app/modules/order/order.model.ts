import { Schema, model } from 'mongoose'
import { IOrder } from './order.interface'

const OrderSchema = new Schema<IOrder>(
  {
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    tradeOfferId: {
      type: Schema.Types.ObjectId,
      ref: 'TradeOffer',
    },
    purchaseType: {
      type: String,
      enum: ['auction_win', 'buy_now', 'trade_swap'],
      required: true,
    },
    amountDetails: {
      itemSubtotal: { type: Number, required: true, min: 0 },
      shipping: { type: Number, default: 0, min: 0 },
      taxes: { type: Number, default: 0, min: 0 },
      processingFee: { type: Number, default: 0, min: 0 },
      charityContribution: { type: Number, default: 0, min: 0 },
      totalPaid: { type: Number, required: true, min: 0 },
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentIntentId: {
      type: String,
    },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
      index: true,
    },
    trackingDetails: {
      carrier: { type: String },
      trackingNumber: { type: String },
      estimatedDelivery: { type: Date },
      journeyUpdates: [
        {
          status: { type: String, required: true },
          description: { type: String, required: true },
          location: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

export const Order = model<IOrder>('Order', OrderSchema)
export default Order
