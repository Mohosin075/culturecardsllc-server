import { Types } from 'mongoose'

export interface IFollow {
  followerId: Types.ObjectId
  followingId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
