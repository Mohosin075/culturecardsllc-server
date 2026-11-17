import { Model, Types } from 'mongoose'

export type ITip = {
  _id: Types.ObjectId
  streamId: Types.ObjectId
  senderId: Types.ObjectId
  sellerId: Types.ObjectId
  amount: number
  currency: string
  paymentIntentId: string
  status: 'pending' | 'succeeded' | 'failed'
  senderName: string
  senderImage?: string
  message?: string
  createdAt: Date
  updatedAt: Date
}

export type TipModel = Model<ITip>
