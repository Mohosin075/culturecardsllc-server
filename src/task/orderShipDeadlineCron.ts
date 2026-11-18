import cron from 'node-cron'
import { Order } from '../app/modules/order/order.model'
import { Product } from '../app/modules/product/product.model'
import { Chat } from '../app/modules/chat/chat.model'
import { Message } from '../app/modules/message/message.model'
import { User } from '../app/modules/user/user.model'
import { sendPushNotification } from '../helpers/pushnotificationHelper'
import stripe from '../config/stripe'

/**
 * Order Ship-Deadline Cron Job
 * Runs hourly.
 *
 * A paid order the seller never shipped would otherwise sit on `pending`
 * forever with the buyer's money held and no way out. This cancels anything
 * still unshipped past its `shipByDate`, refunds the buyer, and tells both
 * sides what happened.
 */
export const startOrderShipDeadlineCron = (): void => {
  cron.schedule('0 * * * *', async () => {
    try {
      const overdue = await Order.find({
        deliveryStatus: 'pending',
        paymentStatus: 'paid',
        shipByDate: { $ne: null, $lte: new Date() },
      }).populate('productId')

      if (overdue.length === 0) return

      console.log(
        `[OrderShipDeadlineCron] Cancelling ${overdue.length} unshipped order(s).`,
      )

      for (const order of overdue as any[]) {
        try {
          await cancelAndRefund(order)
        } catch (error) {
          console.error(
            `[OrderShipDeadlineCron] Failed on order ${order._id}:`,
            error,
          )
        }
      }
    } catch (error) {
      console.error('[OrderShipDeadlineCron] Run failed:', error)
    }
  })

  console.log('⏰ Order ship-deadline cron scheduled (hourly)')
}

const cancelAndRefund = async (order: any): Promise<void> => {
  const productTitle = order.productId?.title || 'your item'
  const amount = order.amountDetails?.totalPaid || 0

  // 1. Refund first — never cancel an order while still holding the money.
  let refunded = false
  if (order.paymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: order.paymentIntentId })
      refunded = true
    } catch (error: any) {
      console.error(
        `[OrderShipDeadlineCron] Stripe refund failed for ${order._id}:`,
        error?.message,
      )
      // Leave the order alone so the next run retries the refund.
      return
    }
  }

  // 2. Mark the order cancelled with a visible trail.
  order.deliveryStatus = 'cancelled'
  order.paymentStatus = refunded ? 'refunded' : order.paymentStatus
  order.cancelReason = 'Seller did not ship within the required window.'
  order.trackingDetails.journeyUpdates.push({
    status: 'Order Cancelled',
    description: refunded
      ? 'The seller did not ship in time. Your payment has been refunded.'
      : 'The seller did not ship in time. This order was cancelled.',
    timestamp: new Date(),
  })
  await order.save()

  // 3. Put the item back on sale.
  if (order.productId?._id) {
    await Product.updateOne(
      { _id: order.productId._id },
      { $inc: { stock: 1 }, $set: { status: 'active' } },
    )
  }

  // 4. Tell both sides, in chat and by push.
  const chat = await Chat.findOne({
    participants: { $all: [order.buyerId, order.sellerId] },
  })
  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: order.buyerId,
      text: `Order cancelled: ${productTitle} was not shipped in time.`,
      messageType: 'order_update',
      seen: false,
      metadata: {
        orderId: order._id.toString(),
        statusLabel: 'ORDER CANCELLED ❌',
        eta: refunded ? 'Refunded' : 'Refund pending',
      },
    })
  }

  const [buyer, seller] = await Promise.all([
    User.findById(order.buyerId).select('deviceToken'),
    User.findById(order.sellerId).select('deviceToken'),
  ])

  if (buyer?.deviceToken) {
    await sendPushNotification(
      buyer.deviceToken,
      'Order Cancelled & Refunded',
      `${productTitle} wasn't shipped in time. $${amount.toFixed(2)} has been refunded.`,
      { type: 'ORDER_UPDATE', orderId: order._id.toString() },
    ).catch(() => {})
  }

  if (seller?.deviceToken) {
    await sendPushNotification(
      seller.deviceToken,
      'Order Cancelled',
      `${productTitle} was cancelled because it wasn't shipped in time.`,
      { type: 'ORDER_UPDATE', orderId: order._id.toString() },
    ).catch(() => {})
  }
}
