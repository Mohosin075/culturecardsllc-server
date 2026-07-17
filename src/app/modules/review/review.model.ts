import { Schema, model } from 'mongoose'
import { IReview, ReviewModel } from './review.interface'

const reviewSchema = new Schema<IReview, ReviewModel>(
  {
    // One of orderId or tradeOfferId is required at the service/validation layer
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    tradeOfferId: { type: Schema.Types.ObjectId, ref: 'TradeOffer' },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      populate: { path: 'reviewer', select: 'name lastName fullName profile' },
    },
    reviewee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      populate: { path: 'reviewee', select: 'name lastName fullName profile' },
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  },
)

export const Review = model<IReview, ReviewModel>('Review', reviewSchema)
