import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import config from '../../../config'
import ApiError from '../../../errors/ApiError'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'
import { Chat } from '../chat/chat.model'
import { Message } from '../message/message.model'
import { PartnerService } from '../partner/partner.service'
import { Product } from '../product/product.model'
import { getShippingProvider } from '../shipping/providers'
import { ShippingServices } from '../shipping/shipping.service'
import {
  Parcel,
  ShippingAddress,
  TrackingUpdate,
} from '../shipping/shipping.interface'
import { User } from '../user/user.model'
import { TradeOffer } from './trade.model'
import {
  ITradeItemStatus,
  ITradeRole,
  ITradeShipment,
  ITradeStage,
} from './trade.interface'
import { TradeSettlement } from './tradeSettlement.model'
import { TradeSettlementServices } from './tradeSettlement.service'
import { TradeVoteServices } from './tradeVote.service'
import { runInTransaction } from './tradeTransaction'

/**
 * Moves a paid trade through ARIES:
 *
 *   both pay → inbound labels → items reach ARIES → authenticated
 *   → outbound labels → delivered → completed (ownership swapped, cash paid out)
 *
 * and handles the ways it can stop early (client answers #4, #8, #9 and the
 * 2026-11-25 follow-up): one side never pays, one side never ships, or an
 * item fails authentication.
 */

const round2 = (n: number): number => Number(n.toFixed(2))
const toCents = (dollars: number): number => Math.round(dollars * 100)

const other = (role: ITradeRole): ITradeRole =>
  role === 'sender' ? 'receiver' : 'sender'

const userIdOf = (offer: any, role: ITradeRole): string =>
  String(role === 'sender' ? offer.senderId?._id ?? offer.senderId : offer.receiverId?._id ?? offer.receiverId)

const itemsOf = (offer: any, role: ITradeRole): any[] =>
  (role === 'sender' ? offer.senderProductIds : offer.receiverProductIds) || []

const itemStatusKey = (role: ITradeRole) =>
  role === 'sender' ? 'senderItemStatus' : 'receiverItemStatus'

const populated = (id: string | Types.ObjectId) =>
  TradeOffer.findById(id)
    .populate('senderProductIds')
    .populate('receiverProductIds')

const hubAddress = (): ShippingAddress => ({
  ...(config.shipping.hubAddress as ShippingAddress),
})

const label = (offer: any) => (offer.tradeCode ? `Trade ${offer.tradeCode}` : 'Your trade')

// ── Business days ───────────────────────────────────────────────────────────

/** Adds Mon–Fri days. Public holidays are not counted out. */
export const addBusinessDays = (start: Date, days: number): Date => {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return d
}

// ── Parcels and addresses ───────────────────────────────────────────────────

/**
 * One package for all of a side's items: the largest of their boxes, with
 * every item's weight added up.
 */
export const parcelForItems = (products: any[]): Parcel | null => {
  if (!products?.length) return null
  const parcels = products.map(p => ShippingServices.parcelForProduct(p))
  const largest = parcels.reduce((a, b) =>
    a.lengthIn * a.widthIn * a.heightIn >= b.lengthIn * b.widthIn * b.heightIn ? a : b,
  )
  const weightOz = parcels.reduce((sum, p) => sum + p.weightOz, 0)
  return { ...largest, weightOz: Math.round(weightOz * 10) / 10 }
}

const partyAddress = async (userId: string): Promise<ShippingAddress> => {
  const a = await ShippingServices.getShipFromAddress(userId)
  if (!a) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Add your shipping address (Account settings → Ship-from address) before paying for this trade.',
    )
  }
  return {
    name: a.name,
    street1: a.street1,
    street2: a.street2,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country,
    phone: a.phone,
  }
}

const cheapestRate = async (
  from: ShippingAddress,
  to: ShippingAddress,
  parcel: Parcel,
) => {
  const quote = await getShippingProvider().getRates(from, to, parcel)
  const rate = [...quote.rates].sort((a, b) => a.amount - b.amount)[0]
  if (!rate) {
    throw new ApiError(
      StatusCodes.BAD_GATEWAY,
      'No shipping rate is available for this trade right now.',
    )
  }
  return rate
}

// ── Quoting (at payment) ────────────────────────────────────────────────────

/**
 * Prices one trader's two labels: their items to ARIES, and the other side's
 * items from ARIES to them. Stores both as quoted shipments on the trade.
 */
