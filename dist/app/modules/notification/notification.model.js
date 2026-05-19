"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const notification_interface_1 = require("./notification.interface");
const notificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        enum: Object.values(notification_interface_1.NotificationType),
        required: true,
        index: true,
    },
    channel: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationChannel),
        default: notification_interface_1.NotificationChannel.IN_APP,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationStatus),
        default: notification_interface_1.NotificationStatus.PENDING,
        index: true,
    },
    priority: {
        type: String,
        enum: Object.values(notification_interface_1.NotificationPriority),
        default: notification_interface_1.NotificationPriority.MEDIUM,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
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
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        },
    },
    toObject: {
        virtuals: true,
    },
});
// Indexes for efficient querying
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ createdAt: -1 });
// Virtual populate for user details
notificationSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true,
});
// Pre-save middleware to update timestamps
notificationSchema.pre('save', function (next) {
    if (this.isModified('isRead') && this.isRead && !this.readAt) {
        this.readAt = new Date();
    }
    if (this.isModified('status') &&
        this.status === notification_interface_1.NotificationStatus.SENT &&
        !this.sentAt) {
        this.sentAt = new Date();
    }
    next();
});
// Static method to mark as read
notificationSchema.statics.markAsRead = async function (notificationId, userId) {
    return this.findOneAndUpdate({ _id: notificationId, userId }, {
        isRead: true,
        readAt: new Date(),
        status: notification_interface_1.NotificationStatus.READ,
    }, { new: true });
};
// Static method to archive
notificationSchema.statics.archive = async function (notificationId, userId) {
    return this.findOneAndUpdate({ _id: notificationId, userId }, {
        isArchived: true,
    }, { new: true });
};
exports.Notification = (0, mongoose_1.model)('Notification', notificationSchema);
