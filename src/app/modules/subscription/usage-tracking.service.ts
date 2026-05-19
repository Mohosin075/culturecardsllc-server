import { Types } from 'mongoose'
import { Subscription } from './subscription.model'
import { ISubscriptionPlan } from './subscription.interface'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
type UsageData = {
  userId: string
  serviceCount: number
  teamMemberCount: number
  storageUsed: number
  apiCallsThisMonth: number
}

class UsageTrackingService {
  // Check if user can add more services
  async canAddService(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const subscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')

      if (!subscription) {
        return { allowed: false, reason: 'No active subscription' }
      }

      let plan: ISubscriptionPlan
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'maxServices' in subscription.planId
      ) {
        plan = subscription.planId as unknown as ISubscriptionPlan
      } else {
        const { subscriptionService } = await import('./subscription.service')
        plan = await subscriptionService.getPlanById(
          subscription.planId.toString(),
        )
      }

      const currentServiceCount = await this.getCurrentServiceCount(userId)

      if (currentServiceCount >= plan.maxServices) {
        return {
          allowed: false,
          reason: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxServices} services.`,
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking service limit:', error)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to check service limit',
      )
    }
  }

  // Check if user can add more team members
  async canAddTeamMember(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const subscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')

      if (!subscription) {
        return { allowed: false, reason: 'No active subscription' }
      }

      let plan: ISubscriptionPlan
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'maxTeamMembers' in subscription.planId
      ) {
        plan = subscription.planId as unknown as ISubscriptionPlan
      } else {
        const { subscriptionService } = await import('./subscription.service')
        plan = await subscriptionService.getPlanById(
          subscription.planId.toString(),
        )
      }

      const currentTeamMemberCount =
        await this.getCurrentTeamMemberCount(userId)

      if (currentTeamMemberCount >= plan.maxTeamMembers) {
        return {
          allowed: false,
          reason: `Plan limit reached. Your ${plan.name} plan allows ${plan.maxTeamMembers} team members.`,
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking team member limit:', error)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to check team member limit',
      )
    }
  }

  // Get current usage for a user
  async getCurrentUsage(userId: string): Promise<UsageData> {
    try {
      const serviceCount = await this.getCurrentServiceCount(userId)
      const teamMemberCount = await this.getCurrentTeamMemberCount(userId)

      return {
        userId,
        serviceCount,
        teamMemberCount,
        storageUsed: 0,
        apiCallsThisMonth: 0,
      }
    } catch (error) {
      console.error('Error getting current usage:', error)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to get usage data',
      )
    }
  }

  // Get usage with plan limits
  async getUsageWithLimits(userId: string): Promise<{
    usage: UsageData
    limits: {
      maxServices: number
      maxTeamMembers: number
    }
    percentages: {
      servicesUsed: number
      teamMembersUsed: number
    }
  }> {
    try {
      const subscription = await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')

      if (!subscription) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          'No active subscription found',
        )
      }

      let plan: ISubscriptionPlan
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'maxServices' in subscription.planId &&
        'maxTeamMembers' in subscription.planId
      ) {
        plan = subscription.planId as unknown as ISubscriptionPlan
      } else {
        const { subscriptionService } = await import('./subscription.service')
        plan = await subscriptionService.getPlanById(
          subscription.planId.toString(),
        )
      }

      const usage = await this.getCurrentUsage(userId)

      return {
        usage,
        limits: {
          maxServices: plan.maxServices,
          maxTeamMembers: plan.maxTeamMembers,
        },
        percentages: {
          servicesUsed: Math.round(
            (usage.serviceCount / plan.maxServices) * 100,
          ),
          teamMembersUsed: Math.round(
            (usage.teamMemberCount / plan.maxTeamMembers) * 100,
          ),
        },
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      console.error('Error getting usage with limits:', error)
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to get usage data',
      )
    }
  }

  // Check if user is approaching limits (80% threshold)
  async checkApproachingLimits(userId: string): Promise<{
    warnings: string[]
    suggestions: string[]
  }> {
    try {
      const data = await this.getUsageWithLimits(userId)
      const warnings: string[] = []
      const suggestions: string[] = []

      if (data.percentages.servicesUsed >= 80) {
        warnings.push(
          `You're using ${data.percentages.servicesUsed}% of your service limit`,
        )
        suggestions.push('Consider upgrading your plan to add more services')
      }

      if (data.percentages.teamMembersUsed >= 80) {
        warnings.push(
          `You're using ${data.percentages.teamMembersUsed}% of your team member limit`,
        )
        suggestions.push(
          'Consider upgrading your plan to add more team members',
        )
      }

      return { warnings, suggestions }
    } catch (error) {
      console.error('Error checking approaching limits:', error)
      return { warnings: [], suggestions: [] }
    }
  }

  // Private helper methods
  private async getCurrentServiceCount(_userId: string): Promise<number> {
    try {
      // Service model missing, stubbed to 0
      return 0
    } catch (error) {
      console.error('Error getting service count:', error)
      return 0
    }
  }

  private async getCurrentTeamMemberCount(_userId: string): Promise<number> {
    try {
      // For now, we assume a professional always has themselves as a member
      // Expand this if a formal Team/Member collection is added later
      return 1
    } catch (error) {
      console.error('Error getting team member count:', error)
      return 1
    }
  }

  // Track feature usage (for analytics)
  async trackFeatureUsage(userId: string, feature: string): Promise<void> {
    try {
      console.log(`Feature used: ${feature} by user: ${userId}`)
    } catch (error) {
      console.error('Error tracking feature usage:', error)
    }
  }
}

export const usageTrackingService = new UsageTrackingService()
