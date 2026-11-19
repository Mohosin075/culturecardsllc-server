"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerValidations = void 0;
const zod_1 = require("zod");
/**
 * The client wants this form to stay "super basic": what they intend to sell,
 * plus acceptance of the seller policies. Name and email are already on the
 * account, so they are not asked for again.
 */
const applyAsSellerZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatTheySell: zod_1.z
            .string({ required_error: 'Tell us what you intend to sell.' })
            .trim()
            .min(3, 'Please describe what you intend to sell.')
            .max(500, 'Keep this under 500 characters.'),
        categories: zod_1.z.array(zod_1.z.string()).optional(),
        businessName: zod_1.z.string().trim().max(200).optional(),
        acceptSellerPolicy: zod_1.z.literal(true, {
            errorMap: () => ({ message: 'You must accept the seller policy.' }),
        }),
        acceptTermsAndConditions: zod_1.z.literal(true, {
            errorMap: () => ({
                message: 'You must accept the terms and conditions.',
            }),
        }),
        acceptMarketplaceRules: zod_1.z.literal(true, {
            errorMap: () => ({ message: 'You must accept the marketplace rules.' }),
        }),
    }),
});
const reviewApplicationZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().trim().max(1000).optional(),
    }),
});
exports.SellerValidations = {
    applyAsSellerZodSchema,
    reviewApplicationZodSchema,
};
