import { USER_ROLES } from '../../../enum/user'
import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import {
  INotification,
  INotificationFilterables,
  CreateNotificationDto,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  INotificationStats,
  INotificationAnalytics,
} from './notification.interface'
import { Notification } from './notification.model'
import { JwtPayload } from 'jsonwebtoken'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
import { notificationSearchableFields } from './notification.constant'
import { Types } from 'mongoose'
import { emailProvider } from './notification.providers'
import { User } from '../user/user.model'
import { Payment } from '../payment/payment.model'

import config from '../../../config'
import { io } from '../../../server'
import { sendPushNotification } from '../../../helpers/pushnotificationHelper'

const createNotification = async (
  payload: CreateNotificationDto,
  sendEmail: boolean = false,
  sendPush: boolean = true,
): Promise<INotification> => {
  try {
    const notificationData: any = {
      userId: payload.userId,
      title: payload.title,
      content: payload.content,
      type: payload.type,
      channel: payload.channel || NotificationChannel.IN_APP,
      priority: payload.priority,
      metadata: payload.metadata || {},
      actionUrl: payload.actionUrl,
      actionText: payload.actionText,
    }

    if (payload.scheduledAt) {
      notificationData.scheduledAt = payload.scheduledAt
      notificationData.status = NotificationStatus.PENDING
    }

    const notification = await Notification.create(notificationData)

    // Send real-time notification via socket
    if (notification.channel !== NotificationChannel.EMAIL) {
      if (io) {
        io.to(notification.userId.toString()).emit('notification', {
          type: 'NEW_NOTIFICATION',
          data: notification,
        })
      }
    }

    // Send email if requested
    if (
      (sendEmail && notification.channel !== NotificationChannel.IN_APP) ||
      notification.channel === NotificationChannel.ALL
    ) {
      await sendNotificationEmail(notification)
    }

    // Send push notification if requested
    // if (
    //   (sendPush &&
    //     (notification.channel === NotificationChannel.PUSH ||
    //       notification.channel === NotificationChannel.ALL))
    // ) {
    await sendNotificationPush(notification)
    // }

    return notification
  } catch (error: any) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to create notification: ${error.message}`,
    )
  }
}

const sendNotificationPush = async (
  notification: INotification,
): Promise<void> => {
  try {
    const user = await User.findById(notification.userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Skip if user has no device token
    if (!user.deviceToken) {
      return
    }

    // Skip if user has disabled push notifications but check if it's an urgent notification
    if (
      user.settings?.pushNotification === false &&
      notification.priority !== NotificationPriority.URGENT
    ) {
      return
    }

    const pushPayload: any = {
      notificationId: notification._id.toString(),
      type: notification.type,
    }

    if (notification.actionUrl) {
      pushPayload.actionUrl = notification.actionUrl
    }

    if (notification.metadata) {
      Object.keys(notification.metadata).forEach(key => {
        pushPayload[key] = String(notification.metadata![key])
      })
    }

    await sendPushNotification(
      user.deviceToken,
      notification.title,
      notification.content,
      pushPayload,
    )
  } catch (error: any) {
    console.error('Failed to send push notification:', error)

    // Update notification metadata with push error
    await Notification.findByIdAndUpdate(notification._id, {
      $set: {
        'metadata.pushError': error.message,
      },
    })
  }
}

const sendNotificationEmail = async (
  notification: INotification,
): Promise<void> => {
  try {
    const user = await User.findById(notification.userId)
    if (!user || !user.email) {
      throw new Error('User not found or no email available')
    }

    let template: string = 'system-alert'
    let templateData: Record<string, any> = {
      userName: user.name,
      notificationTitle: notification.title,
      notificationContent: notification.content,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
    }

    // Map notification type to template and add specific data
    switch (notification.type) {
      case NotificationType.PAYMENT_SUCCESS:
        template = 'payment-success'
        if (notification.metadata?.paymentId) {
          const payment = await Payment.findById(
            notification.metadata.paymentId,
          )
          if (payment) {
            templateData = {
              ...templateData,
              eventTitle: 'Service',
              transactionId: payment._id,
              amount: payment.amount,
              currency: payment.currency,
              paymentMethod: payment.paymentMethod,
              paymentDate: payment.createdAt.toLocaleDateString(),
            }
          }
        }
        break

      case NotificationType.WELCOME:
        template = 'welcome'
        break

      case NotificationType.PASSWORD_RESET:
        template = 'password-reset'
        if (notification.metadata?.resetCode) {
          templateData.resetCode = notification.metadata.resetCode
          templateData.expiryMinutes = 30
        }
        break

      case NotificationType.ACCOUNT_VERIFICATION:
        template = 'account-verification'
        if (notification.metadata?.verificationToken) {
          templateData.verificationUrl = `${config.clientUrl}/verify-email?token=${notification.metadata.verificationToken}`
        }
        break

      default:
        template = 'system-alert'
    }

    await emailProvider.sendTemplateEmail(
      user.email,
      template,
      templateData,
      notification.title,
    )

    // Update notification status
    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    })
  } catch (error: any) {
    console.error('Failed to send notification email:', error)

    // Update notification status to failed
    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.FAILED,
      metadata: {
        ...notification.metadata,
        emailError: error.message,
      },
    })

    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to send email notification: ${error.message}`,
    )
  }
}

