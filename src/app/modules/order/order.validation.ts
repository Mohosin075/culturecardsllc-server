import { z } from 'zod'

const createOrderSchema = z.object({
  body: z.object({
    // Ignored: buyer = authenticated user, seller = product owner (set server-side)
    buyerId: z.string().optional(),
    sellerId: z.string().optional(),
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
    purchaseType: z
      .enum(['auction_win', 'buy_now', 'trade_swap'])
      .optional()
      .default('buy_now'),
    totalPaid: z.number().nonnegative().optional(),
    amountDetails: z
      .object({
        itemSubtotal: z.number().nonnegative().optional().default(0),
        shipping: z.number().nonnegative().optional().default(0),
        taxes: z.number().nonnegative().optional().default(0),
        processingFee: z.number().nonnegative().optional().default(0),
        charityContribution: z.number().nonnegative().optional().default(0),
        totalPaid: z.number().nonnegative().optional(),
      })
      .optional()
      .default({ itemSubtotal: 0, shipping: 0, taxes: 0, processingFee: 0, charityContribution: 0, totalPaid: 0 }),
    shippingAddress: z
      .object({
        fullName: z.string().optional(),
        phone: z.string().optional(),
        street: z.string({ required_error: 'Street address is required' }),
        city: z.string({ required_error: 'City is required' }),
        state: z.string({ required_error: 'State is required' }),
        postalCode: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional().default('USA'),
      })
      .transform((val) => ({
        ...val,
        postalCode: val.postalCode || val.zipCode || '00000',
      })),
    paymentIntentId: z.string().optional(),
    shippingWeight: z.number().nonnegative().optional(),
    shippingLabelUrl: z.string().optional(),
  }),
})

const updateOrderJourneySchema = z.object({
  body: z.object({
    status: z
      .string({ required_error: 'Status label is required' })
      .min(2, 'Status must be at least 2 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .min(3, 'Description must be at least 3 characters'),
    location: z.string().optional(),
    deliveryStatus: z
      .enum(['pending', 'shipped', 'delivered', 'cancelled'])
      .optional(),
  }),
})

export const OrderValidations = {
  createOrderSchema,
  updateOrderJourneySchema,
}
