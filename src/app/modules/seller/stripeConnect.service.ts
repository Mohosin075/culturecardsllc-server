import Stripe from 'stripe'
import { StatusCodes } from 'http-status-codes'
import stripe from '../../../config/stripe'
import config from '../../../config'
import ApiError from '../../../errors/ApiError'
import { errorLogger } from '../../../shared/logger'
import { ISellerStripeState } from './seller.interface'

/**
 * Everything that talks to Stripe Connect lives here.
 *
 * Account type: **Express**. Stripe hosts the identity / bank / tax form, which
 * is exactly what the client asked for ("Stripe handles identity verification,
 * banking information, required tax information and payment account setup").
 *
 * Both `card_payments` and `transfers` are requested so the platform can later
 * settle on either direct charges or destination charges — that decision is
 * still open with the client and this does not lock it in.
 */

const requireStripe = (): void => {
  if (!config.stripe.stripeSecretKey) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'Stripe is not configured on this server.',
    )
  }
}

const ONBOARDING_UNAVAILABLE =
  'Seller onboarding is temporarily unavailable. Please try again later.'

/**
 * Run a Stripe call and turn any Stripe failure into an ApiError a seller can
 * read. Stripe's own message often describes *our* platform setup (for example
 * "You can only create new accounts if you've signed up for Connect"), which
 * means nothing to a seller, so the raw details go to the log only.
 */
const callStripe = async <T>(
  action: string,
  request: () => Promise<T>,
): Promise<T> => {
  try {
    return await request()
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeError)) throw error

    errorLogger.error(
      `[SellerConnect] Stripe ${action} failed: ${error.type} ` +
        `code=${error.code ?? '-'} param=${error.param ?? '-'} ` +
        `requestId=${error.requestId ?? '-'} message=${error.message}`,
    )

    switch (error.type) {
      // Stripe could not be reached or is struggling: worth a retry.
      case 'StripeRateLimitError':
      case 'StripeConnectionError':
      case 'StripeAPIError':
        throw new ApiError(
          StatusCodes.SERVICE_UNAVAILABLE,
          'Stripe is not responding right now. Please try again in a minute.',
        )

      // A specific field was rejected (e.g. a malformed email). Stripe words
      // these for end users, so the seller can act on it.
      case 'StripeInvalidRequestError':
        if (error.param) {
          throw new ApiError(StatusCodes.BAD_REQUEST, error.message)
        }
        // No field means the request itself is wrong for this platform —
        // Connect not enabled, wrong country, etc. Not the seller's fault.
        throw new ApiError(
          StatusCodes.SERVICE_UNAVAILABLE,
          ONBOARDING_UNAVAILABLE,
        )

      // Bad key, missing permission, and anything else: platform setup.
      default:
        throw new ApiError(
          StatusCodes.SERVICE_UNAVAILABLE,
          ONBOARDING_UNAVAILABLE,
        )
    }
  }
}

/** Shape Stripe's account object into the subset we persist. */
export const mapAccountToState = (
  account: Stripe.Account,
): ISellerStripeState => {
  const requirements = account.requirements
  return {
    accountId: account.id,
    detailsSubmitted: Boolean(account.details_submitted),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    disabledReason: requirements?.disabled_reason ?? undefined,
    currentlyDue: requirements?.currently_due ?? [],
    pastDue: requirements?.past_due ?? [],
    lastSyncedAt: new Date(),
  }
}

export const createConnectedAccount = async (params: {
  userId: string
  email?: string
  businessName?: string
  whatTheySell?: string
}): Promise<Stripe.Account> => {
  requireStripe()

  return callStripe('account create', () =>
    stripe.accounts.create({
      type: 'express',
      country: config.seller.connectCountry,
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        // Collectibles / trading cards. 5945 = "Hobby, Toy and Game Shops".
        mcc: config.seller.connectMcc,
        name: params.businessName || undefined,
        product_description: params.whatTheySell || undefined,
      },
      metadata: {
        areisUserId: params.userId,
        platform: 'ARIES',
      },
    }),
  )
}

export const retrieveAccount = async (
  accountId: string,
): Promise<Stripe.Account> => {
  requireStripe()
  return callStripe('account retrieve', () =>
    stripe.accounts.retrieve(accountId),
  )
}

/**
 * A one-time URL into Stripe's hosted onboarding. Links expire within minutes,
 * so a fresh one is minted every time the seller taps "continue".
 */
export const createOnboardingLink = async (
  accountId: string,
): Promise<string> => {
  requireStripe()

  const accountLink = await callStripe('onboarding link', () =>
    stripe.accountLinks.create({
      account: accountId,
      refresh_url: config.seller.stripeRefreshUrl,
      return_url: config.seller.stripeReturnUrl,
      type: 'account_onboarding',
      collection_options: {
        // Collect everything Stripe will eventually need, so the seller is not
        // interrupted again the first time they hit a payout threshold.
        fields: 'eventually_due',
      },
    }),
  )

  return accountLink.url
}

/**
 * Express dashboard link — lets an already-onboarded seller update their bank
 * details or see their payouts without us building any of those screens.
 */
export const createLoginLink = async (accountId: string): Promise<string> => {
  requireStripe()
  const loginLink = await callStripe('dashboard link', () =>
    stripe.accounts.createLoginLink(accountId),
  )
  return loginLink.url
}

/**
 * A seller's real money, read from their connected account rather than
 * recomputed from orders — Stripe is the ledger, not the Order collection.
 */
export const getAccountEarnings = async (
  accountId: string,
): Promise<{
  available: number
  pending: number
  currency: string
  recentPayouts: {
    id: string
    amount: number
    status: string
    arrivalDate: Date | null
  }[]
}> => {
  requireStripe()

  const [balance, payouts] = await callStripe('earnings', () =>
    Promise.all([
      stripe.balance.retrieve({ stripeAccount: accountId }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount: accountId }),
    ]),
  )

  const sum = (entries: { amount: number }[]): number =>
    entries.reduce((total, entry) => total + entry.amount, 0) / 100

  return {
    available: sum(balance.available || []),
    pending: sum(balance.pending || []),
    currency: balance.available?.[0]?.currency?.toUpperCase() || 'USD',
    recentPayouts: payouts.data.map(payout => ({
      id: payout.id,
      amount: payout.amount / 100,
      status: payout.status,
      arrivalDate: payout.arrival_date
        ? new Date(payout.arrival_date * 1000)
        : null,
    })),
  }
}

export const StripeConnectService = {
  getAccountEarnings,
  mapAccountToState,
  createConnectedAccount,
  retrieveAccount,
  createOnboardingLink,
  createLoginLink,
}
