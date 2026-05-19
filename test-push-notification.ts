import mongoose from 'mongoose'
import { User } from './src/app/modules/user/user.model'
import { NotificationServices } from './src/app/modules/notification/notification.service'
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './src/app/modules/notification/notification.interface'
import config from './src/config'

// Replace with a valid user ID from your database and a valid FCM token for testing
const MOCK_USER_ID = '67ba9e38d7065096181f08e4' // Placeholder ID
const MOCK_DEVICE_TOKEN = 'your_device_token_here' // Placeholder token

async function testPushNotification() {
  try {
    await mongoose.connect(config.database_url as string)
    console.log('Connected to Database')

    // 1. Ensure user has a device token
    const user = await User.findById(MOCK_USER_ID)
    if (!user) {
      console.error('User not found. Please provide a valid MOCK_USER_ID.')
      return
    }

    if (!user.deviceToken) {
      console.log('Updating user device token for testing...')
      await User.findByIdAndUpdate(MOCK_USER_ID, {
        deviceToken: MOCK_DEVICE_TOKEN,
      })
    }

    console.log(
      `Sending test notification to user ${user.name} (${user._id})...`,
    )

    // 2. Create a notification with PUSH channel
    const notification = await NotificationServices.createNotification({
      userId: user._id,
      title: 'Photopya Test Push',
      content: 'This is a test push notification from the backend integration.',
      type: NotificationType.SYSTEM_ALERT,
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.HIGH,
      metadata: {
        test: 'true',
        environment: 'development',
      },
    })

    console.log('Notification created successfully:', notification._id)
    console.log(
      'Check your terminal logs for "Successfully sent message" or "Error sending message"',
    )
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await mongoose.connection.close()
  }
}

testPushNotification()
