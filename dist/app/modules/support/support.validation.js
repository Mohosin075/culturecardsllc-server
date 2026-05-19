"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupportSchema = exports.createSupportSchema = void 0;
const zod_1 = require("zod");
const support_1 = require("../../../enum/support");
exports.createSupportSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().optional(),
        subject: zod_1.z.string().optional(),
        message: zod_1.z.string(),
        status: zod_1.z
            .enum([
            support_1.SUPPORT_STATUS.PENDING,
            support_1.SUPPORT_STATUS.UNDER_REVIEW,
            support_1.SUPPORT_STATUS.SOLVED,
            support_1.SUPPORT_STATUS.DISMISSED,
            support_1.SUPPORT_STATUS.DELETED,
        ])
            .optional(),
        attachments: zod_1.z.array(zod_1.z.string()).optional(),
        contentType: zod_1.z.enum(['comment', 'review']),
        reason: zod_1.z.enum(['harassment', 'spam', 'fraud', 'other']).optional(),
    }),
});
exports.updateSupportSchema = zod_1.z.object({
    body: zod_1.z.object({
        subject: zod_1.z.string().optional(),
        message: zod_1.z.string().optional(),
        status: zod_1.z
            .enum([
            support_1.SUPPORT_STATUS.PENDING,
            support_1.SUPPORT_STATUS.UNDER_REVIEW,
            support_1.SUPPORT_STATUS.SOLVED,
            support_1.SUPPORT_STATUS.DISMISSED,
            support_1.SUPPORT_STATUS.DELETED,
        ])
            .optional(),
        attachments: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
