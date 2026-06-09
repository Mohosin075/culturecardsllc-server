"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Support = void 0;
const mongoose_1 = require("mongoose");
const support_1 = require("../../../enum/support");
const supportSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }, // Reporter
    reportedUser: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    contentId: { type: mongoose_1.Schema.Types.ObjectId },
    contentType: {
        type: String,
        enum: ['comment', 'review', 'user'],
    },
    reason: {
        type: String,
        enum: ['harassment', 'spam', 'fraud', 'other'],
        default: 'other',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
    },
    subject: { type: String },
    message: { type: String },
    status: {
        type: String,
        enum: Object.values(support_1.SUPPORT_STATUS),
        default: support_1.SUPPORT_STATUS.PENDING,
    },
    attachments: { type: [String] },
    moderationLog: [
        {
            action: { type: String, required: true },
            by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            details: { type: String },
            timestamp: { type: Date, default: Date.now },
        },
    ],
}, {
    timestamps: true,
});
exports.Support = (0, mongoose_1.model)('Support', supportSchema);
