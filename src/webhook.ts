import express, { Request, Response } from 'express'
import config from './config'
import stripe from './config/stripe'
import { WebhookService } from './app/modules/payment/webhook.service'
import { webhookService as subscriptionWebhookService } from './app/modules/subscription/webhook.service'
import { SellerServices } from './app/modules/seller/seller.service'
import { TradeSettlementServices } from './app/modules/trade/tradeSettlement.service'
import { TradeServices } from './app/modules/trade/trade.service'
import { RefundServices } from './app/modules/refund/refund.service'

const webhookApp = express()

webhookApp.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sig = req.headers['stripe-signature'] as string

      if (!sig) {
        res.status(400).json({ error: 'No Stripe signature' })
        return
      }

      if (!config.stripe.webhookSecret) {
        res.status(500).json({ error: 'Webhook secret not configured' })
        return
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body, 'utf8')

      const cleanSecret = config.stripe.webhookSecret.trim()

      let event
      console.log('🚀 Webhook hit! Signature:', sig)
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, cleanSecret)
        console.log('✅ Webhook Event Constructed:', event.type)
      } catch (err: any) {
        console.error('❌ Webhook Construction Error:', err.message)
        res.status(400).json({ error: `Webhook Error: ${err.message}` })
        return
      }

      // Connect account lifecycle — keeps each seller's verification and
      // payout eligibility in step with Stripe without the app having to poll.
      if (
        event.type === 'account.updated' ||
        event.type === 'account.application.deauthorized'
      ) {
        const account = event.data.object as { id?: string }
        if (account?.id) {
          await SellerServices.syncByAccountId(account.id).catch(err =>
            console.error('[SellerConnect] account.updated sync failed:', err),
          )
        }
      }

      // Chargebacks. On direct charges the dispute belongs to the seller's
      // connected account and Stripe takes the money from their balance, so
      // ARIES is recording what happened rather than paying for it.
      // `event.account` is the connected account the dispute was raised on.
      if (event.type.startsWith('charge.dispute.')) {
        try {
          await RefundServices.recordDisputeFromWebhook(
            event.data.object as any,
            (event as any).account,
          )
        } catch (err) {
          console.error('[Dispute] Failed to record dispute:', err)
        }
      }

      // Trade settlement: a trade only swaps once both sides have paid, and
      // the second payment can land long after the first, so the swap is
      // driven from here rather than from the request that started it.
      if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object as { id?: string; metadata?: any }
        if (intent?.metadata?.purchaseType === 'trade_settlement' && intent.id) {
          try {
            const outcome =
              await TradeSettlementServices.markPartyPaidByIntent(intent.id)
            if (outcome?.settled) {
              await TradeServices.finalizeTradeSwap(outcome.tradeOfferId)
            }
          } catch (err) {
            console.error('[TradeSettlement] webhook handling failed:', err)
          }
        }
      }

      await Promise.allSettled([
        WebhookService.handleWebhook({
          body: rawBody,
          headers: {
            'stripe-signature': sig,
          },
        }),
        subscriptionWebhookService.processWebhookEvent(event),
      ])

      res.status(200).json({
        received: true,
        event: event.type,
        message: 'Webhook processed successfully',
      })
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
        event: 'unknown',
      })
    }
  },
)

export default webhookApp
