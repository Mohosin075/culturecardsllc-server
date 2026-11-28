import { StatusCodes } from 'http-status-codes'
import { JwtPayload } from 'jsonwebtoken'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import config from '../../../config'
import ApiError from '../../../errors/ApiError'
import { LiveStream } from '../auction/auction.model'
import { User } from '../user/user.model'
import { Tip } from './tip.model'
import { ITip } from './tip.interface'
import { io } from '../../../server'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'

const STRIPE_PERCENT_FEE = 0.029
const STRIPE_FIXED_FEE_CENTS = 30

/**
 * No platform fee on tips (0%). The tipper covers the Stripe card processing
 * fee (2.9% + $0.30 gross-up) so the seller retains 100% of the tip amount.
 */
const calculateTipFees = (rawAmount: number) => {
  const tipAmountCents = Math.round(rawAmount * 100)
  const totalChargeCents = Math.ceil(
    (tipAmountCents + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PERCENT_FEE),
  )
  const processingFeeCents = totalChargeCents - tipAmountCents

  return {
    tipAmount: Number((tipAmountCents / 100).toFixed(2)),
    processingFee: Number((processingFeeCents / 100).toFixed(2)),
    platformFee: 0,
    totalCharged: Number((totalChargeCents / 100).toFixed(2)),
    sellerNetAmount: Number((tipAmountCents / 100).toFixed(2)),
    tipAmountCents,
    processingFeeCents,
    totalChargeCents,
  }
}

const getOrCreateStripeCustomer = async (userData: any): Promise<string> => {
  let customerId = userData.stripeCustomerId
  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId)
    } catch (err: any) {
      if (err.raw?.type === 'invalid_request_error' || err.message?.includes('No such customer')) {
        customerId = undefined
      } else {
        throw err
      }
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.email,
      name: userData.fullName || userData.name || undefined,
      metadata: { userId: userData._id.toString() },
    })
    customerId = customer.id
    await User.findByIdAndUpdate(userData._id, { stripeCustomerId: customerId })
  }
  return customerId
}

/**
 * 1. Create a PaymentIntent or execute a 1-tap saved card tip
 */
