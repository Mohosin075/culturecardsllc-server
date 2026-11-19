import { Schema, model } from 'mongoose'
import {
  DisputeRecordModel,
  IDisputeRecord,
  IRefundRequest,
  RefundRequestModel,
} from './refund.interface'

const RefundRequestSchema = new Schema<IRefundRequest>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      // Indexed by the partial unique index below, not here.
    },
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
    reason: {
      type: String,
      enum: [
        'item_not_received',
        'not_as_described',
        'damaged',
        'wrong_item',
        'other',
      ],
      required: true,
    },
    details: { type: String, maxlength: 2000 },
    evidenceUrls: { type: [String], default: [] },
    requestedAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    refundId: { type: String },
    refundedAmount: { type: Number, min: 0 },
    stripeAccountId: { type: String },
    decisionNote: { type: String, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
)

// One live request per order: a buyer should not be able to queue several
// refunds for the same purchase, but may try again after a rejection.
RefundRequestSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)

export const RefundRequest = model<IRefundRequest, RefundRequestModel>(
  'RefundRequest',
  RefundRequestSchema,
)

const DisputeRecordSchema = new Schema<IDisputeRecord>(
  {
    stripeDisputeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripeChargeId: { type: String },
    paymentIntentId: { type: String, index: true },
    stripeAccountId: { type: String, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'usd' },
    reason: { type: String },
    status: { type: String, required: true, index: true },
    evidenceDueBy: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true },
)

export const DisputeRecord = model<IDisputeRecord, DisputeRecordModel>(
  'DisputeRecord',
  DisputeRecordSchema,
)

export default RefundRequest
