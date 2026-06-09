import { Schema, Document } from 'mongoose'

export interface ILiveStream extends Document {
  sellerId: Schema.Types.ObjectId
  title: string
  description?: string
  scheduledAt?: Date
  status: 'scheduled' | 'live' | 'ended'
  agoraChannelName: string
  pinnedProductId?: Schema.Types.ObjectId
  viewersCount: number
  likesCount: number
  createdAt: Date
  updatedAt: Date
}

export interface IAuctionItem extends Document {
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
}
