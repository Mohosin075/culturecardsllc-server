'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.TradeServices = void 0
const http_status_codes_1 = require('http-status-codes')
const ApiError_1 = __importDefault(require('../../../errors/ApiError'))
const trade_model_1 = require('./trade.model')
const product_model_1 = require('../product/product.model')
const message_model_1 = require('../message/message.model')
const chat_model_1 = require('../chat/chat.model')
const mongoose_1 = require('mongoose')
const createTradeOffer = async payload => {
  const { senderProductId, receiverProductId, senderId, receiverId } = payload
  const senderProduct = await product_model_1.Product.findById(senderProductId)
  const receiverProduct =
    await product_model_1.Product.findById(receiverProductId)
  if (!senderProduct || !receiverProduct) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.NOT_FOUND,
      'One or both of the products were not found.',
    )
  }
  if (!senderProduct.allowTrade || !receiverProduct.allowTrade) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'One or both items are not configured to allow trading.',
    )
  }
  if (
    senderProduct.status !== 'active' ||
    receiverProduct.status !== 'active'
  ) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'One or both products are not currently active.',
    )
  }
  payload.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  payload.status = 'pending'
  payload.escrowStatus = 'pending'
  const offer = await trade_model_1.TradeOffer.create(payload)
  let chat = await chat_model_1.Chat.findOne({
    $or: [
      { creator: senderId, participant: receiverId },
      { creator: receiverId, participant: senderId },
    ],
  })
  if (!chat) {
    chat = await chat_model_1.Chat.create({
      creator: senderId,
      participant: receiverId,
    })
  }
  if (chat) {
    await message_model_1.Message.create({
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
const getTradeOffers = async (userId, type) => {
  const query = {}
  if (type === 'sent') {
    query.senderId = new mongoose_1.Types.ObjectId(userId)
  } else {
    query.receiverId = new mongoose_1.Types.ObjectId(userId)
  }
  return await trade_model_1.TradeOffer.find(query)
    .populate('senderId', 'name fullName email image photo')
    .populate('receiverId', 'name fullName email image photo')
    .populate('senderProductId')
    .populate('receiverProductId')
}
const acceptTradeOffer = async offerId => {
  if (!mongoose_1.Types.ObjectId.isValid(offerId)) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'Invalid Offer ID',
    )
  }
  const offer = await trade_model_1.TradeOffer.findById(offerId)
  if (!offer) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.NOT_FOUND,
      'Trade offer not found',
    )
  }
  if (offer.status !== 'pending') {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'This offer is no longer pending.',
    )
  }
  const session = await trade_model_1.TradeOffer.startSession()
  session.startTransaction()
  try {
    offer.status = 'accepted'
    offer.escrowStatus = 'held'
    await offer.save({ session })
    await product_model_1.Product.findByIdAndUpdate(
      offer.senderProductId,
      { status: 'pending' },
      { session },
    )
    await product_model_1.Product.findByIdAndUpdate(
      offer.receiverProductId,
      { status: 'pending' },
      { session },
    )
    let chat = await chat_model_1.Chat.findOne({
      $or: [
        { creator: offer.senderId, participant: offer.receiverId },
        { creator: offer.receiverId, participant: offer.senderId },
      ],
    })
    if (!chat) {
      const createdChats = await chat_model_1.Chat.create(
        [
          {
            creator: offer.senderId,
            participant: offer.receiverId,
          },
        ],
        { session },
      )
      chat = createdChats[0]
    }
    if (chat) {
      await message_model_1.Message.create(
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
    return offer
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}
const declineTradeOffer = async offerId => {
  if (!mongoose_1.Types.ObjectId.isValid(offerId)) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'Invalid Offer ID',
    )
  }
  const offer = await trade_model_1.TradeOffer.findById(offerId)
  if (!offer) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.NOT_FOUND,
      'Trade offer not found',
    )
  }
  if (offer.status !== 'pending') {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'This offer is no longer pending.',
    )
  }
  offer.status = 'declined'
  await offer.save()
  const chat = await chat_model_1.Chat.findOne({
    $or: [
      { creator: offer.senderId, participant: offer.receiverId },
      { creator: offer.receiverId, participant: offer.senderId },
    ],
  })
  if (chat) {
    await message_model_1.Message.create({
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
  return offer
}
exports.TradeServices = {
  createTradeOffer,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
}