const createTipIntent = async (
  user: JwtPayload,
  payload: {
    streamId: string
    amount: number
    paymentMethodId?: string
    message?: string
  },
) => {
  const { streamId, amount, paymentMethodId, message } = payload

  if (!Types.ObjectId.isValid(streamId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid streamId.')
  }

  const stream = await LiveStream.findById(streamId)
  if (!stream) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Live stream not found.')
  }

  const sender = await User.findById(user.userId)
  if (!sender) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Sender user not found.')
  }

  const sellerId = stream.sellerId
  if (String(sellerId) === String(user.userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot tip your own show.')
  }
  const senderName = sender.fullName || sender.name || 'A Supporter'
  const senderImage = sender.profile || (sender as any).image || (sender as any).photo || ''

  const customerId = await getOrCreateStripeCustomer(sender)
  const fees = calculateTipFees(amount)

  // A. 1-Tap Saved Card Charge (user pays tip + Stripe processing fee; 0% platform fee)
  if (paymentMethodId) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: fees.totalChargeCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `Tip for Live Show: ${stream.title}`,
        metadata: {
          type: 'live_stream_tip',
          streamId,
          senderId: user.userId,
          sellerId: sellerId.toString(),
          message: message || '',
          tipAmount: fees.tipAmount.toFixed(2),
          processingFee: fees.processingFee.toFixed(2),
          platformFee: '0.00',
          totalCharged: fees.totalCharged.toFixed(2),
          sellerNetAmount: fees.sellerNetAmount.toFixed(2),
        },
      })

      if (intent.status === 'succeeded') {
        const tipRecord = await Tip.create({
          streamId: new Types.ObjectId(streamId),
          senderId: new Types.ObjectId(user.userId),
          sellerId: new Types.ObjectId(sellerId.toString()),
          amount: fees.tipAmount,
          processingFee: fees.processingFee,
          platformFee: 0,
          totalCharged: fees.totalCharged,
          sellerNetAmount: fees.sellerNetAmount,
          currency: 'USD',
          paymentIntentId: intent.id,
          status: 'succeeded',
          senderName,
          senderImage,
          message: message?.trim(),
        })

        await _broadcastTipSuccess({
          stream,
          tip: tipRecord,
          senderName,
          senderImage,
          amount: fees.tipAmount,
          message: message?.trim(),
          senderId: user.userId,
        })

        return {
          status: 'succeeded',
          tipId: tipRecord._id,
          amount: fees.tipAmount,
          processingFee: fees.processingFee,
          platformFee: 0,
          totalCharged: fees.totalCharged,
          sellerNetAmount: fees.sellerNetAmount,
          currency: 'USD',
        }
      } else {
        return {
          status: intent.status,
          paymentIntentId: intent.id,
          clientSecret: intent.client_secret,
          amount: fees.tipAmount,
          processingFee: fees.processingFee,
          platformFee: 0,
          totalCharged: fees.totalCharged,
          sellerNetAmount: fees.sellerNetAmount,
        }
      }
    } catch (err: any) {
      throw new ApiError(StatusCodes.PAYMENT_REQUIRED, err.message || 'Payment failed.')
    }
  }

  // B. PaymentSheet / New Card Intent
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2024-06-20' },
  )

  const paymentIntent = await stripe.paymentIntents.create({
    amount: fees.totalChargeCents,
    currency: 'usd',
    customer: customerId,
    payment_method_types: ['card'],
    description: `Tip for Live Show: ${stream.title}`,
    metadata: {
      type: 'live_stream_tip',
      streamId,
      senderId: user.userId,
      sellerId: sellerId.toString(),
      message: message || '',
      tipAmount: fees.tipAmount.toFixed(2),
      processingFee: fees.processingFee.toFixed(2),
      platformFee: '0.00',
      totalCharged: fees.totalCharged.toFixed(2),
      sellerNetAmount: fees.sellerNetAmount.toFixed(2),
    },
  })

  return {
    status: 'requires_payment_method',
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    ephemeralKey: ephemeralKey.secret,
    customerId,
    amount: fees.tipAmount,
    processingFee: fees.processingFee,
    platformFee: 0,
    totalCharged: fees.totalCharged,
    sellerNetAmount: fees.sellerNetAmount,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51NJLdJF5nDLFMGmox0iseTJZp42wfLi6Ub41OGs7hoMl0GSFe93a0My7PxdF2eKsxV1rvUf8vVw4p6jl9h9pCmEQ00WSln5w44',
  }
}

/**
 * 2. Confirm PaymentSheet Tip after Stripe client confirmation
 */
