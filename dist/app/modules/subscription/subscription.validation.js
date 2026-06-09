"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionValidation = exports.createBillingPortalSchema = exports.applyCouponSchema = exports.attachPaymentMethodSchema = exports.subscriptionAnalyticsSchema = exports.bulkUpdatePlansSchema = exports.checkTrialEligibilitySchema = exports.webhookHeaderSchema = exports.planParamsSchema = exports.subscriptionParamsSchema = exports.getPlansQuerySchema = exports.createCheckoutSessionSchema = exports.updateSubscriptionSchema = exports.createSubscriptionSchema = exports.updateSubscriptionPlanSchema = exports.createSubscriptionPlanSchema = void 0;
const zod_1 = require("zod");
// Subscription Plan Validation
exports.createSubscriptionPlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'Plan name is required')
            .max(100, 'Plan name too long'),
        description: zod_1.z
            .string()
            .min(1, 'Description is required')
            .max(500, 'Description too long'),
        price: zod_1.z.number().min(0, 'Price must be non-negative'),
        currency: zod_1.z
            .string()
            .length(3, 'Currency must be 3 characters')
            .default('eur'),
        interval: zod_1.z.enum(['month', 'year'], {
            errorMap: () => ({ message: 'Interval must be month or year' }),
        }),
        intervalCount: zod_1.z
            .number()
            .min(1, 'Interval count must be at least 1')
            .default(1),
        trialPeriodDays: zod_1.z
            .number()
            .min(0, 'Trial period must be non-negative')
            .default(10),
        features: zod_1.z
            .array(zod_1.z.string().min(1, 'Feature cannot be empty'))
            .min(1, 'At least one feature is required'),
        maxTeamMembers: zod_1.z
            .number()
            .min(1, 'Max team members must be at least 1')
            .default(1),
        maxServices: zod_1.z
            .number()
            .min(1, 'Max services must be at least 1')
            .default(1),
        userTypes: zod_1.z
            .array(zod_1.z.enum(['user', 'professional', 'admin', 'super_admin'], {
            errorMap: () => ({ message: 'Invalid user type' }),
        }))
            .min(1, 'At least one user type is required'),
        priority: zod_1.z.number().default(0),
    }),
});
exports.updateSubscriptionPlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'Plan name is required')
            .max(100, 'Plan name too long')
            .optional(),
        description: zod_1.z
            .string()
            .min(1, 'Description is required')
            .max(500, 'Description too long')
            .optional(),
        features: zod_1.z
            .array(zod_1.z.string().min(1, 'Feature cannot be empty'))
            .min(1, 'At least one feature is required')
            .optional(),
        maxTeamMembers: zod_1.z
            .number()
            .min(1, 'Max team members must be at least 1')
            .optional(),
        maxServices: zod_1.z
            .number()
            .min(1, 'Max services must be at least 1')
            .optional(),
        isActive: zod_1.z.boolean().optional(),
        priority: zod_1.z.number().optional(),
    }),
});
// Subscription Validation
exports.createSubscriptionSchema = zod_1.z.object({
    body: zod_1.z.object({
        planId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'),
        paymentMethodId: zod_1.z.string().optional(),
        couponId: zod_1.z.string().optional(),
    }),
});
exports.updateSubscriptionSchema = zod_1.z.object({
    body: zod_1.z.object({
        planId: zod_1.z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format')
            .optional(),
        cancelAtPeriodEnd: zod_1.z.boolean().optional(),
    }),
});
// Checkout Session Validation
exports.createCheckoutSessionSchema = zod_1.z.object({
    body: zod_1.z.object({
        planId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'),
        successUrl: zod_1.z.string().url('Invalid success URL'),
        cancelUrl: zod_1.z.string().url('Invalid cancel URL'),
    }),
});
// Query Validation
exports.getPlansQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        userType: zod_1.z
            .enum(['user', 'professional', 'admin', 'super_admin'])
            .optional(),
    }),
});
// Params Validation
exports.subscriptionParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        subscriptionId: zod_1.z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid subscription ID format'),
    }),
});
exports.planParamsSchema = zod_1.z.object({
    params: zod_1.z.object({
        planId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'),
    }),
});
// Webhook Validation
exports.webhookHeaderSchema = zod_1.z.object({
    headers: zod_1.z.object({
        'stripe-signature': zod_1.z.string().min(1, 'Stripe signature is required'),
    }),
});
// Trial Eligibility Validation
exports.checkTrialEligibilitySchema = zod_1.z.object({
    params: zod_1.z.object({
        userId: zod_1.z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
            .optional(),
    }),
});
// Admin validation for bulk operations
exports.bulkUpdatePlansSchema = zod_1.z.object({
    body: zod_1.z.object({
        planIds: zod_1.z
            .array(zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format'))
            .min(1, 'At least one plan ID is required'),
        updates: zod_1.z.object({
            isActive: zod_1.z.boolean().optional(),
            priority: zod_1.z.number().optional(),
        }),
    }),
});
// Subscription analytics validation
exports.subscriptionAnalyticsSchema = zod_1.z.object({
    query: zod_1.z.object({
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        planId: zod_1.z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID format')
            .optional(),
        status: zod_1.z
            .enum(['active', 'trialing', 'canceled', 'past_due', 'unpaid'])
            .optional(),
    }),
});
// Payment method validation
exports.attachPaymentMethodSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethodId: zod_1.z.string().min(1, 'Payment method ID is required'),
    }),
});
// Coupon validation
exports.applyCouponSchema = zod_1.z.object({
    body: zod_1.z.object({
        couponCode: zod_1.z
            .string()
            .min(1, 'Coupon code is required')
            .max(50, 'Coupon code too long'),
    }),
});
// Billing Portal Validation
exports.createBillingPortalSchema = zod_1.z.object({
    body: zod_1.z.object({
        returnUrl: zod_1.z.string().url('Invalid return URL'),
    }),
});
// Export all schemas for easy import
exports.subscriptionValidation = {
    createSubscriptionPlan: exports.createSubscriptionPlanSchema,
    updateSubscriptionPlan: exports.updateSubscriptionPlanSchema,
    createSubscription: exports.createSubscriptionSchema,
    updateSubscription: exports.updateSubscriptionSchema,
    createCheckoutSession: exports.createCheckoutSessionSchema,
    getPlansQuery: exports.getPlansQuerySchema,
    subscriptionParams: exports.subscriptionParamsSchema,
    planParams: exports.planParamsSchema,
    webhookHeader: exports.webhookHeaderSchema,
    checkTrialEligibility: exports.checkTrialEligibilitySchema,
    bulkUpdatePlans: exports.bulkUpdatePlansSchema,
    subscriptionAnalytics: exports.subscriptionAnalyticsSchema,
    attachPaymentMethod: exports.attachPaymentMethodSchema,
    applyCoupon: exports.applyCouponSchema,
    createBillingPortal: exports.createBillingPortalSchema,
};