export const quotePartyLabels = async (
  offer: any,
  role: ITradeRole,
): Promise<{ inbound: number; outbound: number }> => {
  const address = await partyAddress(userIdOf(offer, role))
  const hub = hubAddress()

  // Drop this party's earlier quotes; keep anything already bought.
  offer.shipments = (offer.shipments || []).filter(
    (s: ITradeShipment) =>
      !(s.party === role && s.status === 'quoted' && (s.leg === 'inbound' || s.leg === 'outbound')),
  )

  let inbound = 0
  let outbound = 0

  const myParcel = parcelForItems(itemsOf(offer, role))
  if (myParcel) {
    const rate = await cheapestRate(address, hub, myParcel)
    inbound = rate.amount
    offer.shipments.push({
      leg: 'inbound',
      party: role,
      from: address,
      to: hub,
      parcel: myParcel,
      estimate: rate.amount,
      shipmentId: rate.shipmentId,
      rateId: rate.id,
      service: rate.service,
      carrier: rate.carrier,
      status: 'quoted',
    })
  }

  const theirParcel = parcelForItems(itemsOf(offer, other(role)))
  if (theirParcel) {
    const rate = await cheapestRate(hub, address, theirParcel)
    outbound = rate.amount
    offer.shipments.push({
      leg: 'outbound',
      party: role,
      from: hub,
      to: address,
      parcel: theirParcel,
      estimate: rate.amount,
      shipmentId: rate.shipmentId,
      rateId: rate.id,
      service: rate.service,
      carrier: rate.carrier,
      status: 'quoted',
    })
  }

  offer.markModified('shipments')
  await offer.save()
  return { inbound: round2(inbound), outbound: round2(outbound) }
}

/** Buys the label for a quoted shipment, at today's cheapest rate. */
const buyShipmentLabel = async (shipment: any): Promise<void> => {
  if (shipment.status !== 'quoted') return
  const rate = await cheapestRate(shipment.from, shipment.to, shipment.parcel)
  const bought = await getShippingProvider().buyLabel({
    shipmentId: rate.shipmentId,
    rateId: rate.id,
    from: shipment.from,
    to: shipment.to,
    parcel: shipment.parcel,
  })
  shipment.shipmentId = bought.shipmentId
  shipment.rateId = bought.rateId
  shipment.carrier = bought.carrier
  shipment.service = bought.service
  shipment.trackingCode = bought.trackingCode
  shipment.labelUrl = bought.labelUrl
  shipment.cost = bought.cost
  shipment.status = 'purchased'
  shipment.trackingStatus = 'pre_transit'
  shipment.purchasedAt = new Date()
}

// ── Notifications ───────────────────────────────────────────────────────────

const notify = async (
  offer: any,
  text: string,
  statusLabel: string,
  onlyRole?: ITradeRole,
  opts: { chatOnly?: boolean } = {},
) => {
  const io = (global as any).io
  const tradeOfferId = offer._id.toString()
  const roles: ITradeRole[] = opts.chatOnly ? [] : onlyRole ? [onlyRole] : ['sender', 'receiver']

  try {
    if (!onlyRole) {
      const chat = await Chat.findOne({
        participants: { $all: [userIdOf(offer, 'sender'), userIdOf(offer, 'receiver')] },
      })
      if (chat) {
        const created = await Message.create({
          chatId: chat._id,
          sender: userIdOf(offer, 'sender'),
          text,
          messageType: 'trade_proposal',
          seen: false,
          metadata: { tradeOfferId, statusLabel },
        })
        await Chat.findByIdAndUpdate(chat._id, { $set: { updatedAt: new Date() } })
        if (io) io.emit(`getMessage::${chat._id}`, created)
      }
    }
  } catch (err) {
    console.error('[TradeFulfillment] chat message failed:', err)
  }

  for (const role of roles) {
    const uid = userIdOf(offer, role)
    if (io) io.to(uid).emit('trade-updated', { tradeOfferId, stage: offer.stage, message: text })
    User.findById(uid)
      .select('deviceToken')
      .then(u => {
        if (u?.deviceToken) {
          return sendPushNotification(u.deviceToken, statusLabel, text, {
            type: 'TRADE_UPDATED',
            tradeOfferId,
          })
        }
      })
      .catch(() => {/* non-blocking */})
  }
}

const record = (offer: any, message: string, actorId?: string, stage?: ITradeStage) => {
  offer.history = offer.history || []
  offer.history.push({
    at: new Date(),
    stage: stage ?? offer.stage,
    message,
    actorId: actorId && Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : undefined,
  })
}

