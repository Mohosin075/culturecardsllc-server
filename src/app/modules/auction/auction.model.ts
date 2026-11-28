import { Schema, model } from 'mongoose'
import { ILiveStream, IAuctionItem } from './auction.interface'

const LiveStreamSchema = new Schema<ILiveStream>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    coverImage: {
      type: String,
      default: '',
      trim: true,
    },
    promoVideo: {
      type: String,
      trim: true,
    },
    scheduledAt: {
      type: Date,
    },
    scheduledStartTime: {
      type: Date,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended'],
      default: 'scheduled',
      index: true,
    },
    isCelebrity: {
      type: Boolean,
      default: false,
      index: true,
    },
    agoraChannelName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pinnedProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    inventoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    reminderSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    viewersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Who has liked this show: one like per signed-in user. Not selected by
    // default so stream lists stay small.
    likedBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      select: false,
    },
    // Everyone who has joined this show at least once (signed-in users), so
    // the host can say "N people have joined us". Not selected by default.
    joinedUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      select: false,
    },
    totalJoined: {
      type: Number,
      default: 0,
    },
    tipsTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    tipsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    chatMessages: [
      {
        user: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      }
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

LiveStreamSchema.index({ status: 1, createdAt: -1 })
LiveStreamSchema.index({ sellerId: 1, status: 1 })
LiveStreamSchema.index({ status: 1, scheduledStartTime: 1, reminderSent: 1 })

const AuctionItemSchema = new Schema<IAuctionItem>(
  {
    streamId: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    currentBid: {
      type: Number,
      default: 0,
      min: 0,
    },
    highestBidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    bidIncrement: {
      type: Number,
      default: 1,
      min: 0.01,
    },
    timerDuration: {
      type: Number,
      default: 60,
      min: 5,
    },
    endsAt: {
      type: Date,
      index: true,
    },
    spinWheelPrize: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// ── Tell every connected app when a show starts or ends ──────────────────────
// Shows change status from many places (the host, an admin, a seller being
// removed, the host-disconnect grace timer). Hooking the model catches all of
// them, so home screens can refresh their "Live now" list straight away.
const announceLiveListChanged = (streamId?: unknown, status?: unknown) => {
  const io = (global as any).io
  if (!io) return
  io.emit('live-streams-changed', {
    streamId: streamId ? String(streamId) : undefined,
    status: status ? String(status) : undefined,
  })
}

LiveStreamSchema.pre('save', function (next) {
  ;(this as any).$locals.statusChanged = this.isNew || this.isModified('status')
  next()
})

LiveStreamSchema.post('save', function (doc) {
  if ((doc as any).$locals?.statusChanged) announceLiveListChanged(doc._id, doc.status)
})

LiveStreamSchema.post(['updateOne', 'updateMany', 'findOneAndUpdate'], function (this: any) {
  const update = this.getUpdate?.() || {}
  const status = update.status ?? update.$set?.status
  if (status !== undefined) announceLiveListChanged(this.getQuery?.()?._id, status)
})

export const LiveStream = model<ILiveStream>('LiveStream', LiveStreamSchema)
export const AuctionItem = model<IAuctionItem>('AuctionItem', AuctionItemSchema)
