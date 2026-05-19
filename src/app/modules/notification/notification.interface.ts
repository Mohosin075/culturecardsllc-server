import { Model, Types } from 'mongoose'

export type INotification = {
  _id: Types.ObjectId
  userId: Types.ObjectId
  title: string
  content: string
  type: NotificationType
  channel: NotificationChannel
  status: NotificationStatus
  priority: NotificationPriority
  metadata?: Record<string, any>
  scheduledAt?: Date
  sentAt?: Date
  readAt?: Date
  actionUrl?: string
  actionText?: string
  actionClickedAt?: Date
  isRead: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export enum NotificationType {
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  PROMOTIONAL = 'PROMOTIONAL',
  WELCOME = 'WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_VERIFICATION = 'ACCOUNT_VERIFICATION',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  BOTH = 'BOTH',
  ALL = 'ALL',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export type INotificationFilterables = {
  searchTerm?: string
  userId?: string
  type?: NotificationType
  channel?: NotificationChannel
  status?: NotificationStatus
  priority?: NotificationPriority
  isRead?: boolean
  isArchived?: boolean
  startDate?: string
  endDate?: string
}

export type EmailNotificationData = {
  to: string | string[]
  subject: string
  template: string
  data: Record<string, any>
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    contentType?: string
  }>
}

export type CreateNotificationDto = {
  userId: string | Types.ObjectId
  title: string
  content: string
  type: NotificationType
  channel?: NotificationChannel
  priority?: NotificationPriority
  metadata?: Record<string, any>
  scheduledAt?: Date
  actionUrl?: string
  actionText?: string
}

export type NotificationModel = Model<INotification, {}, {}>

export type INotificationStats = {
  total: number
  unread: number
  byType: Record<string, number>
  byChannel: Record<string, number>
  byStatus: Record<string, number>
}

export type INotificationAnalytics = {
  openRate: number // Percentage of notifications that were opened/read
  engagement: number // Percentage of notifications that had user interaction (clicked action URL)
}

export type INotificationWithAnalytics = {
  analytics?: INotificationAnalytics
} & INotification