// ── Paid → labels ───────────────────────────────────────────────────────────

/**
 * Both sides have paid: buy the labels to ARIES and start the ship-by clock.
 * Called from the Stripe webhook. Safe to call again (admin "retry labels").
 */
export const startFulfillment = async (offerId: string, actorId?: string) => {
  const offer: any = await populated(offerId)
  if (!offer) throw new ApiError(StatusCodes.NOT_FOUND, 'Trade not found')
  if (offer.status !== 'accepted') return offer
  if (offer.stage && !['awaiting_payment', 'awaiting_shipment'].includes(offer.stage)) {
    return offer
  }

  const firstTime = offer.stage !== 'awaiting_shipment'
  if (firstTime) {
    offer.stage = 'awaiting_shipment'
    offer.paidAt = offer.paidAt || new Date()
    offer.escrowStatus = 'held'
    for (const role of ['sender', 'receiver'] as ITradeRole[]) {
      offer[itemStatusKey(role)] = itemsOf(offer, role).length
        ? 'awaiting_shipment'
        : 'none'
    }
    record(offer, 'Both traders paid.', actorId, 'awaiting_shipment')
  }

  const errors: string[] = []
  for (const shipment of offer.shipments.filter((s: any) => s.leg === 'inbound')) {
    try {
      await buyShipmentLabel(shipment)
    } catch (err: any) {
      errors.push(`${shipment.party}: ${err?.message || err}`)
    }
  }
  offer.markModified('shipments')

  if (errors.length) {
    record(offer, `Could not buy inbound label(s): ${errors.join('; ')}`, actorId)
  } else if (!offer.labelsIssuedAt) {
    offer.labelsIssuedAt = new Date()
    record(offer, 'Shipping labels to ARIES issued.', actorId)
  }
  await offer.save()

  if (firstTime && !errors.length) {
    const rules = await TradeSettlementServices.getTradeRules()
    await notify(
      offer,
      `${label(offer)}: both payments are in. Your shipping label to ARIES is ready — print it and ship within ${rules.shipByBusinessDays} business days.`,
      'LABEL READY 📦',
    )
  }
  return offer
}

// ── Tracking ────────────────────────────────────────────────────────────────

const MOVING = new Set(['in_transit', 'out_for_delivery'])

/** Applies a carrier update to any trade shipment with this tracking code. */
export const applyTrackingUpdate = async (update: TrackingUpdate): Promise<boolean> => {
  if (!update.trackingCode) return false
  const offers: any[] = await TradeOffer.find({ 'shipments.trackingCode': update.trackingCode })
  if (!offers.length) return false

  for (const offer of offers) {
    const shipment = offer.shipments.find((s: any) => s.trackingCode === update.trackingCode)
    if (!shipment || shipment.status === 'voided') continue

    const seen = new Set(
      (shipment.events || []).map((e: any) => `${new Date(e.datetime).getTime()}|${e.message}`),
    )
    for (const e of update.events) {
      const key = `${e.datetime.getTime()}|${e.message}`
      if (!seen.has(key)) {
        shipment.events.push({ status: e.status, message: e.message, location: e.location, datetime: e.datetime })
      }
    }
    shipment.trackingStatus = update.status

    if (MOVING.has(update.status) && shipment.status === 'purchased') {
      shipment.status = 'in_transit'
    }
    const delivered = update.status === 'delivered' && shipment.status !== 'delivered'
    if (delivered) {
      shipment.status = 'delivered'
      shipment.deliveredAt = new Date()
    }

    if (shipment.leg === 'inbound') {
      const key = itemStatusKey(shipment.party)
      if (MOVING.has(update.status) && offer[key] === 'awaiting_shipment') {
        offer[key] = 'in_transit'
        record(offer, `${shipment.party} item shipped to ARIES.`)
      }
      if (delivered && ['awaiting_shipment', 'in_transit'].includes(offer[key])) {
        offer[key] = 'received'
        if (offer.stage === 'awaiting_shipment') offer.stage = 'in_authentication'
        record(offer, `${shipment.party} item delivered to ARIES.`)
      }
    }

    offer.markModified('shipments')
    await offer.save()

    if (shipment.leg === 'outbound' && delivered) {
      const outbound = offer.shipments.filter((s: any) => s.leg === 'outbound' && s.status !== 'voided')
      if (outbound.every((s: any) => s.status === 'delivered')) {
        await completeTrade(String(offer._id))
      }
    }
  }
  return true
}

// ── Admin: receive and authenticate ─────────────────────────────────────────

