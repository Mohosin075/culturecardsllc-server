"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentValidations = void 0;
const zod_1 = require("zod");
exports.PaymentValidations = {
    create: zod_1.z.object({
        body: zod_1.z.object({
            bookingId: zod_1.z.string({
                required_error: 'Booking ID is required',
            }),
            amount: zod_1.z.number().min(1, 'Amount must be at least 1').optional(),
            currency: zod_1.z.string().default('EUR'),
            productName: zod_1.z.string().optional(),
            description: zod_1.z.string().optional(),
            paymentMethodId: zod_1.z.string().optional(),
        }),
    }),
    update: zod_1.z.object({
        body: zod_1.z
            .object({
            status: zod_1.z.enum(['succeeded', 'failed', 'refunded']).optional(),
            refundAmount: zod_1.z.number().min(0).optional(),
            refundReason: zod_1.z.string().optional(),
        })
            .strict(),
    }),
    webhook: zod_1.z.object({
        body: zod_1.z.object({
            type: zod_1.z.string(),
            data: zod_1.z.object({
                object: zod_1.z.object({
                    id: zod_1.z.string(),
                    status: zod_1.z.string(),
                    amount: zod_1.z.number(),
                    currency: zod_1.z.string(),
                    metadata: zod_1.z.any().optional(),
                }),
            }),
        }),
    }),
};
