import { USER_ROLES } from '../../../enum/user'
import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import {
  IPaymentFilterables,
  IPayment,
  IPaymentPayload,
} from './payment.interface'
import { Payment } from './payment.model'
import { JwtPayload } from 'jsonwebtoken'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
import { paymentSearchableFields } from './payment.constants'
import { Types } from 'mongoose'
import { User } from '../user/user.model'
import stripe from '../../../config/stripe'

import { WebhookService } from './webhook.service'
import { emailHelper } from '../../../helpers/emailHelper'
import { generatePDFInvoice } from '../../../helpers/invoiceHelper'

const createCheckoutSession = async (
  user: JwtPayload,
  payload: IPaymentPayload,
): Promise<{ clientSecret: string; ephemeralKey: string; customer: string; paymentIntentId: string }> => {
  try {
    const userData = await User.findById(user.userId)
    if (!userData) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }

    let customerId = userData.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: userData.fullName || userData.name || '',
      })
      customerId = customer.id
      userData.stripeCustomerId = customerId
      await userData.save()
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2023-10-16' }
    )

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payload.amount * 100),
      currency: payload.currency || 'usd',
      customer: customerId,
      metadata: {
        userId: user.userId.toString(),
        ...(payload.bookingId && { bookingId: payload.bookingId.toString() }),
        ...(payload.orderId && { orderId: payload.orderId.toString() }),
        ...(payload.tradeOfferId && { tradeOfferId: payload.tradeOfferId.toString() }),
        ...payload.metadata,
      },
    })

    await Payment.create({
      userId: user.userId,
      bookingId: payload.bookingId,
      orderId: payload.orderId,
      tradeOfferId: payload.tradeOfferId,
      userEmail: user.email,
      amount: payload.amount,
      currency: payload.currency || 'usd',
      paymentMethod: 'stripe',
      paymentIntentId: paymentIntent.id,
      status: 'pending',
      metadata: {
        ...(payload.bookingId && { bookingId: payload.bookingId.toString() }),
        ...(payload.orderId && { orderId: payload.orderId.toString() }),
        ...(payload.tradeOfferId && { tradeOfferId: payload.tradeOfferId.toString() }),
        ...payload.metadata,
      },
    })

    return {
      clientSecret: paymentIntent.client_secret as string,
      ephemeralKey: ephemeralKey.secret as string,
      customer: customerId,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Checkout session creation failed: ${errorMessage}`,
    )
  }
}

const verifyCheckoutSession = async (sessionId: string): Promise<IPayment> => {
  try {
    let paymentStatus = '';
    let paymentIntentId = '';
    let metadata: any = {};
    let fullStripeObject: any = null;

    if (sessionId.startsWith('pi_')) {
      const intent = await stripe.paymentIntents.retrieve(sessionId);
      paymentStatus = intent.status === 'succeeded' ? 'paid' : intent.status;
      paymentIntentId = intent.id;
      metadata = intent.metadata;
      fullStripeObject = intent;
      
      console.log('🔍 Verifying Payment Intent:', intent.id)
    } else {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });
      paymentStatus = session.payment_status;
      paymentIntentId = (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id) || '';
      metadata = session.metadata;
      fullStripeObject = session;

      console.log('🔍 Verifying Checkout Session:', session.id)
    }

    // Find payment record using either paymentIntentId (legacy/direct) or metadata.checkoutSessionId (correct for checkout)
    const payment = await Payment.findOne({
      $or: [
        { paymentIntentId: sessionId },
        { 'metadata.checkoutSessionId': sessionId },
        { paymentIntentId: paymentIntentId },
      ],
    }).populate('userId', 'name email')

    if (!payment) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found')
    }

    // Update payment status based on session or intent
    if (paymentStatus === 'paid' && payment.status !== 'succeeded') {
      const dbSession = await Payment.startSession()
      dbSession.startTransaction()

      try {
        // Update payment status
        payment.status = 'succeeded'
        payment.metadata = { ...payment.metadata, stripeData: fullStripeObject }
        await payment.save({ session: dbSession })

        // Booking and Wallet logic removed as requested

        // Send confirmation email
        const user = await payment.populate('userId')
        const userData = user.userId as unknown as {
          name: string
          email: string
        }

        if (userData) {
          await emailHelper.sendEmail({
            to: userData.email,
            subject: 'Payment Successful',
            html: `<p>Hi ${userData.name}, your payment of ${payment.amount} ${payment.currency} was successful.</p>`,
          })
        }

        await dbSession.commitTransaction()
      } catch (error) {
        await dbSession.abortTransaction()
        throw error
      } finally {
        dbSession.endSession()
      }
    } else if (
      (paymentStatus === 'unpaid' || paymentStatus === 'requires_payment_method') &&
      payment.status !== 'failed'
    ) {
      payment.status = 'failed'
      await payment.save()
    }

    return payment
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Payment verification failed: ${errorMessage}`,
    )
  }
}

