import { Schema, model } from 'mongoose'
import {
  FavouriteModel,
  FavouriteType,
  IFavourite,
} from './favourite.interface'

const favouriteSchema = new Schema<IFavourite, FavouriteModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    favouriteType: {
      type: String,
      enum: Object.values(FavouriteType),
      required: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Ensure unique favorite per user and target
favouriteSchema.index({ user: 1, service: 1 }, { unique: true, sparse: true })
favouriteSchema.index({ user: 1, provider: 1 }, { unique: true, sparse: true })

export const Favourite = model<IFavourite, FavouriteModel>(
  'Favourite',
  favouriteSchema,
)
