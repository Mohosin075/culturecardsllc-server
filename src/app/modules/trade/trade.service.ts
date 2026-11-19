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
import { TradeVoteServices } from './tradeVote.service'
import { PartnerService } from '../partner/partner.service'
import { TradeSettlementServices } from './tradeSettlement.service'

const createTradeOffer = async (
  payload: Partial<ITradeOffer>,
): Promise<ITradeOffer> => {
  const { senderProductId, receiverProductId, senderId, receiverId } = payload

  // Check if either user has blocked the other
  const isBlocked = await User.findOne({
    _id: { $in: [senderId, receiverId] },
    blockedUsers: { $in: [senderId, receiverId] },
  })
  if (isBlocked) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Cannot trade with this user due to block restrictions.',
    )
  }

  let senderProduct: any = null
  if (senderProductId) {
    senderProduct = await Product.findById(senderProductId)
    if (!senderProduct) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Sender product not found.')
    }
    if (!senderProduct.allowTrade) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'The offered item is not marked for trade.')
    }
    if (senderProduct.status !== 'active') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'The offered item is not currently active.')
    }
  } else {
    // Pure cash offer
    if (!payload.cashSupplement || payload.cashSupplement <= 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'A cash offer must specify a positive cash amount.')
    }
  }

  const receiverProduct = await Product.findById(receiverProductId)
  if (!receiverProduct) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Target product not found.')
  }

  const isReceiverTradeOrOfferAllowed = receiverProduct.allowTrade || receiverProduct.allowOffers
  if (!isReceiverTradeOrOfferAllowed) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This item is not configured to allow trading or custom offers.',
    )
  }

  // Validate minimum offer amount if configured on receiver product
  if (receiverProduct.allowOffers && receiverProduct.minOfferAmount && receiverProduct.minOfferAmount > 0) {
    const totalOfferValue = (senderProduct?.estValue || 0) + (payload.cashSupplement || 0)
    if (totalOfferValue < receiverProduct.minOfferAmount) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Your offer total value ($${totalOfferValue}) is below the seller's minimum acceptable offer ($${receiverProduct.minOfferAmount}).`,
      )
    }
  }

  if (receiverProduct.status !== 'active') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Target product is not currently active.')
  }

  payload.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  payload.status = 'pending'
  payload.escrowStatus = 'pending'

  const offer = (await TradeOffer.create(payload)) as any

  // Notify receiver via push notification and socket
  const receiverUser = await User.findById(receiverId)
  if (receiverUser?.deviceToken) {
    sendPushNotification(
      receiverUser.deviceToken,
      'New Offer Received 🎁',
      senderProduct
        ? `You received an offer: ${senderProduct.title} for ${receiverProduct.title}.`
        : `You received a cash offer of $${payload.cashSupplement} for ${receiverProduct.title}.`,
      { type: 'NEW_TRADE_OFFER', tradeOfferId: offer._id.toString() },
    ).catch(err => console.error('Push error:', err))
  }

  const io = (global as any).io
  if (io && receiverId) {
    io.to(receiverId.toString()).emit('new_trade_offer', {
      offerId: offer._id.toString(),
      senderId: senderId?.toString() || '',
      receiverProductId: receiverProductId?.toString() || '',
    })
  }

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
    const offerText = senderProduct
      ? `Proposed a new trade swap offer: ${senderProduct.title} for ${receiverProduct.title}.`
      : `Proposed a new cash offer of $${payload.cashSupplement} for ${receiverProduct.title}.`

    const createdMsg = await Message.create({
      chatId: chat._id,
      sender: senderId,
      text: offerText,
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: senderProduct ? 'NEW TRADE OFFER 🎁' : 'NEW CASH OFFER 💵',
        eta: '24 Hours Expire',
      },
    })

    await Chat.findByIdAndUpdate(chat._id, {
      $set: { updatedAt: new Date() },
    })

    if (io) {
      const populatedMsg = await Message.findById(createdMsg._id)
        .populate({
          path: 'metadata.tradeOfferId',
          populate: [
            { path: 'senderProductId' },
            { path: 'receiverProductId' },
          ],
        })
        .lean()
      io.emit(`getMessage::${chat._id}`, populatedMsg || createdMsg)
      if (senderId) io.emit(`updateChatList::${senderId}`)
      if (receiverId) io.emit(`updateChatList::${receiverId}`)
    }
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

    // Atomically reserve items: fails if either was sold/reserved
    // meanwhile (e.g. won in a live auction), so nothing is sold twice.
    if (offer.senderProductId) {
      const reservedSender = await Product.findOneAndUpdate(
        { _id: offer.senderProductId, status: 'active' },
        { status: 'pending' },
        { session },
      )
      if (!reservedSender) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'The offered item is no longer available.',
        )
      }
    }
    const reservedReceiver = await Product.findOneAndUpdate(
      { _id: offer.receiverProductId, status: 'active' },
      { status: 'pending' },
      { session },
    )
    if (!reservedReceiver) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'This item is no longer available.',
      )
    }

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

  // Both sides owe ARIES 4% of their own item's value, and one side may owe
  // a cash difference on top. Nothing is swapped until every side has paid,
  // so hand this caller the payment they personally owe and let the Stripe
  // webhook finalize the swap once the other side settles too.
  const settlement = await TradeSettlementServices.getOrCreateSettlement(offer)

  if (settlement.status !== 'settled') {
    const intent = await TradeSettlementServices.createPartyPaymentIntent(
      offerId,
      userId,
    )

    if (!('alreadyPaid' in intent)) {
      return intent as any
    }

    // This caller is square; the other side still owes.
    const stillOwed = await TradeSettlementServices.getSettlementStatus(offerId)
    if (stillOwed && stillOwed.status !== 'settled') {
      return {
        awaitingCounterparty: true,
        settlement: stillOwed,
      } as any
    }
  }

  return finalizeTradeSwap(offerId, userId)
}

/**
 * Swap the items and close the offer. Safe to call from the trade endpoint
 * once both sides are square, and from the Stripe webhook when the second
 * payment lands.
 */
const finalizeTradeSwap = async (
  offerId: string,
  actorId?: string,
): Promise<ITradeOffer> => {
  const offer = (await TradeOffer.findById(offerId)
    .populate('senderProductId')
    .populate('receiverProductId')) as any

  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }

  if (offer.status === 'completed') return offer

  const userId = actorId || offer.senderId.toString()

  const session = await TradeOffer.startSession()
  session.startTransaction()

  try {
    // Swap product ownership
    if (offer.senderProductId) {
      await Product.findByIdAndUpdate(
        offer.senderProductId._id,
        { sellerId: offer.receiverId, status: 'active' },
        { session },
      )
    }
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

    // Create Community Trade Vote entry (non-blocking)
    TradeVoteServices.createTradeVoteFromCompletedTrade(offer).catch(err =>
      console.error('Failed to auto-create trade vote:', err),
    )

    // Record partner commission on trade completion (3% + 3% = 6% fee)
    const senderVal = (offer.senderProductId as any)?.estValue || 0
    const receiverVal = (offer.receiverProductId as any)?.estValue || 0
    PartnerService.recordCommissionForOrder({
      buyerId: offer.senderId.toString(),
      tradeOfferId: offer._id.toString(),
      transactionAmount: senderVal + receiverVal,
      isTrade: true,
    }).catch(err => console.error('Failed to record partner trade commission:', err))

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
  finalizeTradeSwap,
  getSettlement: TradeSettlementServices.getSettlementStatus,
  createSettlementIntent: TradeSettlementServices.createPartyPaymentIntent,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
  completeTradeOffer,
}
