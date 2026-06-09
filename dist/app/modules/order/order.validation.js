"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderValidations = void 0;
const zod_1 = require("zod");
const createOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        buyerId: zod_1.z
            .string({ required_error: 'Buyer ID is required' })
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Buyer ID format'),
        sellerId: zod_1.z
            .string({ required_error: 'Seller ID is required' })
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Seller ID format'),
        productId: zod_1.z
            .string({ required_error: 'Product ID is required' })
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
        purchaseType: zod_1.z.enum(['auction_win', 'buy_now', 'trade_swap'], {
            required_error: 'Purchase type is required',
        }),
        amountDetails: zod_1.z.object({
            itemSubtotal: zod_1.z
                .number({ required_error: 'Subtotal is required' })
                .nonnegative(),
            shipping: zod_1.z.number().nonnegative().optional().default(0),
            taxes: zod_1.z.number().nonnegative().optional().default(0),
            processingFee: zod_1.z.number().nonnegative().optional().default(0),
            charityContribution: zod_1.z.number().nonnegative().optional().default(0),
            totalPaid: zod_1.z
                .number({ required_error: 'Total paid amount is required' })
                .nonnegative(),
        }, { required_error: 'Amount details are required' }),
        shippingAddress: zod_1.z.object({
            street: zod_1.z.string({ required_error: 'Street address is required' }),
            city: zod_1.z.string({ required_error: 'City is required' }),
            state: zod_1.z.string({ required_error: 'State is required' }),
            postalCode: zod_1.z.string({ required_error: 'Postal code is required' }),
            country: zod_1.z.string({ required_error: 'Country is required' }),
        }, { required_error: 'Shipping address is required' }),
        paymentIntentId: zod_1.z.string().optional(),
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
