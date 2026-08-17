import { Model, Types } from 'mongoose'

export type IPaymentPayload = {
  amount: number
  bookingId?: string
  orderId?: string
  tradeOfferId?: string
  currency?: string
  productName?: string
  description?: string
  metadata?: Record<string, unknown>
  paymentMethodId?: string
}

export type IPaymentFilterables = {
  searchTerm?: string
  userId?: string
  paymentMethod?: string
  status?: string
}

export type IPayment = {
  _id: Types.ObjectId
  userId: Types.ObjectId
  bookingId?: Types.ObjectId
  orderId?: Types.ObjectId
  tradeOfferId?: Types.ObjectId
  userEmail: string
  amount: number
  currency: string
  paymentMethod: 'stripe' | 'paypal' | 'bank_transfer'
  paymentIntentId: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  refundAmount?: number
  refundReason?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type PaymentModel = Model<IPayment>

