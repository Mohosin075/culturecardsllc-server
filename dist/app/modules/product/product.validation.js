"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductValidations = void 0;
const zod_1 = require("zod");
const shipping_constants_1 = require("../shipping/shipping.constants");
/** Inches. Required when packageType is "custom". */
const packageDimensionsSchema = zod_1.z.object({
    lengthIn: zod_1.z.number().positive().max(108),
    widthIn: zod_1.z.number().positive().max(108),
    heightIn: zod_1.z.number().positive().max(108),
});
const createProductSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z
            .string({ required_error: 'Title is required' })
            .min(3, 'Title must be at least 3 characters long'),
        description: zod_1.z.string().optional(),
        images: zod_1.z
            .array(zod_1.z
            .string()
            .max(2048, 'Image URL length too long')
            .refine(val => !val.startsWith('data:image'), {
            message: 'Direct Base64 image strings are not allowed. Please upload to S3 first.',
        }))
            .min(1, 'At least one product image is required'),
        video: zod_1.z.string().optional(),
        category: zod_1.z
            .string({ required_error: 'Category is required' })
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ID format'),
        condition: zod_1.z.enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'], {
            required_error: 'Condition is required',
        }),
        estValue: zod_1.z
            .number({ required_error: 'Estimated value is required' })
            .nonnegative('Estimated value cannot be negative'),
        startingBid: zod_1.z.number().nonnegative().optional(),
        reservePrice: zod_1.z.number().nonnegative().optional(),
        buyNowPrice: zod_1.z.number().nonnegative().optional(),
        allowTrade: zod_1.z.boolean().optional(),
        isTradeOnly: zod_1.z.boolean().optional(),
        isGiveaway: zod_1.z.boolean().optional(),
        lookingFor: zod_1.z.string().optional(),
        targetCategory: zod_1.z.string().optional(),
        minValue: zod_1.z.number().nonnegative().optional(),
        maxValue: zod_1.z.number().nonnegative().optional(),
        shippingWeight: zod_1.z.number().nonnegative().optional(),
        packageType: zod_1.z.enum(shipping_constants_1.PACKAGE_TYPES).optional(),
        packageDimensions: packageDimensionsSchema.optional(),
        allowOffers: zod_1.z.boolean().optional(),
        minOfferAmount: zod_1.z.number().nonnegative().optional(),
        // Ignored: the server always uses the authenticated user as seller
        sellerId: zod_1.z.string().optional(),
    }),
});
const updateProductSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(3).optional(),
        description: zod_1.z.string().optional(),
        images: zod_1.z.array(zod_1.z.string()).min(1).optional(),
        video: zod_1.z.string().optional(),
        category: zod_1.z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ID format')
            .optional(),
        condition: zod_1.z
            .enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'])
            .optional(),
        estValue: zod_1.z.number().nonnegative().optional(),
        startingBid: zod_1.z.number().nonnegative().optional(),
        reservePrice: zod_1.z.number().nonnegative().optional(),
        buyNowPrice: zod_1.z.number().nonnegative().optional(),
        allowTrade: zod_1.z.boolean().optional(),
        isTradeOnly: zod_1.z.boolean().optional(),
        isGiveaway: zod_1.z.boolean().optional(),
        lookingFor: zod_1.z.string().optional(),
        targetCategory: zod_1.z.string().optional(),
        minValue: zod_1.z.number().nonnegative().optional(),
        maxValue: zod_1.z.number().nonnegative().optional(),
        shippingWeight: zod_1.z.number().nonnegative().optional(),
        packageType: zod_1.z.enum(shipping_constants_1.PACKAGE_TYPES).optional(),
        packageDimensions: packageDimensionsSchema.optional(),
        allowOffers: zod_1.z.boolean().optional(),
        minOfferAmount: zod_1.z.number().nonnegative().optional(),
        status: zod_1.z.enum(['active', 'sold', 'unsold', 'pending']).optional(),
        stock: zod_1.z.number().nonnegative().optional(),
        isFeatured: zod_1.z.boolean().optional(),
    }),
});
exports.ProductValidations = {
    createProductSchema,
    updateProductSchema,
};
