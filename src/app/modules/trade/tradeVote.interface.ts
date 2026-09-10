import { Schema, Document } from 'mongoose'

export interface ITradeVoteItem {
  name: string
  value: string
  image: string
  traderId?: Schema.Types.ObjectId
  traderName?: string
}

export interface ITradeVote extends Document {
  tradeId: Schema.Types.ObjectId
  category: string
  itemA: ITradeVoteItem
  itemB: ITradeVoteItem
  votesA: number
  votesB: number
  totalVotes: number
  isActive: boolean
  completedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface IUserVoteLog extends Document {
  userId: Schema.Types.ObjectId
  tradeVoteId: Schema.Types.ObjectId
  votedOption: 'A' | 'B'
  createdAt: Date
  updatedAt: Date
}
