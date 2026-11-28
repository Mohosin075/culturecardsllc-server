import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import ApiError from '../../../errors/ApiError'
import { MarketplaceCharge } from '../payment/marketplaceCharge'
import { SystemSettings } from '../dashboard/settings.model'
import { User } from '../user/user.model'
import { TradeOffer } from './trade.model'
import { ITradeRole } from './trade.interface'
import {
  ITradeSettlement,
  ITradeSettlementParty,
  TradeSettlement,
} from './tradeSettlement.model'

const EPHEMERAL_KEY_API_VERSION = '2023-10-16'

const round2 = (n: number): number => Number(n.toFixed(2))
const toCents = (dollars: number): number => Math.round(dollars * 100)

export type TradeRules = {
  materialFee: number
  paymentWindowHours: number
  shipByBusinessDays: number
}

const DEFAULT_TRADE_RULES: TradeRules = {
  materialFee: 2,
  paymentWindowHours: 48,
  shipByBusinessDays: 7,
}

/** Admin-editable trade rules; fall back to the client's numbers. */
export const getTradeRules = async (): Promise<TradeRules> => {
  try {
    const settings = (await SystemSettings.findOne().lean()) as any
    const rules = settings?.tradeRules || {}
    return {
      materialFee: rules.materialFee ?? DEFAULT_TRADE_RULES.materialFee,
      paymentWindowHours:
        rules.paymentWindowHours ?? DEFAULT_TRADE_RULES.paymentWindowHours,
      shipByBusinessDays:
        rules.shipByBusinessDays ?? DEFAULT_TRADE_RULES.shipByBusinessDays,
    }
  } catch {
    return DEFAULT_TRADE_RULES
  }
}

const sumValues = (products: any[] | undefined): number =>
  (products || []).reduce((sum, p) => sum + Number(p?.estValue || 0), 0)

/**
 * What each side owes, before shipping is quoted.
 *
 * Per the client (#6, #10): each participant pays 4% of what they put in —
 * their items plus any cash they add — and a $2 material fee. Their own
 * labels (to ARIES and back) are added when they open the payment, because
 * quoting needs their address.
 *
 * `offer` must have senderProductIds and receiverProductIds populated.
 */
export const buildSettlementPlan = async (
  offer: any,
): Promise<ITradeSettlementParty[]> => {
  const fees = await MarketplaceCharge.getFeeSettings()
  const rules = await getTradeRules()

  const senderValue = sumValues(offer.senderProductIds)
  const receiverValue = sumValues(offer.receiverProductIds)

  // cashSupplement > 0 means the sender tops up; < 0 means the receiver does.
  const cash = Number(offer.cashSupplement || 0)
  const senderCash = cash > 0 ? Math.abs(cash) : 0
  const receiverCash = cash < 0 ? Math.abs(cash) : 0

  const build = (
    userId: Types.ObjectId,
    role: ITradeRole,
    itemValue: number,
    cashNet: number,
    itemCount: number,
  ): ITradeSettlementParty => ({
    userId,
    role,
    itemValue,
    feeNet: round2((itemValue + cashNet) * (fees.tradeFeePercentPerSide / 100)),
    cashNet,
    // Packing material is for items sent to ARIES; a cash-only side sends none.
    materialFeeNet: itemCount > 0 ? rules.materialFee : 0,
    inboundLabelNet: 0,
    outboundLabelNet: 0,
    labelsQuoted: false,
    chargeCents: 0,
    status: 'pending',
  })

  return [
    build(offer.senderId, 'sender', senderValue, senderCash, (offer.senderProductIds || []).length),
    build(offer.receiverId, 'receiver', receiverValue, receiverCash, (offer.receiverProductIds || []).length),
  ]
}

const populateItems = (query: any) =>
  query.populate('senderProductIds').populate('receiverProductIds')

export const getOrCreateSettlement = async (
  offer: any,
): Promise<ITradeSettlement> => {
  const existing = await TradeSettlement.findOne({ tradeOfferId: offer._id })
  if (existing) return existing

  const parties = await buildSettlementPlan(offer)
  try {
    return await TradeSettlement.create({
      tradeOfferId: offer._id,
      parties,
      status: 'pending',
    })
  } catch (err: any) {
    // Both traders opened the payment at once; the other request won.
    if (err?.code === 11000) {
      const raced = await TradeSettlement.findOne({ tradeOfferId: offer._id })
      if (raced) return raced
    }
    throw err
  }
}

