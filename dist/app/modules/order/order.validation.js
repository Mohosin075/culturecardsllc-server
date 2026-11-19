"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderValidations = void 0;
const zod_1 = require("zod");
const createOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        // Ignored: buyer = authenticated user, seller = product owner (set server-side)
        buyerId: zod_1.z.string().optional(),
        sellerId: zod_1.z.string().optional(),
        productId: zod_1.z
            .string({ required_error: 'Product ID is required' })
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
        purchaseType: zod_1.z
            .enum(['auction_win', 'buy_now', 'trade_swap'])
            .optional()
            .default('buy_now'),
        totalPaid: zod_1.z.number().nonnegative().optional(),
        amountDetails: zod_1.z
            .object({
            itemSubtotal: zod_1.z.number().nonnegative().optional().default(0),
            shipping: zod_1.z.number().nonnegative().optional().default(0),
            taxes: zod_1.z.number().nonnegative().optional().default(0),
            processingFee: zod_1.z.number().nonnegative().optional().default(0),
            charityContribution: zod_1.z.number().nonnegative().optional().default(0),
            totalPaid: zod_1.z.number().nonnegative().optional(),
        })
            .optional()
            .default({ itemSubtotal: 0, shipping: 0, taxes: 0, processingFee: 0, charityContribution: 0, totalPaid: 0 }),
        shippingAddress: zod_1.z
            .object({
            fullName: zod_1.z.string().optional(),
            phone: zod_1.z.string().optional(),
            street: zod_1.z.string({ required_error: 'Street address is required' }),
            city: zod_1.z.string({ required_error: 'City is required' }),
            state: zod_1.z.string({ required_error: 'State is required' }),
            postalCode: zod_1.z.string().optional(),
            zipCode: zod_1.z.string().optional(),
            country: zod_1.z.string().optional().default('USA'),
        })
            .transform((val) => ({
            ...val,
            postalCode: val.postalCode || val.zipCode || '00000',
        })),
        paymentIntentId: zod_1.z.string().optional(),
        shippingWeight: zod_1.z.number().nonnegative().optional(),
        shippingLabelUrl: zod_1.z.string().optional(),
    }),
});
const updateOrderJourneySchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z
            .string({ required_error: 'Status label is required' })
            .min(2, 'Status must be at least 2 characters'),
        description: zod_1.z
            .string({ required_error: 'Description is required' })
            .min(3, 'Description must be at least 3 characters'),
        location: zod_1.z.string().optional(),
        deliveryStatus: zod_1.z
            .enum(['pending', 'shipped', 'delivered', 'cancelled'])
            .optional(),
    }),
});
exports.OrderValidations = {
    createOrderSchema,
    updateOrderJourneySchema,
};
