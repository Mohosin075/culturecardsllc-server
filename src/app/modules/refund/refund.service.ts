import { StatusCodes } from 'http-status-codes'
import { JwtPayload } from 'jsonwebtoken'
import { Types } from 'mongoose'
import Stripe from 'stripe'
import ApiError from '../../../errors/ApiError'
import { Order } from '../order/order.model'
import { MarketplaceCharge } from '../payment/marketplaceCharge'
import { Payment } from '../payment/payment.model'
import { Product } from '../product/product.model'
import { DisputeRecord, RefundRequest } from './refund.model'
import { IRefundReason, IRefundRequest } from './refund.interface'

/** Stripe only accepts its own small set of reason codes. */
const toStripeReason = (
  reason: IRefundReason,
): Stripe.RefundCreateParams.Reason => {
  switch (reason) {
    case 'other':
      return 'requested_by_customer'
    default:
      return 'requested_by_customer'
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Buyer side
// ────────────────────────────────────────────────────────────────────────────

const createRefundRequest = async (
  user: JwtPayload,
  payload: {
    orderId: string
    reason: IRefundReason
    details?: string
    evidenceUrls?: string[]
    requestedAmount?: number
  },
): Promise<IRefundRequest> => {
  if (!Types.ObjectId.isValid(payload.orderId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid order id.')
  }

  const order = await Order.findById(payload.orderId)
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.')
  }

  if (order.buyerId.toString() !== user.userId.toString()) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You can only request a refund for your own order.',
    )
  }

  if (order.paymentStatus !== 'paid') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      order.paymentStatus === 'refunded'
        ? 'This order has already been refunded.'
        : 'This order has not been paid, so there is nothing to refund.',
    )
  }

  const existing = await RefundRequest.findOne({
    orderId: order._id,
    status: 'pending',
  })
  if (existing) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'A refund request for this order is already being reviewed.',
    )
  }

  const orderTotal = Number(order.amountDetails?.totalPaid || 0)
  const requested = Number(payload.requestedAmount ?? orderTotal)

  if (requested <= 0 || requested > orderTotal + 0.005) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Refund amount must be between $0 and the order total of $${orderTotal.toFixed(2)}.`,
    )
  }

  return RefundRequest.create({
    orderId: order._id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    reason: payload.reason,
    details: payload.details,
    evidenceUrls: payload.evidenceUrls || [],
    requestedAmount: requested,
    status: 'pending',
  })
}

/** The buyer's own requests, newest first. */
const getMyRefundRequests = async (
  user: JwtPayload,
): Promise<IRefundRequest[]> =>
  RefundRequest.find({ buyerId: user.userId })
    .populate('orderId', 'amountDetails deliveryStatus productId')
    .sort({ createdAt: -1 })

/** A seller sees refunds raised against their own sales. */
const getRefundRequestsForSeller = async (
  user: JwtPayload,
): Promise<IRefundRequest[]> =>
  RefundRequest.find({ sellerId: user.userId })
    .populate('orderId', 'amountDetails deliveryStatus productId')
    .populate('buyerId', 'name fullName email profile')
    .sort({ createdAt: -1 })

// ────────────────────────────────────────────────────────────────────────────
// Admin side
// ────────────────────────────────────────────────────────────────────────────

const listRefundRequestsForAdmin = async (
  query: Record<string, any>,
): Promise<any[]> => {
  const filter: Record<string, any> = {}
  if (query.status) filter.status = query.status

  const requests = await RefundRequest.find(filter)
    .populate('buyerId', 'name fullName email profile')
    .populate('sellerId', 'name fullName email profile')
    .populate('orderId', 'amountDetails deliveryStatus paymentIntentId')
    .sort({ createdAt: -1 })
    .limit(Number(query.limit) || 100)

  return requests.map((r: any) => ({
    id: r._id.toString(),
    orderId: r.orderId?._id?.toString() || r.orderId?.toString(),
    buyer: {
      id: r.buyerId?._id?.toString(),
      name: r.buyerId?.fullName || r.buyerId?.name || 'Buyer',
      email: r.buyerId?.email,
    },
    seller: {
      id: r.sellerId?._id?.toString(),
      name: r.sellerId?.fullName || r.sellerId?.name || 'Seller',
      email: r.sellerId?.email,
    },
    reason: r.reason,
    details: r.details,
    evidenceUrls: r.evidenceUrls || [],
    requestedAmount: r.requestedAmount,
    orderTotal: r.orderId?.amountDetails?.totalPaid ?? null,
    deliveryStatus: r.orderId?.deliveryStatus ?? null,
    status: r.status,
    decisionNote: r.decisionNote,
    refundedAmount: r.refundedAmount,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
  }))
}

/**
 * Approve a refund: reverse the charge on whichever account it was made on.
 *
 * On a marketplace sale that is the seller's connected account, so the money
 * comes out of the seller's balance — exactly what the spec asks. ARIES's
 * application fee is handed back too on a full refund, so a reversed sale
 * earns the platform nothing; on a partial refund the fee is kept, since the
 * sale did partly happen.
 */
const approveRefundRequest = async (
  requestId: string,
  adminId: string,
  options: { amount?: number; note?: string } = {},
): Promise<IRefundRequest> => {
  const request = await RefundRequest.findById(requestId)
  if (!request) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Refund request not found.')
  }
  if (request.status !== 'pending') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `This request has already been ${request.status}.`,
    )
  }

  const order = await Order.findById(request.orderId)
  if (!order?.paymentIntentId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This order has no payment on record, so it cannot be refunded.',
    )
  }

  const orderTotal = Number(order.amountDetails?.totalPaid || 0)
  const amount = Number(options.amount ?? request.requestedAmount)

  if (amount <= 0 || amount > orderTotal + 0.005) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Refund amount must be between $0 and the order total of $${orderTotal.toFixed(2)}.`,
    )
  }

  const stripeAccountId =
    order.stripeAccountId ||
    (await MarketplaceCharge.findSellerAccountId(order.sellerId?.toString()))

  const isFullRefund = amount >= orderTotal - 0.005

  try {
    const refund = await MarketplaceCharge.refundMarketplacePayment({
      paymentIntentId: order.paymentIntentId,
      stripeAccountId,
      amount,
      reason: toStripeReason(request.reason),
      refundApplicationFee: isFullRefund,
    })

    request.refundId = refund.id
    request.refundedAmount = amount
    request.stripeAccountId = stripeAccountId || undefined
    request.status = 'approved'
  } catch (error: any) {
    // Record the failure instead of leaving the request stuck as pending,
    // so an admin can see why and retry.
    request.status = 'failed'
    request.decisionNote = `Stripe refused the refund: ${error?.message || 'unknown error'}`
    request.reviewedBy = new Types.ObjectId(adminId)
    request.reviewedAt = new Date()
    await request.save()

    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      `Could not refund this order: ${error?.message}. The request has been marked failed.`,
    )
  }

  if (options.note) request.decisionNote = options.note
  request.reviewedBy = new Types.ObjectId(adminId)
  request.reviewedAt = new Date()
  await request.save()

  // Keep the order and the payment record in step with the money.
  order.paymentStatus = isFullRefund ? 'refunded' : order.paymentStatus
  if (isFullRefund && order.deliveryStatus !== 'delivered') {
    order.deliveryStatus = 'cancelled'
    order.cancelReason = 'Refunded by ARIES'
  }
  await order.save()

  await Payment.updateOne(
    { paymentIntentId: order.paymentIntentId },
    {
      $set: {
        status: isFullRefund ? 'refunded' : 'succeeded',
        refundAmount: amount,
        refundReason: request.reason,
      },
    },
  )

  // A fully refunded item goes back on sale.
  if (isFullRefund && order.productId) {
    await Product.updateOne(
      { _id: (order.productId as any)?._id ?? order.productId },
      { $inc: { stock: 1 }, $set: { status: 'active' } },
    ).catch(() => undefined)
  }

  return request
}

