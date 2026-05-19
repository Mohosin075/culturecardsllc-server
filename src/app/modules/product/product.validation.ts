import { z } from 'zod';

const createProductSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'Title is required' }).min(3, 'Title must be at least 3 characters long'),
    description: z.string().optional(),
    images: z.array(z.string()).min(1, 'At least one product image is required'),
    video: z.string().optional(),
    category: z.enum([
      'Fine Art',
      'Sports Cards',
      'Rare Spirits',
      'Luxury Cars',
      'Electronics',
      'Streetwear',
      'TCG',
      'Digital Assets'
    ], { required_error: 'Category is required' }),
    condition: z.enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'], { required_error: 'Condition is required' }),
    estValue: z.number({ required_error: 'Estimated value is required' }).nonnegative('Estimated value cannot be negative'),
    startingBid: z.number().nonnegative().optional(),
    reservePrice: z.number().nonnegative().optional(),
    buyNowPrice: z.number().nonnegative().optional(),
    allowTrade: z.boolean().optional(),
    sellerId: z.string({ required_error: 'Seller ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Seller ID format')
  })
});

const updateProductSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    images: z.array(z.string()).min(1).optional(),
    video: z.string().optional(),
    category: z.enum([
      'Fine Art',
      'Sports Cards',
      'Rare Spirits',
      'Luxury Cars',
      'Electronics',
      'Streetwear',
      'TCG',
      'Digital Assets'
    ]).optional(),
    condition: z.enum(['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair']).optional(),
    estValue: z.number().nonnegative().optional(),
    startingBid: z.number().nonnegative().optional(),
    reservePrice: z.number().nonnegative().optional(),
    buyNowPrice: z.number().nonnegative().optional(),
    allowTrade: z.boolean().optional(),
    status: z.enum(['active', 'sold', 'unsold', 'pending']).optional(),
    stock: z.number().nonnegative().optional()
  })
});

export const ProductValidations = {
  createProductSchema,
  updateProductSchema
};