const requireRole = (role: string): ITradeRole => {
  if (role !== 'sender' && role !== 'receiver') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'party must be "sender" or "receiver".')
  }
  return role
}

const requireActive = (offer: any) => {
  if (!offer) throw new ApiError(StatusCodes.NOT_FOUND, 'Trade not found')
  if (offer.status !== 'accepted' || ['completed', 'cancelled', 'awaiting_payment'].includes(offer.stage)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This trade is not being fulfilled right now.')
  }
}

/** The item(s) arrived at ARIES (for when tracking did not say so). */
export const markReceived = async (offerId: string, partyInput: string, actorId: string) => {
  const role = requireRole(partyInput)
  const offer: any = await populated(offerId)
  requireActive(offer)
  const key = itemStatusKey(role)
  if (!['awaiting_shipment', 'in_transit'].includes(offer[key])) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `The ${role}'s item is already ${offer[key]}.`)
  }
  offer[key] = 'received'
  const inbound = offer.shipments.find((s: any) => s.leg === 'inbound' && s.party === role)
  if (inbound && inbound.status !== 'delivered') {
    inbound.status = 'delivered'
    inbound.deliveredAt = new Date()
    offer.markModified('shipments')
  }
  if (offer.stage === 'awaiting_shipment') offer.stage = 'in_authentication'
  record(offer, `${role} item received at ARIES.`, actorId)
  await offer.save()
  await notify(offer, `${label(offer)}: your item arrived at ARIES and is being authenticated.`, 'ITEM RECEIVED 🔍', role)
  return offer
}

const ready = (status: ITradeItemStatus | undefined) => status === 'authenticated' || status === 'none'

export const authenticateItem = async (
  offerId: string,
  partyInput: string,
  passed: boolean,
  note: string | undefined,
  actorId: string,
) => {
  const role = requireRole(partyInput)
  const offer: any = await populated(offerId)
  requireActive(offer)
  const key = itemStatusKey(role)
  if (!['received', 'failed', 'authenticated'].includes(offer[key])) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `The ${role}'s item has not been received yet.`)
  }
  offer[key] = passed ? 'authenticated' : 'failed'
  if (offer.stage === 'awaiting_shipment') offer.stage = 'in_authentication'
  record(offer, `${role} item ${passed ? 'passed' : 'failed'} authentication${note ? `: ${note}` : ''}.`, actorId)
  await offer.save()

  if (!passed) {
    // The trade can't go ahead. The failed item's owner pays the returns and
    // the $2 material fee; the other trader is reimbursed (client rule).
    const other: ITradeRole = role === 'sender' ? 'receiver' : 'sender'
    const faultParty: ITradeRole | 'both' = offer[itemStatusKey(other)] === 'failed' ? 'both' : role
    const { plan } = await cancelTrade(offerId, {
      faultParty,
      policy: 'failed_authentication',
      reason: `${role === 'sender' ? 'The sender' : 'The receiver'}'s item did not pass authentication${note ? ` (${note})` : ''}`,
      actorId,
    })
    const owner = plan.parties.find(p => p.role === role)
    const innocent = plan.parties.find(p => p.role === other)
    await notify(
      offer,
      `${label(offer)}: your item did not pass authentication${note ? ` (${note})` : ''}. It is being shipped back to you. ` +
        `The return shipping and the $2 material fee are on you` +
        (owner && owner.refundAmount > 0 ? `; $${owner.refundAmount.toFixed(2)} of your payment is being refunded.` : '.') +
        (owner && owner.shortfall > 0 ? ` You owe $${owner.shortfall.toFixed(2)} more for return shipping.` : ''),
      'AUTHENTICATION FAILED',
      role,
    )
    if (faultParty !== 'both') {
      await notify(
        offer,
        `${label(offer)}: the other trader's item did not pass authentication, so the trade is cancelled. ` +
          `Your item is coming back to you at no cost` +
          (innocent && innocent.refundAmount > 0 ? ` and $${innocent.refundAmount.toFixed(2)} is being refunded to your card.` : '.'),
        'TRADE CANCELLED',
        other,
      )
    }
    // A lasting record in the traders' chat (the messages above are push only).
    await notify(
      offer,
      `${label(offer)} was cancelled: the ${faultParty === 'both' ? "items" : `${role}'s item`} did not pass authentication. ` +
        (faultParty === 'both'
          ? 'Each trader pays their own return shipping and the $2 material fee.'
          : `The ${role} pays the return shipping and the $2 material fee; the ${other} is refunded in full.`),
      'AUTHENTICATION FAILED',
      undefined,
      { chatOnly: true },
    )
    return (await populated(offerId)) as any
  }

  if (ready(offer.senderItemStatus) && ready(offer.receiverItemStatus)) {
    return shipBack(offerId, actorId)
  }
  return offer
}

