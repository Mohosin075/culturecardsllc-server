"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlan = void 0;
const mongoose_1 = require("mongoose");
const subscriptionPlanSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        required: true,
        default: 'eur',
    },
    interval: {
        type: String,
        enum: ['month', 'year'],
        required: true,
    },
    intervalCount: {
        type: Number,
        default: 1,
        min: 1,
    },
    trialPeriodDays: {
        type: Number,
        default: 10,
        min: 0,
    },
    features: [
        {
            type: String,
            required: true,
        },
    ],
    maxTeamMembers: {
        type: Number,
        default: 1,
    },
    maxServices: {
        type: Number,
        default: 1,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    stripePriceId: {
        type: String,
        required: true,
        // unique: true,
    },
    stripeProductId: {
        type: String,
        required: true,
    },
    userTypes: [
        {
            type: String,
            enum: ['user', 'professional', 'admin', 'super_admin'],
            required: true,
        },
    ],
    priority: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});
// Index for efficient queries
subscriptionPlanSchema.index({ isActive: 1, userTypes: 1 });
subscriptionPlanSchema.index({ stripePriceId: 1 });
exports.SubscriptionPlan = (0, mongoose_1.model)('SubscriptionPlan', subscriptionPlanSchema);