const rejectRefundRequest = async (
  requestId: string,
  adminId: string,
  note?: string,
): Promise<IRefundRequest> => {
  const request = await RefundRequest.findById(requestId)
  if (!request) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Refund request not found.')
  }
  if (request.status !== 'pending') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `This request has already been ${request.status}.`,
    )
  }

  request.status = 'rejected'
  request.decisionNote = note
  request.reviewedBy = new Types.ObjectId(adminId)
  request.reviewedAt = new Date()
  await request.save()

  return request
}

// ────────────────────────────────────────────────────────────────────────────
// Disputes (chargebacks)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mirror a Stripe dispute locally.
 *
 * On direct charges the dispute is raised against the seller's connected
 * account and Stripe takes the money from their balance, so ARIES is
 * recording rather than paying. `stripeAccountId` comes from the webhook
 * event's `account` field.
 */
const recordDisputeFromWebhook = async (
  dispute: Stripe.Dispute,
  stripeAccountId?: string,
): Promise<void> => {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id

  const order = paymentIntentId
    ? await Order.findOne({ paymentIntentId })
    : null

  const isClosed = ['won', 'lost', 'warning_closed'].includes(dispute.status)

  await DisputeRecord.findOneAndUpdate(
    { stripeDisputeId: dispute.id },
    {
      $set: {
        stripeChargeId:
          typeof dispute.charge === 'string'
            ? dispute.charge
            : dispute.charge?.id,
        paymentIntentId,
        stripeAccountId,
        orderId: order?._id,
        sellerId: order?.sellerId,
        buyerId: order?.buyerId,
        amount: dispute.amount / 100,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueBy: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000)
          : undefined,
        closedAt: isClosed ? new Date() : undefined,
      },
    },
    { upsert: true, new: true },
  )
}

