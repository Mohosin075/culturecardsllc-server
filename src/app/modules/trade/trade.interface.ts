import { Schema, Document } from 'mongoose'

export type ITradeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'expired'

export type IEscrowStatus = 'pending' | 'held' | 'released' | 'refunded'

export type ITradeOffer = {
  senderId: Schema.Types.ObjectId
  receiverId: Schema.Types.ObjectId
  senderProductId: Schema.Types.ObjectId
  receiverProductId: Schema.Types.ObjectId
  cashSupplement: number // Positive if sender pays receiver, Negative if receiver pays sender
  escrowStatus: IEscrowStatus
  status: ITradeStatus
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
} & Document
