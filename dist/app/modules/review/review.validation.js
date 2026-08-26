"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReviewSchema = exports.createReviewSchema = void 0;
const zod_1 = require("zod");
exports.createReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        orderId: zod_1.z.string().optional(),
        tradeOfferId: zod_1.z.string().optional(),
        reviewee: zod_1.z.string({
            required_error: 'Reviewee is required',
        }),
        rating: zod_1.z.number().min(1).max(5),
        review: zod_1.z.string(),
    }),
});
exports.updateReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        reviewee: zod_1.z.string().optional(),
        rating: zod_1.z.number().min(1).max(5).optional(),
        review: zod_1.z.string().optional(),
    }),
});