const confirmTip = async (
  user: JwtPayload,
  payload: {
    streamId: string
    paymentIntentId: string
    amount: number
    message?: string
  },
) => {
  const { streamId, paymentIntentId, amount, message } = payload

  const existingTip = await Tip.findOne({ paymentIntentId })
  if (existingTip && existingTip.status === 'succeeded') {
    return existingTip
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (intent.status !== 'succeeded') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Payment is not complete (Stripe status: ${intent.status}).`,
    )
  }

  const stream = await LiveStream.findById(streamId)
  if (!stream) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Live stream not found.')
  }

  const sender = await User.findById(user.userId)
  const senderName = sender?.fullName || sender?.name || 'A Supporter'
  const senderImage = sender?.profile || (sender as any)?.image || (sender as any)?.photo || ''

  // Use trusted amounts from Stripe PaymentIntent metadata when present
  const metaTipAmount = Number(intent.metadata?.tipAmount)
  const tipAmount = Number.isFinite(metaTipAmount) && metaTipAmount > 0 ? metaTipAmount : amount
  const computedFees = calculateTipFees(tipAmount)
  const metaProcessingFee = Number(intent.metadata?.processingFee)
  const processingFee =
    Number.isFinite(metaProcessingFee) && metaProcessingFee >= 0
      ? metaProcessingFee
      : computedFees.processingFee
  const totalCharged = Number((intent.amount / 100).toFixed(2))

  const tipRecord = await Tip.findOneAndUpdate(
    { paymentIntentId },
    {
      streamId: new Types.ObjectId(streamId),
      senderId: new Types.ObjectId(user.userId),
      sellerId: stream.sellerId,
      amount: tipAmount,
      processingFee,
      platformFee: 0,
      totalCharged,
      sellerNetAmount: tipAmount,
      currency: 'USD',
      paymentIntentId,
      status: 'succeeded',
      senderName,
      senderImage,
      message: message?.trim(),
    },
    { upsert: true, new: true },
  )

  await _broadcastTipSuccess({
    stream,
    tip: tipRecord,
    senderName,
    senderImage,
    amount: tipAmount,
    message: message?.trim(),
    senderId: user.userId,
  })

  return tipRecord
}

/**
 * Helper to update stream counter, broadcast socket event, and send push notification
 */
const _broadcastTipSuccess = async (data: {
  stream: any
  tip: ITip
  senderName: string
  senderImage: string
  amount: number
  message?: string
  senderId: string
}) => {
  const { stream, tip, senderName, senderImage, amount, message, senderId } = data
  const streamIdStr = stream._id.toString()

  // 1. Update LiveStream totals atomically
  await LiveStream.findByIdAndUpdate(stream._id, {
    $inc: { tipsTotal: amount, tipsCount: 1 },
    $push: {
      chatMessages: {
        _id: new Types.ObjectId(),
        user: senderName,
        userId: new Types.ObjectId(senderId),
        message: `💛 Sent a $${amount.toFixed(2)} Tip!${message ? ' "' + message + '"' : ''}`,
        timestamp: new Date(),
        likedBy: [],
      },
    },
  })

  // 2. Broadcast real-time Socket Event to all participants in stream room
  if (io) {
    io.to(`stream:${streamIdStr}`).emit('stream-tip', {
      streamId: streamIdStr,
      tipId: tip._id.toString(),
      amount,
      sender: {
        _id: senderId,
        name: senderName,
        image: senderImage,
      },
      message: message || '',
      timestamp: new Date(),
    })
  }

  // 3. Send Push Notification to Seller
  try {
    const seller = await User.findById(stream.sellerId)
    if (seller?.deviceToken) {
      await sendPushNotification(
        seller.deviceToken,
        'New Tip Received! 💛',
        `${senderName} tipped you $${amount.toFixed(2)} on "${stream.title}"!`,
        {
          type: 'live_tip',
          streamId: streamIdStr,
          tipId: tip._id.toString(),
          amount: amount.toString(),
        },
      )
    }
  } catch (_) {}
}

/**
 * 3. Get all tips for a specific stream
 */
const getStreamTips = async (streamId: string) => {
  if (!Types.ObjectId.isValid(streamId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid streamId.')
  }
  return await Tip.find({ streamId, status: 'succeeded' }).sort({ createdAt: -1 })
}

/**
 * 4. Get tips received by the authenticated seller (with total earnings)
 */
const getMySellerTips = async (userId: string) => {
  const tips = await Tip.find({
    sellerId: new Types.ObjectId(userId),
    status: 'succeeded',
  })
    .populate('streamId', 'title coverImage')
    .sort({ createdAt: -1 })

  const totalEarnings = tips.reduce(
    (sum, item) => sum + (item.sellerNetAmount || item.amount || 0),
    0,
  )

  return {
    totalEarnings: Number(totalEarnings.toFixed(2)),
    totalCount: tips.length,
    tips,
  }
}

/**
 * 5. Admin: every tip on the platform, newest first, with totals.
 */
const getAllTipsForAdmin = async (query: Record<string, any>) => {
  const page = Math.max(parseInt(query.page) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100)
  const filter: Record<string, any> = {}
  if (['pending', 'succeeded', 'failed'].includes(query.status)) {
    filter.status = query.status
  }
  if (query.streamId && Types.ObjectId.isValid(query.streamId)) {
    filter.streamId = new Types.ObjectId(query.streamId)
  }

  const [tips, total, totals] = await Promise.all([
    Tip.find(filter)
      .populate('streamId', 'title coverImage')
      .populate('sellerId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Tip.countDocuments(filter),
    Tip.aggregate([
      { $match: { status: 'succeeded' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          tipped: { $sum: '$amount' },
          platformFees: { $sum: '$platformFee' },
          processingFees: { $sum: '$processingFee' },
          sellerNet: { $sum: '$sellerNetAmount' },
        },
      },
    ]),
  ])

  const t = totals[0] || {}
  const round = (n?: number) => Number((n || 0).toFixed(2))
  return {
    summary: {
      count: t.count || 0,
      tipped: round(t.tipped),
      platformFees: round(t.platformFees),
      processingFees: round(t.processingFees),
      sellerNet: round(t.sellerNet),
    },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    tips,
  }
}

export const TipServices = {
  getAllTipsForAdmin,
  createTipIntent,
  confirmTip,
  getStreamTips,
  getMySellerTips,
}
