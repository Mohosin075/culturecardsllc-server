"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReviewSchema = exports.createReviewSchema = void 0;
const zod_1 = require("zod");
exports.createReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        bookingId: zod_1.z.string(),
        reviewee: zod_1.z.string().optional(),
        rating: zod_1.z.number(),
        review: zod_1.z.string(),
    }),
});
exports.updateReviewSchema = zod_1.z.object({
    body: zod_1.z.object({
        reviewee: zod_1.z.string().optional(),
        rating: zod_1.z.number().optional(),
        review: zod_1.z.string().optional(),
    }),
});
