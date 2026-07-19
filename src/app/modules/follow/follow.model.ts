import { Schema, model } from 'mongoose'
import { IFollow } from './follow.interface'

const FollowSchema = new Schema<IFollow>(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Ensure a user can only follow another user once
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true })
FollowSchema.index({ followingId: 1 })
FollowSchema.index({ followerId: 1 })

export const Follow = model<IFollow>('Follow', FollowSchema)
