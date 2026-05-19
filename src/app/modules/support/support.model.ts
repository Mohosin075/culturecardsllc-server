import { Schema, model } from 'mongoose'
import { ISupport, SupportModel } from './support.interface'
import { SUPPORT_STATUS } from '../../../enum/support'

const supportSchema = new Schema<ISupport, SupportModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' }, // Reporter
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User' },
    contentId: { type: Schema.Types.ObjectId },
    contentType: {
      type: String,
      enum: ['comment', 'review', 'user'],
    },
    reason: {
      type: String,
      enum: ['harassment', 'spam', 'fraud', 'other'],
      default: 'other',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    subject: { type: String },
    message: { type: String },
    status: {
      type: String,
      enum: Object.values(SUPPORT_STATUS),
      default: SUPPORT_STATUS.PENDING,
    },
    attachments: { type: [String] },
    moderationLog: [
      {
        action: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        details: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
)

export const Support = model<ISupport, SupportModel>('Support', supportSchema)
