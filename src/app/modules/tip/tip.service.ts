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
  const senderName = sender.fullName || sender.name || 'A Supporter'
  const senderImage = sender.profile || (sender as any).image || (sender as any).photo || ''

  const customerId = await getOrCreateStripeCustomer(sender)
  const tipAmountCents = Math.round(amount * 100)

  // A. 1-Tap Saved Card Charge
  if (paymentMethodId) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: tipAmountCents,
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
        },
      })

      if (intent.status === 'succeeded') {
        const tipRecord = await Tip.create({
          streamId: new Types.ObjectId(streamId),
          senderId: new Types.ObjectId(user.userId),
          sellerId: new Types.ObjectId(sellerId.toString()),
          amount,
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
          amount,
          message: message?.trim(),
          senderId: user.userId,
        })

        return {
          status: 'succeeded',
          tipId: tipRecord._id,
          amount,
          currency: 'USD',
        }
      } else {
        return {
          status: intent.status,
          paymentIntentId: intent.id,
          clientSecret: intent.client_secret,
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
    amount: tipAmountCents,
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
    },
  })

  return {
    status: 'requires_payment_method',
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    ephemeralKey: ephemeralKey.secret,
    customerId,
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

  const tipRecord = await Tip.findOneAndUpdate(
    { paymentIntentId },
    {
      streamId: new Types.ObjectId(streamId),
      senderId: new Types.ObjectId(user.userId),
      sellerId: stream.sellerId,
      amount,
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
    amount,
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

  const totalEarnings = tips.reduce((sum, item) => sum + (item.amount || 0), 0)

  return {
    totalEarnings: Number(totalEarnings.toFixed(2)),
    totalCount: tips.length,
    tips,
  }
}

export const TipServices = {
  createTipIntent,
  confirmTip,
  getStreamTips,
  getMySellerTips,
}
