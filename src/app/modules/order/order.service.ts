import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { Order } from './order.model'
import { IOrder, IJourneyUpdate } from './order.interface'
import { Product } from '../product/product.model'
import { Payment } from '../payment/payment.model'
import { Chat } from '../chat/chat.model'
import { Message } from '../message/message.model'
import { Types } from 'mongoose'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'
import { initializeOrderShipping } from '../../../helpers/shippingHelper'
import stripe from '../../../config/stripe'
import { User } from '../user/user.model'
import { Notification } from '../notification/notification.model'
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from '../notification/notification.interface'
import { MarketplaceCharge } from '../payment/marketplaceCharge'

/** How long a seller has to hand the parcel over before the order auto-cancels. */
export const SHIP_WINDOW_BUSINESS_DAYS = 3

/** Adds business days (skipping Sat/Sun) to a date. */
export const addBusinessDays = (from: Date, days: number): Date => {
  const result = new Date(from)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const day = result.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return result
}

/** Short, human date for chat/notification copy. */
export const formatShipByDate = (date?: Date): string =>
  date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'soon'

/** DB notification + socket ping + FCM push so the seller is alerted immediately. */
const notifySellerOfNewOrder = async (
  order: IOrder,
  productTitle: string,
  productImage?: string,
  chatId?: string,
): Promise<void> => {
  const orderId = (order as any)._id.toString()
  const sellerId = order.sellerId.toString()
  const buyerId = order.buyerId.toString()
  const totalPaid = Number(order.amountDetails?.totalPaid || 0)
  const amountText = totalPaid > 0 ? `$${totalPaid.toFixed(2)}` : ''
  const shipByText = formatShipByDate(order.shipByDate)

  const [seller, buyer] = await Promise.all([
    User.findById(sellerId).select('deviceToken'),
    User.findById(buyerId).select('fullName name username'),
  ])

  const buyerName =
    (buyer as any)?.fullName ||
    (buyer as any)?.name ||
    (buyer as any)?.username ||
    'A buyer'

  const title = 'New Order Received'
  const body = amountText
    ? `${buyerName} purchased ${productTitle} for ${amountText} — ship by ${shipByText}.`
    : `${buyerName} purchased ${productTitle} — ship by ${shipByText}.`

  // 1. Persist in-app notification in MongoDB so it appears in Notifications & Messages -> Updates
  let savedNotification: any = null
  try {
    savedNotification = await Notification.create({
      userId: order.sellerId,
      title,
      content: body,
      type: NotificationType.NEW_ORDER,
      channel: NotificationChannel.BOTH,
      status: NotificationStatus.SENT,
      priority: NotificationPriority.HIGH,
      sentAt: new Date(),
      isRead: false,
      metadata: {
        orderId,
        productTitle,
        image: productImage || '',
        amount: totalPaid,
        buyerId,
        buyerName,
        chatId: chatId || '',
        shipByDate: order.shipByDate,
      },
    })
  } catch (err) {
    console.error('Failed to persist NEW_ORDER notification:', err)
  }

  // 2. Real-time Socket.IO events to the seller's room
  const io = (global as any).io
  if (io) {
    io.to(sellerId).emit('new-order', {
      orderId,
      productTitle,
      productImage: productImage || '',
      totalPaid,
      buyerName,
      shipByDate: order.shipByDate,
      title,
      message: body,
      chatId: chatId || '',
    })
    io.to(sellerId).emit('notification', savedNotification || {
      type: NotificationType.NEW_ORDER,
      title,
      content: body,
      orderId,
    })
    io.to(sellerId).emit(`updateChatList::${sellerId}`, {
      chatId: chatId || '',
      orderId,
      type: 'NEW_ORDER',
    })
  }

  // 3. Push notification (FCM / APNs)
  if (!seller?.deviceToken) return

  await sendPushNotification(seller.deviceToken, title, body, {
    type: 'NEW_ORDER',
    orderId,
    productTitle,
    amount: String(totalPaid),
    buyerName,
    chatId: chatId || '',
  })
}

