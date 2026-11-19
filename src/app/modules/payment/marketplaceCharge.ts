import Stripe from 'stripe'
import { StatusCodes } from 'http-status-codes'
import stripe from '../../../config/stripe'
import ApiError from '../../../errors/ApiError'
import { SystemSettings } from '../dashboard/settings.model'
import { SellerApplication } from '../seller/seller.model'
import { User } from '../user/user.model'

/**
 * Marketplace money movement.
 *
 * Every sale is a **direct charge** on the seller's connected account. That is
 * what the client's spec requires: Stripe's processing fee comes out of the
 * seller's proceeds rather than ARIES's, and dispute liability sits with the
 * seller. ARIES takes its cut through `application_fee_amount`, which Stripe
 * moves to the platform automatically — no manual transfer, no payout job.
 *
 * Trade fees are different: nobody is selling anything, ARIES is just
 * collecting its own fee, so those stay as ordinary platform charges.
 */

const EPHEMERAL_KEY_API_VERSION = '2023-10-16'

export type FeeSettings = {
  saleFeePercent: number
  tradeFeePercentPerSide: number
  stripePercent: number
  stripeFlatFee: number
}

const DEFAULT_FEES: FeeSettings = {
  saleFeePercent: 6.5,
  tradeFeePercentPerSide: 4,
  stripePercent: 2.9,
  stripeFlatFee: 0.3,
}

const toCents = (dollars: number): number => Math.round(dollars * 100)

/** Fee rates are admin-editable; fall back to the spec's numbers. */
export const getFeeSettings = async (): Promise<FeeSettings> => {
  try {
    const settings = await SystemSettings.findOne().lean()
    const fees = (settings as any)?.marketplaceFees
    if (!fees) return DEFAULT_FEES
    return {
      saleFeePercent: fees.saleFeePercent ?? DEFAULT_FEES.saleFeePercent,
      tradeFeePercentPerSide:
        fees.tradeFeePercentPerSide ?? DEFAULT_FEES.tradeFeePercentPerSide,
      stripePercent: fees.stripePercent ?? DEFAULT_FEES.stripePercent,
      stripeFlatFee: fees.stripeFlatFee ?? DEFAULT_FEES.stripeFlatFee,
    }
  } catch {
    return DEFAULT_FEES
  }
}

/**
 * ARIES's cut of a sale, in cents.
 *
 * The fee is taken on the item price only. Shipping and tax are passed through
 * to the seller untouched — charging a marketplace fee on postage would make
 * the seller's take depend on the parcel's weight.
 */
export const calculateSaleFee = (
  itemSubtotal: number,
  fees: FeeSettings,
): number => toCents(itemSubtotal * (fees.saleFeePercent / 100))

/**
 * What a user must be charged so that ARIES nets `netWanted` after Stripe
 * takes its percentage and flat fee.
 *
 *   charge = (netWanted + flat) / (1 - percent)
 *
 * Rounded up, so a rounding cent never comes out of the platform's fee. On the
 * spec's $100 trade this gives $4.43 for a $4.00 net; the client's worked
 * example says $4.42, which nets $3.99.
 */
export const grossUpForStripe = (
  netWanted: number,
  fees: FeeSettings,
): number => {
  const rate = fees.stripePercent / 100
  if (rate >= 1) return toCents(netWanted)
  const gross = (netWanted + fees.stripeFlatFee) / (1 - rate)
  return Math.ceil(gross * 100)
}

/** Each side's trade fee, in cents, already grossed up for Stripe. */
export const calculateTradeFeeCharge = (
  itemValue: number,
  fees: FeeSettings,
): { netFee: number; chargeCents: number } => {
  const netFee = Number(
    (itemValue * (fees.tradeFeePercentPerSide / 100)).toFixed(2),
  )
  return { netFee, chargeCents: grossUpForStripe(netFee, fees) }
}

/**
 * The connected account a seller's money must land in.
 *
 * Throws rather than silently falling back to a platform charge: taking money
 * for a seller who cannot be paid out would leave funds stranded on the
 * platform, which is the problem Connect is here to solve.
 */
export const requireConnectedAccount = async (
  sellerId: string,
): Promise<string> => {
  const application = await SellerApplication.findOne({ userId: sellerId })

  if (!application?.stripe?.accountId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This seller has not connected a Stripe account yet, so their items cannot be purchased.',
    )
  }

  if (!application.stripe.chargesEnabled) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This seller cannot accept payments yet — their Stripe verification is incomplete.',
    )
  }

  return application.stripe.accountId
}

/**
 * A direct charge needs a Customer that lives on the *connected* account; the
 * platform's Customer objects are not visible there. One is created per
 * (buyer, connected account) pair and remembered on the user.
 */
export const getOrCreateConnectedCustomer = async (
  userId: string,
  connectedAccountId: string,
): Promise<string> => {
  const user = await User.findById(userId)
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')

  const existing = (user as any).stripeConnectedCustomerIds?.get?.(
    connectedAccountId,
  )
  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing, {
        stripeAccount: connectedAccountId,
      })
      if (!(customer as any).deleted) return existing
    } catch {
      // Fall through and make a new one.
    }
  }

  const customer = await stripe.customers.create(
    {
      email: user.email,
      name: user.fullName || user.name || undefined,
      metadata: { areisUserId: user._id.toString() },
    },
    { stripeAccount: connectedAccountId },
  )

  if (!(user as any).stripeConnectedCustomerIds) {
    ;(user as any).stripeConnectedCustomerIds = new Map<string, string>()
  }
  ;(user as any).stripeConnectedCustomerIds.set(connectedAccountId, customer.id)
  await user.save()

  return customer.id
}

