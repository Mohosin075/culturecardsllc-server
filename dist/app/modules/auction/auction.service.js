'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.AuctionServices = void 0
const http_status_codes_1 = require('http-status-codes')
const ApiError_1 = __importDefault(require('../../../errors/ApiError'))
const auction_model_1 = require('./auction.model')
const agora_access_token_1 = require('agora-access-token')
const config_1 = __importDefault(require('../../../config'))
const mongoose_1 = require('mongoose')
const generateAgoraToken = async (
  channelName,
  uid = 0,
  role = 'subscriber',
) => {
  const appId = config_1.default.agora.app_id
  const appCertificate = config_1.default.agora.app_certificate
  if (!appId || !appCertificate) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora configuration (App ID or App Certificate) is missing from system configuration.',
    )
  }
  const agoraRole =
    role === 'publisher'
      ? agora_access_token_1.RtcRole.PUBLISHER
      : agora_access_token_1.RtcRole.SUBSCRIBER
  const expirationTimeInSeconds = 3600 * 2 // 2 hours
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds
  const token = agora_access_token_1.RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs,
  )
  return {
    token,
    appId,
    channelName,
    uid,
  }
}
const createLiveStream = async payload => {
  if (!payload.agoraChannelName) {
    payload.agoraChannelName = `channel_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  }
  return await auction_model_1.LiveStream.create(payload)
}
const getLiveStreams = async status => {
  const query = {}
  if (status) query.status = status
  return await auction_model_1.LiveStream.find(query)
    .populate('sellerId', 'name fullName email image photo')
    .populate('pinnedProductId')
}
const createAuctionItem = async payload => {
  const auction = await auction_model_1.AuctionItem.create(payload)
  return auction
}
const placeBidSecure = async (auctionItemId, bidderId, bidAmount) => {
  if (!mongoose_1.Types.ObjectId.isValid(auctionItemId)) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'Invalid Auction Item ID',
    )
  }
  // 1. Atomically find and update ONLY if the new bid is higher than the current bid
  // This uses a concurrency-safe atomic query lock to protect against over-bidding race conditions.
  const updatedAuction = await auction_model_1.AuctionItem.findOneAndUpdate(
    {
      _id: new mongoose_1.Types.ObjectId(auctionItemId),
      status: 'active',
      $or: [{ currentBid: { $lt: bidAmount } }, { currentBid: 0 }],
    },
    {
      $set: {
        currentBid: bidAmount,
        highestBidderId: new mongoose_1.Types.ObjectId(bidderId),
      },
    },
    { new: true },
  ).populate('productId')
  if (!updatedAuction) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.CONFLICT,
      'Bid rejected: Someone placed a higher or equal bid first.',
    )
  }
  // 2. Anti-Sniping Check: If bid placed within last 10 seconds, extend endsAt by 15 seconds
  const tenSecondsFromNow = new Date(Date.now() + 10000)
  if (updatedAuction.endsAt && updatedAuction.endsAt < tenSecondsFromNow) {
    const extendedTime = new Date(updatedAuction.endsAt.getTime() + 15000)
    await auction_model_1.AuctionItem.findByIdAndUpdate(auctionItemId, {
      $set: { endsAt: extendedTime },
    })
    updatedAuction.endsAt = extendedTime
  }
  return updatedAuction
}
exports.AuctionServices = {
  generateAgoraToken,
  createLiveStream,
  getLiveStreams,
  createAuctionItem,
  placeBidSecure,
}
