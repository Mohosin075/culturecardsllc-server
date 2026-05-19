"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategorySchema = exports.createCategorySchema = void 0;
const zod_1 = require("zod");
exports.createCategorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({
            required_error: 'Category name is required',
        }),
        description: zod_1.z.string().optional(),
        image: zod_1.z.string().optional(),
        theme: zod_1.z.string().optional(),
        parent: zod_1.z.string().optional(),
        type: zod_1.z.enum(['category', 'subcategory']).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.updateCategorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        image: zod_1.z.string().optional(),
        theme: zod_1.z.string().optional(),
        parent: zod_1.z.string().optional(),
        type: zod_1.z.enum(['category', 'subcategory']).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