/** Net dollars this party owes in total, before Stripe's gross-up. */
export const partyNetTotal = (p: ITradeSettlementParty): number =>
  round2(
    p.feeNet +
      p.cashNet +
      (p.materialFeeNet || 0) +
      (p.inboundLabelNet || 0) +
      (p.outboundLabelNet || 0),
  )

export type TradePaymentIntent = {
  clientSecret: string
  ephemeralKey: string
  customer: string
  paymentIntentId: string
  feeAmount: number
  cashAmount: number
  materialFee: number
  shippingAmount: number
  totalAmount: number
}

const ensureCustomer = async (userId: string): Promise<string> => {
  const user = await User.findById(userId)
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  if (user.stripeCustomerId) {
    // A customer saved under other Stripe keys (e.g. before a switch from
    // test to live) does not exist here; make a fresh one.
    try {
      const existing: any = await stripe.customers.retrieve(user.stripeCustomerId)
      if (!existing?.deleted) return user.stripeCustomerId
    } catch (err: any) {
      if (err?.code !== 'resource_missing') throw err
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName || user.name || undefined,
    metadata: { areisUserId: user._id.toString() },
  })
  user.stripeCustomerId = customer.id
  await user.save()
  return customer.id
}

const describe = (party: ITradeSettlementParty, intent: any, customerId: string, ephemeralKey: string): TradePaymentIntent => ({
  clientSecret: intent.client_secret as string,
  ephemeralKey,
  customer: customerId,
  paymentIntentId: intent.id,
  feeAmount: party.feeNet,
  cashAmount: party.cashNet,
  materialFee: party.materialFeeNet || 0,
  shippingAmount: round2((party.inboundLabelNet || 0) + (party.outboundLabelNet || 0)),
  totalAmount: party.chargeCents / 100,
})

/**
 * The payment this user must make to settle their side of the trade.
 *
 * Everything is an ordinary platform charge: the client holds all trade money
 * (fees, labels and the cash difference) until the trade completes (#13), and
 * the cash is passed on to the other trader only then.
 *
 * `quoteLabels` prices this party's two labels; it lives in the fulfillment
 * service, which owns the shipments.
 */
export const createPartyPaymentIntent = async (
  offerId: string,
  userId: string,
  quoteLabels: (
    offer: any,
    role: ITradeRole,
  ) => Promise<{ inbound: number; outbound: number }>,
): Promise<TradePaymentIntent | { alreadyPaid: true }> => {
  const offer = await populateItems(TradeOffer.findById(offerId))

  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found')
  }
  if (offer.status !== 'accepted' || (offer.stage && offer.stage !== 'awaiting_payment')) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This trade is not waiting for payment.',
    )
  }

  const settlement = await getOrCreateSettlement(offer)
  const party = settlement.parties.find(
    p => p.userId.toString() === userId.toString(),
  )

  if (!party) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not part of this trade.')
  }

  if (party.status === 'paid') return { alreadyPaid: true }

  // Price this party's shipping (needs their address), then the total.
  const labels = await quoteLabels(offer, party.role)
  party.inboundLabelNet = round2(labels.inbound)
  party.outboundLabelNet = round2(labels.outbound)
  party.labelsQuoted = true

  const fees = await MarketplaceCharge.getFeeSettings()
  party.chargeCents = MarketplaceCharge.grossUpForStripe(partyNetTotal(party), fees)

  const customerId = await ensureCustomer(userId)
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: EPHEMERAL_KEY_API_VERSION },
  )

  const metadata: Record<string, string> = {
    purchaseType: 'trade_settlement',
    tradeOfferId: offer._id.toString(),
    tradeCode: offer.tradeCode || '',
    areisTradeRole: party.role,
    areisTradeFeeCents: String(toCents(party.feeNet)),
    areisTradeCashCents: String(toCents(party.cashNet)),
    areisTradeMaterialCents: String(toCents(party.materialFeeNet || 0)),
    areisTradeShippingCents: String(
      toCents((party.inboundLabelNet || 0) + (party.outboundLabelNet || 0)),
    ),
  }

  // Re-use a live platform intent rather than stacking up new ones on retry.
  let intent: any = null
  if (party.paymentIntentId && !party.stripeAccountId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(party.paymentIntentId)
      if (
        existing.status !== 'canceled' &&
        existing.status !== 'succeeded' &&
        existing.status !== 'processing'
      ) {
        intent =
          existing.amount === party.chargeCents
            ? existing
            : await stripe.paymentIntents.update(existing.id, {
                amount: party.chargeCents,
                metadata,
              })
      }
    } catch {
      intent = null // stale; make a new one
    }
  }

  if (!intent) {
    intent = await stripe.paymentIntents.create({
      amount: party.chargeCents,
      currency: 'usd',
      customer: customerId,
      description: `ARIES trade ${offer.tradeCode || offer._id}`,
      metadata,
    })
  }

  party.paymentIntentId = intent.id
  party.stripeAccountId = undefined
  settlement.markModified('parties')
  await settlement.save()

  return describe(party, intent, customerId, ephemeralKey.secret as string)
}