export type DirectChargeResult = {
  clientSecret: string
  ephemeralKey: string
  customer: string
  paymentIntentId: string
  /** The mobile Stripe SDK must be pointed at this account. */
  stripeAccountId: string
  applicationFeeAmount: number
}

/**
 * Create a direct-charge PaymentIntent on the seller's connected account,
 * with ARIES's cut as the application fee.
 */
export const createDirectChargeIntent = async (params: {
  buyerId: string
  sellerId: string
  /** Total the buyer pays, in dollars (item + shipping + tax). */
  totalAmount: number
  /** Item price only — the marketplace fee is calculated on this. */
  itemSubtotal: number
  currency?: string
  metadata?: Record<string, string>
}): Promise<DirectChargeResult> => {
  const fees = await getFeeSettings()
  const connectedAccountId = await requireConnectedAccount(params.sellerId)
  const customerId = await getOrCreateConnectedCustomer(
    params.buyerId,
    connectedAccountId,
  )

  const amountCents = toCents(params.totalAmount)
  // Never let the fee exceed the charge (possible if an admin sets a silly
  // rate, or on a $0 giveaway order).
  const applicationFeeAmount = Math.min(
    calculateSaleFee(params.itemSubtotal, fees),
    amountCents,
  )

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    {
      apiVersion: EPHEMERAL_KEY_API_VERSION,
      stripeAccount: connectedAccountId,
    },
  )

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: params.currency || 'usd',
      customer: customerId,
      application_fee_amount: applicationFeeAmount,
      metadata: {
        areisBuyerId: params.buyerId,
        areisSellerId: params.sellerId,
        areisPlatformFeeCents: String(applicationFeeAmount),
        ...params.metadata,
      },
    },
    { stripeAccount: connectedAccountId },
  )

  return {
    clientSecret: paymentIntent.client_secret as string,
    ephemeralKey: ephemeralKey.secret as string,
    customer: customerId,
    paymentIntentId: paymentIntent.id,
    stripeAccountId: connectedAccountId,
    applicationFeeAmount,
  }
}

/**
 * Copy a card saved on the platform to a connected account, so an auction
 * winner can be charged off-session by a direct charge. Stripe requires this:
 * a platform payment method is not usable on a connected account as-is.
 */
export const clonePaymentMethodToConnectedAccount = async (params: {
  platformCustomerId: string
  paymentMethodId: string
  connectedAccountId: string
  connectedCustomerId: string
}): Promise<string> => {
  const cloned = await stripe.paymentMethods.create(
    {
      customer: params.platformCustomerId,
      payment_method: params.paymentMethodId,
    } as Stripe.PaymentMethodCreateParams,
    { stripeAccount: params.connectedAccountId },
  )

  await stripe.paymentMethods.attach(
    cloned.id,
    { customer: params.connectedCustomerId },
    { stripeAccount: params.connectedAccountId },
  )

  return cloned.id
}

/**
 * Off-session direct charge, used when an auction ends and the winner has a
 * saved card. Returns null when there is no usable card, so the caller can
 * fall back to asking the winner to pay.
 */
export const chargeSavedCardDirect = async (params: {
  buyerId: string
  sellerId: string
  totalAmount: number
  itemSubtotal: number
  metadata?: Record<string, string>
}): Promise<{
  paymentIntentId: string
  stripeAccountId: string
  applicationFeeAmount: number
} | null> => {
  const buyer = await User.findById(params.buyerId).select('stripeCustomerId')
  if (!buyer?.stripeCustomerId) return null

  const fees = await getFeeSettings()
  const connectedAccountId = await requireConnectedAccount(params.sellerId)

  const methods = await stripe.paymentMethods.list({
    customer: buyer.stripeCustomerId,
    type: 'card',
    limit: 1,
  })
  const savedCard = methods.data[0]
  if (!savedCard) return null

  const connectedCustomerId = await getOrCreateConnectedCustomer(
    params.buyerId,
    connectedAccountId,
  )
  const clonedPaymentMethodId = await clonePaymentMethodToConnectedAccount({
    platformCustomerId: buyer.stripeCustomerId,
    paymentMethodId: savedCard.id,
    connectedAccountId,
    connectedCustomerId,
  })

  const amountCents = toCents(params.totalAmount)
  const applicationFeeAmount = Math.min(
    calculateSaleFee(params.itemSubtotal, fees),
    amountCents,
  )

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      customer: connectedCustomerId,
      payment_method: clonedPaymentMethodId,
      off_session: true,
      confirm: true,
      application_fee_amount: applicationFeeAmount,
      metadata: {
        areisBuyerId: params.buyerId,
        areisSellerId: params.sellerId,
        areisPlatformFeeCents: String(applicationFeeAmount),
        ...params.metadata,
      },
    },
    { stripeAccount: connectedAccountId },
  )

  if (intent.status !== 'succeeded') return null

  return {
    paymentIntentId: intent.id,
    stripeAccountId: connectedAccountId,
    applicationFeeAmount,
  }
}

export const MarketplaceCharge = {
  getFeeSettings,
  calculateSaleFee,
  grossUpForStripe,
  calculateTradeFeeCharge,
  requireConnectedAccount,
  getOrCreateConnectedCustomer,
  createDirectChargeIntent,
  chargeSavedCardDirect,
  clonePaymentMethodToConnectedAccount,
}
