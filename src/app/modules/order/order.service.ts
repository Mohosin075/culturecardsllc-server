import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { Order } from './order.model'
import { IOrder, IJourneyUpdate } from './order.interface'
import { Product } from '../product/product.model'
import { Chat } from '../chat/chat.model'
import { Message } from '../message/message.model'
import { Types } from 'mongoose'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'
import { initializeOrderShipping } from '../../../helpers/shippingHelper'

const createOrder = async (payload: Partial<IOrder>): Promise<IOrder> => {
  const product = await Product.findById(payload.productId)
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }

  if (product.stock <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Product is out of stock.')
  }

  // Populate shipping weight, tracking number, and mock PDF label
  await initializeOrderShipping(payload, product)

  const session = await Order.startSession()
  session.startTransaction()

  try {
    const orders = await Order.create([payload], { session })
    const order = orders[0]

    product.stock -= 1
    if (product.stock === 0) {
      product.status = 'sold'
    }
    await product.save({ session })

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
            sender: order.sellerId,
            text: `Order Confirmed: ${product.title} (#${(order as any)._id.toString().substring(0, 8).toUpperCase()})`,
            messageType: 'order_update',
            seen: false,
            metadata: {
              orderId: (order as any)._id.toString(),
              statusLabel: 'ORDER CONFIRMED 📦',
              eta: 'Delivery Pending',
            },
          },
        ],
        { session },
      )
    }

    await session.commitTransaction()
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
): Promise<IOrder> => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Order ID')
  }

  const order = await Order.findById(orderId).populate('productId buyerId')
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found')
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