// ============================================
// FLUTTER STRIPE INTEGRATION METHODS
// ============================================

/**
 * Create Payment Intent for Flutter App
 * Used by flutter_stripe SDK for native mobile payments
 *
 * Supports two modes:
 * 1. NEW CARD: No paymentMethodId → returns clientSecret for Flutter SDK to collect card
 * 2. SAVED CARD: paymentMethodId provided → attaches saved card & auto-confirms off-session
 */
const createPaymentIntent = async (
  user: JwtPayload,
  payload: IPaymentPayload,
): Promise<{
  clientSecret: string
  paymentIntentId: string
  amount: number
  status: string
}> => {
  try {
    // Determine payable amount from payload (as Booking is missing)
    const payableAmount =
      typeof payload.amount === 'number' ? Number(payload.amount.toFixed(2)) : 0

    if (payableAmount <= 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'No payable amount found for this payment',
      )
    }

    // Get or create Stripe customer (needed for saved card payments)
    const userData = await User.findById(user.userId)
    if (!userData) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')

    const userEmail = userData.email

    let customerId = userData.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.fullName || userData.name,
        metadata: { userId: userData._id.toString() },
      })
      customerId = customer.id
      userData.stripeCustomerId = customer.id
      await userData.save()
    }

    // Build PaymentIntent params
    const intentParams: any = {
      amount: Math.round(payableAmount * 100), // Convert to cents
      currency: 'eur',
      customer: customerId,
      metadata: {
        userId: user.userId,
        userEmail,
        ...(payload.bookingId && { bookingId: payload.bookingId.toString() }),
        ...(payload.orderId && { orderId: payload.orderId.toString() }),
        ...(payload.tradeOfferId && { tradeOfferId: payload.tradeOfferId.toString() }),
        ...payload.metadata,
      },
    }

    // If paymentMethodId is provided → pay with saved card (off-session)
    if (payload.paymentMethodId) {
      intentParams.payment_method = payload.paymentMethodId
      intentParams.off_session = true
      intentParams.confirm = true // Auto-confirm with saved card
    } else {
      // New card → Flutter SDK will collect card details using clientSecret
      intentParams.payment_method_types = ['card']
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams)

    // Create payment record
    await Payment.create({
      userId: user.userId,
      bookingId: payload.bookingId,
      orderId: payload.orderId,
      tradeOfferId: payload.tradeOfferId,
      userEmail,
      amount: payableAmount,
      currency: 'EUR',
      paymentMethod: 'stripe',
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
      metadata: {
        userId: user.userId,
        ...(payload.bookingId && { bookingId: payload.bookingId.toString() }),
        ...(payload.orderId && { orderId: payload.orderId.toString() }),
        ...(payload.tradeOfferId && { tradeOfferId: payload.tradeOfferId.toString() }),
        usedSavedCard: !!payload.paymentMethodId,
        ...payload.metadata,
      },
    })

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: payableAmount,
      status: paymentIntent.status,
    }
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Payment Intent creation failed: ${errorMessage}`,
    )
  }
}

/**
 * Create Ephemeral Key for Flutter Stripe SDK
 * Required for customer-scoped operations in flutter_stripe
 */
const createEphemeralKey = async (
  user: JwtPayload,
  apiVersion: string = '2025-05-28.basil',
): Promise<{ ephemeralKey: string }> => {
  try {
    const userData = await User.findById(user.userId)
    if (!userData) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }

    let customerId = userData.stripeCustomerId

    // Create customer if it doesn't exist in DB
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.fullName || userData.name,
        metadata: {
          userId: user.userId,
        },
      })
      customerId = customer.id

      // Update user record with stripeCustomerId
      userData.stripeCustomerId = customer.id
      await userData.save()
    }

    // Create ephemeral key
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: apiVersion },
    )

    return {
      ephemeralKey: ephemeralKey.secret!,
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Ephemeral key creation failed: ${errorMessage}`,
    )
  }
}

