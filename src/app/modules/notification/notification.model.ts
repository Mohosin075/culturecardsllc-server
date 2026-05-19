import { Schema, model } from 'mongoose'
import {
  INotification,
  NotificationModel,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
} from './notification.interface'

const notificationSchema = new Schema<INotification, NotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      default: NotificationChannel.IN_APP,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    sentAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    actionUrl: {
      type: String,
    },
    actionText: {
      type: String,
    },
    actionClickedAt: {
      type: Date,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v
        return ret
      },
    },
    toObject: {
      virtuals: true,
    },
  },
)

// Indexes for efficient querying
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 })
notificationSchema.index({ status: 1, scheduledAt: 1 })
notificationSchema.index({ createdAt: -1 })

// Virtual populate for user details
notificationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
})

// Pre-save middleware to update timestamps
notificationSchema.pre('save', function (next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date()
  }
  if (
    this.isModified('status') &&
    this.status === NotificationStatus.SENT &&
    !this.sentAt
  ) {
    this.sentAt = new Date()
  }
  next()
})

// Static method to mark as read
notificationSchema.statics.markAsRead = async function (
  notificationId: string,
  userId: string,
) {
  return this.findOneAndUpdate(
    { _id: notificationId, userId },
    {
      isRead: true,
      readAt: new Date(),
      status: NotificationStatus.READ,
    },
    { new: true },
  )
}

// Static method to archive
notificationSchema.statics.archive = async function (
  notificationId: string,
  userId: string,
) {
  return this.findOneAndUpdate(
    { _id: notificationId, userId },
    {
      isArchived: true,
    },
    { new: true },
  )
}

export const Notification = model<INotification, NotificationModel>(
  'Notification',
  notificationSchema,
)
