import { z } from 'zod'
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from './notification.interface'

export const NotificationValidations = {
  create: z.object({
    body: z.object({
      userId: z.string().optional(),
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
      content: z.string().min(1, 'Content is required'),
      type: z.nativeEnum(NotificationType),
      channel: z
        .nativeEnum(NotificationChannel)
        .default(NotificationChannel.IN_APP),
      priority: z
        .nativeEnum(NotificationPriority)
        .default(NotificationPriority.MEDIUM),
      metadata: z.record(z.any()).optional(),
      scheduledAt: z.string().datetime().optional(),
      actionUrl: z.string().url().optional(),
      actionText: z.string().max(50).optional(),
    }),
  }),

  update: z.object({
    body: z.object({
      isRead: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      status: z.nativeEnum(NotificationStatus).optional(),
    }),
  }),

  bulkUpdate: z.object({
    body: z.object({
      notificationIds: z
        .array(z.string())
        .min(1, 'At least one notification ID is required'),
      isRead: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    }),
  }),

  sendEmail: z.object({
    body: z.object({
      to: z.union([z.string().email(), z.array(z.string().email())]),
      subject: z.string().min(1).optional(),
      template: z.string().min(1, 'Template name is required'),
      data: z.record(z.any()).optional(),
      attachments: z
        .array(
          z.object({
            filename: z.string(),
            path: z.string().optional(),
            content: z.string().optional(),
            contentType: z.string().optional(),
          }),
        )
        .optional(),
    }),
  }),

  filter: z.object({
    query: z.object({
      searchTerm: z.string().optional(),
      userId: z.string().optional(),
      type: z.nativeEnum(NotificationType).optional(),
      channel: z.nativeEnum(NotificationChannel).optional(),
      status: z.string().optional(),
      priority: z.nativeEnum(NotificationPriority).optional(),
      isRead: z.string().optional(),
      isArchived: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.string().optional(),
    }),
  }),
}
