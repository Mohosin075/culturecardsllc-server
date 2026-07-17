import { Model, Types } from 'mongoose'
import { IUser } from '../user/user.interface'

export type IReview = {
  _id?: Types.ObjectId
  // One of orderId or tradeOfferId is required (platform has no booking concept)
  orderId?: Types.ObjectId
  tradeOfferId?: Types.ObjectId
  reviewer: Types.ObjectId | IUser
  reviewee?: Types.ObjectId | IUser
  rating: number
  review: string
  createdAt: Date
  updatedAt: Date
}

export type ReviewModel = Model<IReview>
