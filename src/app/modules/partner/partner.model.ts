import { Schema, model } from 'mongoose'
import { IPartner, IPartnerEarning } from './partner.interface'

const PartnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    promoCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    revenueSharePercentage: { type: Number, default: 50, min: 0, max: 100 },
    bankDetails: {
      accountNumber: { type: String, default: '' },
      routingNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountHolderName: { type: String, default: '' },
    },
    accessToken: { type: String, required: true, unique: true, index: true },
    totalEarnings: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  },
)

const PartnerEarningSchema = new Schema<IPartnerEarning>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', sparse: true },
    tradeOfferId: { type: Schema.Types.ObjectId, ref: 'TradeOffer', sparse: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionAmount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    partnerShare: { type: Number, required: true, min: 0 },
    ownerShare: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
)

// Idempotency: Prevent duplicate earnings on webhook retries
PartnerEarningSchema.index({ partnerId: 1, orderId: 1 }, { unique: true, sparse: true })
PartnerEarningSchema.index({ partnerId: 1, tradeOfferId: 1 }, { unique: true, sparse: true })
PartnerEarningSchema.index({ partnerId: 1, createdAt: -1 })
PartnerEarningSchema.index({ createdAt: 1 })

export const Partner = model<IPartner>('Partner', PartnerSchema)
export const PartnerEarning = model<IPartnerEarning>('PartnerEarning', PartnerEarningSchema)
