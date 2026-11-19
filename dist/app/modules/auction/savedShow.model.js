"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedShow = void 0;
const mongoose_1 = require("mongoose");
const SavedShowSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    streamId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'LiveStream',
        required: true,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Ensure a user can bookmark a specific stream only once
SavedShowSchema.index({ userId: 1, streamId: 1 }, { unique: true });
exports.SavedShow = (0, mongoose_1.model)('SavedShow', SavedShowSchema);
