import { Schema, Document, Types } from 'mongoose'

export type IBankDetails = {
  accountNumber?: string
  routingNumber?: string
  bankName?: string
  accountHolderName?: string
}

export type IPartner = {
  _id: Types.ObjectId
  name: string
  email: string
  promoCode: string // uppercase e.g. "OG"
  revenueSharePercentage: number // default 50
  bankDetails?: IBankDetails
  accessToken: string // unique 64-character hex token for magic link access
  totalEarnings: number
  createdAt: Date
  updatedAt: Date
} & Document

export type IPartnerEarning = {
  _id: Types.ObjectId
  partnerId: Types.ObjectId
  orderId?: Types.ObjectId
  tradeOfferId?: Types.ObjectId
  buyerId?: Types.ObjectId
  transactionAmount: number
  platformFee: number
  partnerShare: number
  ownerShare: number
  description?: string
  createdAt: Date
  updatedAt: Date
} & Document
