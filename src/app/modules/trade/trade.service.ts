import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { TradeOffer } from './trade.model'
import { ITradeOffer } from './trade.interface'
import { Product } from '../product/product.model'
import { Message } from '../message/message.model'
import { Chat } from '../chat/chat.model'
import { Types } from 'mongoose'
import { io } from '../../../server'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'
import { User } from '../user/user.model'
import stripe from '../../../config/stripe'

const createTradeOffer = async (
  payload: Partial<ITradeOffer>,
): Promise<ITradeOffer> => {
  const { senderProductId, receiverProductId, senderId, receiverId } = payload

  const senderProduct = await Product.findById(senderProductId)
  const receiverProduct = await Product.findById(receiverProductId)

  if (!senderProduct || !receiverProduct) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'One or both of the products were not found.',
    )
  }

  // Allow trade/offer if sender allows trade, and receiver allows trade or offers
  const isSenderTradeAllowed = senderProduct.allowTrade
  const isReceiverTradeOrOfferAllowed = receiverProduct.allowTrade || receiverProduct.allowOffers

  if (!isSenderTradeAllowed || !isReceiverTradeOrOfferAllowed) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'One or both items are not configured to allow trading or custom offers.',
    )
  }

  // Validate minimum offer amount if configured on receiver product
  if (receiverProduct.allowOffers && receiverProduct.minOfferAmount && receiverProduct.minOfferAmount > 0) {
    const totalOfferValue = (senderProduct.estValue || 0) + (payload.cashSupplement || 0)
    if (totalOfferValue < receiverProduct.minOfferAmount) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Your offer total value ($${totalOfferValue}) is below the seller's minimum acceptable offer ($${receiverProduct.minOfferAmount}).`,
      )
    }
  }

  if (
    senderProduct.status !== 'active' ||
    receiverProduct.status !== 'active'
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'One or both products are not currently active.',
    )
  }

  payload.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  payload.status = 'pending'
  payload.escrowStatus = 'pending'

  const offer = (await TradeOffer.create(payload)) as any

  // Find existing chat between sender and receiver using participants array
  let chat = await Chat.findOne({
    participants: { $all: [senderId, receiverId] },
  })

  if (!chat) {
    chat = await Chat.create({
      participants: [senderId, receiverId],
    })
  }

  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: senderId,
      text: `Proposed a new trade swap offer: ${senderProduct.title} for ${receiverProduct.title}.`,
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: 'NEW TRADE OFFER 🎁',
        eta: '24 Hours Expire',
      },
    })
  }

  return offer
}

const getTradeOffers = async (
  userId: string,
  type: 'sent' | 'received',
): Promise<ITradeOffer[]> => {
  const query: any = {}
  if (type === 'sent') {
    query.senderId = new Types.ObjectId(userId)
  } else {
    query.receiverId = new Types.ObjectId(userId)
  }

  return await TradeOffer.find(query)
    .populate('senderId', 'name fullName email image photo')
    .populate('receiverId', 'name fullName email image photo')
    .populate('senderProductId')
    .populate('receiverProductId')
}

const acceptTradeOffer = async (offerId: string): Promise<ITradeOffer> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID')
  }

  const offer = (await TradeOffer.findById(offerId)) as any
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }

  if (offer.status !== 'pending') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This offer is no longer pending.',
    )
  }

  const session = await TradeOffer.startSession()
  session.startTransaction()

  try {
    offer.status = 'accepted'
    offer.escrowStatus = 'held'
    await offer.save({ session })

    await Product.findByIdAndUpdate(
      offer.senderProductId,
      { status: 'pending' },
      { session },
    )
    await Product.findByIdAndUpdate(
      offer.receiverProductId,
      { status: 'pending' },
      { session },
    )

    // Use participants[] array — consistent with Chat model schema
    let chat = await Chat.findOne({
      participants: { $all: [offer.senderId, offer.receiverId] },
    })

    if (!chat) {
      const createdChats = await Chat.create(
        [{ participants: [offer.senderId, offer.receiverId] }],
        { session },
      )
      chat = createdChats[0]
    }

    if (chat) {
      await Message.create(
        [
          {
            chatId: chat._id,
            sender: offer.receiverId,
            text: 'Accepted the trade swap offer! Escrow service is now Active & Secured.',
            messageType: 'trade_proposal',
            seen: false,
            metadata: {
              tradeOfferId: offer._id.toString(),
              statusLabel: 'TRADE ACCEPTED 🤝',
            },
          },
        ],
        { session },
      )
    }

    await session.commitTransaction()

    // Notify sender via socket + push
    if (io) {
      io.to(offer.senderId.toString()).emit('trade-accepted', {
        tradeOfferId: offer._id.toString(),
        message: 'Your trade offer was accepted! 🤝',
      })
    }
    const senderUser = await User.findById(offer.senderId).select('deviceToken')
    if (senderUser?.deviceToken) {
      await sendPushNotification(
        senderUser.deviceToken,
        'Trade Accepted 🤝',
        'Your trade offer was accepted! Escrow is now active.',
        { type: 'TRADE_ACCEPTED', tradeOfferId: offer._id.toString() },
      ).catch(() => {/* non-blocking */})
    }

    return offer
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

const declineTradeOffer = async (offerId: string): Promise<ITradeOffer> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID')
  }

  const offer = (await TradeOffer.findById(offerId)) as any
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }

  if (offer.status !== 'pending') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This offer is no longer pending.',
    )
  }

  offer.status = 'declined'
  await offer.save()

  // Use participants[] array — consistent with Chat model schema
  const chat = await Chat.findOne({
    participants: { $all: [offer.senderId, offer.receiverId] },
  })

  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: offer.receiverId,
      text: 'Declined the trade swap offer.',
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: 'TRADE DECLINED ❌',
      },
    })
  }

  // Notify sender
  if (io) {
    io.to(offer.senderId.toString()).emit('trade-declined', {
      tradeOfferId: offer._id.toString(),
      message: 'Your trade offer was declined ❌',
    })
  }
  const senderUser = await User.findById(offer.senderId).select('deviceToken')
  if (senderUser?.deviceToken) {
    await sendPushNotification(
      senderUser.deviceToken,
      'Trade Declined ❌',
      'Your trade offer was declined.',
      { type: 'TRADE_DECLINED', tradeOfferId: offer._id.toString() },
    ).catch(() => {/* non-blocking */})
  }

  return offer
}

