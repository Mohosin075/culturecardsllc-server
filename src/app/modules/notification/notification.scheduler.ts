import cron from 'node-cron'
import { Notification } from './notification.model'
import { NotificationServices } from './notification.service'
import {
  NotificationStatus,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './notification.interface'

import { User } from '../user/user.model'

export class NotificationScheduler {
  private static instance: NotificationScheduler

  private constructor() {
    this.initializeSchedulers()
  }

  static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler()
    }
    return NotificationScheduler.instance
  }

  private initializeSchedulers(): void {
    console.log('🕒 Initializing notification schedulers...')

    // Schedule 1: Process pending notifications every minute
    cron.schedule('* * * * *', async () => {
      await this.processPendingNotifications()
    })

    // Schedule 3: Clean up old archived notifications daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupArchivedNotifications()
    })

    // Schedule 4: Send welcome emails to new users (within last hour)
    cron.schedule('*/15 * * * *', async () => {
      // Every 15 minutes
      await this.sendWelcomeEmails()
    })

    console.log('✅ Notification schedulers initialized')
  }

  private async processPendingNotifications(): Promise<void> {
    try {
      const pendingNotifications = await Notification.find({
        status: NotificationStatus.PENDING,
        scheduledAt: { $lte: new Date() },
        channel: { $ne: 'IN_APP' },
      }).limit(50)

      console.log(
        `📧 Processing ${pendingNotifications.length} pending notifications...`,
      )

      for (const notification of pendingNotifications) {
        try {
          await NotificationServices.sendNotificationEmail(notification)
        } catch (error: any) {
          console.error(
            `Failed to process notification ${notification._id}:`,
            error,
          )

          // Update status to failed after max retries
          const retryCount = (notification.metadata?.retryCount || 0) + 1
          if (retryCount >= 3) {
            await Notification.findByIdAndUpdate(notification._id, {
              status: NotificationStatus.FAILED,
              metadata: {
                ...notification.metadata,
                retryCount,
                lastError: error.message,
              },
            })
          } else {
            // Update retry count and reschedule for later
            await Notification.findByIdAndUpdate(notification._id, {
              scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes later
              metadata: {
                ...notification.metadata,
                retryCount,
              },
            })
          }
        }
      }
    } catch (error) {
      console.error('Error processing pending notifications:', error)
    }
  }

  private async sendWelcomeEmails(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

      // Find users created in the last hour who haven't received welcome email
      const newUsers = await User.find({
        createdAt: { $gte: oneHourAgo },
        'metadata.welcomeEmailSent': { $ne: true },
      })

      console.log(`👋 Found ${newUsers.length} new users to welcome`)

      for (const user of newUsers) {
        try {
          await NotificationServices.createNotification(
            {
              userId: user._id,
              title: 'Welcome to Aries!',
              content: `Welcome aboard, ${user.name}! We're excited to have you join our community.`,
              type: NotificationType.WELCOME,
              channel: NotificationChannel.BOTH,
              priority: NotificationPriority.MEDIUM,
              metadata: {
                welcomeEmailSent: true,
              },
              actionUrl: `${process.env.CLIENT_URL}/dashboard`,
              actionText: 'Get Started',
            },
            true,
          )

          // Mark welcome email as sent in user metadata
          await User.findByIdAndUpdate(user._id, {
            $set: {
              'metadata.welcomeEmailSent': true,
              'metadata.welcomeEmailSentAt': new Date(),
            },
          })

          console.log(`Sent welcome email to: ${user.email}`)
        } catch (error) {
          console.error(`Failed to send welcome email to ${user.email}:`, error)
        }
      }
    } catch (error) {
      console.error('Error sending welcome emails:', error)
    }
  }

  private async cleanupArchivedNotifications(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const result = await Notification.deleteMany({
        isArchived: true,
        updatedAt: { $lte: thirtyDaysAgo },
      })

      console.log(
        `🧹 Cleaned up ${result.deletedCount} archived notifications older than 30 days`,
      )
    } catch (error) {
      console.error('Error cleaning up archived notifications:', error)
    }
  }

  // Public method to manually trigger schedulers (for testing)
  async triggerManualSchedule(
    type: 'reminders' | 'welcome' | 'cleanup',
  ): Promise<void> {
    console.log(`🔧 Manually triggering scheduler: ${type}`)

    switch (type) {
      case 'welcome':
        await this.sendWelcomeEmails()
        break
      case 'cleanup':
        await this.cleanupArchivedNotifications()
        break
    }

    console.log(`✅ Manual scheduler completed: ${type}`)
  }
}

// Export singleton instance
export const notificationScheduler = NotificationScheduler.getInstance()
