'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.WebhookService = void 0
const http_status_codes_1 = require('http-status-codes')
const stripe_1 = __importDefault(require('../../../config/stripe'))
const ApiError_1 = __importDefault(require('../../../errors/ApiError'))
const payment_model_1 = require('./payment.model')
const emailHelper_1 = require('../../../helpers/emailHelper')
const handleCheckoutSessionCompleted = async sessionData => {
  var _a
  try {
    console.log('🔔 Processing Checkout Session Completed:', sessionData.id)
    const sessionWithDetails =
      await stripe_1.default.checkout.sessions.retrieve(sessionData.id, {
        expand: ['payment_intent', 'line_items'],
      })
    console.log(
      '✅ Session Details Retrieved. Payment Intent:',
      sessionWithDetails.payment_intent,
    )
    let lookupId
    if (typeof sessionWithDetails.payment_intent === 'string') {
      lookupId = sessionWithDetails.payment_intent
    } else if (
      (_a = sessionWithDetails.payment_intent) === null || _a === void 0
        ? void 0
        : _a.id
    ) {
      lookupId = sessionWithDetails.payment_intent.id
    } else {
      lookupId = sessionWithDetails.id
    }
    const mongoSession = await payment_model_1.Payment.startSession()
    mongoSession.startTransaction()
    try {
      // Find and lock the payment document
      const payment = await payment_model_1.Payment.findOne({
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
      await emailHelper_1.emailHelper.sendEmail({
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
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
      `Checkout processing failed: ${errorMessage}`,
    )
  }
}
const handleCheckoutSessionExpired = async session => {
  const mongoSession = await payment_model_1.Payment.startSession()
  mongoSession.startTransaction()
  try {
    const payment = await payment_model_1.Payment.findOne({
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
const handlePaymentSuccess = async paymentIntent => {
  const mongoSession = await payment_model_1.Payment.startSession()
  mongoSession.startTransaction()
  try {
    // STRICT LOOKUP: First try paymentIntentId
    let payment = await payment_model_1.Payment.findOne({
      paymentIntentId: paymentIntent.id,
    }).session(mongoSession)
    // FALLBACK LOOKUP: Use bookingId from metadata
    if (!payment) {
      const metadata = paymentIntent.metadata || {}
      const bookingId = metadata.bookingId
      if (bookingId) {
        payment = await payment_model_1.Payment.findOne({
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
      await emailHelper_1.emailHelper.sendEmail({
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
const handlePaymentFailure = async paymentIntent => {
  const mongoSession = await payment_model_1.Payment.startSession()
  mongoSession.startTransaction()
  try {
    let payment = await payment_model_1.Payment.findOne({
      paymentIntentId: paymentIntent.id,
    }).session(mongoSession)
    // Fallback for failure too
    if (
      !payment &&
      paymentIntent.metadata &&
      paymentIntent.metadata.bookingId
    ) {
      payment = await payment_model_1.Payment.findOne({
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
exports.WebhookService = {
  handleWebhook: async payload => {
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('Webhook processing error:', errorMessage)
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
        `Webhook processing failed: ${errorMessage}`,
      )
    }
  },
}
