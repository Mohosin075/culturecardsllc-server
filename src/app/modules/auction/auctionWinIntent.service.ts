import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import ApiError from '../../../errors/ApiError'
import { Payment } from '../payment/payment.model'
import { MarketplaceCharge } from '../payment/marketplaceCharge'
import { createAuctionWinOrder } from '../payment/webhook.service'
import { User } from '../user/user.model'

/**
 * Pay for an auction win inside the app (Stripe PaymentSheet) instead of the
 * Stripe Checkout web page.
 *
 * The win already has a pending Payment row (made when the auction closed,
 * together with a Checkout link kept as a fallback). This makes a
 * PaymentIntent for the same amount on the seller's connected account, with
 * ARIES's sale fee as the application fee, exactly like the Checkout path.
 * The buyer's shipping address comes from the sheet and is saved on the order.
 *
 * The order is created once the intent has succeeded: right away when the app
 * confirms, or from the payment_intent.succeeded webhook if the app never
 * gets that far. Both paths are idempotent.
 */

export type WinShippingAddress = {
  fullName?: string
  phone?: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

const findPendingWin = async (userId: string, paymentId: string) => {
  if (!Types.ObjectId.isValid(paymentId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid payment id')
  }
  const payment: any = await Payment.findOne({
    _id: paymentId,
    userId: new Types.ObjectId(userId),
    'metadata.purchaseType': 'auction_win',
  })
  if (!payment) throw new ApiError(StatusCodes.NOT_FOUND, 'Auction win not found')
  return payment
}

const validAddress = (a: any): a is WinShippingAddress =>
  !!a && ['street', 'city', 'state', 'postalCode', 'country'].every(k => String(a[k] || '').trim())

/** Makes (or reuses) the PaymentIntent the app shows in PaymentSheet. */
const createWinIntent = async (
  userId: string,
  paymentId: string,
  shippingAddress: WinShippingAddress,
) => {
  if (!validAddress(shippingAddress)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A full shipping address is required.')
  }
  const payment = await findPendingWin(userId, paymentId)
  if (payment.status === 'succeeded') {
    throw new ApiError(StatusCodes.CONFLICT, 'This win is already paid.')
  }
  if (payment.status !== 'pending') {
    throw new ApiError(StatusCodes.GONE, 'This payment link has expired.')
  }
  const meta = payment.metadata || {}
  const account: string | undefined = meta.stripeAccountId
  if (!account) {
    throw new ApiError(StatusCodes.CONFLICT, 'The seller cannot take payments right now.')
  }

  const amountCents = Math.round(Number(payment.amount) * 100)
  const fees = await MarketplaceCharge.getFeeSettings()
  const intentMeta = {
    purchaseType: 'auction_win',
    paymentRecordId: payment._id.toString(),
    productId: String(meta.productId || ''),
    sellerId: String(meta.sellerId || ''),
    winnerId: String(meta.winnerId || ''),
    auctionItemId: String(meta.auctionItemId || ''),
  }
  const shipping = {
    name: shippingAddress.fullName || 'Buyer',
    phone: shippingAddress.phone || undefined,
    address: {
      line1: shippingAddress.street,
      city: shippingAddress.city,
      state: shippingAddress.state,
      postal_code: shippingAddress.postalCode,
      country: shippingAddress.country,
    },
  }

  // Reuse an unpaid intent from an earlier attempt so retries don't pile up.
  let intent: any = null
  if (meta.sheetIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(meta.sheetIntentId, {}, { stripeAccount: account })
      if (existing.status === 'succeeded') {
        await fulfillWinIntent(existing.id, account)
        throw new ApiError(StatusCodes.CONFLICT, 'This win is already paid.')
      }
      if (existing.status !== 'canceled' && existing.amount === amountCents) {
        intent = await stripe.paymentIntents.update(
          existing.id,
          { shipping, metadata: intentMeta },
          { stripeAccount: account },
        )
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err
      intent = null
    }
  }
  if (!intent) {
    intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        application_fee_amount: MarketplaceCharge.calculateSaleFee(Number(payment.amount), fees),
        automatic_payment_methods: { enabled: true },
        description: `Auction win`,
        shipping,
        metadata: intentMeta,
      },
      { stripeAccount: account },
    )
  }

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        'metadata.sheetIntentId': intent.id,
        'metadata.shippingAddress': shippingAddress,
      },
    },
  )

  // Remember the address for next time if the buyer has none saved.
  User.updateOne(
    { _id: userId, 'address.presentAddress': { $in: [null, ''] } },
    {
      $set: {
        'address.presentAddress': shippingAddress.street,
        'address.city': shippingAddress.city,
        'address.postalCode': shippingAddress.postalCode,
        'address.country': shippingAddress.country,
      },
    },
  ).catch(() => {})

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    stripeAccountId: account,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    amount: Number(payment.amount),
  }
}

