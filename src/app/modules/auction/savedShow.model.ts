import { Schema, model } from 'mongoose'
import { ISavedShow } from './auction.interface'

const SavedShowSchema = new Schema<ISavedShow>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    streamId: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Ensure a user can bookmark a specific stream only once
SavedShowSchema.index({ userId: 1, streamId: 1 }, { unique: true })

export const SavedShow = model<ISavedShow>('SavedShow', SavedShowSchema)
