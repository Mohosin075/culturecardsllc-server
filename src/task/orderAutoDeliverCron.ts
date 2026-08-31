import cron from 'node-cron'
import { Order } from '../app/modules/order/order.model'
import { Chat } from '../app/modules/chat/chat.model'
import { Message } from '../app/modules/message/message.model'
import { sendPushNotification } from '../helpers/pushnotificationHelper'
import { io } from '../server'

/**
 * Order Auto-Deliver Cron Job
 * Runs every day at midnight (00:00).
 * Finds all orders in 'shipped' status with 'paid' payment that have been in transit
 * for 14 or more days, and marks them as 'delivered' automatically.
 */
export const startOrderAutoDeliverCron = (): void => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[OrderAutoDeliverCron] Running 14-day auto-delivery check...')

    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

      const eligibleOrders = await Order.find({
        deliveryStatus: 'shipped',
        paymentStatus: 'paid',
        updatedAt: { $lte: fourteenDaysAgo },
      }).populate('buyerId sellerId productId')

      if (eligibleOrders.length === 0) {
        console.log('[OrderAutoDeliverCron] No shipped orders reached 14 days limit.')
        return
      }

      console.log(`[OrderAutoDeliverCron] Found ${eligibleOrders.length} order(s) to auto-deliver.`)

      for (const order of eligibleOrders as any[]) {
        try {
          const journeyUpdate = {
            status: 'Delivered',
            description: 'Package automatically marked as delivered (14-day transit completed).',
            location: order.shippingAddress?.city
              ? `${order.shippingAddress.city}, ${order.shippingAddress.state || ''}`
              : 'Destination',
            timestamp: new Date(),
          }

          order.deliveryStatus = 'delivered'
          if (!order.trackingDetails) {
            order.trackingDetails = { journeyUpdates: [] }
          }
          order.trackingDetails.journeyUpdates.push(journeyUpdate)
          await order.save()

          const buyerUser = order.buyerId as any
          const buyerUserId = buyerUser?._id ? buyerUser._id.toString() : order.buyerId?.toString()
          const sellerUserId = order.sellerId?._id ? order.sellerId._id.toString() : order.sellerId?.toString()

          // 1. Create In-App Chat Update
          if (buyerUserId && sellerUserId) {
            const chat = await Chat.findOne({
              participants: { $all: [buyerUserId, sellerUserId] },
            })

            if (chat) {
              await Message.create({
                chatId: chat._id,
                sender: sellerUserId,
                text: `Order Delivered: Package auto-confirmed as delivered. #${order._id.toString().substring(0, 8).toUpperCase()}`,
                messageType: 'order_update',
                seen: false,
                metadata: {
                  orderId: order._id.toString(),
                  statusLabel: 'ORDER DELIVERED ✅',
                  trackingNumber: order.trackingDetails.trackingNumber,
                  eta: journeyUpdate.location,
                },
              })
            }
          }

          // 2. Dispatch FCM Push Notification to Buyer
          if (buyerUser && buyerUser.deviceToken) {
            try {
              await sendPushNotification(
                buyerUser.deviceToken,
                'Order Delivered ✅',
                'Your package has been auto-marked as delivered. Thank you for shopping with CultureCards!',
                { type: 'ORDER_UPDATE', orderId: order._id.toString() },
              )
            } catch (fcmErr) {
              console.error(`[OrderAutoDeliverCron] Push notification failed for order ${order._id}:`, fcmErr)
            }
          }

          // 3. Socket broadcast to buyer & seller if active
          if (io && buyerUserId && sellerUserId) {
            [buyerUserId, sellerUserId].forEach(uid => {
              io.to(uid).emit('order-status-updated', {
                orderId: order._id.toString(),
                deliveryStatus: 'delivered',
                message: 'Order has been delivered ✅',
              })
            })
          }

          console.log(`[OrderAutoDeliverCron] Auto-delivered order: ${order._id}`)
        } catch (innerErr) {
          console.error(`[OrderAutoDeliverCron] Failed to auto-deliver order ${order._id}:`, innerErr)
        }
      }

      console.log(`[OrderAutoDeliverCron] Processed ${eligibleOrders.length} auto-delivery orders successfully.`)
    } catch (err) {
      console.error('[OrderAutoDeliverCron] Error during auto-deliver check:', err)
    }
  })

  console.log('[OrderAutoDeliverCron] Order auto-delivery cron job scheduled (daily at midnight).')
}
