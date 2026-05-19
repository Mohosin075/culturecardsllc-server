"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Category = void 0;
const mongoose_1 = require("mongoose");
const categorySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    image: {
        type: String,
    },
    icon: {
        type: String,
    },
    theme: {
        type: String,
        trim: true,
    },
    parent: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
    },
    type: {
        type: String,
        enum: ['category', 'subcategory'],
        default: 'category',
    },
    isPopular: {
        type: Boolean,
        default: false,
    },
    isTrending: {
        type: Boolean,
        default: false,
    },
    trendingBadge: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
categorySchema.index({ name: 1, theme: 1, parent: 1 }, { unique: true });
categorySchema.index({ theme: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ type: 1 });
categorySchema.index({ isPopular: 1 });
categorySchema.index({ isTrending: 1 });
exports.Category = (0, mongoose_1.model)('Category', categorySchema);
