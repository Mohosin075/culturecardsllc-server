import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import ApiError from '../../../errors/ApiError'
import { MarketplaceCharge } from '../payment/marketplaceCharge'
import { User } from '../user/user.model'
import { TradeOffer } from './trade.model'
import {
  ITradeSettlement,
  ITradeSettlementParty,
  TradeSettlement,
} from './tradeSettlement.model'

const EPHEMERAL_KEY_API_VERSION = '2023-10-16'

const round2 = (n: number): number => Number(n.toFixed(2))

/**
 * Work out what each side of a trade owes.
 *
 * Both parties pay ARIES 4% of their own item's agreed value. If the items
 * are worth different amounts, the party with the cheaper item also pays the
 * difference in cash to the other party.
 *
 * Every charge is grossed up so Stripe's cut never eats into ARIES's fee or
 * into the cash the other party receives — the payer covers it, which is what
 * the spec's "users will pay the 2.9% + 30¢" means.
 */
export const buildSettlementPlan = async (
  offer: any,
): Promise<ITradeSettlementParty[]> => {
  const fees = await MarketplaceCharge.getFeeSettings()

  const senderValue = Number((offer.senderProductId as any)?.estValue || 0)
  const receiverValue = Number((offer.receiverProductId as any)?.estValue || 0)

  // cashSupplement > 0 means the sender tops up; < 0 means the receiver does.
  const cash = Number(offer.cashSupplement || 0)
  const senderCash = cash > 0 ? Math.abs(cash) : 0
  const receiverCash = cash < 0 ? Math.abs(cash) : 0

  const build = (
    userId: Types.ObjectId,
    role: 'sender' | 'receiver',
    itemValue: number,
    cashNet: number,
  ): ITradeSettlementParty => {
    const feeNet = round2(itemValue * (fees.tradeFeePercentPerSide / 100))
    const chargeCents =
      feeNet + cashNet > 0
        ? MarketplaceCharge.grossUpForStripe(feeNet + cashNet, fees)
        : 0
    return {
      userId,
      role,
      itemValue,
      feeNet,
      cashNet,
      chargeCents,
      status: chargeCents > 0 ? 'pending' : 'paid',
      paidAt: chargeCents > 0 ? undefined : new Date(),
    }
  }

  return [
    build(offer.senderId, 'sender', senderValue, senderCash),
    build(offer.receiverId, 'receiver', receiverValue, receiverCash),
  ]
}

export const getOrCreateSettlement = async (
  offer: any,
): Promise<ITradeSettlement> => {
  const existing = await TradeSettlement.findOne({ tradeOfferId: offer._id })
  if (existing) return existing

  const parties = await buildSettlementPlan(offer)
  return TradeSettlement.create({
    tradeOfferId: offer._id,
    parties,
    status: parties.every(p => p.status === 'paid') ? 'settled' : 'pending',
  })
}

export type TradePaymentIntent = {
  clientSecret: string
  ephemeralKey: string
  customer: string
  paymentIntentId: string
  /** Present when the cash portion routes to the other party's account. */
  stripeAccountId?: string
  feeAmount: number
  cashAmount: number
  totalAmount: number
}

/**
 * The payment this user must make to settle their side of the trade.
 *
 * When they owe cash to the other party, the whole thing runs as a direct
 * charge on that party's connected account, with ARIES's 4% taken as the
 * application fee — one charge instead of two, and the recipient's cash lands
 * in their own Stripe account rather than sitting on the platform.
 *
 * When they only owe the fee, it is an ordinary platform charge: nobody is
 * being paid out.
 */
