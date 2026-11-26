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
import { TradeSettlementServices } from './tradeSettlement.service'
import { TradeFulfillment } from './tradeFulfillment.service'
import { nextTradeCode } from './tradeCode'
import { USER_ROLES } from '../../../enum/user'

/** A trade can include several items per side (client #11). */
export const MAX_ITEMS_PER_SIDE = 10

const uniqueIds = (...lists: (unknown[] | unknown | undefined)[]): string[] => {
  const out = new Set<string>()
  for (const list of lists) {
    for (const id of Array.isArray(list) ? list : [list]) {
      if (id) out.add(String(id))
    }
  }
  return [...out]
}

const titles = (products: any[]): string =>
  products.map(p => p.title || 'item').join(', ')

type CreateTradePayload = Partial<ITradeOffer> & {
  senderProductIds?: string[]
  receiverProductIds?: string[]
}

const createTradeOffer = async (
  payload: CreateTradePayload,
): Promise<ITradeOffer> => {
  const { senderId, receiverId } = payload

  if (String(senderId) === String(receiverId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot trade with yourself.')
  }

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

  const senderIds = uniqueIds(payload.senderProductIds, payload.senderProductId)
  const receiverIds = uniqueIds(payload.receiverProductIds, payload.receiverProductId)

  if (!receiverIds.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Choose at least one item you want.')
  }
  if (senderIds.length > MAX_ITEMS_PER_SIDE || receiverIds.length > MAX_ITEMS_PER_SIDE) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `A trade can include up to ${MAX_ITEMS_PER_SIDE} items per side.`,
    )
  }

  const senderProducts: any[] = senderIds.length
    ? await Product.find({ _id: { $in: senderIds } })
    : []
  if (senderProducts.length !== senderIds.length) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'One of your offered items was not found.')
  }
  for (const p of senderProducts) {
    if (String(p.sellerId) !== String(senderId)) {
      throw new ApiError(StatusCodes.FORBIDDEN, `"${p.title}" is not yours to offer.`)
    }
    if (!p.allowTrade) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `"${p.title}" is not marked for trade.`)
    }
    if (p.status !== 'active') {
      throw new ApiError(StatusCodes.BAD_REQUEST, `"${p.title}" is not currently active.`)
    }
  }

  if (!senderProducts.length && (!payload.cashSupplement || payload.cashSupplement <= 0)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A cash offer must specify a positive cash amount.')
  }

  const receiverProducts: any[] = await Product.find({ _id: { $in: receiverIds } })
  if (receiverProducts.length !== receiverIds.length) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Target product not found.')
  }
  for (const p of receiverProducts) {
    if (String(p.sellerId) !== String(receiverId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `"${p.title}" does not belong to this trader.`)
    }
    if (!(p.allowTrade || p.allowOffers)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `"${p.title}" is not configured to allow trading or custom offers.`,
      )
    }
    if (p.status !== 'active') {
      throw new ApiError(StatusCodes.BAD_REQUEST, `"${p.title}" is not currently active.`)
    }
  }

  // Minimum offer applies when one item is asked for.
  const target = receiverProducts[0]
  if (receiverProducts.length === 1 && target.allowOffers && target.minOfferAmount > 0) {
    const totalOfferValue =
      senderProducts.reduce((s, p) => s + Number(p.estValue || 0), 0) +
      Number(payload.cashSupplement || 0)
    if (totalOfferValue < target.minOfferAmount) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Your offer total value ($${totalOfferValue}) is below the seller's minimum acceptable offer ($${target.minOfferAmount}).`,
      )
    }
  }

  const offer = (await TradeOffer.create({
    senderId,
    receiverId,
    senderProductIds: senderIds,
    receiverProductIds: receiverIds,
    senderProductId: senderIds[0],
    receiverProductId: receiverIds[0],
    cashSupplement: Number(payload.cashSupplement || 0),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'pending',
    escrowStatus: 'pending',
  })) as any

  const summary = senderProducts.length
    ? `${titles(senderProducts)} for ${titles(receiverProducts)}`
    : `$${payload.cashSupplement} cash for ${titles(receiverProducts)}`

  // Notify receiver via push notification and socket
  const receiverUser = await User.findById(receiverId)
  if (receiverUser?.deviceToken) {
    sendPushNotification(
      receiverUser.deviceToken,
      'New Offer Received 🎁',
      `You received an offer: ${summary}.`,
      { type: 'NEW_TRADE_OFFER', tradeOfferId: offer._id.toString() },
    ).catch(err => console.error('Push error:', err))
  }

  const socket = (global as any).io
  if (socket && receiverId) {
    socket.to(receiverId.toString()).emit('new_trade_offer', {
      offerId: offer._id.toString(),
      senderId: senderId?.toString() || '',
      receiverProductId: receiverIds[0],
    })
  }

  let chat = await Chat.findOne({ participants: { $all: [senderId, receiverId] } })
  if (!chat) {
    chat = await Chat.create({ participants: [senderId, receiverId] })
  }

  if (chat) {
    const createdMsg = await Message.create({
      chatId: chat._id,
      sender: senderId,
      text: senderProducts.length
        ? `Proposed a new trade swap offer: ${summary}.`
        : `Proposed a new cash offer of ${summary}.`,
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: senderProducts.length ? 'NEW TRADE OFFER 🎁' : 'NEW CASH OFFER 💵',
        eta: '24 Hours Expire',
      },
    })

    await Chat.findByIdAndUpdate(chat._id, { $set: { updatedAt: new Date() } })

    if (socket) {
      const populatedMsg = await Message.findById(createdMsg._id)
        .populate({
          path: 'metadata.tradeOfferId',
          populate: [{ path: 'senderProductId' }, { path: 'receiverProductId' }],
        })
        .lean()
      socket.emit(`getMessage::${chat._id}`, populatedMsg || createdMsg)
      if (senderId) socket.emit(`updateChatList::${senderId}`)
      if (receiverId) socket.emit(`updateChatList::${receiverId}`)
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
    .select('-history')
    .sort({ createdAt: -1 })
    .populate('senderId', 'name fullName email image photo')
    .populate('receiverId', 'name fullName email image photo')
    .populate('senderProductId')
    .populate('receiverProductId')
    .populate('senderProductIds')
    .populate('receiverProductIds')
}

