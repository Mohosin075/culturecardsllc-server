import express, { Request, Response } from 'express'
import config from './config'
import stripe from './config/stripe'
import { WebhookService } from './app/modules/payment/webhook.service'
import { webhookService as subscriptionWebhookService } from './app/modules/subscription/webhook.service'

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
