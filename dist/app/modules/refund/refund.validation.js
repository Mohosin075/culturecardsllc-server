"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundValidations = void 0;
const zod_1 = require("zod");
const createRefundRequestZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        orderId: zod_1.z.string({ required_error: 'orderId is required.' }),
        reason: zod_1.z.enum([
            'item_not_received',
            'not_as_described',
            'damaged',
            'wrong_item',
            'other',
        ]),
        details: zod_1.z.string().trim().max(2000).optional(),
        evidenceUrls: zod_1.z.array(zod_1.z.string()).max(10).optional(),
        /** Omit for a full refund of the order total. */
        requestedAmount: zod_1.z.number().positive().optional(),
    }),
});
const reviewRefundRequestZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        /** Lets an admin approve less than the buyer asked for. */
        amount: zod_1.z.number().positive().optional(),
        note: zod_1.z.string().trim().max(1000).optional(),
    }),
});
exports.RefundValidations = {
    createRefundRequestZodSchema,
    reviewRefundRequestZodSchema,
};
