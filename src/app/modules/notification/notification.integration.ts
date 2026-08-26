import { Types } from 'mongoose'
import { NotificationServices } from './notification.service'
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './notification.interface'
import { Payment } from '../payment/payment.model'
import { User } from '../user/user.model'
import { Follow } from '../follow/follow.model'

export class NotificationIntegration {
  static async onPaymentSuccess(
    paymentId: Types.ObjectId | string,
  ): Promise<void> {
    try {
      const payment = await Payment.findById(paymentId).populate(
        'userId',
        'email name',
      )

      if (!payment) return

      await NotificationServices.createNotification(
        {
          userId: payment.userId._id,
          title: 'Payment Successful',
          content: `Your payment of ${payment.amount} ${payment.currency} was successful.`,
          type: NotificationType.PAYMENT_SUCCESS,
          channel: NotificationChannel.ALL,
          priority: NotificationPriority.HIGH,
          metadata: {
            paymentId: payment._id,
          },
          actionUrl: `${process.env.CLIENT_URL}/payments/${payment._id}`,
          actionText: 'View Receipt',
        },
        true,
      )
    } catch (error) {
      console.error('Error creating payment success notification:', error)
    }
  }

  static async onPaymentFailed(
    paymentId: Types.ObjectId | string,
  ): Promise<void> {
    try {
      const payment = await Payment.findById(paymentId).populate(
        'userId',
        'email name',
      )

      if (!payment) return

      await NotificationServices.createNotification(
        {
          userId: payment.userId._id,
          title: 'Payment Failed',
          content: `Your payment failed. Please try again.`,
          type: NotificationType.PAYMENT_FAILED,
          channel: NotificationChannel.ALL,
          priority: NotificationPriority.URGENT,
          metadata: {
            paymentId: payment._id,
          },
          actionUrl: `${process.env.CLIENT_URL}/payments/${payment._id}/retry`,
          actionText: 'Retry Payment',
        },
        true,
      )
    } catch (error) {
      console.error('Error creating payment failed notification:', error)
    }
  }

  static async onNewMessage(
    senderId: Types.ObjectId,
    receiverId: Types.ObjectId,
    message: string,
  ): Promise<void> {
    try {
      await NotificationServices.createNotification({
        userId: receiverId,
        title: 'New Message',
        content: `You have a new message: "${message.substring(0, 100)}..."`,
        type: NotificationType.NEW_MESSAGE,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        metadata: {
          senderId,
          messagePreview: message.substring(0, 100),
        },
        actionUrl: `${process.env.CLIENT_URL}/messages/${senderId}`,
        actionText: 'View Message',
      })
    } catch (error) {
      console.error('Error creating message notification:', error)
    }
  }

  static async sendPasswordReset(
    userId: Types.ObjectId,
    resetCode: string,
  ): Promise<void> {
    try {
      const user = await User.findById(userId)
      if (!user) return

      await NotificationServices.createNotification(
        {
          userId: user._id,
          title: 'Password Reset Request',
          content: `Use this code to reset your password: ${resetCode}`,
          type: NotificationType.PASSWORD_RESET,
          channel: NotificationChannel.EMAIL,
          priority: NotificationPriority.URGENT,
          metadata: {
            resetCode,
          },
        },
        true,
      )
    } catch (error) {
      console.error('Error creating password reset notification:', error)
    }
  }

  static async sendAccountVerification(
    userId: Types.ObjectId,
    verificationToken: string,
  ): Promise<void> {
    try {
      const user = await User.findById(userId)
      if (!user) return

      await NotificationServices.createNotification(
        {
          userId: user._id,
          title: 'Verify Your Account',
          content:
            'Please verify your email address to complete your registration.',
          type: NotificationType.ACCOUNT_VERIFICATION,
          channel: NotificationChannel.EMAIL,
          priority: NotificationPriority.HIGH,
          metadata: {
            verificationToken,
          },
        },
        true,
      )
    } catch (error) {
      console.error('Error creating account verification notification:', error)
    }
  }

  static async onAuctionWon(
    winnerId: Types.ObjectId | string,
    sellerId: Types.ObjectId | string,
    productName: string,
    bidAmount: number,
    auctionItemId: string,
  ): Promise<void> {
    try {
      await NotificationServices.createNotification({
        userId: winnerId,
        title: 'Auction Won! 🏆',
        content: `Congratulations! You won the auction for "${productName}" with a bid of $${bidAmount}.`,
        type: NotificationType.AUCTION_WON,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.HIGH,
        metadata: {
          sellerId: sellerId.toString(),
          auctionItemId: auctionItemId.toString(),
          bidAmount: bidAmount.toString(),
        },
      })
    } catch (error) {
      console.error('Error creating auction won notification:', error)
    }
  }

  static async onNewFollow(
    followerId: Types.ObjectId | string,
    followingId: Types.ObjectId | string,
  ): Promise<void> {
    try {
      const follower = await User.findById(followerId)
      if (!follower) return

      const followerName = follower.fullName || follower.name || 'Someone'

      await NotificationServices.createNotification({
        userId: followingId,
        title: 'New Follower! 👤',
        content: `${followerName} started following you.`,
        type: NotificationType.NEW_FOLLOW,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        metadata: {
          followerId: followerId.toString(),
        },
      })
    } catch (error) {
      console.error('Error creating new follower notification:', error)
    }
  }

  static async onLiveStreamGoLive(
    sellerId: Types.ObjectId | string,
    streamId: Types.ObjectId | string,
    streamTitle: string,
  ): Promise<void> {
    try {
      const seller = await User.findById(sellerId)
      if (!seller) return

      const sellerName = seller.fullName || seller.name || 'Host'

      // Find all followers
      const followers = await Follow.find({ followingId: sellerId }).select('followerId')
      if (followers.length === 0) return

      // Create notifications for all followers
      const promises = followers.map(async f => {
        try {
          await NotificationServices.createNotification({
            userId: f.followerId,
            title: 'Live Now! 🎥',
            content: `${sellerName} is live now: "${streamTitle}". Tap to join!`,
            type: NotificationType.STREAM_LIVE,
            channel: NotificationChannel.PUSH,
            priority: NotificationPriority.HIGH,
            metadata: {
              streamId: streamId.toString(),
              sellerId: sellerId.toString(),
            },
            actionUrl: `/streams/${streamId}`,
          })
        } catch (err) {
          console.error(`Failed to send stream live notification to follower ${f.followerId}:`, err)
        }
      })

      await Promise.allSettled(promises)
    } catch (error) {
      console.error('Error creating live stream notifications:', error)
    }
  }

  static async onNewReview(
    reviewerId: Types.ObjectId | string,
    revieweeId: Types.ObjectId | string,
    rating: number,
    reviewId: string,
  ): Promise<void> {
    try {
      const reviewer = await User.findById(reviewerId)
      if (!reviewer) return

      const reviewerName = reviewer.fullName || reviewer.name || 'Someone'

      await NotificationServices.createNotification({
        userId: revieweeId,
        title: 'New Review Received ⭐️',
        content: `${reviewerName} left you a ${rating}-star review.`,
        type: NotificationType.NEW_REVIEW,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        metadata: {
          reviewerId: reviewerId.toString(),
          rating: rating.toString(),
          reviewId: reviewId.toString(),
        },
      })
    } catch (error) {
      console.error('Error creating review notification:', error)
    }
  }
}

export default NotificationIntegration
