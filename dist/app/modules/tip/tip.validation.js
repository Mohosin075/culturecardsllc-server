"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipValidation = void 0;
const zod_1 = require("zod");
const createTipIntentZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        streamId: zod_1.z.string({ required_error: 'streamId is required' }),
        amount: zod_1.z.number({ required_error: 'amount is required' }).min(1, 'Minimum tip amount is $1'),
        paymentMethodId: zod_1.z.string().optional(),
        message: zod_1.z.string().max(200, 'Message cannot exceed 200 characters').optional(),
    }),
});
const confirmTipZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        streamId: zod_1.z.string({ required_error: 'streamId is required' }),
        paymentIntentId: zod_1.z.string({ required_error: 'paymentIntentId is required' }),
        amount: zod_1.z.number().min(1),
        message: zod_1.z.string().max(200, 'Message cannot exceed 200 characters').optional(),
    }),
});
exports.TipValidation = {
    createTipIntentZodSchema,
    confirmTipZodSchema,
};