const isAdminRole = (role?: string) =>
  role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN

const acceptTradeOffer = async (
  offerId: string,
  userId: string,
  role?: string,
): Promise<ITradeOffer> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID')
  }

  const offer = (await TradeOffer.findById(offerId)) as any
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }
  if (String(offer.receiverId) !== String(userId) && !isAdminRole(role)) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only the trader who received this offer can accept it.')
  }
  if (offer.status !== 'pending') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This offer is no longer pending.')
  }

  const rules = await TradeSettlementServices.getTradeRules()

  // Reserve every item, one at a time so a clash can be undone: if any was
  // sold or reserved meanwhile (e.g. won in a live auction), release the ones
  // already taken and refuse, so nothing is sold twice. Works with or without
  // MongoDB transactions.
  const itemIds = [...(offer.senderProductIds || []), ...(offer.receiverProductIds || [])]
  const reserved: any[] = []
  for (const itemId of itemIds) {
    const taken = await Product.findOneAndUpdate(
      { _id: itemId, status: 'active' },
      { status: 'pending' },
    )
    if (!taken) {
      if (reserved.length) {
        await Product.updateMany({ _id: { $in: reserved }, status: 'pending' }, { status: 'active' })
      }
      throw new ApiError(
        StatusCodes.CONFLICT,
        'One of the items in this trade is no longer available.',
      )
    }
    reserved.push(itemId)
  }

  // Flip pending → accepted atomically, so a double tap cannot accept twice.
  const tradeCode = offer.tradeCode || (await nextTradeCode())
  const accepted = await TradeOffer.findOneAndUpdate(
    { _id: offer._id, status: 'pending' },
    {
      $set: {
        tradeCode,
        status: 'accepted',
        stage: 'awaiting_payment',
        escrowStatus: 'pending',
        acceptedAt: new Date(),
        paymentDueAt: new Date(Date.now() + rules.paymentWindowHours * 60 * 60 * 1000),
      },
      $push: {
        history: {
          at: new Date(),
          stage: 'awaiting_payment',
          message: `Accepted as trade ${tradeCode}.`,
          actorId: userId,
        },
      },
    },
    { new: true },
  )
  if (!accepted) {
    await Product.updateMany({ _id: { $in: reserved }, status: 'pending' }, { status: 'active' })
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This offer is no longer pending.')
  }
  Object.assign(offer, { tradeCode, status: 'accepted', stage: 'awaiting_payment' })

  let chat = await Chat.findOne({
    participants: { $all: [offer.senderId, offer.receiverId] },
  })
  if (!chat) {
    chat = await Chat.create({ participants: [offer.senderId, offer.receiverId] })
  }
  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: offer.receiverId,
      text: `Accepted the trade! Trade ${tradeCode}: both traders now pay their fees and shipping within ${rules.paymentWindowHours} hours.`,
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: 'TRADE ACCEPTED 🤝',
      },
    })
  }

  if (io) {
    io.to(offer.senderId.toString()).emit('trade-accepted', {
      tradeOfferId: offer._id.toString(),
      tradeCode: offer.tradeCode,
      message: 'Your trade offer was accepted! 🤝',
    })
  }
  const senderUser = await User.findById(offer.senderId).select('deviceToken')
  if (senderUser?.deviceToken) {
    await sendPushNotification(
      senderUser.deviceToken,
      'Trade Accepted 🤝',
      `Trade ${tradeCode} was accepted. Pay your fee and shipping to get it moving.`,
      { type: 'TRADE_ACCEPTED', tradeOfferId: offer._id.toString() },
    ).catch(() => {/* non-blocking */})
  }

  return accepted as any
}

