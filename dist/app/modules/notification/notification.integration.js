"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationIntegration = void 0;
const notification_service_1 = require("./notification.service");
const notification_interface_1 = require("./notification.interface");
const payment_model_1 = require("../payment/payment.model");
const user_model_1 = require("../user/user.model");
class NotificationIntegration {
    static async onPaymentSuccess(paymentId) {
        try {
            const payment = await payment_model_1.Payment.findById(paymentId).populate('userId', 'email name');
            if (!payment)
                return;
            await notification_service_1.NotificationServices.createNotification({
                userId: payment.userId._id,
                title: 'Payment Successful',
                content: `Your payment of ${payment.amount} ${payment.currency} was successful.`,
                type: notification_interface_1.NotificationType.PAYMENT_SUCCESS,
                channel: notification_interface_1.NotificationChannel.ALL,
                priority: notification_interface_1.NotificationPriority.HIGH,
                metadata: {
                    paymentId: payment._id,
                },
                actionUrl: `${process.env.CLIENT_URL}/payments/${payment._id}`,
                actionText: 'View Receipt',
            }, true);
        }
        catch (error) {
            console.error('Error creating payment success notification:', error);
        }
    }
    static async onPaymentFailed(paymentId) {
        try {
            const payment = await payment_model_1.Payment.findById(paymentId).populate('userId', 'email name');
            if (!payment)
                return;
            await notification_service_1.NotificationServices.createNotification({
                userId: payment.userId._id,
                title: 'Payment Failed',
                content: `Your payment failed. Please try again.`,
                type: notification_interface_1.NotificationType.PAYMENT_FAILED,
                channel: notification_interface_1.NotificationChannel.ALL,
                priority: notification_interface_1.NotificationPriority.URGENT,
                metadata: {
                    paymentId: payment._id,
                },
                actionUrl: `${process.env.CLIENT_URL}/payments/${payment._id}/retry`,
                actionText: 'Retry Payment',
            }, true);
        }
        catch (error) {
            console.error('Error creating payment failed notification:', error);
        }
    }
    static async onNewMessage(senderId, receiverId, message) {
        try {
            await notification_service_1.NotificationServices.createNotification({
                userId: receiverId,
                title: 'New Message',
                content: `You have a new message: "${message.substring(0, 100)}..."`,
                type: notification_interface_1.NotificationType.NEW_MESSAGE,
                channel: notification_interface_1.NotificationChannel.PUSH,
                priority: notification_interface_1.NotificationPriority.MEDIUM,
                metadata: {
                    senderId,
                    messagePreview: message.substring(0, 100),
                },
                actionUrl: `${process.env.CLIENT_URL}/messages/${senderId}`,
                actionText: 'View Message',
            });
        }
        catch (error) {
            console.error('Error creating message notification:', error);
        }
    }
    static async sendPasswordReset(userId, resetCode) {
        try {
            const user = await user_model_1.User.findById(userId);
            if (!user)
                return;
            await notification_service_1.NotificationServices.createNotification({
                userId: user._id,
                title: 'Password Reset Request',
                content: `Use this code to reset your password: ${resetCode}`,
                type: notification_interface_1.NotificationType.PASSWORD_RESET,
                channel: notification_interface_1.NotificationChannel.EMAIL,
                priority: notification_interface_1.NotificationPriority.URGENT,
                metadata: {
                    resetCode,
                },
            }, true);
        }
        catch (error) {
            console.error('Error creating password reset notification:', error);
        }
    }
    static async sendAccountVerification(userId, verificationToken) {
        try {
            const user = await user_model_1.User.findById(userId);
            if (!user)
                return;
            await notification_service_1.NotificationServices.createNotification({
                userId: user._id,
                title: 'Verify Your Account',
                content: 'Please verify your email address to complete your registration.',
                type: notification_interface_1.NotificationType.ACCOUNT_VERIFICATION,
                channel: notification_interface_1.NotificationChannel.EMAIL,
                priority: notification_interface_1.NotificationPriority.HIGH,
                metadata: {
                    verificationToken,
                },
            }, true);
        }
        catch (error) {
            console.error('Error creating account verification notification:', error);
        }
    }
}
exports.NotificationIntegration = NotificationIntegration;
exports.default = NotificationIntegration;