/** Where both sides stand, for the trade screen. */
export const getSettlementStatus = async (offerId: string) => {
  const settlement = await TradeSettlement.findOne({ tradeOfferId: offerId })
  if (!settlement) return null
  return {
    status: settlement.status,
    parties: settlement.parties.map(p => ({
      userId: p.userId.toString(),
      role: p.role,
      itemValue: p.itemValue,
      feeNet: p.feeNet,
      cashNet: p.cashNet,
      materialFee: p.materialFeeNet || 0,
      inboundLabel: p.inboundLabelNet || 0,
      outboundLabel: p.outboundLabelNet || 0,
      totalAmount: p.chargeCents / 100,
      // What the card network takes: the total was grossed up to cover it.
      processingFee: Math.max(
        0,
        Math.round(
          p.chargeCents -
            Math.round(
              ((p.feeNet || 0) + (p.cashNet || 0) + (p.materialFeeNet || 0) +
                (p.inboundLabelNet || 0) + (p.outboundLabelNet || 0)) * 100,
            ),
        ) / 100,
      ),
      refundedAmount: (p.refundedCents || 0) / 100,
      returnShipping: (p.returnShippingCents || 0) / 100,
      // Still owed only until the extra charge is paid.
      owed: p.extraStatus === 'paid' ? 0 : (p.shortfallCents || 0) / 100,
      owedPaid: p.extraStatus === 'paid' && (p.shortfallCents || 0) > 0,
      extraReason: p.extraReason || 'label_difference',
      feeForfeited: !!p.feeForfeited,
      extraDue:
        p.extraStatus === 'pending' ? (p.extraChargeCents || 0) / 100 : 0,
      status: p.status,
    })),
  }
}

/**
 * Called from the Stripe webhook. Marks one side paid and reports whether the
 * trade is now fully settled, so the caller can start shipping.
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
  if (!party || party.status === 'paid' || settlement.status === 'cancelled') {
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

/** Gives part (or all) of a party's payment back. Returns cents refunded. */
export const refundParty = async (
  settlement: ITradeSettlement,
  role: ITradeRole,
  cents: number,
  reason: string,
): Promise<number> => {
  const party = settlement.parties.find(p => p.role === role)
  if (!party || party.status !== 'paid' || !party.paymentIntentId) return 0

  const remaining = party.chargeCents - (party.refundedCents || 0)
  const amount = Math.min(Math.max(0, Math.round(cents)), remaining)
  if (amount <= 0) return 0

  const refund = await stripe.refunds.create({
    payment_intent: party.paymentIntentId,
    amount,
    metadata: {
      tradeOfferId: settlement.tradeOfferId.toString(),
      areisTradeRole: role,
      reason: reason.slice(0, 450),
    },
  })

  party.refundedCents = (party.refundedCents || 0) + amount
  party.refundIds = [...(party.refundIds || []), refund.id]
  settlement.markModified('parties')
  await settlement.save()
  return amount
}

