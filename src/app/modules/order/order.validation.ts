import { z } from 'zod'

const createOrderSchema = z.object({
  body: z.object({
    buyerId: z
      .string({ required_error: 'Buyer ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Buyer ID format'),
    sellerId: z
      .string({ required_error: 'Seller ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Seller ID format'),
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
    purchaseType: z.enum(['auction_win', 'buy_now', 'trade_swap'], {
      required_error: 'Purchase type is required',
    }),
    amountDetails: z.object(
      {
        itemSubtotal: z
          .number({ required_error: 'Subtotal is required' })
          .nonnegative(),
        shipping: z.number().nonnegative().optional().default(0),
        taxes: z.number().nonnegative().optional().default(0),
        processingFee: z.number().nonnegative().optional().default(0),
        charityContribution: z.number().nonnegative().optional().default(0),
        totalPaid: z
          .number({ required_error: 'Total paid amount is required' })
          .nonnegative(),
      },
      { required_error: 'Amount details are required' },
    ),
    shippingAddress: z.object(
      {
        street: z.string({ required_error: 'Street address is required' }),
        city: z.string({ required_error: 'City is required' }),
        state: z.string({ required_error: 'State is required' }),
        postalCode: z.string({ required_error: 'Postal code is required' }),
        country: z.string({ required_error: 'Country is required' }),
      },
      { required_error: 'Shipping address is required' },
    ),
    paymentIntentId: z.string().optional(),
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
