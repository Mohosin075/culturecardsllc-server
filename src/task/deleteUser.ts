import cron from 'node-cron'
import { User } from '../app/modules/user/user.model'

cron.schedule('*/5 * * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

    const result = await User.deleteMany({
      isVerified: false,
      createdAt: { $lt: cutoff },
    })

    console.log(
      `[CRON] Deleted ${result.deletedCount} unverified users (older than 5 minutes)`,
    )
  } catch (error) {
    console.error('[CRON] Error deleting unverified users:', error)
  }
})
