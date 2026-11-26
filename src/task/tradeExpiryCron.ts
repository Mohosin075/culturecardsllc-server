import cron from 'node-cron'
import { TradeOffer } from '../app/modules/trade/trade.model'
import { Product } from '../app/modules/product/product.model'
import { Chat } from '../app/modules/chat/chat.model'
import { Message } from '../app/modules/message/message.model'
import { io } from '../server'
import { TradeFulfillment } from '../app/modules/trade/tradeFulfillment.service'

/**
 * Trade Expiry Cron Job
 * Runs every hour. Finds all pending trade offers past their expiresAt
 * and marks them as 'expired', restoring product statuses if needed.
 */
export const startTradeExpiryCron = (): void => {
  cron.schedule('0 * * * *', async () => {
    console.log('[TradeExpiryCron] Running trade expiry check...')

    try {
      const expiredOffers = await TradeOffer.find({
        status: 'pending',
        expiresAt: { $lte: new Date() },
      })

      if (expiredOffers.length === 0) {
        console.log('[TradeExpiryCron] No expired offers found.')
        return
      }

      console.log(`[TradeExpiryCron] Found ${expiredOffers.length} expired offer(s).`)

      for (const offer of expiredOffers as any[]) {
        try {
          // Mark offer expired
          offer.status = 'expired'
          await offer.save()

          // Restore product statuses if they were somehow locked
          await Product.updateMany(
            {
              _id: {
                $in: [
                  ...(offer.senderProductIds || []),
                  ...(offer.receiverProductIds || []),
                ],
              },
              status: 'pending', // only restore if still pending (not sold/completed)
            },
            { status: 'active' },
          )

          // Chat notification
          const chat = await Chat.findOne({
            participants: { $all: [offer.senderId, offer.receiverId] },
          })

          if (chat) {
            await Message.create({
              chatId: chat._id,
              sender: offer.senderId,
              text: 'Your trade offer has expired after 24 hours. ⏰',
              messageType: 'trade_proposal',
              seen: false,
              metadata: {
                tradeOfferId: offer._id.toString(),
                statusLabel: 'TRADE EXPIRED ⏰',
              },
            })
          }

          // Socket notify both parties
          if (io) {
            [offer.senderId.toString(), offer.receiverId.toString()].forEach(uid => {
              io!.to(uid).emit('trade-expired', {
                tradeOfferId: offer._id.toString(),
                message: 'A trade offer has expired ⏰',
              })
            })
          }
        } catch (innerErr) {
          console.error(`[TradeExpiryCron] Failed to expire offer ${offer._id}:`, innerErr)
        }
      }

      console.log(`[TradeExpiryCron] Successfully expired ${expiredOffers.length} offer(s).`)
    } catch (err) {
      console.error('[TradeExpiryCron] Error during expiry check:', err)
    }
  })

  // Accepted trades: payment window and ship-by deadline (client #4 and the
  // 2026-11-25 follow-up). Every 15 minutes.
  cron.schedule('*/15 * * * *', async () => {
    await TradeFulfillment.enforcePaymentDeadlines().catch(err =>
      console.error('[TradeDeadlines] payment check failed:', err),
    )
    await TradeFulfillment.enforceShipDeadlines().catch(err =>
      console.error('[TradeDeadlines] ship-by check failed:', err),
    )
  })

  console.log('[TradeExpiryCron] Trade expiry cron job scheduled (every hour).')
}
