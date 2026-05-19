import { Model, Types } from 'mongoose'

export enum FavouriteType {
  SERVICE = 'service',
  PROVIDER = ' ',
}

export type IFavourite = {
  _id: Types.ObjectId
  user: Types.ObjectId
  favouriteType: FavouriteType
  service?: Types.ObjectId
  provider?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export type FavouriteModel = Model<IFavourite, Record<string, never>>
