"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const subscription_controller_1 = require("./subscription.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const subscription_validation_1 = require("./subscription.validation");
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// Public routes (no authentication required)
router.get('/plans', (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.getPlansQuery), subscription_controller_1.SubscriptionController.getAvailablePlans); //✅tested
router.get('/plans/:planId', (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.planParams), subscription_controller_1.SubscriptionController.getPlanById); //✅tested
// User routes (require authentication)
// Apply authentication middleware to all routes below
router.get('/trial-eligibility/:userId?', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.checkTrialEligibility), subscription_controller_1.SubscriptionController.checkTrialEligibility);
router.post('/create', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.createSubscription), subscription_controller_1.SubscriptionController.createSubscription); //if payment is handle from frontend then this route will be used
router.get('/my-subscription', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), subscription_controller_1.SubscriptionController.getUserSubscription);
router.patch('/:subscriptionId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionParams), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.updateSubscription), subscription_controller_1.SubscriptionController.updateSubscription);
router.delete('/:subscriptionId/cancel', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionParams), subscription_controller_1.SubscriptionController.cancelSubscription);
router.get('/status', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), subscription_controller_1.SubscriptionController.getSubscriptionStatus);
router.post('/checkout-session', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.createCheckoutSession), subscription_controller_1.SubscriptionController.createCheckoutSession);
router.post('/:subscriptionId/reactivate', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionParams), subscription_controller_1.SubscriptionController.reactivateSubscription);
router.post('/:subscriptionId/pause', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionParams), subscription_controller_1.SubscriptionController.pauseSubscription);
router.post('/:subscriptionId/resume', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionParams), subscription_controller_1.SubscriptionController.resumeSubscription);
router.get('/usage', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), subscription_controller_1.SubscriptionController.getUsageData);
router.get('/usage/warnings', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN), subscription_controller_1.SubscriptionController.getUsageWarnings);
router.post('/billing-portal', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.createBillingPortal), subscription_controller_1.SubscriptionController.createBillingPortal);
// Admin routes (require admin role)
router.post('/admin/plans', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.createSubscriptionPlan), subscription_controller_1.SubscriptionController.createSubscriptionPlan);
router.patch('/admin/plans/:planId', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.planParams), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.updateSubscriptionPlan), subscription_controller_1.SubscriptionController.updateSubscriptionPlan);
router.get('/admin/plans', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.getPlansQuery), subscription_controller_1.SubscriptionController.getAllPlans);
router.get('/admin/all-subscriptions', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), subscription_controller_1.SubscriptionController.getAllSubscriptions);
router.get('/admin/analytics', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionAnalytics), subscription_controller_1.SubscriptionController.getSubscriptionAnalytics);
router.post('/admin/:subscriptionId/retry-payment', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(subscription_validation_1.subscriptionValidation.subscriptionParams), subscription_controller_1.SubscriptionController.retryFailedPayment);
exports.SubscriptionRoutes = router;