// ── Admin: ship back ────────────────────────────────────────────────────────

/**
 * Both sides authenticated: buy the labels from ARIES to each trader and
 * settle the difference against what they paid for them (client #8, #9).
 */
export const shipBack = async (offerId: string, actorId?: string) => {
  const offer: any = await populated(offerId)
  requireActive(offer)
  if (!(ready(offer.senderItemStatus) && ready(offer.receiverItemStatus))) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Both sides must pass authentication first.')
  }

  const settlement = await TradeSettlement.findOne({ tradeOfferId: offer._id })
  const outbound = offer.shipments.filter((s: any) => s.leg === 'outbound' && s.status !== 'voided')
  if (!outbound.length) return completeTrade(offerId, actorId)

  const errors: string[] = []
  for (const shipment of outbound) {
    if (shipment.status !== 'quoted') continue
    try {
      await buyShipmentLabel(shipment)
    } catch (err: any) {
      errors.push(`${shipment.party}: ${err?.message || err}`)
      continue
    }

    const party = settlement?.parties.find(p => p.role === shipment.party)
    const diffCents = toCents(shipment.cost || 0) - toCents(shipment.estimate || 0)
    if (settlement && party && diffCents < 0) {
      try {
        await TradeSettlementServices.refundParty(
          settlement,
          shipment.party,
          -diffCents,
          'Return label cost less than estimated',
        )
        record(offer, `Refunded $${(-diffCents / 100).toFixed(2)} label overestimate to ${shipment.party}.`, actorId)
      } catch (err) {
        console.error('[TradeFulfillment] overestimate refund failed:', err)
      }
    } else if (settlement && party && diffCents > 0) {
      party.extraChargeCents = (party.extraChargeCents || 0) + diffCents
      party.extraStatus = 'pending'
      settlement.markModified('parties')
      await settlement.save()
      record(offer, `${shipment.party} owes $${(diffCents / 100).toFixed(2)} more for their label.`, actorId)
      await notify(
        offer,
        `${label(offer)}: your return label cost $${(diffCents / 100).toFixed(2)} more than estimated. Please pay the difference in the app.`,
        'SHIPPING ADJUSTMENT',
        shipment.party,
      )
    }
  }
  offer.markModified('shipments')

  if (errors.length) {
    record(offer, `Could not buy outbound label(s): ${errors.join('; ')}`, actorId)
    await offer.save()
    throw new ApiError(StatusCodes.BAD_GATEWAY, `Could not buy every label: ${errors.join('; ')}`)
  }

  offer.stage = 'shipping_back'
  record(offer, 'Items authenticated and shipped back.', actorId, 'shipping_back')
  await offer.save()
  await notify(offer, `${label(offer)}: everything passed authentication. Your new items are on their way! 🚚`, 'SHIPPED TO YOU 🚚')
  return offer
}

// ── Completion ──────────────────────────────────────────────────────────────

/** Swap ownership, pay out the cash difference, and close the trade. */
export const completeTrade = async (offerId: string, actorId?: string) => {
  const offer: any = await populated(offerId)
  if (!offer) throw new ApiError(StatusCodes.NOT_FOUND, 'Trade not found')
  if (offer.status === 'completed') return offer
  if (offer.status !== 'accepted') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only an active trade can be completed.')
  }
  if (offer.stage === 'awaiting_payment' || !offer.stage) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Both traders must pay before the trade can complete.')
  }

  const senderIds = itemsOf(offer, 'sender').map((p: any) => p._id ?? p)
  const receiverIds = itemsOf(offer, 'receiver').map((p: any) => p._id ?? p)

  record(offer, 'Trade completed. Ownership transferred.', actorId, 'completed')
  await runInTransaction(async session => {
    if (senderIds.length) {
      await Product.updateMany({ _id: { $in: senderIds } }, { sellerId: offer.receiverId, status: 'active' }, { session })
    }
    if (receiverIds.length) {
      await Product.updateMany({ _id: { $in: receiverIds } }, { sellerId: offer.senderId, status: 'active' }, { session })
    }
    offer.status = 'completed'
    offer.stage = 'completed'
    offer.escrowStatus = 'released'
    offer.completedAt = new Date()
    await offer.save({ session })
  })

  TradeSettlementServices.payOutCash(offerId).catch(err =>
    console.error('[TradeFulfillment] cash payout failed:', err),
  )
  TradeVoteServices.createTradeVoteFromCompletedTrade(offer).catch(err =>
    console.error('Failed to auto-create trade vote:', err),
  )
  PartnerService.recordCommissionForOrder({
    buyerId: userIdOf(offer, 'sender'),
    tradeOfferId: offer._id.toString(),
    transactionAmount:
      itemsOf(offer, 'sender').reduce((s: number, p: any) => s + Number(p?.estValue || 0), 0) +
      itemsOf(offer, 'receiver').reduce((s: number, p: any) => s + Number(p?.estValue || 0), 0),
    isTrade: true,
  }).catch(err => console.error('Failed to record partner trade commission:', err))

  await notify(offer, `${label(offer)} is complete! The items are now yours. ✅`, 'TRADE COMPLETED ✅')
  return offer
}

