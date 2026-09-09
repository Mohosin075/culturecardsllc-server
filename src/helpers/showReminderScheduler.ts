import { LiveStream } from '../app/modules/auction/auction.model'
import { NotificationIntegration } from '../app/modules/notification/notification.integration'

export const initShowReminderScheduler = () => {
  console.log('⏰ Show Reminder Scheduler initialized (15-min notification checker).')

  // Run initial check after 10 seconds, then every 60 seconds
  setTimeout(checkAndSendReminders, 10000)
  setInterval(checkAndSendReminders, 60000)
}

const checkAndSendReminders = async () => {
  try {
    const now = new Date()
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

    // Find scheduled streams starting within 15 minutes that haven't sent reminders yet
    const upcomingStreams = await LiveStream.find({
      status: 'scheduled',
      reminderSent: { $ne: true },
      scheduledStartTime: { $lte: fifteenMinutesLater, $gte: now },
    }).populate('sellerId', 'name fullName')

    if (upcomingStreams.length === 0) return

    for (const stream of upcomingStreams) {
      const seller = stream.sellerId as any
      const sellerName = seller?.fullName || seller?.name || 'Host'

      console.log(`[REMINDER] Sending 15-min push notifications for stream: "${stream.title}" (${(stream as any)._id})`)

      await NotificationIntegration.onScheduledShowReminder(
        (stream as any)._id.toString(),
        stream.title,
        sellerName,
      )

      // Mark reminder as sent
      await LiveStream.findByIdAndUpdate((stream as any)._id, {
        $set: { reminderSent: true },
      })
    }
  } catch (error) {
    console.error('Error in checkAndSendReminders scheduler:', error)
  }
}
