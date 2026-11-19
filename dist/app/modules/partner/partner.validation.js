"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerValidations = void 0;
const zod_1 = require("zod");
const createPartnerZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string({ required_error: 'Partner name is required' })
            .min(2, 'Name must be at least 2 characters')
            .max(60, 'Name cannot exceed 60 characters')
            .trim(),
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address format')
            .toLowerCase()
            .trim(),
        promoCode: zod_1.z
            .string({ required_error: 'Promo code is required' })
            .min(2, 'Promo code must be at least 2 characters')
            .max(20, 'Promo code cannot exceed 20 characters')
            .regex(/^[a-zA-Z0-9_-]+$/, 'Promo code must only contain letters, numbers, hyphens, and underscores')
            .transform(val => val.toUpperCase().trim()),
        revenueSharePercentage: zod_1.z
            .number()
            .min(1, 'Revenue share must be at least 1%')
            .max(100, 'Revenue share cannot exceed 100%')
            .optional()
            .default(50),
    }),
});
const updateBankDetailsZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        accountNumber: zod_1.z
            .string()
            .min(4, 'Account number must be at least 4 digits')
            .max(34, 'Account number cannot exceed 34 characters')
            .trim()
            .optional()
            .or(zod_1.z.literal('')),
        routingNumber: zod_1.z
            .string()
            .regex(/^\d{9}$/, 'US Routing number must be exactly 9 digits')
            .optional()
            .or(zod_1.z.literal('')),
        bankName: zod_1.z.string().max(100).optional(),
        accountHolderName: zod_1.z.string().max(100).optional(),
    }),
});
exports.PartnerValidations = {
    createPartnerZodSchema,
    updateBankDetailsZodSchema,
};