/**
 * Asks a trader for more money when a label cost more than its estimate
 * (client #9). Returns a payment sheet for the app.
 */
export const createExtraChargeIntent = async (
  offerId: string,
  userId: string,
): Promise<TradePaymentIntent | { nothingDue: true }> => {
  const settlement = await TradeSettlement.findOne({ tradeOfferId: offerId })
  const party = settlement?.parties.find(
    p => p.userId.toString() === userId.toString(),
  )
  if (!settlement || !party) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Nothing to pay on this trade.')
  }
  if (party.extraStatus !== 'pending' || !party.extraChargeCents) {
    return { nothingDue: true }
  }

  const customerId = await ensureCustomer(userId)
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: EPHEMERAL_KEY_API_VERSION },
  )

  let intent: any = null
  if (party.extraPaymentIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(party.extraPaymentIntentId)
      if (existing.status !== 'canceled' && existing.status !== 'succeeded') {
        intent = existing
      }
    } catch {
      intent = null
    }
  }
  if (!intent) {
    intent = await stripe.paymentIntents.create({
      amount: party.extraChargeCents,
      currency: 'usd',
      customer: customerId,
      description:
        party.extraReason === 'return_shipping'
          ? 'ARIES trade return shipping'
          : 'ARIES trade shipping adjustment',
      metadata: {
        purchaseType: 'trade_extra',
        tradeOfferId: offerId,
        areisTradeRole: party.role,
      },
    })
    party.extraPaymentIntentId = intent.id
    settlement.markModified('parties')
    await settlement.save()
  }

  return {
    clientSecret: intent.client_secret,
    ephemeralKey: ephemeralKey.secret as string,
    customer: customerId,
    paymentIntentId: intent.id,
    feeAmount: 0,
    cashAmount: 0,
    materialFee: 0,
    shippingAmount: party.extraChargeCents / 100,
    totalAmount: party.extraChargeCents / 100,
  }
}

export const markExtraPaidByIntent = async (paymentIntentId: string) => {
  const settlement = await TradeSettlement.findOne({
    'parties.extraPaymentIntentId': paymentIntentId,
  })
  const party = settlement?.parties.find(
    p => p.extraPaymentIntentId === paymentIntentId,
  )
  if (!settlement || !party || party.extraStatus === 'paid') return
  party.extraStatus = 'paid'
  settlement.markModified('parties')
  await settlement.save()
}

/**
 * On completion, passes each cash difference to the trader who receives it.
 * Paid from the platform balance, tied to the original charge so the money is
 * available. A trader with no Stripe account is flagged for a manual payout.
 */
export const payOutCash = async (offerId: string): Promise<void> => {
  const settlement = await TradeSettlement.findOne({ tradeOfferId: offerId })
  if (!settlement) return

  for (const payer of settlement.parties) {
    if (!payer.cashNet || payer.cashNet <= 0) continue
    if (payer.payoutStatus === 'paid' || payer.payoutStatus === 'manual') continue
    const recipient = settlement.parties.find(p => p.role !== payer.role)
    if (!recipient || !payer.paymentIntentId) continue

    try {
      const destination = await MarketplaceCharge.requireConnectedAccount(
        recipient.userId.toString(),
      )
      const intent = await stripe.paymentIntents.retrieve(payer.paymentIntentId)
      const transfer = await stripe.transfers.create({
        amount: toCents(payer.cashNet),
        currency: 'usd',
        destination,
        source_transaction: (intent.latest_charge as string) || undefined,
        metadata: {
          tradeOfferId: offerId,
          purpose: 'trade_cash_difference',
        },
      })
      payer.payoutTransferId = transfer.id
      payer.payoutStatus = 'paid'
    } catch (err) {
      console.error('[TradeSettlement] cash payout needs manual handling:', err)
      payer.payoutStatus = 'manual'
    }
  }

  settlement.markModified('parties')
  await settlement.save()
}

export const TradeSettlementServices = {
  buildSettlementPlan,
  getOrCreateSettlement,
  createPartyPaymentIntent,
  createExtraChargeIntent,
  getSettlementStatus,
  markPartyPaidByIntent,
  markExtraPaidByIntent,
  refundParty,
  payOutCash,
  partyNetTotal,
  getTradeRules,
}
