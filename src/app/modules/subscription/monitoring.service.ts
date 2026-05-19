import { Subscription } from './subscription.model'
import { SubscriptionPlan } from './subscription-plan.model'
import { stripeService } from './stripe.service'

class MonitoringService {
  // Monitor subscription health
  async monitorSubscriptionHealth(): Promise<void> {
    try {
      // Check for subscriptions that should have ended but are still active
      const expiredSubscriptions = await Subscription.find({
        status: { $in: ['active', 'trialing'] },
        currentPeriodEnd: { $lt: new Date() },
      })

      if (expiredSubscriptions.length > 0) {
        console.warn(
          `Found ${expiredSubscriptions.length} expired but active subscriptions`,
        )

        // Sync with Stripe to get current status
        for (const subscription of expiredSubscriptions) {
          try {
            const stripeSubscription = await stripeService.getSubscription(
              subscription.stripeSubscriptionId,
            )

            if (stripeSubscription.status !== subscription.status) {
              const subscriptionItem = stripeSubscription.items.data[0]
              const currentPeriodStart =
                (stripeSubscription as any).current_period_start ||
                (subscriptionItem as any).current_period_start
              const currentPeriodEnd =
                (stripeSubscription as any).current_period_end ||
                (subscriptionItem as any).current_period_end

              await Subscription.findByIdAndUpdate(subscription._id, {
                status: stripeSubscription.status,
                currentPeriodStart: currentPeriodStart
                  ? new Date(currentPeriodStart * 1000)
                  : undefined,
                currentPeriodEnd: currentPeriodEnd
                  ? new Date(currentPeriodEnd * 1000)
                  : undefined,
              })

              console.log(`Synced subscription status: ${subscription._id}`)
            }
          } catch (error) {
            console.error(
              `Error syncing subscription ${subscription._id}:`,
              error,
            )
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring subscription health:', error)
    }
  }

  // Monitor payment failures
  async monitorPaymentFailures(): Promise<void> {
    try {
      const failedPayments = await Subscription.find({
        paymentFailureCount: { $gte: 3 },
        status: 'past_due',
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      }).populate(['userId', 'planId'])

      if (failedPayments.length > 0) {
        console.warn(
          `HIGH PRIORITY: ${failedPayments.length} subscriptions with multiple payment failures`,
        )

        // Send alerts to admin
        for (const subscription of failedPayments) {
          console.error(
            `PAYMENT FAILURE ALERT: Subscription ${subscription._id} has ${subscription.paymentFailureCount} failed attempts`,
          )

          // You could integrate with your notification service here
          // await notificationService.sendPaymentFailureAlert(subscription)
        }
      }
    } catch (error) {
      console.error('Error monitoring payment failures:', error)
    }
  }

  // Monitor trial conversions
  async monitorTrialConversions(): Promise<void> {
    try {
      const trialEndingSoon = await Subscription.find({
        status: 'trialing',
        trialEnd: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Next 3 days
        },
      }).populate(['userId', 'planId'])

      if (trialEndingSoon.length > 0) {
        console.log(
          `${trialEndingSoon.length} trials ending in the next 3 days`,
        )

        // Send conversion reminders
        for (const subscription of trialEndingSoon) {
          console.log(`Trial ending soon: ${subscription._id}`)

          // You could send reminder emails here
          // await emailService.sendTrialEndingReminder(subscription)
        }
      }
    } catch (error) {
      console.error('Error monitoring trial conversions:', error)
    }
  }

  // Monitor plan usage and limits
  async monitorPlanUsage(): Promise<void> {
    try {
      // This would depend on your specific usage tracking implementation
      // Example: Check if users are approaching their plan limits

      const activeSubscriptions = await Subscription.find({
        status: { $in: ['active', 'trialing'] },
      }).populate(['userId', 'planId'])

      for (const subscription of activeSubscriptions) {
        // Example usage monitoring logic
        // const usage = await usageTrackingService.getUsageWithLimits(subscription.userId)
        // if (usage.percentages.servicesUsed >= 80) {
        //   console.warn(`User ${subscription.userId} approaching service limit`)
        // }
      }
    } catch (error) {
      console.error('Error monitoring plan usage:', error)
    }
  }

  // Generate daily health report
  async generateDailyReport(): Promise<any> {
    try {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

      const report: any = {
        date: today.toISOString().split('T')[0],
        subscriptions: {
          total: await Subscription.countDocuments(),
          active: await Subscription.countDocuments({ status: 'active' }),
          trialing: await Subscription.countDocuments({ status: 'trialing' }),
          pastDue: await Subscription.countDocuments({ status: 'past_due' }),
          canceled: await Subscription.countDocuments({ status: 'canceled' }),
        },
        newSubscriptions: await Subscription.countDocuments({
          createdAt: { $gte: yesterday, $lt: today },
        }),
        canceledSubscriptions: await Subscription.countDocuments({
          status: 'canceled',
          updatedAt: { $gte: yesterday, $lt: today },
        }),
        paymentFailures: await Subscription.countDocuments({
          paymentFailureCount: { $gt: 0 },
          updatedAt: { $gte: yesterday, $lt: today },
        }),
        plans: {
          total: await SubscriptionPlan.countDocuments(),
          active: await SubscriptionPlan.countDocuments({ isActive: true }),
        },
      }

      // Calculate churn rate
      const totalActive =
        report.subscriptions.active + report.subscriptions.trialing
      report.churnRate =
        totalActive > 0
          ? ((report.canceledSubscriptions / totalActive) * 100).toFixed(2)
          : '0.00'

      console.log('Daily subscription report generated', report)
      return report
    } catch (error) {
      console.error('Error generating daily report:', error)
      throw error
    }
  }

  // Check for webhook processing delays
  async monitorWebhookHealth(): Promise<void> {
    try {
      // Check for subscriptions that haven't been updated by webhooks recently
      const staleSubscriptions = await Subscription.find({
        status: { $in: ['active', 'trialing'] },
        updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days old
      })

      if (staleSubscriptions.length > 0) {
        console.warn(
          `Found ${staleSubscriptions.length} subscriptions with stale webhook data`,
        )

        // Sync with Stripe
        for (const subscription of staleSubscriptions.slice(0, 10)) {
          // Limit to 10 to avoid rate limits
          try {
            const stripeSubscription = await stripeService.getSubscription(
              subscription.stripeSubscriptionId,
            )

            const subscriptionItem = stripeSubscription.items.data[0]
            const currentPeriodStart =
              (stripeSubscription as any).current_period_start ||
              (subscriptionItem as any).current_period_start
            const currentPeriodEnd =
              (stripeSubscription as any).current_period_end ||
              (subscriptionItem as any).current_period_end

            await Subscription.findByIdAndUpdate(subscription._id, {
              status: stripeSubscription.status,
              currentPeriodStart: currentPeriodStart
                ? new Date(currentPeriodStart * 1000)
                : undefined,
              currentPeriodEnd: currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000)
                : undefined,
              updatedAt: new Date(),
            })

            console.log(`Synced stale subscription: ${subscription._id}`)
          } catch (error) {
            console.error(
              `Error syncing stale subscription ${subscription._id}:`,
              error,
            )
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring webhook health:', error)
    }
  }

  // Run all monitoring tasks
  async runAllMonitoringTasks(): Promise<void> {
    console.log('Starting subscription monitoring tasks...')

    await Promise.allSettled([
      this.monitorSubscriptionHealth(),
      this.monitorPaymentFailures(),
      this.monitorTrialConversions(),
      this.monitorPlanUsage(),
      this.monitorWebhookHealth(),
    ])

    console.log('Subscription monitoring tasks completed')
  }
}

export const monitoringService = new MonitoringService()
