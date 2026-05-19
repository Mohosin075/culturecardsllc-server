"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductValidations = void 0;
const zod_1 = require("zod");
const createProductSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ required_error: 'Title is required' }).min(3, 'Title must be at least 3 characters long'),
        description: zod_1.z.string().optional(),
        images: zod_1.z.array(zod_1.z.string()).min(1, 'At least one product image is required'),
        video: zod_1.z.string().optional(),
        category: zod_1.z.enum([
            'Fine Art',
            'Sports Cards',
            'Rare Spirits',
            'Luxury Cars',
            'Electronics',
            'Streetwear',
            'TCG',
            'Digital Assets'
        ], { required_error: 'Category is required' }),
        condition: zod_1.z.enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'], { required_error: 'Condition is required' }),
        estValue: zod_1.z.number({ required_error: 'Estimated value is required' }).nonnegative('Estimated value cannot be negative'),
        startingBid: zod_1.z.number().nonnegative().optional(),
        reservePrice: zod_1.z.number().nonnegative().optional(),
        buyNowPrice: zod_1.z.number().nonnegative().optional(),
        allowTrade: zod_1.z.boolean().optional(),
        sellerId: zod_1.z.string({ required_error: 'Seller ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Seller ID format')
    })
});
const updateProductSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(3).optional(),
        description: zod_1.z.string().optional(),
        images: zod_1.z.array(zod_1.z.string()).min(1).optional(),
        video: zod_1.z.string().optional(),
        category: zod_1.z.enum([
            'Fine Art',
            'Sports Cards',
            'Rare Spirits',
            'Luxury Cars',
            'Electronics',
            'Streetwear',
            'TCG',
            'Digital Assets'
        ]).optional(),
        condition: zod_1.z.enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair']).optional(),
        estValue: zod_1.z.number().nonnegative().optional(),
        startingBid: zod_1.z.number().nonnegative().optional(),
        reservePrice: zod_1.z.number().nonnegative().optional(),
        buyNowPrice: zod_1.z.number().nonnegative().optional(),
        allowTrade: zod_1.z.boolean().optional(),
        status: zod_1.z.enum(['active', 'sold', 'unsold', 'pending']).optional(),
        stock: zod_1.z.number().nonnegative().optional()
    })
});
exports.ProductValidations = {
    createProductSchema,
    updateProductSchema
};
