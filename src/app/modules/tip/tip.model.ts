import { Schema, model } from 'mongoose'
import { ITip, TipModel } from './tip.interface'

const tipSchema = new Schema<ITip, TipModel>(
  {
    streamId: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    processingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCharged: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellerNetAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    paymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      default: 'pending',
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderImage: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  },
)

tipSchema.index({ sellerId: 1, createdAt: -1 })
tipSchema.index({ streamId: 1, createdAt: -1 })

export const Tip = model<ITip, TipModel>('Tip', tipSchema)
