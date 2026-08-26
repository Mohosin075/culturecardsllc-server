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
import { Order } from '../order/order.model'
import { initializeOrderShipping } from '../../../helpers/shippingHelper'
import { Chat } from '../chat/chat.model'
import { Message } from '../message/message.model'
import { NotificationIntegration } from '../notification/notification.integration'
import { NotificationServices } from '../notification/notification.service'
import { NotificationType, NotificationChannel, NotificationPriority } from '../notification/notification.interface'
import { Payment } from '../payment/payment.model'

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

  if (status === 'live') {
    NotificationIntegration.onLiveStreamGoLive(
      stream.sellerId.toString(),
      streamId,
      stream.title
    ).catch(err => console.error('Failed to send go-live notification to followers:', err))
  }

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

  // Get winner info
  const winner = await User.findById(auctionItem.highestBidderId)
  if (!winner) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Winner profile not found')
  }

  let isAutoPaid = false
  let paymentIntentId: string | undefined

  // 1. Try automatic off-session charge if the winner has saved card details on Stripe
  if (winner.stripeCustomerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: winner.stripeCustomerId,
        type: 'card',
      })

      if (paymentMethods.data.length > 0) {
        const paymentMethodId = paymentMethods.data[0].id
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(auctionItem.currentBid * 100),
          currency: 'usd',
          customer: winner.stripeCustomerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            purchaseType: 'auction_win',
            productId: product._id.toString(),
            sellerId: stream?.sellerId?.toString() || '',
            winnerId: auctionItem.highestBidderId.toString(),
            auctionItemId: auctionItemId,
          },
        })

        if (paymentIntent.status === 'succeeded') {
          isAutoPaid = true
          paymentIntentId = paymentIntent.id
          console.log(`[AUTO-PAY] Instant card charge succeeded for Auction:${auctionItemId}`)
        }
      }
    } catch (autoPayError) {
      console.error('[AUTO-PAY] Automatic charge failed. Falling back to checkout session:', autoPayError)
    }
  }

  // 2. If charged successfully, create the paid Order immediately
  if (isAutoPaid) {
    const shippingAddress = {
      street: winner.address?.presentAddress || '123 Collectors St',
      city: winner.address?.city || 'Collector City',
      state: 'AP',
      postalCode: winner.address?.postalCode || '10001',
      country: winner.address?.country || 'US',
    }

    const orderPayload: any = {
      buyerId: auctionItem.highestBidderId,
      sellerId: stream?.sellerId,
      productId: product._id,
      purchaseType: 'auction_win' as const,
      paymentStatus: 'paid' as const,
      deliveryStatus: 'pending' as const,
      shippingAddress,
      paymentIntentId,
      amountDetails: {
        itemSubtotal: auctionItem.currentBid,
        shipping: 0,
        taxes: 0,
        processingFee: 0,
        charityContribution: 0,
        totalPaid: auctionItem.currentBid,
      },
    }

    // Initialize shipping weight, rate, tracking, and label PDF on disk (supports bundling)
    const existingOrder = await Order.findOne({
      buyerId: auctionItem.highestBidderId,
      sellerId: stream?.sellerId,
      deliveryStatus: 'pending',
      purchaseType: 'auction_win',
      createdAt: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }
    })

    if (existingOrder) {
      orderPayload.trackingDetails = {
        carrier: existingOrder.trackingDetails.carrier,
        trackingNumber: existingOrder.trackingDetails.trackingNumber,
        estimatedDelivery: existingOrder.trackingDetails.estimatedDelivery,
        journeyUpdates: []
      }
      orderPayload.shippingLabelUrl = existingOrder.shippingLabelUrl
      orderPayload.shippingWeight = 0
      orderPayload.amountDetails.shipping = 0
    } else {
      await initializeOrderShipping(orderPayload, product)
    }

    const [order] = await Order.create([orderPayload])

    // Mark product sold
    await Product.findByIdAndUpdate(product._id, { status: 'sold', stock: 0 })

    // Mark auction completed
    auctionItem.status = 'completed'
    await auctionItem.save()

    // 1. Create order update message in chat
    try {
      const chat = await Chat.findOne({
        participants: { $all: [auctionItem.highestBidderId.toString(), stream.sellerId.toString()] },
      })
      if (chat) {
        await Message.create({
          chatId: chat._id,
          sender: auctionItem.highestBidderId,
          text: `🏆 Auction Won! Payment complete. Order #${(order as any)._id.toString().substring(0, 8).toUpperCase()} created.`,
          messageType: 'order_update',
          seen: false,
          metadata: { orderId: (order as any)._id.toString(), statusLabel: 'AUCTION WON 🏆' },
        })
      }
    } catch (chatError) {
      console.error('Failed to create auction win chat message:', chatError)
    }

    // 2. Notify seller via socket
    if (io && stream?.sellerId) {
      io.to(stream.sellerId.toString()).emit('auction-payment-received', {
        orderId: (order as any)._id.toString(),
        productId: product._id.toString(),
        message: 'Auction payment received! Order created.',
      })
    }

    // 3. Notify winner via socket
    if (io) {
      io.to(auctionItem.highestBidderId.toString()).emit('auction-won', {
        auctionItemId,
        productTitle: product.title,
        winningBid: auctionItem.currentBid,
        isAutoPaid: true,
        message: `🏆 Congratulations! You won the auction for ${product.title}. Payment of $${auctionItem.currentBid} was charged automatically!`,
      })
    }

    // 4. Send Push Notification to winner
    NotificationIntegration.onAuctionWon(
      auctionItem.highestBidderId,
      stream?.sellerId || '',
      product.title,
      auctionItem.currentBid,
      auctionItemId
    ).catch(err => console.error('Failed to send auction won push notification:', err))

    return { checkoutUrl: '', auctionItem }
  }

  // 3. Fallback: Create Stripe checkout session for manual payment
  await Product.findByIdAndUpdate(product._id, { status: 'pending' })

  auctionItem.status = 'completed'
  await auctionItem.save()

  if (!winner.email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Winner email not found')
  }

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

  // Create Payment record for tracking & webhook safety
  await Payment.create({
    userId: auctionItem.highestBidderId,
    userEmail: winner.email,
    amount: auctionItem.currentBid,
    currency: 'usd',
    paymentMethod: 'stripe',
    paymentIntentId: stripeSession.id,
    status: 'pending',
    metadata: {
      purchaseType: 'auction_win',
      productId: product._id.toString(),
      sellerId: stream?.sellerId?.toString() || '',
      winnerId: auctionItem.highestBidderId.toString(),
      auctionItemId: auctionItemId,
      checkoutSessionId: stripeSession.id,
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

  // Send Push Notification to winner for manual checkout
  NotificationServices.createNotification({
    userId: auctionItem.highestBidderId.toString(),
    title: 'Auction Won! 🏆',
    content: `Congratulations! You won the auction for "${product.title}" for $${auctionItem.currentBid}. Please complete your payment.`,
    type: NotificationType.AUCTION_WON,
    channel: NotificationChannel.PUSH,
    priority: NotificationPriority.HIGH,
    metadata: {
      sellerId: stream?.sellerId?.toString() || '',
      auctionItemId,
      bidAmount: auctionItem.currentBid.toString(),
    },
    actionUrl: stripeSession.url || undefined,
    actionText: 'Pay Now',
  }).catch(err => console.error('Failed to create manual payment auction won notification:', err))

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