// ── Cancellation and refunds ────────────────────────────────────────────────

/** Did this side's items leave their hands (so their label and material were used)? */
const shipped = (status?: ITradeItemStatus) =>
  !!status && ['in_transit', 'received', 'authenticated', 'failed'].includes(status)

/**
 * 'failed_authentication' (client, 2026-11-28): the owner of an item that
 * fails authentication pays to ship things back and keeps losing the $2
 * material fee (and the label to ARIES they used), but their 4% fee is
 * returned. The other trader is reimbursed in full.
 */
export type CancelPolicy = 'default' | 'failed_authentication'

export type CancelPlan = {
  faultParty?: ITradeRole | 'both'
  parties: {
    role: ITradeRole
    paid: boolean
    paidAmount: number
    refundAmount: number
    feeForfeited: boolean
    returnShipping: number
    shortfall: number
  }[]
  returns: { owner: ITradeRole; payer: ITradeRole; estimate: number }[]
}

/**
 * Works out who gets what back when a trade stops early.
 *
 * - The innocent side gets everything back (client #4).
 * - The side at fault forfeits their 4% (follow-up #6). Their $2 material fee
 *   and their label to ARIES come back only if they never shipped. The cash
 *   they added and their unused return-label estimate always come back.
 * - Items already at (or on the way to) ARIES go back to their owner. The
 *   side at fault pays for those return labels (follow-up #6); with no single
 *   side at fault each owner pays for their own.
 */
const planCancellation = async (
  offer: any,
  faultParty: ITradeRole | 'both' | undefined,
  policy: CancelPolicy = 'default',
): Promise<CancelPlan> => {
  const settlement = await TradeSettlement.findOne({ tradeOfferId: offer._id })
  const hub = hubAddress()
  const returns: CancelPlan['returns'] = []

  for (const owner of ['sender', 'receiver'] as ITradeRole[]) {
    if (!shipped(offer[itemStatusKey(owner)])) continue
    const parcel = parcelForItems(itemsOf(offer, owner))
    if (!parcel) continue
    let estimate = 0
    try {
      const to = await partyAddress(userIdOf(offer, owner))
      estimate = (await cheapestRate(hub, to, parcel)).amount
    } catch {
      estimate = 0
    }
    const payer: ITradeRole =
      faultParty && faultParty !== 'both' ? faultParty : owner
    returns.push({ owner, payer, estimate: round2(estimate) })
  }

  const parties = (['sender', 'receiver'] as ITradeRole[]).map(role => {
    const p = settlement?.parties.find(x => x.role === role)
    const paid = p?.status === 'paid'
    const paidAmount = paid ? (p!.chargeCents - (p!.refundedCents || 0)) / 100 : 0
    const atFault = faultParty === role || faultParty === 'both'
    const returnShipping = round2(
      returns.filter(r => r.payer === role).reduce((s, r) => s + r.estimate, 0),
    )

    if (!paid || !p) {
      return { role, paid: false, paidAmount: 0, refundAmount: 0, feeForfeited: false, returnShipping, shortfall: returnShipping }
    }

    let gross: number
    if (!atFault) {
      gross = paidAmount
    } else {
      const didShip = shipped(offer[itemStatusKey(role)])
      const outboundBought = offer.shipments.some(
        (s: any) => s.leg === 'outbound' && s.party === role && s.status !== 'quoted' && s.status !== 'voided',
      )
      gross =
        p.cashNet +
        (outboundBought ? 0 : p.outboundLabelNet || 0) +
        (didShip ? 0 : (p.materialFeeNet || 0) + (p.inboundLabelNet || 0)) +
        (policy === 'failed_authentication' ? p.feeNet || 0 : 0)
      gross = Math.min(round2(gross), paidAmount)
    }

    const refundAmount = round2(Math.max(0, gross - returnShipping))
    const shortfall = round2(Math.max(0, returnShipping - gross))
    return {
      role,
      paid: true,
      paidAmount,
      refundAmount,
      feeForfeited: atFault && policy !== 'failed_authentication',
      returnShipping,
      shortfall,
    }
  })

  return { faultParty, parties, returns }
}

