import { Schema, model } from 'mongoose'
import { ITradeOffer } from './trade.interface'

const AddressSchema = new Schema(
  {
    name: String,
    company: String,
    street1: String,
    street2: String,
    city: String,
    state: String,
    zip: String,
    country: String,
    phone: String,
    email: String,
  },
  { _id: false },
)

const ParcelSchema = new Schema(
  {
    lengthIn: Number,
    widthIn: Number,
    heightIn: Number,
    weightOz: Number,
  },
  { _id: false },
)

const ShipmentSchema = new Schema(
  {
    leg: { type: String, enum: ['inbound', 'outbound', 'return'], required: true },
    party: { type: String, enum: ['sender', 'receiver'], required: true },
    from: { type: AddressSchema },
    to: { type: AddressSchema },
    parcel: { type: ParcelSchema },
    estimate: Number,
    cost: Number,
    shipmentId: String,
    rateId: String,
    carrier: String,
    service: String,
    trackingCode: { type: String, index: true },
    labelUrl: String,
    trackingStatus: String,
    events: [
      {
        _id: false,
        status: String,
        message: String,
        location: String,
        datetime: Date,
      },
    ],
    status: {
      type: String,
      enum: ['quoted', 'purchased', 'in_transit', 'delivered', 'voided'],
      default: 'quoted',
    },
    purchasedAt: Date,
    deliveredAt: Date,
  },
  { _id: true },
)

const ITEM_STATUSES = [
  'none',
  'awaiting_shipment',
  'in_transit',
  'received',
  'authenticated',
  'failed',
  'returned',
]

const TradeOfferSchema = new Schema<ITradeOffer>(
  {
    tradeCode: { type: String, unique: true, sparse: true, index: true },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    receiverProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    senderProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },
    receiverProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    cashSupplement: {
      type: Number,
      default: 0,
    },
    escrowStatus: {
      type: String,
      enum: ['pending', 'held', 'released', 'refunded'],
      default: 'pending',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'completed', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    stage: {
      type: String,
      enum: [
        'awaiting_payment',
        'awaiting_shipment',
        'in_authentication',
        'shipping_back',
        'completed',
        'cancelled',
      ],
      index: true,
    },
    senderItemStatus: { type: String, enum: ITEM_STATUSES },
    receiverItemStatus: { type: String, enum: ITEM_STATUSES },
    shipments: { type: [ShipmentSchema], default: [] },
    history: [
      {
        _id: false,
        at: { type: Date, default: Date.now },
        stage: String,
        message: String,
        actorId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    acceptedAt: Date,
    paymentDueAt: { type: Date, index: true },
    paidAt: Date,
    labelsIssuedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    faultParty: { type: String, enum: ['sender', 'receiver', 'both'] },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Older offers only have the single-item fields; read them as one-item lists.
TradeOfferSchema.pre('validate', function (next) {
  const doc = this as any
  if (!doc.receiverProductIds?.length && doc.receiverProductId) {
    doc.receiverProductIds = [doc.receiverProductId]
  }
  if (!doc.senderProductIds?.length && doc.senderProductId) {
    doc.senderProductIds = [doc.senderProductId]
  }
  if (!doc.receiverProductId && doc.receiverProductIds?.length) {
    doc.receiverProductId = doc.receiverProductIds[0]
  }
  if (!doc.senderProductId && doc.senderProductIds?.length) {
    doc.senderProductId = doc.senderProductIds[0]
  }
  next()
})

export const TradeOffer = model<ITradeOffer>('TradeOffer', TradeOfferSchema)
export default TradeOffer