const declineTradeOffer = async (
  offerId: string,
  userId: string,
  role?: string,
): Promise<ITradeOffer> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID')
  }

  const offer = (await TradeOffer.findById(offerId)) as any
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }
  const isParticipant = [String(offer.senderId), String(offer.receiverId)].includes(String(userId))
  if (!isParticipant && !isAdminRole(role)) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not part of this trade.')
  }
  if (offer.status !== 'pending') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This offer is no longer pending.')
  }

  offer.status = 'declined'
  await offer.save()

  const withdrawn = String(offer.senderId) === String(userId)
  const chat = await Chat.findOne({
    participants: { $all: [offer.senderId, offer.receiverId] },
  })
  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: userId,
      text: withdrawn ? 'Withdrew the trade offer.' : 'Declined the trade swap offer.',
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: withdrawn ? 'OFFER WITHDRAWN' : 'TRADE DECLINED ❌',
      },
    })
  }

  const notifyId = withdrawn ? offer.receiverId : offer.senderId
  if (io) {
    io.to(notifyId.toString()).emit('trade-declined', {
      tradeOfferId: offer._id.toString(),
      message: withdrawn ? 'A trade offer was withdrawn.' : 'Your trade offer was declined ❌',
    })
  }
  const notifyUser = await User.findById(notifyId).select('deviceToken')
  if (notifyUser?.deviceToken) {
    await sendPushNotification(
      notifyUser.deviceToken,
      withdrawn ? 'Offer Withdrawn' : 'Trade Declined ❌',
      withdrawn ? 'A trade offer you received was withdrawn.' : 'Your trade offer was declined.',
      { type: 'TRADE_DECLINED', tradeOfferId: offer._id.toString() },
    ).catch(() => {/* non-blocking */})
  }

  return offer
}

/**
 * The app's "Complete / Pay" button on an accepted trade.
 *
 * Returns the payment this caller owes (4% + $2 + their shipping, plus any
 * cash they add) until they have paid. After that it returns the trade: the
 * items now travel through ARIES, and the trade completes when they arrive.
 */
const completeTradeOffer = async (offerId: string, userId: string): Promise<any> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID')
  }

  const offer = (await TradeOffer.findById(offerId)) as any
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }

  const isParticipant = [String(offer.senderId), String(offer.receiverId)].includes(String(userId))
  if (!isParticipant) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not authorized to pay for this trade.')
  }
  if (offer.status !== 'accepted') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only accepted trade offers can be paid for.')
  }

  // Accepted before trade stages existed.
  if (!offer.stage) {
    offer.stage = 'awaiting_payment'
    offer.tradeCode = offer.tradeCode || (await nextTradeCode())
    await offer.save()
  }

  if (offer.stage === 'awaiting_payment') {
    const intent = await TradeSettlementServices.createPartyPaymentIntent(
      offerId,
      userId,
      TradeFulfillment.quotePartyLabels,
    )
    if (!('alreadyPaid' in intent)) return intent

    const settlement = await TradeSettlementServices.getSettlementStatus(offerId)
    if (settlement && settlement.status !== 'settled') {
      return { awaitingCounterparty: true, settlement }
    }
  }

  return TradeFulfillment.getTradeForUser(offerId, userId)
}

export const TradeServices = {
  createTradeOffer,
  getSettlement: TradeSettlementServices.getSettlementStatus,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
  completeTradeOffer,
}
