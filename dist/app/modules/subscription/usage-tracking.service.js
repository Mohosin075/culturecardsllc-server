'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        var desc = Object.getOwnPropertyDescriptor(m, k)
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k]
            },
          }
        }
        Object.defineProperty(o, k2, desc)
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v })
      }
    : function (o, v) {
        o['default'] = v
      })
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = []
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
          return ar
        }
      return ownKeys(o)
    }
    return function (mod) {
      if (mod && mod.__esModule) return mod
      var result = {}
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i])
      __setModuleDefault(result, mod)
      return result
    }
  })()
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.usageTrackingService = void 0
const mongoose_1 = require('mongoose')
const subscription_model_1 = require('./subscription.model')
const ApiError_1 = __importDefault(require('../../../errors/ApiError'))
const http_status_codes_1 = require('http-status-codes')
class UsageTrackingService {
  // Check if user can add more services
  async canAddService(userId) {
    try {
      const subscription = await subscription_model_1.Subscription.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')
      if (!subscription) {
        return { allowed: false, reason: 'No active subscription' }
      }
      let plan
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'maxServices' in subscription.planId
      ) {
        plan = subscription.planId
      } else {
        const { subscriptionService } = await Promise.resolve().then(() =>
          __importStar(require('./subscription.service')),
        )
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
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to check service limit',
      )
    }
  }
  // Check if user can add more team members
  async canAddTeamMember(userId) {
    try {
      const subscription = await subscription_model_1.Subscription.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')
      if (!subscription) {
        return { allowed: false, reason: 'No active subscription' }
      }
      let plan
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'maxTeamMembers' in subscription.planId
      ) {
        plan = subscription.planId
      } else {
        const { subscriptionService } = await Promise.resolve().then(() =>
          __importStar(require('./subscription.service')),
        )
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
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to check team member limit',
      )
    }
  }
  // Get current usage for a user
  async getCurrentUsage(userId) {
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
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to get usage data',
      )
    }
  }
  // Get usage with plan limits
  async getUsageWithLimits(userId) {
    try {
      const subscription = await subscription_model_1.Subscription.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        status: { $in: ['active', 'trialing'] },
      }).populate('planId')
      if (!subscription) {
        throw new ApiError_1.default(
          http_status_codes_1.StatusCodes.NOT_FOUND,
          'No active subscription found',
        )
      }
      let plan
      if (
        subscription.planId &&
        typeof subscription.planId === 'object' &&
        'name' in subscription.planId &&
        'maxServices' in subscription.planId &&
        'maxTeamMembers' in subscription.planId
      ) {
        plan = subscription.planId
      } else {
        const { subscriptionService } = await Promise.resolve().then(() =>
          __importStar(require('./subscription.service')),
        )
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
      if (error instanceof ApiError_1.default) throw error
      console.error('Error getting usage with limits:', error)
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to get usage data',
      )
    }
  }
  // Check if user is approaching limits (80% threshold)
  async checkApproachingLimits(userId) {
    try {
      const data = await this.getUsageWithLimits(userId)
      const warnings = []
      const suggestions = []
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
  async getCurrentServiceCount(_userId) {
    try {
      // Service model missing, stubbed to 0
      return 0
    } catch (error) {
      console.error('Error getting service count:', error)
      return 0
    }
  }
  async getCurrentTeamMemberCount(_userId) {
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
  async trackFeatureUsage(userId, feature) {
    try {
      console.log(`Feature used: ${feature} by user: ${userId}`)
    } catch (error) {
      console.error('Error tracking feature usage:', error)
    }
  }
}
exports.usageTrackingService = new UsageTrackingService()
