import { Schema, model } from 'mongoose'
import { ITradeVote, IUserVoteLog } from './tradeVote.interface'

const TradeVoteItemSchema = new Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
    image: { type: String, required: true },
    traderId: { type: Schema.Types.ObjectId, ref: 'User' },
    traderName: { type: String, default: 'Trader' },
  },
  { _id: false },
)

const TradeVoteSchema = new Schema<ITradeVote>(
  {
    tradeId: {
      type: Schema.Types.ObjectId,
      ref: 'TradeOffer',
      required: true,
      index: true,
    },
    category: {
      type: String,
      default: 'Trading Cards',
      index: true,
    },
    itemA: {
      type: TradeVoteItemSchema,
      required: true,
    },
    itemB: {
      type: TradeVoteItemSchema,
      required: true,
    },
    votesA: {
      type: Number,
      default: 0,
    },
    votesB: {
      type: Number,
      default: 0,
    },
    totalVotes: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

const UserVoteLogSchema = new Schema<IUserVoteLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tradeVoteId: {
      type: Schema.Types.ObjectId,
      ref: 'TradeVote',
      required: true,
      index: true,
    },
    votedOption: {
      type: String,
      enum: ['A', 'B'],
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Prevent duplicate votes per user per trade vote
UserVoteLogSchema.index({ userId: 1, tradeVoteId: 1 }, { unique: true })

export const TradeVote = model<ITradeVote>('TradeVote', TradeVoteSchema)
export const UserVoteLog = model<IUserVoteLog>('UserVoteLog', UserVoteLogSchema)
