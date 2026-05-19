"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionService = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("../user/user.model");
const stripe_service_1 = require("./stripe.service");
const subscription_model_1 = require("./subscription.model");
const subscription_plan_model_1 = require("./subscription-plan.model");
const email_notification_service_1 = require("./email-notification.service");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
class SubscriptionService {
    // Get all available subscription plans
    async getAvailablePlans(userType) {
        try {
            const query = { isActive: true };
            if (userType) {
                query.userTypes = { $in: [userType] };
            }
            const plans = await subscription_plan_model_1.SubscriptionPlan.find(query).sort({
                priority: 1,
                price: 1,
            });
            return plans;
        }
        catch (error) {
            console.error('Error fetching subscription plans:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscription plans');
        }
    }
    // Get plan by ID
    async getPlanById(planId) {
        try {
            const plan = await subscription_plan_model_1.SubscriptionPlan.findById(planId);
            if (!plan) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription plan not found');
            }
            return plan;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error fetching subscription plan:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscription plan');
        }
    }
    // Check trial eligibility
    async checkTrialEligibility(userId) {
        try {
            const existingSubscription = await subscription_model_1.Subscription.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
                hasUsedTrial: true,
            });
            const isEligible = !existingSubscription;
            return {
                isEligible,
                hasUsedTrial: !!existingSubscription,
                trialDays: 10, // Default trial period
                reason: isEligible
                    ? undefined
                    : 'User has already used their free trial',
            };
        }
        catch (error) {
            console.error('Error checking trial eligibility:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to check trial eligibility');
        }
    }
    // Create subscription
    async createSubscription(userId, request) {
        try {
            // Validate user exists
            const user = await user_model_1.User.findById(userId).select('+email');
            if (!user) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
            }
            // Validate plan exists
            const plan = await this.getPlanById(request.planId);
            // Check if user already has an active subscription
            const existingSubscription = await subscription_model_1.Subscription.findActiveByUserId(userId);
            if (existingSubscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'User already has an active subscription');
            }
            // Check trial eligibility
            const trialInfo = await this.checkTrialEligibility(userId);
            // Create or get Stripe customer
            let stripeCustomerId;
            const existingCustomer = await subscription_model_1.Subscription.findOne({ userId }).select('stripeCustomerId');
            if (existingCustomer === null || existingCustomer === void 0 ? void 0 : existingCustomer.stripeCustomerId) {
                stripeCustomerId = existingCustomer.stripeCustomerId;
            }
            else {
                const stripeCustomer = await stripe_service_1.stripeService.createCustomer(user.email, user.fullName || user.name, { userId: userId.toString() });
                stripeCustomerId = stripeCustomer.id;
            }
            // Attach payment method if provided
            if (request.paymentMethodId) {
                await stripe_service_1.stripeService.attachPaymentMethod(request.paymentMethodId, stripeCustomerId);
                await stripe_service_1.stripeService.setDefaultPaymentMethod(stripeCustomerId, request.paymentMethodId);
            }
            console.log('Metadata', userId, request.planId);
            // Create Stripe subscription
            const stripeSubscription = await stripe_service_1.stripeService.createSubscription({
                customerId: stripeCustomerId,
                priceId: plan.stripePriceId,
                trialPeriodDays: trialInfo.isEligible
                    ? plan.trialPeriodDays
                    : undefined,
                paymentMethodId: request.paymentMethodId,
                metadata: {
                    userId: userId.toString(),
                    planId: request.planId,
                },
            });
            // Create local subscription record
            // In newer Stripe API versions (like 2025-08-27.basil), current_period_start/end are moved to items.data[0]
            const subscriptionItem = stripeSubscription.items.data[0];
            const currentPeriodStart = stripeSubscription.current_period_start ||
                subscriptionItem.current_period_start;
            const currentPeriodEnd = stripeSubscription.current_period_end ||
                subscriptionItem.current_period_end;
            const subscription = new subscription_model_1.Subscription({
                userId: new mongoose_1.Types.ObjectId(userId),
                planId: new mongoose_1.Types.ObjectId(request.planId),
                stripeCustomerId,
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: plan.stripePriceId,
                status: stripeSubscription.status,
                currentPeriodStart: currentPeriodStart
                    ? new Date(currentPeriodStart * 1000)
                    : new Date(),
                currentPeriodEnd: currentPeriodEnd
                    ? new Date(currentPeriodEnd * 1000)
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialStart: stripeSubscription.trial_start
                    ? new Date(stripeSubscription.trial_start * 1000)
                    : null,
                trialEnd: stripeSubscription.trial_end
                    ? new Date(stripeSubscription.trial_end * 1000)
                    : null,
                hasUsedTrial: trialInfo.isEligible,
                metadata: new Map(Object.entries(stripeSubscription.metadata || {})),
            });
            await subscription.save();
            // Update user profile with subscription info
            await user_model_1.User.findByIdAndUpdate(userId, {
                stripeCustomerId,
                subscriptionStatus: stripeSubscription.status,
                subscriptionTier: this.getSubscriptionTier(plan.name),
                trialUsed: trialInfo.isEligible,
                subscriptionExpiresAt: currentPeriodEnd
                    ? new Date(currentPeriodEnd * 1000)
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            // Send welcome email
            await email_notification_service_1.emailNotificationService.sendSubscriptionWelcomeEmail(subscription, plan, !!stripeSubscription.trial_start);
            // Get client secret for payment confirmation if needed
            let clientSecret;
            console.log('--- Debugging Subscription ---');
            console.log('Subscription Status:', stripeSubscription.status);
            // Try getting from latest invoice's payment intent
            if (stripeSubscription.latest_invoice &&
                typeof stripeSubscription.latest_invoice === 'object') {
                const invoice = stripeSubscription.latest_invoice;
                if (invoice.payment_intent &&
                    typeof invoice.payment_intent === 'object') {
                    clientSecret =
                        invoice.payment_intent.client_secret || undefined;
                    console.log('Client Secret found in latest_invoice.payment_intent');
                }
                else if (invoice.payment_intent &&
                    typeof invoice.payment_intent === 'string') {
                    // If it's a string, it means it wasn't expanded properly
                    console.log('Payment Intent found as string, but not expanded:', invoice.payment_intent);
                }
            }
            // If still undefined, try setup_intent (common for free trials or setup flow)
            if (!clientSecret && stripeSubscription.pending_setup_intent) {
                if (typeof stripeSubscription.pending_setup_intent === 'object') {
                    clientSecret =
                        stripeSubscription.pending_setup_intent.client_secret ||
                            undefined;
                    console.log('Client Secret found in pending_setup_intent');
                }
                else {
                    console.log('Pending Setup Intent found as string, but not expanded:', stripeSubscription.pending_setup_intent);
                }
            }
            console.log('Final clientSecret:', clientSecret);
            console.log('------------------------------');
            console.log(`Subscription created for user ${userId}: ${subscription._id}`);
            return {
                subscription: await subscription.populate(['planId']),
                clientSecret,
            };
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error creating subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create subscription');
        }
    }
    // Get user's current subscription
    async getUserSubscription(userId) {
        try {
            const subscription = await subscription_model_1.Subscription.findActiveByUserId(userId);
            return subscription;
        }
        catch (error) {
            console.error('Error fetching user subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch subscription');
        }
    }
    // Admin: Get all subscriptions with filters and pagination
    async getAllSubscriptions(query) {
        try {
            const subscriptionQuery = new QueryBuilder_1.default(subscription_model_1.Subscription.find().populate(['userId', 'planId']), query)
                .filter()
                .sort()
                .paginate()
                .fields();
            const result = await subscriptionQuery.modelQuery;
            const meta = await subscriptionQuery.getPaginationInfo();
            // Provide demo data if database is empty
            if (result.length === 0) {
                const demoData = [
                    {
                        _id: 'demo_1',
                        userId: {
                            name: 'Jane Smith',
                            email: 'jane@example.com',
                        },
                        planId: {
                            name: 'Monthly',
                            price: 14.99,
                            interval: 'month',
                        },
                        status: 'active',
                        currentPeriodStart: new Date('2025-12-15'),
                        currentPeriodEnd: new Date('2026-02-15'),
                        cancelAtPeriodEnd: false,
                        paymentMethod: 'Visa **** 4242',
                    },
                    {
                        _id: 'demo_2',
                        userId: {
                            name: 'Mike Ross',
                            email: 'mike@example.com',
                        },
                        planId: {
                            name: 'Yearly',
                            price: 199.98,
                            interval: 'year',
                        },
                        status: 'active',
                        currentPeriodStart: new Date('2025-01-01'),
                        currentPeriodEnd: new Date('2026-01-01'),
                        cancelAtPeriodEnd: false,
                        paymentMethod: 'Mastercard **** 8888',
                    },
                ];
                return {
                    meta: {
                        page: 1,
                        limit: 10,
                        total: 2,
                        totalPage: 1,
                    },
                    result: demoData,
                };
            }
            return {
                meta,
                result,
            };
        }
        catch (error) {
            console.error('Error fetching all subscriptions:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch all subscriptions');
        }
    }
    // Update subscription (change plan)
    async updateSubscription(userId, subscriptionId, request) {
        try {
            // Find existing subscription
            const subscription = await subscription_model_1.Subscription.findOne({
                _id: subscriptionId,
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription not found');
            }
            const updateParams = {};
            // Handle plan change
            if (request.planId) {
                const newPlan = await this.getPlanById(request.planId);
                // Get current Stripe subscription to find subscription item ID
                const stripeSubscription = await stripe_service_1.stripeService.getSubscription(subscription.stripeSubscriptionId);
                const subscriptionItemId = stripeSubscription.items.data[0].id;
                // Update Stripe subscription with correct item ID
                await stripe_service_1.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
                    items: [
                        {
                            id: subscriptionItemId, // Use subscription item ID, not subscription ID
                            price: newPlan.stripePriceId,
                        },
                    ],
                    proration_behavior: 'create_prorations', // This handles automatic proration
                });
                updateParams.planId = new mongoose_1.Types.ObjectId(request.planId);
                updateParams.stripePriceId = newPlan.stripePriceId;
                // Update user profile with new subscription tier
                await user_model_1.User.findByIdAndUpdate(userId, {
                    subscriptionTier: this.getSubscriptionTier(newPlan.name),
                });
                // Send plan change notification email
                const { emailNotificationService } = await Promise.resolve().then(() => __importStar(require('./email-notification.service')));
                await emailNotificationService.sendPlanChangeEmail(subscription, newPlan, stripeSubscription.items.data[0].price);
            }
            // Handle cancellation
            if (request.cancelAtPeriodEnd !== undefined) {
                await stripe_service_1.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
                    cancel_at_period_end: request.cancelAtPeriodEnd,
                });
                updateParams.cancelAtPeriodEnd = request.cancelAtPeriodEnd;
                if (request.cancelAtPeriodEnd) {
                    updateParams.canceledAt = new Date();
                }
            }
            // Update local subscription
            const updatedSubscription = await subscription_model_1.Subscription.findByIdAndUpdate(subscriptionId, updateParams, { new: true }).populate(['planId']);
            console.log(`Subscription updated: ${subscriptionId}`);
            return updatedSubscription;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error updating subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update subscription');
        }
    }
    // Cancel subscription
    async cancelSubscription(userId, subscriptionId, cancelAtPeriodEnd = true) {
        try {
            const subscription = await subscription_model_1.Subscription.findOne({
                _id: subscriptionId,
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription not found');
            }
            // Cancel in Stripe
            await stripe_service_1.stripeService.cancelSubscription(subscription.stripeSubscriptionId, cancelAtPeriodEnd);
            // Update local subscription
            const updateData = {
                cancelAtPeriodEnd,
                canceledAt: new Date(),
            };
            if (!cancelAtPeriodEnd) {
                updateData.status = 'canceled';
                updateData.endedAt = new Date();
            }
            const updatedSubscription = await subscription_model_1.Subscription.findByIdAndUpdate(subscriptionId, updateData, { new: true }).populate(['planId']);
            console.log(`Subscription canceled: ${subscriptionId}`);
            return updatedSubscription;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error canceling subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to cancel subscription');
        }
    }
    // Reactivate subscription
    async reactivateSubscription(userId, subscriptionId) {
        try {
            const subscription = await subscription_model_1.Subscription.findOne({
                _id: subscriptionId,
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription not found');
            }
            if (subscription.status === 'canceled' && subscription.endedAt) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Subscription has already ended and cannot be reactivated. Please start a new subscription.');
            }
            if (!subscription.cancelAtPeriodEnd) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Subscription is not set to cancel and is already active.');
            }
            // Reactivate in Stripe
            await stripe_service_1.stripeService.reactivateSubscription(subscription.stripeSubscriptionId);
            // Update local subscription
            const updatedSubscription = await subscription_model_1.Subscription.findByIdAndUpdate(subscriptionId, {
                cancelAtPeriodEnd: false,
                canceledAt: null,
                resumedAt: new Date(),
            }, { new: true }).populate(['planId']);
            // Send reactivation email
            const plan = updatedSubscription === null || updatedSubscription === void 0 ? void 0 : updatedSubscription.planId;
            if (plan) {
                await email_notification_service_1.emailNotificationService.sendSubscriptionWelcomeEmail(updatedSubscription, plan, updatedSubscription.status === 'trialing');
            }
            console.log(`Subscription reactivated: ${subscriptionId}`);
            return updatedSubscription;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error reactivating subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to reactivate subscription');
        }
    }
    // Get subscription status
    async getSubscriptionStatus(userId) {
        try {
            const subscription = await subscription_model_1.Subscription.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
                status: { $in: ['active', 'trialing'] },
            }).populate('planId');
            if (!subscription) {
                return {
                    isActive: false,
                    isTrialing: false,
                    isPastDue: false,
                    isCanceled: false,
                    daysUntilExpiry: 0,
                };
            }
            const now = new Date();
            const endDate = subscription.currentPeriodEnd;
            const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            // Ensure planId is populated, if not fetch it separately
            let currentPlan;
            if (subscription.planId &&
                typeof subscription.planId === 'object' &&
                'name' in subscription.planId &&
                'description' in subscription.planId &&
                'price' in subscription.planId) {
                // planId is properly populated with plan data
                currentPlan = subscription.planId;
            }
            else {
                // Fallback: fetch the plan separately if not populated
                currentPlan = await this.getPlanById(subscription.planId.toString());
            }
            return {
                isActive: ['active', 'trialing'].includes(subscription.status),
                isTrialing: subscription.status === 'trialing',
                isPastDue: subscription.status === 'past_due',
                isCanceled: subscription.status === 'canceled',
                daysUntilExpiry: Math.max(0, daysUntilExpiry),
                currentPlan,
            };
        }
        catch (error) {
            console.error('Error getting subscription status:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get subscription status');
        }
    }
    // Create checkout session
    async createCheckoutSession(userId, planId, successUrl, cancelUrl) {
        try {
            const user = await user_model_1.User.findById(userId).select('+email');
            if (!user) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
            }
            const plan = await this.getPlanById(planId);
            const trialInfo = await this.checkTrialEligibility(userId);
            // Create or get Stripe customer
            let stripeCustomerId;
            const existingCustomer = await subscription_model_1.Subscription.findOne({ userId }).select('stripeCustomerId');
            if (existingCustomer === null || existingCustomer === void 0 ? void 0 : existingCustomer.stripeCustomerId) {
                stripeCustomerId = existingCustomer.stripeCustomerId;
            }
            else {
                const stripeCustomer = await stripe_service_1.stripeService.createCustomer(user.email, user.fullName || user.name, { userId: userId.toString() });
                stripeCustomerId = stripeCustomer.id;
            }
            const session = await stripe_service_1.stripeService.createCheckoutSession({
                customerId: stripeCustomerId,
                priceId: plan.stripePriceId,
                successUrl,
                cancelUrl,
                trialPeriodDays: trialInfo.isEligible
                    ? plan.trialPeriodDays
                    : undefined,
                metadata: {
                    userId: userId.toString(),
                    planId,
                },
            });
            return {
                sessionId: session.id,
                url: session.url,
            };
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error creating checkout session:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
        }
    }
    // Admin: Create subscription plan
    async createSubscriptionPlan(planData) {
        try {
            // Create Stripe product
            const stripeProduct = await stripe_service_1.stripeService.createProduct({
                name: planData.name,
                description: planData.description,
                metadata: {
                    userTypes: planData.userTypes.join(','),
                    maxTeamMembers: planData.maxTeamMembers.toString(),
                    maxServices: planData.maxServices.toString(),
                },
            });
            // Create Stripe price
            const stripePrice = await stripe_service_1.stripeService.createPrice({
                productId: stripeProduct.id,
                unitAmount: planData.price * 100, // Convert to cents
                currency: planData.currency,
                interval: planData.interval,
                intervalCount: planData.intervalCount,
                metadata: {
                    planName: planData.name,
                },
            });
            // Create local plan
            const plan = new subscription_plan_model_1.SubscriptionPlan({
                ...planData,
                stripeProductId: stripeProduct.id,
                stripePriceId: stripePrice.id,
            });
            await plan.save();
            console.log(`Subscription plan created: ${plan._id}`);
            return plan;
        }
        catch (error) {
            console.error('Error creating subscription plan:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create subscription plan');
        }
    }
    // Admin: Update subscription plan
    async updateSubscriptionPlan(planId, updateData) {
        try {
            const plan = await subscription_plan_model_1.SubscriptionPlan.findById(planId);
            if (!plan) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription plan not found');
            }
            // Update Stripe product if name or description changed
            if (updateData.name || updateData.description) {
                await stripe_service_1.stripeService.updateProduct(plan.stripeProductId, {
                    name: updateData.name || plan.name,
                    description: updateData.description || plan.description,
                });
            }
            // Create new Stripe price if price changed
            if (updateData.price && updateData.price !== plan.price) {
                const newStripePrice = await stripe_service_1.stripeService.createPrice({
                    productId: plan.stripeProductId,
                    unitAmount: updateData.price * 100,
                    currency: updateData.currency || plan.currency,
                    interval: updateData.interval || plan.interval,
                    intervalCount: updateData.intervalCount || plan.intervalCount,
                });
                // Archive old price
                await stripe_service_1.stripeService.archivePrice(plan.stripePriceId);
                updateData.stripePriceId = newStripePrice.id;
            }
            const updatedPlan = await subscription_plan_model_1.SubscriptionPlan.findByIdAndUpdate(planId, updateData, { new: true });
            console.log(`Subscription plan updated: ${planId}`);
            return updatedPlan;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error updating subscription plan:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update subscription plan');
        }
    }
    // Get subscription analytics
    async getSubscriptionAnalytics(filters) {
        var _a;
        try {
            const matchStage = {};
            if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
                matchStage.createdAt = {};
                if (filters.startDate)
                    matchStage.createdAt.$gte = filters.startDate;
                if (filters.endDate)
                    matchStage.createdAt.$lte = filters.endDate;
            }
            if (filters === null || filters === void 0 ? void 0 : filters.planId) {
                matchStage.planId = new mongoose_1.Types.ObjectId(filters.planId);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                matchStage.status = filters.status;
            }
            const analytics = await subscription_model_1.Subscription.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalSubscriptions: { $sum: 1 },
                        activeSubscriptions: {
                            $sum: {
                                $cond: [{ $in: ['$status', ['active', 'trialing']] }, 1, 0],
                            },
                        },
                        trialingSubscriptions: {
                            $sum: { $cond: [{ $eq: ['$status', 'trialing'] }, 1, 0] },
                        },
                        canceledSubscriptions: {
                            $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] },
                        },
                        pastDueSubscriptions: {
                            $sum: { $cond: [{ $eq: ['$status', 'past_due'] }, 1, 0] },
                        },
                    },
                },
            ]);
            // Calculate MRR (Monthly Recurring Revenue)
            const mrrData = await subscription_model_1.Subscription.aggregate([
                {
                    $match: {
                        status: { $in: ['active', 'trialing'] },
                        ...matchStage,
                    },
                },
                {
                    $lookup: {
                        from: 'subscriptionplans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'plan',
                    },
                },
                { $unwind: '$plan' },
                {
                    $group: {
                        _id: null,
                        monthlyRevenue: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$plan.interval', 'month'] },
                                    '$plan.price',
                                    { $divide: ['$plan.price', 12] }, // Convert yearly to monthly
                                ],
                            },
                        },
                    },
                },
            ]);
            const result = analytics[0] || {
                totalSubscriptions: 0,
                activeSubscriptions: 0,
                trialingSubscriptions: 0,
                canceledSubscriptions: 0,
                pastDueSubscriptions: 0,
            };
            result.monthlyRevenue = ((_a = mrrData[0]) === null || _a === void 0 ? void 0 : _a.monthlyRevenue) || 0;
            result.churnRate =
                result.totalSubscriptions > 0
                    ? ((result.canceledSubscriptions / result.totalSubscriptions) *
                        100).toFixed(2)
                    : 0;
            return result;
        }
        catch (error) {
            console.error('Error getting subscription analytics:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to get subscription analytics');
        }
    }
    // Retry failed payments
    async retryFailedPayment(subscriptionId) {
        try {
            const subscription = await subscription_model_1.Subscription.findById(subscriptionId);
            if (!subscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription not found');
            }
            // Get latest invoice from Stripe
            const stripeSubscription = await stripe_service_1.stripeService.getSubscriptionExpanded(subscription.stripeSubscriptionId);
            if (stripeSubscription.latest_invoice &&
                typeof stripeSubscription.latest_invoice === 'object') {
                const invoice = stripeSubscription.latest_invoice;
                // Retry payment on the invoice
                await stripe_service_1.stripeService.retryInvoicePayment(invoice.id);
                console.log(`Payment retry initiated for subscription: ${subscriptionId}`);
            }
        }
        catch (error) {
            console.error('Error retrying failed payment:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to retry payment');
        }
    }
    // Pause subscription (for temporary suspension)
    async pauseSubscription(userId, subscriptionId) {
        try {
            const subscription = await subscription_model_1.Subscription.findOne({
                _id: subscriptionId,
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription not found');
            }
            // Pause in Stripe
            await stripe_service_1.stripeService.pauseSubscription(subscription.stripeSubscriptionId);
            // Update local subscription
            const updatedSubscription = await subscription_model_1.Subscription.findByIdAndUpdate(subscriptionId, { status: 'paused' }, { new: true }).populate(['planId']);
            console.log(`Subscription paused: ${subscriptionId}`);
            return updatedSubscription;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error pausing subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to pause subscription');
        }
    }
    // Resume paused subscription
    async resumeSubscription(userId, subscriptionId) {
        try {
            const subscription = await subscription_model_1.Subscription.findOne({
                _id: subscriptionId,
                userId: new mongoose_1.Types.ObjectId(userId),
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Subscription not found');
            }
            // Resume in Stripe
            await stripe_service_1.stripeService.resumeSubscription(subscription.stripeSubscriptionId);
            // Update local subscription
            const updatedSubscription = await subscription_model_1.Subscription.findByIdAndUpdate(subscriptionId, { status: 'active' }, { new: true }).populate(['planId']);
            console.log(`Subscription resumed: ${subscriptionId}`);
            return updatedSubscription;
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error resuming subscription:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to resume subscription');
        }
    }
    // Create billing portal session for payment method management
    async createBillingPortalSession(userId, returnUrl) {
        try {
            // Get user to find their Stripe customer ID
            const user = await user_model_1.User.findById(userId);
            if (!user) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
            }
            const userWithStripe = user;
            if (!userWithStripe.stripeCustomerId) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'User does not have a Stripe customer account');
            }
            // Create billing portal session
            const session = await stripe_service_1.stripeService.createPortalSession(userWithStripe.stripeCustomerId, returnUrl);
            console.log(`Billing portal session created for user: ${userId}`);
            return { url: session.url };
        }
        catch (error) {
            if (error instanceof ApiError_1.default)
                throw error;
            console.error('Error creating billing portal session:', error);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create billing portal session');
        }
    }
    // Helper method to determine subscription tier
    getSubscriptionTier(planName) {
        const name = planName.toLowerCase();
        if (name.includes('enterprise') || name.includes('pro')) {
            return 'premium';
        }
        else if (name.includes('basic') || name.includes('starter')) {
            return 'basic';
        }
        return 'free';
    }
}
exports.subscriptionService = new SubscriptionService();
