import cron from 'node-cron'
import { NotificationServices } from '../app/modules/notification/notification.service'

// Run every minute to check for scheduled notifications
cron.schedule('* * * * *', async () => {
  console.log('Checking for scheduled notifications...')
  await NotificationServices.sendScheduledNotifications()
})
