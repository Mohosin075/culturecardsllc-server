import { StatusCodes } from 'http-status-codes'
import stripe from '../../../config/stripe'
import ApiError from '../../../errors/ApiError'
import { Payment } from './payment.model'
import { emailHelper } from '../../../helpers/emailHelper'
const handleCheckoutSessionCompleted = async (
  sessionData: Record<string, unknown> & { id: string },
): Promise<void> => {
  try {
    console.log('🔔 Processing Checkout Session Completed:', sessionData.id)
    const sessionWithDetails = await stripe.checkout.sessions.retrieve(
      sessionData.id,
      {
        expand: ['payment_intent', 'line_items'],
      },
    )
    console.log(
      '✅ Session Details Retrieved. Payment Intent:',
      sessionWithDetails.payment_intent,
    )
    let lookupId: string

    if (typeof sessionWithDetails.payment_intent === 'string') {
      lookupId = sessionWithDetails.payment_intent
    } else if (sessionWithDetails.payment_intent?.id) {
      lookupId = sessionWithDetails.payment_intent.id
    } else {
      lookupId = sessionWithDetails.id
    }

    const mongoSession = await Payment.startSession()
    mongoSession.startTransaction()

    try {
      // Find and lock the payment document
      const payment = await Payment.findOne({
        $or: [
          { paymentIntentId: lookupId },
          { 'metadata.checkoutSessionId': sessionWithDetails.id },
        ],
      }).session(mongoSession)

      if (!payment) {
        throw new Error(
          `Payment not found for session: ${sessionWithDetails.id}`,
        )
      }

      // Check if already processed to avoid duplicates
      if (payment.status === 'succeeded') {
        await mongoSession.commitTransaction()
        return
      }

      // Update payment
      payment.status = 'succeeded'
      payment.metadata = { ...payment.metadata, ...sessionWithDetails }
      await payment.save({ session: mongoSession })

      // Booking and Wallet logic removed as requested

      await mongoSession.commitTransaction()
      console.log(
        `Successfully processed payment for session: ${sessionWithDetails.id}`,
      )

      // Send email
      await emailHelper.sendEmail({
        to: payment.userEmail,
        subject: 'Payment Successful',
        html: `<p>Your payment was successful.</p>`,
      })
    } catch (error) {
      await mongoSession.abortTransaction()
      throw error
    } finally {
      mongoSession.endSession()
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Checkout processing failed: ${errorMessage}`,
    )
  }
}

const handleCheckoutSessionExpired = async (
  session: Record<string, unknown> & { id: string },
): Promise<void> => {
  const mongoSession = await Payment.startSession()
  mongoSession.startTransaction()

  try {
    const payment = await Payment.findOne({
      $or: [
        { paymentIntentId: session.id },
        { 'metadata.checkoutSessionId': session.id },
      ],
    }).session(mongoSession)

    if (payment) {
      payment.status = 'failed'
      payment.metadata = { ...payment.metadata, ...session, expired: true }
      await payment.save({ session: mongoSession })
    }

    await mongoSession.commitTransaction()
  } catch (error) {
    await mongoSession.abortTransaction()
    throw error
  } finally {
    mongoSession.endSession()
  }
}

const handlePaymentSuccess = async (
  paymentIntent: Record<string, unknown> & {
    id: string
    metadata?: Record<string, string>
  },
): Promise<void> => {
  const mongoSession = await Payment.startSession()
  mongoSession.startTransaction()

  try {
    // STRICT LOOKUP: First try paymentIntentId
    let payment = await Payment.findOne({
      paymentIntentId: paymentIntent.id,
    }).session(mongoSession)

    // FALLBACK LOOKUP: Use bookingId from metadata
    if (!payment) {
      const metadata = paymentIntent.metadata || {}
      const bookingId = metadata.bookingId

      if (bookingId) {
        payment = await Payment.findOne({
          bookingId,
          status: 'pending',
        })
          .sort({ createdAt: -1 })
          .session(mongoSession)

        if (payment) {
          payment.paymentIntentId = paymentIntent.id
        } else {
          console.log(
            `⚠️ No record found for bookingId: ${bookingId} with status: pending`,
          )
        }
      } else {
        console.log(
          '❌ No bookingId found in metadata. Cannot perform fallback lookup.',
        )
      }
    }

    if (!payment) {
      await mongoSession.commitTransaction()
      return
    }

    // Check if already processed
    if (payment.status === 'succeeded') {
      await mongoSession.commitTransaction()
      return
    }

    // Update payment
    payment.status = 'succeeded'
    // Ensure we don't overwrite crucial metadata if it exists
    payment.metadata = { ...payment.metadata, ...paymentIntent }
    await payment.save({ session: mongoSession })

    // Booking and Wallet logic removed as requested
    await mongoSession.commitTransaction()
    console.log(`Successfully processed payment intent: ${paymentIntent.id}`)

    // Send email
    if (payment.userEmail) {
      await emailHelper.sendEmail({
        to: payment.userEmail,
        subject: 'Payment Successful',
        html: `<p>Your payment was successful.</p>`,
      })
    }
  } catch (error) {
    await mongoSession.abortTransaction()
    throw error
  } finally {
    mongoSession.endSession()
  }
}

const handlePaymentFailure = async (
  paymentIntent: Record<string, unknown> & {
    id: string
    metadata?: Record<string, string>
  },
): Promise<void> => {
  const mongoSession = await Payment.startSession()
  mongoSession.startTransaction()

  try {
    let payment = await Payment.findOne({
      paymentIntentId: paymentIntent.id,
    }).session(mongoSession)

    // Fallback for failure too
    if (
      !payment &&
      paymentIntent.metadata &&
      paymentIntent.metadata.bookingId
    ) {
      payment = await Payment.findOne({
        bookingId: paymentIntent.metadata.bookingId,
      }).session(mongoSession)
    }

    if (payment) {
      payment.status = 'failed'
      payment.metadata = { ...payment.metadata, ...paymentIntent }
      await payment.save({ session: mongoSession })
    }

    await mongoSession.commitTransaction()
  } catch (error) {
    await mongoSession.abortTransaction()
    throw error
  } finally {
    mongoSession.endSession()
  }
}

export const WebhookService = {
  handleWebhook: async (payload: {
    body: string | Buffer
    headers?: any
  }): Promise<void> => {
    try {
      const event = JSON.parse(payload.body.toString())
      console.log(`Processing webhook: ${event.type}`)

      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object)
          break
        case 'checkout.session.expired':
          await handleCheckoutSessionExpired(event.data.object)
          break
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object)
          break
        case 'payment_intent.payment_failed':
          await handlePaymentFailure(event.data.object)
          break
        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('Webhook processing error:', errorMessage)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Webhook processing failed: ${errorMessage}`,
      )
    }
  },
}