// ─── Trade Complete: ownership swap + escrow release ───────────────────────
const completeTradeOffer = async (
  offerId: string,
  userId: string,
): Promise<ITradeOffer | { clientSecret: string; ephemeralKey: string; customer: string; publishableKey?: string }> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID')
  }

  const offer = (await TradeOffer.findById(offerId)
    .populate('senderProductId')
    .populate('receiverProductId')) as any

  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }

  if (offer.status !== 'accepted') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only accepted trade offers can be completed.',
    )
  }

  // Authorization: only sender or receiver can complete
  const isSender = offer.senderId.toString() === userId
  const isReceiver = offer.receiverId.toString() === userId
  if (!isSender && !isReceiver) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not authorized to complete this trade.',
    )
  }

  if (offer.cashSupplement && offer.cashSupplement !== 0) {
    const payerId = offer.cashSupplement > 0 ? offer.senderId : offer.receiverId
    const payerUser = await User.findById(payerId).select('email stripeCustomerId')

    if (!payerUser?.email) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Payer user email not found')
    }

    let customerId = payerUser.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({ email: payerUser.email })
      customerId = customer.id
      payerUser.stripeCustomerId = customerId
      await payerUser.save()
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    )

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Math.abs(offer.cashSupplement) * 100),
      currency: 'usd',
      customer: customerId,
      metadata: {
        purchaseType: 'trade_supplement',
        tradeOfferId: offer._id.toString(),
        senderId: offer.senderId.toString(),
        receiverId: offer.receiverId.toString(),
        senderProductId: offer.senderProductId._id.toString(),
        receiverProductId: offer.receiverProductId._id.toString(),
      },
    })

    return { 
      clientSecret: paymentIntent.client_secret as string,
      ephemeralKey: ephemeralKey.secret as string,
      customer: customerId,
    }
  }

  // ── No cash supplement: complete immediately ────────────────────────────
  const session = await TradeOffer.startSession()
  session.startTransaction()

  try {
    // Swap product ownership
    await Product.findByIdAndUpdate(
      offer.senderProductId._id,
      { sellerId: offer.receiverId, status: 'active' },
      { session },
    )
    await Product.findByIdAndUpdate(
      offer.receiverProductId._id,
      { sellerId: offer.senderId, status: 'active' },
      { session },
    )

    // Update offer
    offer.status = 'completed'
    offer.escrowStatus = 'released'
    await offer.save({ session })

    // Chat message
    const chat = await Chat.findOne({
      participants: { $all: [offer.senderId, offer.receiverId] },
    })
    if (chat) {
      await Message.create(
        [
          {
            chatId: chat._id,
            sender: userId,
            text: 'Trade completed! Items have been exchanged. ✅',
            messageType: 'trade_proposal',
            seen: false,
            metadata: {
              tradeOfferId: offer._id.toString(),
              statusLabel: 'TRADE COMPLETED ✅',
            },
          },
        ],
        { session },
      )
    }

    await session.commitTransaction()

    // Notify both parties
    const notifyIds = [offer.senderId.toString(), offer.receiverId.toString()]
    notifyIds.forEach(uid => {
      if (io) {
        io.to(uid).emit('trade-completed', {
          tradeOfferId: offer._id.toString(),
          message: 'Trade completed! Ownership transferred. ✅',
        })
      }
    })

    return offer
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

export const TradeServices = {
  createTradeOffer,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
  completeTradeOffer,
}
