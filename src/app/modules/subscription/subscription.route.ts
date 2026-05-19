import express from 'express'
import { SubscriptionController } from './subscription.controller'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { subscriptionValidation } from './subscription.validation'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// Public routes (no authentication required)
router.get(
  '/plans',
  validateRequest(subscriptionValidation.getPlansQuery),
  SubscriptionController.getAvailablePlans,
) //✅tested

router.get(
  '/plans/:planId',
  validateRequest(subscriptionValidation.planParams),
  SubscriptionController.getPlanById,
) //✅tested

// User routes (require authentication)
// Apply authentication middleware to all routes below

router.get(
  '/trial-eligibility/:userId?',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.checkTrialEligibility),
  SubscriptionController.checkTrialEligibility,
)

router.post(
  '/create',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.createSubscription),
  SubscriptionController.createSubscription,
) //if payment is handle from frontend then this route will be used

router.get(
  '/my-subscription',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  SubscriptionController.getUserSubscription,
)

router.patch(
  '/:subscriptionId',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.subscriptionParams),
  validateRequest(subscriptionValidation.updateSubscription),
  SubscriptionController.updateSubscription,
)

router.delete(
  '/:subscriptionId/cancel',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.subscriptionParams),
  SubscriptionController.cancelSubscription,
)

router.get(
  '/status',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),

  SubscriptionController.getSubscriptionStatus,
)

router.post(
  '/checkout-session',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.createCheckoutSession),
  SubscriptionController.createCheckoutSession,
)

router.post(
  '/:subscriptionId/reactivate',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.subscriptionParams),
  SubscriptionController.reactivateSubscription,
)

router.post(
  '/:subscriptionId/pause',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.subscriptionParams),
  SubscriptionController.pauseSubscription,
)

router.post(
  '/:subscriptionId/resume',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  validateRequest(subscriptionValidation.subscriptionParams),
  SubscriptionController.resumeSubscription,
)

router.get(
  '/usage',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),

  SubscriptionController.getUsageData,
)

router.get(
  '/usage/warnings',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER, USER_ROLES.SUPER_ADMIN),
  SubscriptionController.getUsageWarnings,
)

router.post(
  '/billing-portal',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER, USER_ROLES.SUPER_ADMIN),
  validateRequest(subscriptionValidation.createBillingPortal),
  SubscriptionController.createBillingPortal,
)

// Admin routes (require admin role)

router.post(
  '/admin/plans',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(subscriptionValidation.createSubscriptionPlan),
  SubscriptionController.createSubscriptionPlan,
)

router.patch(
  '/admin/plans/:planId',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(subscriptionValidation.planParams),
  validateRequest(subscriptionValidation.updateSubscriptionPlan),
  SubscriptionController.updateSubscriptionPlan,
)

router.get(
  '/admin/plans',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(subscriptionValidation.getPlansQuery),
  SubscriptionController.getAllPlans,
)

router.get(
  '/admin/all-subscriptions',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  SubscriptionController.getAllSubscriptions,
)

router.get(
  '/admin/analytics',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(subscriptionValidation.subscriptionAnalytics),
  SubscriptionController.getSubscriptionAnalytics,
)

router.post(
  '/admin/:subscriptionId/retry-payment',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(subscriptionValidation.subscriptionParams),
  SubscriptionController.retryFailedPayment,
)

export const SubscriptionRoutes = router
