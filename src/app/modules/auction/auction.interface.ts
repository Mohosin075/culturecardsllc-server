import { Schema, Document } from 'mongoose'

export type ILiveStream = {
  sellerId: Schema.Types.ObjectId
  title: string
  description?: string
  coverImage: string
  promoVideo?: string
  scheduledAt?: Date
  scheduledStartTime?: Date
  startedAt?: Date
  endedAt?: Date
  status: 'scheduled' | 'live' | 'ended'
  agoraChannelName: string
  pinnedProductId?: Schema.Types.ObjectId
  inventoryIds?: Schema.Types.ObjectId[]
  reminderSent?: boolean
  viewersCount: number
  likesCount: number
  chatMessages?: Array<{
    user: string
    message: string
    timestamp: Date
  }>
  createdAt: Date
  updatedAt: Date
} & Document

export type ISavedShow = {
  userId: Schema.Types.ObjectId
  streamId: Schema.Types.ObjectId
  createdAt: Date
  updatedAt: Date
} & Document

export type IAuctionItem = {
  streamId: Schema.Types.ObjectId
  productId: Schema.Types.ObjectId
  status: 'pending' | 'active' | 'completed' | 'failed'
  currentBid: number
  highestBidderId?: Schema.Types.ObjectId
  bidIncrement: number
  timerDuration: number // in seconds
  endsAt?: Date
  createdAt: Date
  updatedAt: Date
} & Document