/** Creates the order for a succeeded win intent. Safe to call more than once. */
const fulfillWinIntent = async (intentId: string, account: string): Promise<'paid' | 'pending'> => {
  const intent: any = await stripe.paymentIntents.retrieve(intentId, {}, { stripeAccount: account })
  if (intent.status !== 'succeeded') return 'pending'
  const meta = (intent.metadata || {}) as Record<string, string>
  if (meta.purchaseType !== 'auction_win' || !meta.paymentRecordId) return 'pending'

  const mongoSession = await Payment.startSession()
  mongoSession.startTransaction()
  const afterCommit: Array<() => Promise<void>> = []
  try {
    const payment: any = await Payment.findById(meta.paymentRecordId).session(mongoSession)
    if (!payment) throw new Error(`Payment ${meta.paymentRecordId} not found`)
    if (payment.status === 'succeeded') {
      await mongoSession.commitTransaction()
      return 'paid'
    }
    payment.status = 'succeeded'
    payment.paymentIntentId = intent.id
    payment.markModified?.('metadata')
    await payment.save({ session: mongoSession })

    const saved = payment.metadata?.shippingAddress
    await createAuctionWinOrder({
      meta: {
        productId: meta.productId,
        sellerId: meta.sellerId,
        winnerId: meta.winnerId,
        auctionItemId: meta.auctionItemId,
      },
      totalPaid: (intent.amount_received || intent.amount || 0) / 100,
      paymentIntentId: intent.id,
      stripeAccountId: account,
      platformFee: (intent.application_fee_amount || 0) / 100,
      mongoSession,
      afterCommit,
      shippingOverride: validAddress(saved) ? saved : undefined,
    })
    await mongoSession.commitTransaction()
  } catch (err) {
    await mongoSession.abortTransaction()
    throw err
  } finally {
    mongoSession.endSession()
  }

  for (const job of afterCommit) {
    await job().catch(err => console.error('[AuctionWin] seller notify failed:', err))
  }
  // Close the unused Checkout link so it can't be paid a second time.
  const sessionId = (await Payment.findById(meta.paymentRecordId).lean() as any)?.metadata?.checkoutSessionId
  if (sessionId) {
    stripe.checkout.sessions
      .expire(sessionId, {}, { stripeAccount: account })
      .catch(() => {})
  }
  return 'paid'
}

/** Called by the app right after PaymentSheet reports success. */
const confirmWinIntent = async (userId: string, paymentId: string) => {
  const payment = await findPendingWin(userId, paymentId)
  if (payment.status === 'succeeded') return { status: 'paid' as const }
  const intentId = payment.metadata?.sheetIntentId
  const account = payment.metadata?.stripeAccountId
  if (!intentId || !account) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No in-app payment was started for this win.')
  }
  return { status: await fulfillWinIntent(intentId, account) }
}

export const AuctionWinIntentServices = { createWinIntent, confirmWinIntent, fulfillWinIntent }
