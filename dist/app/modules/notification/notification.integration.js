"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationIntegration = void 0;
const notification_service_1 = require("./notification.service");
const notification_interface_1 = require("./notification.interface");
const payment_model_1 = require("../payment/payment.model");
const user_model_1 = require("../user/user.model");
const follow_model_1 = require("../follow/follow.model");
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
    static async onAuctionWon(winnerId, sellerId, productName, bidAmount, auctionItemId) {
        try {
            await notification_service_1.NotificationServices.createNotification({
                userId: winnerId,
                title: 'Auction Won! 🏆',
                content: `Congratulations! You won the auction for "${productName}" with a bid of $${bidAmount}.`,
                type: notification_interface_1.NotificationType.AUCTION_WON,
                channel: notification_interface_1.NotificationChannel.PUSH,
                priority: notification_interface_1.NotificationPriority.HIGH,
                metadata: {
                    sellerId: sellerId.toString(),
                    auctionItemId: auctionItemId.toString(),
                    bidAmount: bidAmount.toString(),
                },
            });
        }
        catch (error) {
            console.error('Error creating auction won notification:', error);
        }
    }
    static async onNewFollow(followerId, followingId) {
        try {
            const follower = await user_model_1.User.findById(followerId);
            if (!follower)
                return;
            const followerName = follower.fullName || follower.name || 'Someone';
            await notification_service_1.NotificationServices.createNotification({
                userId: followingId,
                title: 'New Follower! 👤',
                content: `${followerName} started following you.`,
                type: notification_interface_1.NotificationType.NEW_FOLLOW,
                channel: notification_interface_1.NotificationChannel.PUSH,
                priority: notification_interface_1.NotificationPriority.MEDIUM,
                metadata: {
                    followerId: followerId.toString(),
                },
            });
        }
        catch (error) {
            console.error('Error creating new follower notification:', error);
        }
    }
    static async onLiveStreamGoLive(sellerId, streamId, streamTitle) {
        try {
            const seller = await user_model_1.User.findById(sellerId);
            if (!seller)
                return;
            const sellerName = seller.fullName || seller.name || 'Host';
            // Find all followers
            const followers = await follow_model_1.Follow.find({ followingId: sellerId }).select('followerId');
            if (followers.length === 0)
                return;
            // Create notifications for all followers
            const promises = followers.map(async (f) => {
                try {
                    await notification_service_1.NotificationServices.createNotification({
                        userId: f.followerId,
                        title: 'Live Now! 🎥',
                        content: `${sellerName} is live now: "${streamTitle}". Tap to join!`,
                        type: notification_interface_1.NotificationType.STREAM_LIVE,
                        channel: notification_interface_1.NotificationChannel.PUSH,
                        priority: notification_interface_1.NotificationPriority.HIGH,
                        metadata: {
                            streamId: streamId.toString(),
                            sellerId: sellerId.toString(),
                        },
                        actionUrl: `/streams/${streamId}`,
                    });
                }
                catch (err) {
                    console.error(`Failed to send stream live notification to follower ${f.followerId}:`, err);
                }
            });
            await Promise.allSettled(promises);
        }
        catch (error) {
            console.error('Error creating live stream notifications:', error);
        }
    }
    static async onNewReview(reviewerId, revieweeId, rating, reviewId) {
        try {
            const reviewer = await user_model_1.User.findById(reviewerId);
            if (!reviewer)
                return;
            const reviewerName = reviewer.fullName || reviewer.name || 'Someone';
            await notification_service_1.NotificationServices.createNotification({
                userId: revieweeId,
                title: 'New Review Received ⭐️',
                content: `${reviewerName} left you a ${rating}-star review.`,
                type: notification_interface_1.NotificationType.NEW_REVIEW,
                channel: notification_interface_1.NotificationChannel.PUSH,
                priority: notification_interface_1.NotificationPriority.MEDIUM,
                metadata: {
                    reviewerId: reviewerId.toString(),
                    rating: rating.toString(),
                    reviewId: reviewId.toString(),
                },
            });
        }
        catch (error) {
            console.error('Error creating review notification:', error);
        }
    }
}
exports.NotificationIntegration = NotificationIntegration;
exports.default = NotificationIntegration;