const createOrder = async (payload: Partial<IOrder>): Promise<IOrder> => {
  const product = await Product.findById(payload.productId)
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }

  if (product.stock <= 0 || product.status === 'sold') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Product is out of stock.')
  }

  payload.purchaseType = payload.purchaseType || 'buy_now'
  if (!payload.amountDetails) {
    payload.amountDetails = {
      itemSubtotal: product.buyNowPrice || product.estValue || 0,
      shipping: 0,
      taxes: 0,
      processingFee: 0,
      charityContribution: 0,
      totalPaid: (payload as any).totalPaid || product.buyNowPrice || product.estValue || 0,
    }
  } else if (payload.amountDetails.totalPaid === undefined || payload.amountDetails.totalPaid === 0) {
    payload.amountDetails.totalPaid = (payload as any).totalPaid ||
      ((payload.amountDetails.itemSubtotal || 0) + (payload.amountDetails.shipping || 0) + (payload.amountDetails.taxes || 0))
  }
  if (!payload.shippingAddress) {
    payload.shippingAddress = {
      street: 'N/A',
      city: 'N/A',
      state: 'N/A',
      postalCode: '00000',
      country: 'USA',
    }
  } else {
    payload.shippingAddress.street = payload.shippingAddress.street?.trim() || 'N/A'
    payload.shippingAddress.city = payload.shippingAddress.city?.trim() || 'N/A'
    payload.shippingAddress.state = payload.shippingAddress.state?.trim() || 'N/A'
    payload.shippingAddress.postalCode = payload.shippingAddress.postalCode?.trim() || (payload.shippingAddress as any).zipCode?.trim() || '00000'
    payload.shippingAddress.country = payload.shippingAddress.country?.trim() || 'USA'
  }

  // Security: seller always comes from the product, never from the client
  payload.sellerId = product.sellerId as any
  if (String(payload.sellerId) === String(payload.buyerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot buy your own item.')
  }

  // Security: payment status is decided server-side. An order is only "paid"
  // if the client supplies a Stripe PaymentIntent that actually succeeded,
  // covers the amount, and has not been used by another order.
  payload.paymentStatus = 'pending'
  if (payload.paymentIntentId) {
    const alreadyUsed = await Order.exists({ paymentIntentId: payload.paymentIntentId })
    if (alreadyUsed) {
      throw new ApiError(StatusCodes.CONFLICT, 'This payment has already been used for another order.')
    }
    // A marketplace charge lives on the seller's connected account, not the
    // platform, so the intent has to be looked up on both.
    const located = await MarketplaceCharge.retrievePaymentIntentAnywhere(
      payload.paymentIntentId,
      payload.sellerId?.toString(),
    )
    if (!located) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid payment reference.')
    }
    const intent = located.intent
    // Remembered so the refund path knows where to send the reversal.
    payload.stripeAccountId = located.stripeAccountId || undefined
    const claimedTotal = Number(payload.amountDetails?.totalPaid || 0)
    if (intent.status === 'succeeded' && intent.amount_received >= Math.round(claimedTotal * 100)) {
      payload.paymentStatus = 'paid'
      if (payload.amountDetails) {
        payload.amountDetails.totalPaid = intent.amount_received / 100
      }
    }
  }

  // Populate shipping weight, tracking number, and mock PDF label
  await initializeOrderShipping(payload, product)

  // The seller gets a fixed window to ship. The buyer sees this date, and
  // orderShipDeadlineCron cancels and refunds anything still unshipped past it.
  payload.shipByDate = addBusinessDays(new Date(), SHIP_WINDOW_BUSINESS_DAYS)

  // Seed the opening checkpoint so the journey always starts at "Order Placed".
  // Without it the timeline stayed empty until the seller shipped, and then
  // jumped straight to "Shipped" with no record of the order being placed.
  if (!payload.trackingDetails) {
    payload.trackingDetails = { journeyUpdates: [] }
  }
  if (!payload.trackingDetails.journeyUpdates?.length) {
    payload.trackingDetails.journeyUpdates = [
      {
        status: 'Order Placed',
        description:
          payload.paymentStatus === 'paid'
            ? 'Payment confirmed and sent to the seller.'
            : 'Order created, awaiting payment confirmation.',
        timestamp: new Date(),
      },
    ]
  }

  const session = await Order.startSession()
  session.startTransaction()

  try {
    const orders = await Order.create([payload], { session })
    const order = orders[0]

    if (payload.paymentIntentId) {
      await Payment.updateOne(
        { paymentIntentId: payload.paymentIntentId },
        { status: 'succeeded', orderId: order._id },
        { session },
      )
    }

    // Atomic stock decrement: two buyers can't both take the last unit
    const reserved = await Product.findOneAndUpdate(
      { _id: product._id, stock: { $gt: 0 }, status: { $ne: 'sold' } },
      { $inc: { stock: -1 } },
      { new: true, session },
    )
    if (!reserved) {
      throw new ApiError(StatusCodes.CONFLICT, 'Sorry, this item just sold out.')
    }
    if (reserved.stock <= 0) {
      await Product.updateOne({ _id: product._id }, { status: 'sold' }, { session })
    }

    // Use participants[] array — consistent with Chat model schema
    let chat = await Chat.findOne({
      participants: { $all: [order.buyerId, order.sellerId] },
    })

    if (!chat) {
      const createdChats = await Chat.create(
        [{ participants: [order.buyerId, order.sellerId] }],
        { session },
      )
      chat = createdChats[0]
    }

    if (chat) {
      await Message.create(
        [
          {
            chatId: chat._id,
            // Sent on the buyer's behalf: with the seller as sender the
            // message counted as their own, so it never showed as unread and
            // the seller had no sign a new order had come in.
            sender: order.buyerId,
            text: `New order: ${product.title} (#${(order as any)._id.toString().substring(0, 8).toUpperCase()})`,
            messageType: 'order_update',
            seen: false,
            metadata: {
              orderId: (order as any)._id.toString(),
              statusLabel: 'NEW ORDER 📦',
              eta: `Ship by ${formatShipByDate(payload.shipByDate)}`,
            },
          },
        ],
        { session },
      )
    }

    await session.commitTransaction()

    // Tell the seller there is something to pack. Non-blocking: the order is
    // already committed and must not fail over a notification.
    const productImage =
      Array.isArray((product as any).images) && (product as any).images.length > 0
        ? String((product as any).images[0])
        : ''
    notifySellerOfNewOrder(
      order,
      product.title,
      productImage,
      chat?._id?.toString(),
    ).catch(err =>
      console.error('Failed to notify seller of new order:', err),
    )

    return order
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

const getOrdersForUser = async (
  userId: string,
  role: 'buyer' | 'seller',
): Promise<IOrder[]> => {
  const query: any = {}
  if (role === 'buyer') {
    query.buyerId = new Types.ObjectId(userId)
  } else {
    query.sellerId = new Types.ObjectId(userId)
  }

  return await Order.find(query)
    .populate('buyerId', 'name fullName email image photo')
    .populate('sellerId', 'name fullName email image photo')
    .populate('productId')
    .sort({ createdAt: -1 })
}

const getOrderById = async (id: string): Promise<IOrder> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Order ID')
  }

  const order = await Order.findById(id)
    .populate('buyerId', 'name fullName email image photo')
    .populate('sellerId', 'name fullName email image photo')
    .populate('productId')

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order details not found')
  }

  return order
}