const sendScheduledNotifications = async (): Promise<void> => {
  try {
    const pendingNotifications = await Notification.find({
      status: NotificationStatus.PENDING,
      scheduledAt: { $lte: new Date() },
    }).limit(50)

    console.log(
      `📧 Processing ${pendingNotifications.length} scheduled notifications...`,
    )

    for (const notification of pendingNotifications) {
      try {
        await sendNotificationEmail(notification)
      } catch (error: any) {
        console.error(
          `Failed to process notification ${notification._id}:`,
          error,
        )
      }
    }
  } catch (error) {
    console.error('Error processing scheduled notifications:', error)
  }
}

const getAllNotifications = async (
  user: JwtPayload,
  filterables: INotificationFilterables,
  pagination: IPaginationOptions,
) => {
  const { searchTerm, ...filterData } = filterables
  const { page, skip, limit, sortBy, sortOrder } =
    paginationHelper.calculatePagination(pagination)

  const andConditions: Record<string, any>[] = []

  // Search term
  if (searchTerm) {
    andConditions.push({
      $or: notificationSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    })
  }

  // Filter by other fields
  if (Object.keys(filterData).length) {
    const filterEntries = Object.entries(filterData)
    filterEntries.forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'startDate' || key === 'endDate') {
          // Date filtering - ensure value is string
          const dateCondition: any = {}
          if (key === 'startDate' && typeof value === 'string') {
            dateCondition.$gte = new Date(value)
          }
          if (key === 'endDate' && typeof value === 'string') {
            dateCondition.$lte = new Date(value)
          }
          if (Object.keys(dateCondition).length > 0) {
            andConditions.push({ createdAt: dateCondition })
          }
        } else if (key === 'isRead' || key === 'isArchived') {
          // Boolean filtering - convert string to boolean
          andConditions.push({ [key]: value === 'true' })
        } else {
          // Regular field filtering
          andConditions.push({ [key]: value })
        }
      }
    })
  }

  // User-specific filtering (unless admin)
  if (
    (user as any).activeRole === USER_ROLES.BUYER ||
    (user as any).activeRole === USER_ROLES.SELLER
  ) {
    andConditions.push({
      userId: new Types.ObjectId((user as any).userId as string),
    })
  }

  const whereConditions = andConditions.length ? { $and: andConditions } : {}

  const [result, total, analyticsData] = await Promise.all([
    Notification.find(whereConditions)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .populate('userId', 'name email')
      .lean(),
    Notification.countDocuments(whereConditions),
    // Get overall analytics for the filtered notifications
    Notification.aggregate([
      { $match: whereConditions },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          readNotifications: {
            $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] },
          },
          clickedNotifications: {
            $sum: { $cond: [{ $ne: ['$actionClickedAt', null] }, 1, 0] },
          },
        },
      },
    ]),
  ])

  // Calculate overall analytics
  const stats = analyticsData[0] || {
    totalNotifications: 0,
    readNotifications: 0,
    clickedNotifications: 0,
  }

  const overallAnalytics: INotificationAnalytics = {
    openRate:
      stats.totalNotifications > 0
        ? Math.round((stats.readNotifications / stats.totalNotifications) * 100)
        : 0,
    engagement:
      stats.totalNotifications > 0
        ? Math.round(
            (stats.clickedNotifications / stats.totalNotifications) * 100,
          )
        : 0,
  }

  // Add individual analytics to each notification
  const notificationsWithAnalytics = result.map(notification => ({
    ...notification,
    analytics: {
      openRate: notification.isRead ? 100 : 0, // Individual notification is either open (100%) or not (0%)
      engagement: notification.actionClickedAt ? 100 : 0, // Individual notification action is either clicked (100%) or not (0%)
    } as INotificationAnalytics,
  }))

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    analytics: overallAnalytics, // Overall analytics for all notifications matching the query
    data: notificationsWithAnalytics,
  }
}