/**
 * Handle Payment Intent Webhook Events
 * Processes payment_intent.succeeded events from Stripe
 */
const handlePaymentIntentWebhook = async (
  paymentIntent: Record<string, unknown> & { id?: string },
): Promise<void> => {
  try {
    const payment = await Payment.findOne({
      paymentIntentId: paymentIntent.id,
    })

    if (!payment) {
      console.error(`Payment not found for Payment Intent: ${paymentIntent.id}`)
      return
    }

    if (payment.status === 'succeeded') {
      console.log(`Payment already processed: ${paymentIntent.id}`)
      return
    }

    // Start MongoDB transaction
    const session = await Payment.startSession()
    session.startTransaction()

    try {
      // Update payment status
      payment.status = 'succeeded'
      payment.metadata = {
        ...payment.metadata,
        processedAt: new Date().toISOString(),
      }
      await payment.save({ session })

      await session.commitTransaction()
      console.log(`Payment processed successfully: ${paymentIntent.id}`)
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error(`Webhook processing failed: ${errorMessage}`)
    throw error
  }
}

// ============================================
// EXISTING METHODS
// ============================================

const getAllPayments = async (
  user: JwtPayload,
  filterables: IPaymentFilterables,
  pagination: IPaginationOptions,
) => {
  const { searchTerm, ...filterData } = filterables
  const { page, skip, limit, sortBy, sortOrder } =
    paginationHelper.calculatePagination(pagination)

  const andConditions = []

  // Search functionality
  if (searchTerm) {
    andConditions.push({
      $or: paymentSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    })
  }

  // Filter functionality
  if (Object.keys(filterData).length) {
    andConditions.push({
      $and: Object.entries(filterData).map(([key, value]) => ({
        [key]: value,
      })),
    })
  }

  // Regular users can only see their own payments
  if (
    user.activeRole === USER_ROLES.BUYER ||
    user.activeRole === USER_ROLES.SELLER
  ) {
    andConditions.push({
      userId: new Types.ObjectId(user.userId),
    })
  }

  const whereConditions = andConditions.length ? { $and: andConditions } : {}

  const [result, total] = await Promise.all([
    Payment.find(whereConditions)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .populate('userId', 'name email')
      .populate({
        path: 'bookingId',
      }),
    Payment.countDocuments(whereConditions),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  }
}

const getSinglePayment = async (id: string): Promise<IPayment> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Payment ID')
  }

  const result = await Payment.findById(id).populate('userId', 'name email')

  if (!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested payment not found, please try again with valid id',
    )
  }

  return result
}

const updatePayment = async (
  id: string,
  payload: Partial<IPayment>,
): Promise<IPayment | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Payment ID')
  }

  const result = await Payment.findByIdAndUpdate(
    new Types.ObjectId(id),
    { $set: payload },
    {
      new: true,
      runValidators: true,
    },
  ).populate('userId', 'name email')

  if (!result) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Requested payment not found, please try again with valid id',
    )
  }

  return result
}

