import { Model, Types } from 'mongoose'
import { SUPPORT_STATUS } from '../../../enum/support'

export type ISupportFilterables = {
  searchTerm?: string
  subject?: string
  message?: string
}

export type ISupport = {
  _id: Types.ObjectId
  contentType: 'comment' | 'review' | 'user'
  contentId?: Types.ObjectId
  reportedUser?: Types.ObjectId
  reason: 'harassment' | 'spam' | 'fraud' | 'other'
  userId: Types.ObjectId // Reporter
  subject?: string
  message: string
  status: SUPPORT_STATUS
  priority: 'low' | 'medium' | 'high'
  attachments?: string[]
  moderationLog?: Array<{
    action: string
    by: Types.ObjectId
    details: string
    timestamp: Date
  }>
}

export type SupportModel = Model<ISupport, {}, {}>
