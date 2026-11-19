import { Model, Types } from 'mongoose'

/**
 * The client's spec: "Buyers request refunds through ARIES. ARIES reviews and
 * approves or rejects refund requests. Once approved, Stripe processes the
 * refund and deducts the refunded amount from the seller's available balance."
 *
 * So a refund is a request first and a Stripe call second — the buyer never
 * triggers a reversal directly.
 */
export type IRefundRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'failed'

export type IRefundReason =
  | 'item_not_received'
  | 'not_as_described'
  | 'damaged'
  | 'wrong_item'
  | 'other'

export type IRefundRequest = {
  _id: Types.ObjectId
  orderId: Types.ObjectId
  buyerId: Types.ObjectId
  sellerId: Types.ObjectId
  reason: IRefundReason
  /** The buyer's own description of the problem. */
  details?: string
  /** Photos the buyer attached as evidence. */
  evidenceUrls: string[]
  /** Dollars. Defaults to the order total. */
  requestedAmount: number
  status: IRefundRequestStatus
  /** Set once Stripe has reversed the charge. */
  refundId?: string
  refundedAmount?: number
  /** Which account the reversal was issued on. */
  stripeAccountId?: string
  /** Why an admin said no, or why Stripe refused. */
  decisionNote?: string
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type RefundRequestModel = Model<IRefundRequest>

/**
 * A Stripe dispute (chargeback) mirrored locally.
 *
 * On direct charges the dispute belongs to the seller's connected account and
 * the money is taken from their balance, which is the liability split the
 * client asked for. ARIES only needs to know it happened.
 */
export type IDisputeRecord = {
  _id: Types.ObjectId
  stripeDisputeId: string
  stripeChargeId?: string
  paymentIntentId?: string
  /** The connected account the dispute was raised against. */
  stripeAccountId?: string
  orderId?: Types.ObjectId
  sellerId?: Types.ObjectId
  buyerId?: Types.ObjectId
  amount: number
  currency: string
  reason?: string
  /** Stripe's own status: needs_response, under_review, won, lost… */
  status: string
  /** When Stripe stops accepting evidence. */
  evidenceDueBy?: Date
  closedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type DisputeRecordModel = Model<IDisputeRecord>