const getNotificationById = async (id: string): Promise<INotification> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid notification ID')
  }

  const result = await Notification.findById(id)
    .populate('userId', 'name email')
    .lean()

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found')
  }

  return result
}

const updateNotification = async (
  id: string,
  payload: Partial<INotification>,
  userId?: string,
): Promise<INotification> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid notification ID')
  }

  const query: any = { _id: id }
  if (userId) {
    query.userId = userId
  }

  const result = await Notification.findOneAndUpdate(
    query,
    { $set: payload },
    { new: true, runValidators: true },
  )
    .populate('userId', 'name email')
    .lean()

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found')
  }

  return result
}

const markAsRead = async (
  id: string,
  userId: string,
): Promise<INotification> => {
  const result = await Notification.findOneAndUpdate(
    { _id: id, userId },
    {
      isRead: true,
      readAt: new Date(),
      status: NotificationStatus.READ,
    },
    { new: true },
  )
    .populate('userId', 'name email')
    .lean()

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found')
  }

  return result
}

const markAllAsRead = async (
  userId: string,
): Promise<{ modifiedCount: number }> => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    {
      isRead: true,
      readAt: new Date(),
      status: NotificationStatus.READ,
    },
  )

  return { modifiedCount: result.modifiedCount }
}

const archiveNotification = async (
  id: string,
  userId: string,
): Promise<INotification> => {
  const result = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { isArchived: true },
    { new: true },
  )
    .populate('userId', 'name email')
    .lean()

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found')
  }

  return result
}

const deleteNotification = async (id: string): Promise<INotification> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid notification ID')
  }

  const result = await Notification.findByIdAndDelete(id).lean()

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found')
  }

  return result
}

const getNotificationStats = async (
  user: JwtPayload & { userId?: string; role?: string },
): Promise<INotificationStats> => {
  const query: any = {}

  if (
    user.activeRole === USER_ROLES.BUYER ||
    user.activeRole === USER_ROLES.SELLER
  ) {
    query.userId = user.userId
  }

  const [total, unread, byType, byChannel, byStatus] = await Promise.all([
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, isRead: false }),
    Notification.aggregate([
      { $match: query },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Notification.aggregate([
      { $match: query },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]),
    Notification.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ])

  const stats: INotificationStats = {
    total,
    unread,
    byType: {},
    byChannel: {},
    byStatus: {},
  }

  byType.forEach(item => {
    stats.byType[item._id] = item.count
  })

  byChannel.forEach(item => {
    stats.byChannel[item._id] = item.count
  })

  byStatus.forEach(item => {
    stats.byStatus[item._id] = item.count
  })

  return stats
}

const getMyNotifications = async (
  user: JwtPayload & { userId: string },
  pagination: IPaginationOptions,
) => {
  const { page, skip, limit, sortBy, sortOrder } =
    paginationHelper.calculatePagination(pagination)

  const query = { userId: user.userId, isArchived: false }

  const [result, total] = await Promise.all([
    Notification.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .lean(),
    Notification.countDocuments(query),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  }
}

const sendTestEmail = async (
  to: string,
  template: string,
): Promise<boolean> => {
  try {
    const user = await User.findOne({ email: to })
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }

    const testData = {
      userName: user.name,
      actionUrl: `${config.clientUrl}/dashboard`,
      actionText: 'Go to Dashboard',
    }

    await emailProvider.sendTemplateEmail(to, template, testData)
    return true
  } catch (error: any) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to send test email: ${error.message}`,
    )
  }
}

export const NotificationServices = {
  createNotification,
  sendNotificationEmail,

  getAllNotifications,
  getNotificationById,
  updateNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  getNotificationStats,
  getMyNotifications,
  sendTestEmail,
  sendScheduledNotifications,
}
