import { Schema, model, Model, Types, Document } from 'mongoose'

/**
 * Money owed on a trade.
 *
 * The client's spec charges **both** sides 4% of their own item's agreed
 * value, and lets one side pay a cash difference on top. Those are separate
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
  /** What this party is actually charged, in cents (fee + cash, grossed up). */
  chargeCents: number
  paymentIntentId?: string
  /** Set when the charge runs on the other party's connected account. */
  stripeAccountId?: string
  status: 'pending' | 'paid'
  paidAt?: Date
}

export type ITradeSettlement = {
  _id: Types.ObjectId
  tradeOfferId: Types.ObjectId
  parties: ITradeSettlementParty[]
  status: 'pending' | 'settled'
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
    chargeCents: { type: Number, default: 0, min: 0 },
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
      enum: ['pending', 'settled'],
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