export const cancelTrade = async (
  offerId: string,
  options: {
    faultParty?: ITradeRole | 'both'
    reason: string
    actorId?: string
    dryRun?: boolean
    policy?: CancelPolicy
  },
) => {
  const offer: any = await populated(offerId)
  if (!offer) throw new ApiError(StatusCodes.NOT_FOUND, 'Trade not found')
  if (offer.status !== 'accepted') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Only an accepted trade can be cancelled.')
  }

  const plan = await planCancellation(offer, options.faultParty, options.policy)
  if (options.dryRun) return { plan, offer }

  const settlement = await TradeSettlement.findOne({ tradeOfferId: offer._id })

  // 1. Void labels nobody will use; buy the returns.
  for (const s of offer.shipments) {
    if (s.status === 'quoted') {
      s.status = 'voided'
    } else if (s.status === 'purchased' && (s.trackingStatus === 'pre_transit' || !s.trackingStatus)) {
      try {
        if (s.shipmentId) await getShippingProvider().refundLabel(s.shipmentId)
      } catch (err) {
        console.error('[TradeFulfillment] label void failed:', err)
      }
      s.status = 'voided'
    }
  }
  for (const r of plan.returns) {
    const parcel = parcelForItems(itemsOf(offer, r.owner))
    try {
      const shipment: any = {
        leg: 'return',
        party: r.owner,
        from: hubAddress(),
        to: await partyAddress(userIdOf(offer, r.owner)),
        parcel,
        estimate: r.estimate,
        status: 'quoted',
      }
      await buyShipmentLabel(shipment)
      offer.shipments.push(shipment)
    } catch (err: any) {
      record(offer, `Could not buy return label for ${r.owner}: ${err?.message || err}`, options.actorId)
    }
  }
  offer.markModified('shipments')

  // 2. Refunds.
  if (settlement) {
    for (const p of plan.parties) {
      const party = settlement.parties.find(x => x.role === p.role)
      if (party && p.feeForfeited) party.feeForfeited = true
      if (party) {
        party.returnShippingCents = toCents(p.returnShipping)
        party.shortfallCents = toCents(p.shortfall)
        // Anything the refund couldn't cover becomes payable in the app.
        if (p.shortfall > 0) {
          party.extraChargeCents = (party.extraChargeCents || 0) + toCents(p.shortfall)
          party.extraStatus = 'pending'
          party.extraReason = 'return_shipping'
        }
      }
      if (p.refundAmount > 0) {
        try {
          await TradeSettlementServices.refundParty(settlement, p.role, toCents(p.refundAmount), options.reason)
        } catch (err: any) {
          record(offer, `Refund to ${p.role} failed: ${err?.message || err}`, options.actorId)
        }
      }
      if (p.shortfall > 0) {
        record(offer, `${p.role} owes $${p.shortfall.toFixed(2)} in return shipping beyond what can be refunded.`, options.actorId)
      }
    }
    settlement.status = 'cancelled'
    settlement.markModified('parties')
    await settlement.save()
  }

  // 3. Release the items to their owners and close the trade.
  const allIds = [...itemsOf(offer, 'sender'), ...itemsOf(offer, 'receiver')].map((p: any) => p._id ?? p)
  await Product.updateMany({ _id: { $in: allIds }, status: 'pending' }, { status: 'active' })

  offer.status = 'cancelled'
  offer.stage = 'cancelled'
  offer.escrowStatus = 'refunded'
  offer.cancelledAt = new Date()
  offer.cancelReason = options.reason
  offer.faultParty = options.faultParty
  for (const r of plan.returns) offer[itemStatusKey(r.owner)] = 'returned'
  record(offer, `Cancelled: ${options.reason}`, options.actorId, 'cancelled')
  await offer.save()

  // A failed authentication sends each trader their own message instead.
  if (options.policy !== 'failed_authentication') {
    await notify(offer, `${label(offer)} was cancelled: ${options.reason}. Any refund is on its way to your card.`, 'TRADE CANCELLED')
  }
  return { plan, offer }
}

