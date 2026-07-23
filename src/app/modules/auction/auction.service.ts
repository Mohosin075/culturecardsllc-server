import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { LiveStream, AuctionItem } from './auction.model'
import { ILiveStream, IAuctionItem } from './auction.interface'
import { RtcTokenBuilder, RtcRole } from 'agora-access-token'
import config from '../../../config'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import { Product } from '../product/product.model'
import { User } from '../user/user.model'
import { io } from '../../../server'

const generateAgoraToken = async (
  channelName: string,
  uid: number = 0,
  role: 'publisher' | 'subscriber' = 'subscriber',
): Promise<{
  token: string
  appId: string
  channelName: string
  uid: number
}> => {
  const appId = config.agora.app_id
  const appCertificate = config.agora.app_certificate

  if (!appId || !appCertificate) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora configuration (App ID or App Certificate) is missing from system configuration.',
    )
  }

  const agoraRole =
    role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER
  const expirationTimeInSeconds = 3600 * 2 // 2 hours
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

  const token = RtcTokenBuilder.buildTokenWithUid(
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

const createLiveStream = async (
  payload: Partial<ILiveStream>,
): Promise<ILiveStream> => {
  const seller = await User.findById(payload.sellerId)
  if (!seller) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Seller not found')
  }

  if (!seller.sellerVerified) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your seller account is not verified yet. Please wait for admin approval.',
    )
  }

  if (!payload.agoraChannelName) {
    payload.agoraChannelName = `channel_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  }
  return await LiveStream.create(payload)
}

const getLiveStreams = async (status?: string): Promise<ILiveStream[]> => {
  const query: any = {}
  if (status) query.status = status
  return await LiveStream.find(query)
    .populate('sellerId', 'name fullName email image photo')
    .populate('pinnedProductId')
}

const createAuctionItem = async (
  payload: Partial<IAuctionItem> & { startingBid?: number },
): Promise<IAuctionItem> => {
  const { startingBid, ...rest } = payload
  const duration = rest.timerDuration || 60
  const endsAt = rest.endsAt || new Date(Date.now() + duration * 1000)
  
  const auction = await AuctionItem.create({
    ...rest,
    currentBid: startingBid ?? 0,
    status: 'active',
    endsAt,
  })
  return auction
}

const placeBidSecure = async (
  auctionItemId: string,
  bidderId: string,
  bidAmount: number,
): Promise<IAuctionItem> => {
  if (!Types.ObjectId.isValid(auctionItemId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID')
  }

  // ── DEBUG: Fetch current state before the atomic update ──────
  const currentState = await AuctionItem.findById(auctionItemId).select('status currentBid highestBidderId endsAt')
  console.log(`\n[BID-DEBUG] ──────────────────────────────────────`)
  console.log(`[BID-DEBUG] auctionItemId : ${auctionItemId}`)
  console.log(`[BID-DEBUG] bidderId      : ${bidderId}`)
  console.log(`[BID-DEBUG] bidAmount     : ${bidAmount}`)
  if (!currentState) {
    console.log(`[BID-DEBUG] RESULT: ITEM NOT FOUND IN DB`)
  } else {
    console.log(`[BID-DEBUG] DB status     : ${currentState.status}`)
    console.log(`[BID-DEBUG] DB currentBid : ${currentState.currentBid}`)
    console.log(`[BID-DEBUG] DB endsAt     : ${currentState.endsAt}`)
    const statusOk = currentState.status === 'active'
    const bidOk = bidAmount > currentState.currentBid || currentState.currentBid === 0
    console.log(`[BID-DEBUG] status=active?: ${statusOk}  |  bid>currentBid?: ${bidOk}`)
    if (!statusOk) console.log(`[BID-DEBUG] ❌ FAIL REASON: status is "${currentState.status}", expected "active"`)
    if (!bidOk) console.log(`[BID-DEBUG] ❌ FAIL REASON: bidAmount (${bidAmount}) is NOT greater than currentBid (${currentState.currentBid})`)
    if (statusOk && bidOk) console.log(`[BID-DEBUG] ✅ Should PASS atomic update`)
  }
  console.log(`[BID-DEBUG] ──────────────────────────────────────\n`)
  // ── END DEBUG ────────────────────────────────────────────────

  // 1. Atomically find and update ONLY if the new bid is higher than the current bid
  // This uses a concurrency-safe atomic query lock to protect against over-bidding race conditions.
  const updatedAuction = await AuctionItem.findOneAndUpdate(
    {
      _id: new Types.ObjectId(auctionItemId),
      status: 'active',
      $or: [{ currentBid: { $lt: bidAmount } }, { currentBid: 0 }],
    },
    {
      $set: {
        currentBid: bidAmount,
        highestBidderId: new Types.ObjectId(bidderId),
      },
    },
    { new: true },
  ).populate('productId')

  if (!updatedAuction) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Bid rejected: Someone placed a higher or equal bid first.',
    )
  }

  // 2. Anti-Sniping Check: If bid placed within last 10 seconds, extend endsAt by 15 seconds
  const tenSecondsFromNow = new Date(Date.now() + 10000)
  if (updatedAuction.endsAt && updatedAuction.endsAt < tenSecondsFromNow) {
    const extendedTime = new Date(updatedAuction.endsAt.getTime() + 15000)
    await AuctionItem.findByIdAndUpdate(auctionItemId, {
      $set: { endsAt: extendedTime },
    })
    updatedAuction.endsAt = extendedTime
  }

  // 3. Broadcast new-bid event to all stream room viewers
  if (io && updatedAuction.streamId) {
    const bidderInfo = await User.findById(bidderId).select(
      'name fullName email image photo',
    )
    io.to(`stream:${updatedAuction.streamId.toString()}`).emit('new-bid', {
      streamId: updatedAuction.streamId.toString(),
      auctionItemId: updatedAuction._id,
      currentBid: updatedAuction.currentBid,
      highestBidder: bidderInfo,
      endsAt: updatedAuction.endsAt,
    })
  }

  return updatedAuction
}

// Get active auction items for a live stream
const getAuctionItemsByStream = async (streamId: string): Promise<IAuctionItem[]> => {
  if (!Types.ObjectId.isValid(streamId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Stream ID')
  }
  return await AuctionItem.find({ streamId: new Types.ObjectId(streamId) })
    .populate('productId')
    .sort({ createdAt: -1 })
}

const updateLiveStreamStatus = async (
  streamId: string,
  userId: string,
  userRole: string,
  status: 'scheduled' | 'live' | 'ended',
): Promise<ILiveStream> => {
  if (!Types.ObjectId.isValid(streamId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Stream ID')
  }

  const stream = await LiveStream.findById(streamId)
  if (!stream) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Live stream session not found')
  }

  // Authorize: Only the seller who owns the stream, or an admin/super_admin can update status
  if (
    userRole !== 'admin' &&
    userRole !== 'super_admin' &&
    stream.sellerId.toString() !== userId
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Unauthorized: Only the stream host or administrators can change the stream status.',
    )
  }

  stream.status = status
  await stream.save()
  return stream
}

// ── Complete auction + trigger winner Stripe checkout ────────────────────────────
const completeAuction = async (
  auctionItemId: string,
  requestingUserId: string,
): Promise<{ checkoutUrl: string; auctionItem: IAuctionItem }> => {
  if (!Types.ObjectId.isValid(auctionItemId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID')
  }

  const auctionItem = (await AuctionItem.findById(auctionItemId)
    .populate('productId')
    .populate('streamId')) as any

  if (!auctionItem) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Auction item not found')
  }

  if (auctionItem.status !== 'active') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Auction cannot be completed. Current status: ${auctionItem.status}`,
    )
  }

  if (!auctionItem.highestBidderId) {
    // No bids placed: mark as failed
    auctionItem.status = 'failed'
    await auctionItem.save()
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Auction ended with no bids. Status set to failed.',
    )
  }

  // Check reservePrice
  const product = auctionItem.productId as any
  if (product.reservePrice && auctionItem.currentBid < product.reservePrice) {
    auctionItem.status = 'failed'
    await auctionItem.save()
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Reserve price not met (current: $${auctionItem.currentBid}, reserve: $${product.reservePrice}). Auction failed.`,
    )
  }

  // Authorize: only the stream seller or admin can complete
  const stream = auctionItem.streamId as any
  if (
    stream &&
    stream.sellerId.toString() !== requestingUserId &&
    requestingUserId !== 'admin'
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Only the auction host can complete this auction.',
    )
  }

  // Mark product pending (escrow-like hold)
  await Product.findByIdAndUpdate(product._id, { status: 'pending' })

  // Mark auction completed
  auctionItem.status = 'completed'
  await auctionItem.save()

  // Get winner info
  const winner = await User.findById(auctionItem.highestBidderId).select('email name')
  if (!winner?.email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Winner email not found')
  }

  // Create Stripe checkout session for winner
  const stripeSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Auction Win: ${product.title}`,
            description: `You won the auction! Highest bid: $${auctionItem.currentBid}`,
          },
          unit_amount: Math.round(auctionItem.currentBid * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${config.clientUrl}?auction_won=true&auctionItemId=${auctionItemId}`,
    cancel_url: `${config.clientUrl}/auction/cancel`,
    customer_email: winner.email,
    metadata: {
      purchaseType: 'auction_win',
      productId: product._id.toString(),
      sellerId: stream?.sellerId?.toString() || '',
      winnerId: auctionItem.highestBidderId.toString(),
      auctionItemId: auctionItemId,
    },
  })

  // Notify winner via socket
  if (io) {
    io.to(auctionItem.highestBidderId.toString()).emit('auction-won', {
      auctionItemId,
      productTitle: product.title,
      winningBid: auctionItem.currentBid,
      checkoutUrl: stripeSession.url,
      message: `🏆 You won the auction for ${product.title}! Please complete your payment.`,
    })
  }

  return { checkoutUrl: stripeSession.url!, auctionItem }
}

export const AuctionServices = {
  generateAgoraToken,
  createLiveStream,
  getLiveStreams,
  createAuctionItem,
  getAuctionItemsByStream,
  placeBidSecure,
  updateLiveStreamStatus,
  completeAuction,
}
