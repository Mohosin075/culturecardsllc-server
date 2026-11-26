import { Schema, Document } from 'mongoose'
import { Parcel, ShippingAddress, TrackingStatus } from '../shipping/shipping.interface'

export type ITradeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'expired'
  | 'cancelled'

export type IEscrowStatus = 'pending' | 'held' | 'released' | 'refunded'

export type ITradeRole = 'sender' | 'receiver'

/**
 * Where an accepted trade is. Every item travels participant → ARIES →
 * other participant, and nothing ships until both sides have paid.
 */
export type ITradeStage =
  | 'awaiting_payment' // accepted; one or both sides still owe
  | 'awaiting_shipment' // paid; inbound labels bought, items not at ARIES yet
  | 'in_authentication' // at least one item reached ARIES
  | 'shipping_back' // both authenticated; outbound labels bought
  | 'completed'
  | 'cancelled'

/** One side's items on their way through ARIES. */
export type ITradeItemStatus =
  | 'none' // this side sends no items (cash only)
  | 'awaiting_shipment'
  | 'in_transit'
  | 'received'
  | 'authenticated'
  | 'failed'
  | 'returned'

export type ITradeShipmentLeg = 'inbound' | 'outbound' | 'return'

/**
 * One label. A two-sided trade has four: each participant → ARIES (inbound),
 * and ARIES → each participant (outbound). A cancelled trade may add returns.
 */
export type ITradeShipment = {
  leg: ITradeShipmentLeg
  /** The participant who sends (inbound) or receives (outbound/return). */
  party: ITradeRole
  from: ShippingAddress
  to: ShippingAddress
  parcel: Parcel
  /** Dollars quoted when the trade was paid. */
  estimate?: number
  /** Dollars actually paid for the label. */
  cost?: number
  shipmentId?: string
  rateId?: string
  carrier?: string
  service?: string
  trackingCode?: string
  labelUrl?: string
  trackingStatus?: TrackingStatus
  events?: { status: string; message: string; location?: string; datetime: Date }[]
  status: 'quoted' | 'purchased' | 'in_transit' | 'delivered' | 'voided'
  purchasedAt?: Date
  deliveredAt?: Date
}

export type ITradeHistoryEntry = {
  at: Date
  stage?: ITradeStage
  message: string
  actorId?: Schema.Types.ObjectId
}

export type ITradeOffer = {
  /** Human trade number: A-01 … A-1000, then B-01 … B-1000. Set on accept. */
  tradeCode?: string
  senderId: Schema.Types.ObjectId
  receiverId: Schema.Types.ObjectId
  /** Every item each side puts in. */
  senderProductIds: Schema.Types.ObjectId[]
  receiverProductIds: Schema.Types.ObjectId[]
  /** First item of each side, kept for older app builds. */
  senderProductId?: Schema.Types.ObjectId
  receiverProductId: Schema.Types.ObjectId
  cashSupplement: number // Positive if sender pays receiver, Negative if receiver pays sender
  escrowStatus: IEscrowStatus
  status: ITradeStatus
  stage?: ITradeStage
  senderItemStatus?: ITradeItemStatus
  receiverItemStatus?: ITradeItemStatus
  shipments: ITradeShipment[]
  history: ITradeHistoryEntry[]
  acceptedAt?: Date
  /** Both sides must pay by then, or the trade is cancelled and refunded. */
  paymentDueAt?: Date
  paidAt?: Date
  /** When both inbound labels were bought; the ship-by clock starts here. */
  labelsIssuedAt?: Date
  completedAt?: Date
  cancelledAt?: Date
  cancelReason?: string
  /** The side whose fault cancelled the trade, if any. */
  faultParty?: ITradeRole | 'both'
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
} & Document
