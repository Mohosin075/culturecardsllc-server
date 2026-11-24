import { z } from 'zod'
import { PACKAGE_TYPES, PackageType } from '../shipping/shipping.constants'

/** Inches. Required when packageType is "custom". */
const packageDimensionsSchema = z.object({
  lengthIn: z.number().positive().max(108),
  widthIn: z.number().positive().max(108),
  heightIn: z.number().positive().max(108),
})

const createProductSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(3, 'Title must be at least 3 characters long'),
    description: z.string().optional(),
    images: z
      .array(
        z
          .string()
          .max(2048, 'Image URL length too long')
          .refine(val => !val.startsWith('data:image'), {
            message: 'Direct Base64 image strings are not allowed. Please upload to S3 first.',
          }),
      )
      .min(1, 'At least one product image is required'),
    video: z.string().optional(),
    category: z
      .string({ required_error: 'Category is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ID format'),
    condition: z.enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'], {
      required_error: 'Condition is required',
    }),
    estValue: z
      .number({ required_error: 'Estimated value is required' })
      .nonnegative('Estimated value cannot be negative'),
    startingBid: z.number().nonnegative().optional(),
    reservePrice: z.number().nonnegative().optional(),
    buyNowPrice: z.number().nonnegative().optional(),
    allowTrade: z.boolean().optional(),
    isTradeOnly: z.boolean().optional(),
    isGiveaway: z.boolean().optional(),
    lookingFor: z.string().optional(),
    targetCategory: z.string().optional(),
    minValue: z.number().nonnegative().optional(),
    maxValue: z.number().nonnegative().optional(),
    shippingWeight: z.number().nonnegative().optional(),
    packageType: z.enum(PACKAGE_TYPES as [PackageType, ...PackageType[]]).optional(),
    packageDimensions: packageDimensionsSchema.optional(),
    allowOffers: z.boolean().optional(),
    minOfferAmount: z.number().nonnegative().optional(),
    // Ignored: the server always uses the authenticated user as seller
    sellerId: z.string().optional(),
  }),
})

const updateProductSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    images: z.array(z.string()).min(1).optional(),
    video: z.string().optional(),
    category: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Category ID format')
      .optional(),
    condition: z
      .enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'])
      .optional(),
    estValue: z.number().nonnegative().optional(),
    startingBid: z.number().nonnegative().optional(),
    reservePrice: z.number().nonnegative().optional(),
    buyNowPrice: z.number().nonnegative().optional(),
    allowTrade: z.boolean().optional(),
    isTradeOnly: z.boolean().optional(),
    isGiveaway: z.boolean().optional(),
    lookingFor: z.string().optional(),
    targetCategory: z.string().optional(),
    minValue: z.number().nonnegative().optional(),
    maxValue: z.number().nonnegative().optional(),
    shippingWeight: z.number().nonnegative().optional(),
    packageType: z.enum(PACKAGE_TYPES as [PackageType, ...PackageType[]]).optional(),
    packageDimensions: packageDimensionsSchema.optional(),
    allowOffers: z.boolean().optional(),
    minOfferAmount: z.number().nonnegative().optional(),
    status: z.enum(['active', 'sold', 'unsold', 'pending']).optional(),
    stock: z.number().nonnegative().optional(),
    isFeatured: z.boolean().optional(),
  }),
})

export const ProductValidations = {
  createProductSchema,
  updateProductSchema,
}