const listDisputesForAdmin = async (
  query: Record<string, any>,
): Promise<any[]> => {
  const filter: Record<string, any> = {}
  if (query.status) filter.status = query.status

  const disputes = await DisputeRecord.find(filter)
    .populate('sellerId', 'name fullName email')
    .populate('buyerId', 'name fullName email')
    .sort({ createdAt: -1 })
    .limit(Number(query.limit) || 100)

  return disputes.map((d: any) => ({
    id: d._id.toString(),
    stripeDisputeId: d.stripeDisputeId,
    orderId: d.orderId?.toString(),
    seller: d.sellerId
      ? {
          id: d.sellerId._id?.toString(),
          name: d.sellerId.fullName || d.sellerId.name,
          email: d.sellerId.email,
        }
      : null,
    buyer: d.buyerId
      ? {
          id: d.buyerId._id?.toString(),
          name: d.buyerId.fullName || d.buyerId.name,
        }
      : null,
    amount: d.amount,
    currency: (d.currency || 'usd').toUpperCase(),
    reason: d.reason,
    status: d.status,
    evidenceDueBy: d.evidenceDueBy,
    // On direct charges the seller's balance is hit, not the platform's.
    liability: d.stripeAccountId ? 'seller' : 'platform',
    createdAt: d.createdAt,
  }))
}

/** A seller's own chargebacks, for their dashboard. */
const getDisputesForSeller = async (user: JwtPayload): Promise<any[]> =>
  DisputeRecord.find({ sellerId: user.userId }).sort({ createdAt: -1 })

export const RefundServices = {
  createRefundRequest,
  getMyRefundRequests,
  getRefundRequestsForSeller,
  listRefundRequestsForAdmin,
  approveRefundRequest,
  rejectRefundRequest,
  recordDisputeFromWebhook,
  listDisputesForAdmin,
  getDisputesForSeller,
}