const updateOrderJourney = async (
  orderId: string,
  journeyUpdate: IJourneyUpdate,
  deliveryStatus: 'pending' | 'shipped' | 'delivered' | 'cancelled',
  requester?: { userId: string; isAdmin: boolean },
): Promise<IOrder> => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Order ID')
  }

  const order = await Order.findById(orderId).populate('productId buyerId')
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found')
  }

  // Security: seller (or admin) can push any checkpoint; the buyer may only
  // confirm delivery of their own order.
  if (requester && !requester.isAdmin) {
    const buyerRef = (order.buyerId as any)?._id ?? order.buyerId
    const isSeller = String(order.sellerId) === requester.userId
    const isBuyer = String(buyerRef) === requester.userId
    if (!isSeller && !(isBuyer && deliveryStatus === 'delivered')) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        isBuyer
          ? 'Buyers can only confirm delivery.'
          : 'You can only update your own orders.',
      )
    }
  }

  // A cancelled order must not keep the buyer's money, and the item goes back
  // on sale.
  if (deliveryStatus === 'cancelled' && order.deliveryStatus !== 'cancelled') {
    if (order.paymentStatus === 'paid' && order.paymentIntentId) {
      try {
        await MarketplaceCharge.refundMarketplacePayment({
          paymentIntentId: order.paymentIntentId,
          stripeAccountId:
            order.stripeAccountId ||
            (await MarketplaceCharge.findSellerAccountId(
              order.sellerId?.toString(),
            )),
        })
        order.paymentStatus = 'refunded'
      } catch (error: any) {
        throw new ApiError(
          StatusCodes.BAD_GATEWAY,
          `Could not refund this order: ${error?.message}. It was left unchanged.`,
        )
      }
    }
    const productRef = (order.productId as any)?._id ?? order.productId
    if (productRef) {
      await Product.updateOne(
        { _id: productRef },
        { $inc: { stock: 1 }, $set: { status: 'active' } },
      )
    }
  }

  order.deliveryStatus = deliveryStatus
  order.trackingDetails.journeyUpdates.push(journeyUpdate)
  await order.save()

  const buyerUser = order.buyerId as any
  const buyerUserId = buyerUser?._id
    ? buyerUser._id.toString()
    : order.buyerId.toString()

  // Use participants[] array — consistent with Chat model schema
  const chat = await Chat.findOne({
    participants: { $all: [buyerUserId, order.sellerId] },
  })

  if (chat) {
    const trackingMsg = `Order tracking update: ${journeyUpdate.description} (${journeyUpdate.status})`
    await Message.create({
      chatId: chat._id,
      sender: order.sellerId,
      text: trackingMsg,
      messageType: 'order_update',
      seen: false,
      metadata: {
        orderId: (order as any)._id.toString(),
        statusLabel:
          deliveryStatus === 'shipped'
            ? 'ORDER SHIPPED 🚚'
            : 'SHIPMENT UPDATE 📦',
        trackingNumber: order.trackingDetails.trackingNumber,
        eta: journeyUpdate.location || 'In Transit',
      },
    })
  }

  if (buyerUser && buyerUser.deviceToken) {
    try {
      await sendPushNotification(
        buyerUser.deviceToken,
        `Order Update: ${journeyUpdate.status}`,
        `Your package: ${journeyUpdate.description}. Location: ${journeyUpdate.location || 'N/A'}`,
        { type: 'ORDER_UPDATE', orderId: (order as any)._id.toString() },
      )
    } catch (err) {
      console.error('FCM Push notification dispatch failed:', err)
    }
  }

  return order
}

export const OrderServices = {
  createOrder,
  getOrdersForUser,
  getOrderById,
  updateOrderJourney,
}
