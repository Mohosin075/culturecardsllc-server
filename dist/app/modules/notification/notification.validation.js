"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationValidations = void 0;
const zod_1 = require("zod");
const notification_interface_1 = require("./notification.interface");
exports.NotificationValidations = {
    create: zod_1.z.object({
        body: zod_1.z.object({
            userId: zod_1.z.string().optional(),
            title: zod_1.z.string().min(1, 'Title is required').max(200, 'Title too long'),
            content: zod_1.z.string().min(1, 'Content is required'),
            type: zod_1.z.nativeEnum(notification_interface_1.NotificationType),
            channel: zod_1.z
                .nativeEnum(notification_interface_1.NotificationChannel)
                .default(notification_interface_1.NotificationChannel.IN_APP),
            priority: zod_1.z
                .nativeEnum(notification_interface_1.NotificationPriority)
                .default(notification_interface_1.NotificationPriority.MEDIUM),
            metadata: zod_1.z.record(zod_1.z.any()).optional(),
            scheduledAt: zod_1.z.string().datetime().optional(),
            actionUrl: zod_1.z.string().url().optional(),
            actionText: zod_1.z.string().max(50).optional(),
        }),
    }),
    update: zod_1.z.object({
        body: zod_1.z.object({
            isRead: zod_1.z.boolean().optional(),
            isArchived: zod_1.z.boolean().optional(),
            status: zod_1.z.nativeEnum(notification_interface_1.NotificationStatus).optional(),
        }),
    }),
    bulkUpdate: zod_1.z.object({
        body: zod_1.z.object({
            notificationIds: zod_1.z
                .array(zod_1.z.string())
                .min(1, 'At least one notification ID is required'),
            isRead: zod_1.z.boolean().optional(),
            isArchived: zod_1.z.boolean().optional(),
        }),
    }),
    sendEmail: zod_1.z.object({
        body: zod_1.z.object({
            to: zod_1.z.union([zod_1.z.string().email(), zod_1.z.array(zod_1.z.string().email())]),
            subject: zod_1.z.string().min(1).optional(),
            template: zod_1.z.string().min(1, 'Template name is required'),
            data: zod_1.z.record(zod_1.z.any()).optional(),
            attachments: zod_1.z
                .array(zod_1.z.object({
                filename: zod_1.z.string(),
                path: zod_1.z.string().optional(),
                content: zod_1.z.string().optional(),
                contentType: zod_1.z.string().optional(),
            }))
                .optional(),
        }),
    }),
    filter: zod_1.z.object({
        query: zod_1.z.object({
            searchTerm: zod_1.z.string().optional(),
            userId: zod_1.z.string().optional(),
            type: zod_1.z.nativeEnum(notification_interface_1.NotificationType).optional(),
            channel: zod_1.z.nativeEnum(notification_interface_1.NotificationChannel).optional(),
            status: zod_1.z.string().optional(),
            priority: zod_1.z.nativeEnum(notification_interface_1.NotificationPriority).optional(),
            isRead: zod_1.z.string().optional(),
            isArchived: zod_1.z.string().optional(),
            startDate: zod_1.z.string().optional(),
            endDate: zod_1.z.string().optional(),
            page: zod_1.z.string().optional(),
            limit: zod_1.z.string().optional(),
            sortBy: zod_1.z.string().optional(),
            sortOrder: zod_1.z.string().optional(),
        }),
    }),
};
