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
    streamId: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      index: true,
    },
    isGiveaway: {
      type: Boolean,
      default: false,
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
    // Which Stripe account the charge lives on; refunds go back to the same
    // place. Unset for platform-side payments.
    stripeAccountId: {
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
    // The seller must ship by this date. Past it, the order is cancelled and
    // the buyer refunded automatically (see orderShipDeadlineCron).
    shipByDate: {
      type: Date,
      index: true,
    },
    cancelReason: {
      type: String,
    },
    trackingDetails: {
      carrier: { type: String },
      trackingNumber: { type: String, index: true },
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
    shippingWeight: {
      type: Number,
      default: 0,
    },
    shippingLabelUrl: {
      type: String,
    },
    shippingService: {
      type: String,
    },
    bundledWithOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    shipment: {
      provider: { type: String, enum: ['mock', 'easypost'] },
      shipmentId: { type: String },
      rateId: { type: String },
      carrier: { type: String },
      service: { type: String },
      labelCost: { type: Number },
      trackerId: { type: String },
      trackingStatus: { type: String },
      purchasedAt: { type: Date },
      refundedAt: { type: Date },
    },
    spinWheelPrize: {
      type: String,
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