// ── Deadlines (cron) ────────────────────────────────────────────────────────

/** One side never paid in time: refund the other in full (client #4). */
export const enforcePaymentDeadlines = async () => {
  const due: any[] = await TradeOffer.find({
    status: 'accepted',
    stage: 'awaiting_payment',
    paymentDueAt: { $lte: new Date() },
  }).select('_id')

  for (const { _id } of due) {
    try {
      const settlement = await TradeSettlement.findOne({ tradeOfferId: _id })
      const unpaid = (['sender', 'receiver'] as ITradeRole[]).filter(
        role => settlement?.parties.find(p => p.role === role)?.status !== 'paid',
      )
      const faultParty = unpaid.length === 2 ? 'both' : unpaid[0]
      await cancelTrade(String(_id), {
        faultParty,
        reason: 'payment was not completed in time',
      })
    } catch (err) {
      console.error(`[TradeDeadlines] payment deadline for ${_id} failed:`, err)
    }
  }
}

/** A side never shipped within the business-day window: they forfeit their 4%. */
export const enforceShipDeadlines = async () => {
  const rules = await TradeSettlementServices.getTradeRules()
  const active: any[] = await TradeOffer.find({
    status: 'accepted',
    stage: { $in: ['awaiting_shipment', 'in_authentication'] },
    labelsIssuedAt: { $ne: null },
    $or: [{ senderItemStatus: 'awaiting_shipment' }, { receiverItemStatus: 'awaiting_shipment' }],
  }).select('_id labelsIssuedAt senderItemStatus receiverItemStatus')

  const now = new Date()
  for (const offer of active) {
    if (addBusinessDays(offer.labelsIssuedAt, rules.shipByBusinessDays) > now) continue
    const late = (['sender', 'receiver'] as ITradeRole[]).filter(
      role => offer[itemStatusKey(role)] === 'awaiting_shipment',
    )
    try {
      await cancelTrade(String(offer._id), {
        faultParty: late.length === 2 ? 'both' : late[0],
        reason: `an item was not shipped within ${rules.shipByBusinessDays} business days`,
      })
    } catch (err) {
      console.error(`[TradeDeadlines] ship deadline for ${offer._id} failed:`, err)
    }
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * A trade as one participant sees it: their own labels only, so neither side
 * ever sees the other's home address.
 */
export const getTradeForUser = async (offerId: string, userId: string, isAdmin = false) => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid trade id')
  }
  const offer: any = await TradeOffer.findById(offerId)
    .populate('senderId', 'name fullName userName username image photo')
    .populate('receiverId', 'name fullName userName username image photo')
    .populate('senderProductIds')
    .populate('receiverProductIds')
    .lean({ virtuals: true })
  if (!offer) throw new ApiError(StatusCodes.NOT_FOUND, 'Trade not found')

  const role: ITradeRole | null =
    String(offer.senderId?._id) === userId
      ? 'sender'
      : String(offer.receiverId?._id) === userId
        ? 'receiver'
        : null
  if (!role && !isAdmin) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not part of this trade.')
  }

  const settlement = await TradeSettlementServices.getSettlementStatus(offerId)
  const rules = await TradeSettlementServices.getTradeRules()
  const shipBy =
    offer.labelsIssuedAt && offer.stage === 'awaiting_shipment'
      ? addBusinessDays(new Date(offer.labelsIssuedAt), rules.shipByBusinessDays)
      : undefined

  return {
    ...offer,
    myRole: role,
    shipBy,
    shipments: isAdmin
      ? offer.shipments
      : (offer.shipments || [])
          .filter((s: any) => s.party === role && s.status !== 'quoted')
          .map((s: any) => (s.leg === 'inbound' ? s : { ...s, from: undefined })),
    history: isAdmin ? offer.history : undefined,
    settlement: isAdmin
      ? settlement
      : settlement && {
          ...settlement,
          parties: settlement.parties.filter(p => p.role === role),
        },
  }
}

export const TradeFulfillment = {
  addBusinessDays,
  parcelForItems,
  quotePartyLabels,
  startFulfillment,
  applyTrackingUpdate,
  markReceived,
  authenticateItem,
  shipBack,
  completeTrade,
  cancelTrade,
  enforcePaymentDeadlines,
  enforceShipDeadlines,
  getTradeForUser,
}
