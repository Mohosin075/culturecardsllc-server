import { Types } from 'mongoose'
import { NotificationServices } from './notification.service'
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './notification.interface'
import { Payment } from '../payment/payment.model'
import { User } from '../user/user.model'

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
}

export default NotificationIntegration