export const createPartyPaymentIntent = async (
  offerId: string,
  userId: string,
): Promise<TradePaymentIntent | { alreadyPaid: true }> => {
  const offer = (await TradeOffer.findById(offerId)
    .populate('senderProductId')
    .populate('receiverProductId')) as any

  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }

  const settlement = await getOrCreateSettlement(offer)
  const party = settlement.parties.find(
    p => p.userId.toString() === userId.toString(),
  )

  if (!party) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not part of this trade.',
    )
  }

  if (party.status === 'paid') return { alreadyPaid: true }

  // Re-use a live intent rather than stacking up new ones on every retry.
  if (party.paymentIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(
        party.paymentIntentId,
        party.stripeAccountId
          ? { stripeAccount: party.stripeAccountId }
          : undefined,
      )
      if (
        existing.status !== 'canceled' &&
        existing.status !== 'succeeded' &&
        existing.client_secret
      ) {
        const customerId = String(existing.customer)
        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: customerId },
          party.stripeAccountId
            ? {
                apiVersion: EPHEMERAL_KEY_API_VERSION,
                stripeAccount: party.stripeAccountId,
              }
            : { apiVersion: EPHEMERAL_KEY_API_VERSION },
        )
        return {
          clientSecret: existing.client_secret,
          ephemeralKey: ephemeralKey.secret as string,
          customer: customerId,
          paymentIntentId: existing.id,
          stripeAccountId: party.stripeAccountId,
          feeAmount: party.feeNet,
          cashAmount: party.cashNet,
          totalAmount: party.chargeCents / 100,
        }
      }
    } catch {
      // Stale intent — fall through and make a new one.
    }
  }

  const counterparty = settlement.parties.find(
    p => p.userId.toString() !== userId.toString(),
  )

  const metadata: Record<string, string> = {
    purchaseType: 'trade_settlement',
    tradeOfferId: offer._id.toString(),
    areisTradeRole: party.role,
    areisTradeFeeCents: String(Math.round(party.feeNet * 100)),
    areisTradeCashCents: String(Math.round(party.cashNet * 100)),
  }

  let result: TradePaymentIntent

  if (party.cashNet > 0 && counterparty) {
    // Cash flows to the other party: direct charge on their account.
    const connectedAccountId = await MarketplaceCharge.requireConnectedAccount(
      counterparty.userId.toString(),
    )
    const customerId = await MarketplaceCharge.getOrCreateConnectedCustomer(
      userId,
      connectedAccountId,
    )

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      {
        apiVersion: EPHEMERAL_KEY_API_VERSION,
        stripeAccount: connectedAccountId,
      },
    )

    const intent = await stripe.paymentIntents.create(
      {
        amount: party.chargeCents,
        currency: 'usd',
        customer: customerId,
        // ARIES's 4% comes off the top; the rest settles to the recipient.
        application_fee_amount: Math.min(
          Math.round(party.feeNet * 100),
          party.chargeCents,
        ),
        metadata,
      },
      { stripeAccount: connectedAccountId },
    )

    party.paymentIntentId = intent.id
    party.stripeAccountId = connectedAccountId
    result = {
      clientSecret: intent.client_secret as string,
      ephemeralKey: ephemeralKey.secret as string,
      customer: customerId,
      paymentIntentId: intent.id,
      stripeAccountId: connectedAccountId,
      feeAmount: party.feeNet,
      cashAmount: party.cashNet,
      totalAmount: party.chargeCents / 100,
    }
  } else {
    // Fee only — straight to the platform.
    const user = await User.findById(userId)
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || user.name || undefined,
        metadata: { areisUserId: user._id.toString() },
      })
      customerId = customer.id
      user.stripeCustomerId = customerId
      await user.save()
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: EPHEMERAL_KEY_API_VERSION },
    )

    const intent = await stripe.paymentIntents.create({
      amount: party.chargeCents,
      currency: 'usd',
      customer: customerId,
      metadata,
    })

    party.paymentIntentId = intent.id
    party.stripeAccountId = undefined
    result = {
      clientSecret: intent.client_secret as string,
      ephemeralKey: ephemeralKey.secret as string,
      customer: customerId,
      paymentIntentId: intent.id,
      feeAmount: party.feeNet,
      cashAmount: party.cashNet,
      totalAmount: party.chargeCents / 100,
    }
  }

  settlement.markModified('parties')
  await settlement.save()

  return result
}

/** Where both sides stand, for the trade screen. */
export const getSettlementStatus = async (
  offerId: string,
): Promise<{
  status: string
  parties: {
    userId: string
    role: string
    feeNet: number
    cashNet: number
    totalAmount: number
    status: string
  }[]
} | null> => {
  const settlement = await TradeSettlement.findOne({ tradeOfferId: offerId })
  if (!settlement) return null
  return {
    status: settlement.status,
    parties: settlement.parties.map(p => ({
      userId: p.userId.toString(),
      role: p.role,
      feeNet: p.feeNet,
      cashNet: p.cashNet,
      totalAmount: p.chargeCents / 100,
      status: p.status,
    })),
  }
}

/**
 * Called from the Stripe webhook. Marks one side paid and reports whether the
 * trade is now fully settled, so the caller can swap the items.
 */
export const markPartyPaidByIntent = async (
  paymentIntentId: string,
): Promise<{ settled: boolean; tradeOfferId: string } | null> => {
  const settlement = await TradeSettlement.findOne({
    'parties.paymentIntentId': paymentIntentId,
  })
  if (!settlement) return null

  const party = settlement.parties.find(
    p => p.paymentIntentId === paymentIntentId,
  )
  if (!party || party.status === 'paid') {
    return {
      settled: settlement.status === 'settled',
      tradeOfferId: settlement.tradeOfferId.toString(),
    }
  }

  party.status = 'paid'
  party.paidAt = new Date()

  const allPaid = settlement.parties.every(p => p.status === 'paid')
  if (allPaid) {
    settlement.status = 'settled'
    settlement.settledAt = new Date()
  }

  settlement.markModified('parties')
  await settlement.save()

  return {
    settled: allPaid,
    tradeOfferId: settlement.tradeOfferId.toString(),
  }
}

export const TradeSettlementServices = {
  buildSettlementPlan,
  getOrCreateSettlement,
  createPartyPaymentIntent,
  getSettlementStatus,
  markPartyPaidByIntent,
}
