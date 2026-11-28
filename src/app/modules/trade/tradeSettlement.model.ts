import { Schema, model, Model, Types, Document } from 'mongoose'

/**
 * Money owed on a trade.
 *
 * The client's spec charges **both** sides 4% of what they put into the trade
 * (their items plus any cash they add), a $2 material fee, and their own
 * shipping both ways. All of it is held on the platform until the trade
 * completes. Those are separate
 * payments by separate people, so a trade cannot settle in a single
 * PaymentIntent the way a sale can — this record tracks each side until all
 * of them have cleared, and only then are the items swapped.
 */
export type ITradeSettlementParty = {
  userId: Types.ObjectId
  role: 'sender' | 'receiver'
  /** Agreed value of this party's item, the 4% is taken on it. */
  itemValue: number
  /** ARIES's fee for this side, in dollars, before gross-up. */
  feeNet: number
  /** Cash difference this party owes the other side, in dollars. */
  cashNet: number
  /** Packing material fee, in dollars ($2 per trader). */
  materialFeeNet: number
  /** Label from this party to ARIES, in dollars (0 if they send nothing). */
  inboundLabelNet: number
  /** Estimate for the label from ARIES back to them, in dollars. */
  outboundLabelNet: number
  /** Set once both labels have been quoted for this party. */
  labelsQuoted?: boolean
  /** What this party is actually charged, in cents (all of the above, grossed up). */
  chargeCents: number
  /** Cents given back so far (cancellations, label overestimates). */
  refundedCents?: number
  refundIds?: string[]
  /** The 4% was kept because this party caused a cancellation. */
  feeForfeited?: boolean
  /** A second payment, when a label cost more than its estimate. */
  extraChargeCents?: number
  extraPaymentIntentId?: string
  extraStatus?: 'pending' | 'paid'
  /** The cash difference this party *receives*, paid out on completion. */
  payoutTransferId?: string
  payoutStatus?: 'none' | 'paid' | 'manual'
  paymentIntentId?: string
  /** Set when the charge runs on the other party's connected account. */
  stripeAccountId?: string
  status: 'pending' | 'paid'
  paidAt?: Date
  /** Set when the trade is cancelled: return shipping this party paid for. */
  returnShippingCents?: number
  /** Return shipping this party still owes beyond what could be refunded. */
  shortfallCents?: number
  /** Why an extra charge is due: a pricier label, or a cancelled trade's returns. */
  extraReason?: 'label_difference' | 'return_shipping'
}

export type ITradeSettlement = {
  _id: Types.ObjectId
  tradeOfferId: Types.ObjectId
  parties: ITradeSettlementParty[]
  status: 'pending' | 'settled' | 'cancelled'
  settledAt?: Date
  createdAt: Date
  updatedAt: Date
} & Document

const PartySchema = new Schema<ITradeSettlementParty>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['sender', 'receiver'], required: true },
    itemValue: { type: Number, default: 0, min: 0 },
    feeNet: { type: Number, default: 0, min: 0 },
    cashNet: { type: Number, default: 0, min: 0 },
    materialFeeNet: { type: Number, default: 0, min: 0 },
    inboundLabelNet: { type: Number, default: 0, min: 0 },
    outboundLabelNet: { type: Number, default: 0, min: 0 },
    labelsQuoted: { type: Boolean, default: false },
    chargeCents: { type: Number, default: 0, min: 0 },
    refundedCents: { type: Number, default: 0, min: 0 },
    returnShippingCents: { type: Number, default: 0, min: 0 },
    shortfallCents: { type: Number, default: 0, min: 0 },
    extraReason: { type: String, enum: ['label_difference', 'return_shipping'] },
    refundIds: { type: [String], default: [] },
    feeForfeited: { type: Boolean, default: false },
    extraChargeCents: { type: Number, default: 0, min: 0 },
    extraPaymentIntentId: { type: String, index: true },
    extraStatus: { type: String, enum: ['pending', 'paid'] },
    payoutTransferId: { type: String },
    payoutStatus: { type: String, enum: ['none', 'paid', 'manual'], default: 'none' },
    paymentIntentId: { type: String, index: true },
    stripeAccountId: { type: String },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date },
  },
  { _id: false },
)

const TradeSettlementSchema = new Schema<ITradeSettlement>(
  {
    tradeOfferId: {
      type: Schema.Types.ObjectId,
      ref: 'TradeOffer',
      required: true,
      unique: true,
      index: true,
    },
    parties: { type: [PartySchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'settled', 'cancelled'],
      default: 'pending',
      index: true,
    },
    settledAt: { type: Date },
  },
  { timestamps: true },
)

export const TradeSettlement = model<
  ITradeSettlement,
  Model<ITradeSettlement>
>('TradeSettlement', TradeSettlementSchema)

export default TradeSettlement