const refundPayment = async (
  id: string,
  reason?: string,
): Promise<IPayment> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Payment ID')
  }

  const payment = await Payment.findById(id)
  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found')
  }

  if (payment.status !== 'succeeded') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only successful payments can be refunded',
    )
  }

  // Process refund via Stripe
  try {
    let refundPaymentIntentId = payment.paymentIntentId
    const checkoutSessionId = payment.metadata?.checkoutSessionId

    // For checkout payments, paymentIntentId may hold session ID in older records.
    if (checkoutSessionId) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(
        checkoutSessionId as string,
      )
      if (typeof checkoutSession.payment_intent === 'string') {
        refundPaymentIntentId = checkoutSession.payment_intent
      }
    }

    const refund = await stripe.refunds.create({
      payment_intent: refundPaymentIntentId,
      amount: Math.round(payment.amount * 100),
      reason: reason ? 'requested_by_customer' : 'duplicate',
    })

    const dbSession = await Payment.startSession()
    dbSession.startTransaction()

    let result: IPayment | null = null
    try {
      result = await Payment.findByIdAndUpdate(
        id,
        {
          status: 'refunded',
          refundAmount: payment.amount,
          refundReason: reason,
          metadata: { ...payment.metadata, refundId: refund.id },
        },
        { new: true, runValidators: true, session: dbSession },
      ).populate('userId', 'name email')

      // Booking logic removed as requested

      await dbSession.commitTransaction()
    } catch (error) {
      await dbSession.abortTransaction()
      throw error
    } finally {
      dbSession.endSession()
    }

    return result!
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Refund failed: ${errorMessage}`,
    )
  }
}

const getMyPayments = async (
  user: JwtPayload,
  pagination: IPaginationOptions,
) => {
  const { page, skip, limit, sortBy, sortOrder } =
    paginationHelper.calculatePagination(pagination)

  const [result, total] = await Promise.all([
    Payment.find({ userId: new Types.ObjectId(user.userId) })
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .populate('userId', 'name email'),
    Payment.countDocuments({ userId: new Types.ObjectId(user.userId) }),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  }
}

const generateInvoice = async (id: string): Promise<string | Buffer> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Payment ID')
  }

  const payment = await Payment.findById(id)
    .populate('userId')
    .populate('bookingId')

  if (!payment) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found')
  }

  // 1. If it's a Stripe payment, try to get the official receipt URL
  if (
    payment.paymentIntentId &&
    payment.status === 'succeeded' &&
    payment.paymentMethod === 'stripe'
  ) {
    try {
      const pi = await stripe.paymentIntents.retrieve(payment.paymentIntentId)
      if (pi.latest_charge) {
        const charge = await stripe.charges.retrieve(pi.latest_charge as string)
        if (charge.receipt_url) {
          return charge.receipt_url
        }
      }
    } catch (error) {
      console.error('Failed to fetch stripe receipt:', error)
    }
  }

  // 2. Fallback to custom PDF invoice generation
  return await generatePDFInvoice(payment as unknown as IPayment)
}

/**
 * Create Setup Intent to save payment method for future use
 */
const createSetupIntent = async (
  user: JwtPayload,
): Promise<{ clientSecret: string }> => {
  const userData = await User.findById(user.userId)
  if (!userData) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')

  let customerId = userData.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.email,
      name: userData.fullName || userData.name,
      metadata: { userId: userData._id.toString() },
    })
    customerId = customer.id
    userData.stripeCustomerId = customer.id
    await userData.save()
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  })

  return {
    clientSecret: setupIntent.client_secret!,
  }
}

/**
 * List all saved payment methods for a user
 */
const getMyPaymentMethods = async (user: JwtPayload) => {
  const userData = await User.findById(user.userId)
  if (!userData?.stripeCustomerId) return []

  const paymentMethods = await stripe.paymentMethods.list({
    customer: userData.stripeCustomerId,
    type: 'card',
  })

  const customer = (await stripe.customers.retrieve(
    userData.stripeCustomerId,
  )) as import('stripe').Stripe.Customer
  const defaultPaymentMethodId =
    customer.invoice_settings?.default_payment_method

  return paymentMethods.data.map(pm => ({
    id: pm.id,
    brand: pm.card?.brand,
    last4: pm.card?.last4,
    expMonth: pm.card?.exp_month,
    expYear: pm.card?.exp_year,
    isDefault: pm.id === defaultPaymentMethodId,
  }))
}

/**
 * Delete a saved payment method
 */
const deletePaymentMethod = async (
  user: JwtPayload,
  paymentMethodId: string,
) => {
  const userData = await User.findById(user.userId)
  if (!userData?.stripeCustomerId)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No stripe customer found')

  // Verify ownership (optional check, Stripe handles detachment but good for safety)
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  if (pm.customer !== userData.stripeCustomerId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Payment method does not belong to this user',
    )
  }

  await stripe.paymentMethods.detach(paymentMethodId)
  return { success: true }
}

/**
 * Set a payment method as default
 */
const setDefaultPaymentMethod = async (
  user: JwtPayload,
  paymentMethodId: string,
) => {
  const userData = await User.findById(user.userId)
  if (!userData?.stripeCustomerId)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No stripe customer found')

  await stripe.customers.update(userData.stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })

  return { success: true }
}

export const PaymentServices = {
  getAllPayments,
  getSinglePayment,
  updatePayment,
  refundPayment,
  getMyPayments,
  createCheckoutSession,
  verifyCheckoutSession,
  handleWebhook: WebhookService.handleWebhook,
  createPaymentIntent,
  createEphemeralKey,
  handlePaymentIntentWebhook,
  generateInvoice,
  createSetupIntent,
  getMyPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
}
