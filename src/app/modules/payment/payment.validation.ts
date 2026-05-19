import { z } from 'zod'

export const PaymentValidations = {
  create: z.object({
    body: z.object({
      bookingId: z.string({
        required_error: 'Booking ID is required',
      }),
      amount: z.number().min(1, 'Amount must be at least 1').optional(),
      currency: z.string().default('EUR'),
      productName: z.string().optional(),
      description: z.string().optional(),
      paymentMethodId: z.string().optional(),
    }),
  }),

  update: z.object({
    body: z
      .object({
        status: z.enum(['succeeded', 'failed', 'refunded']).optional(),
        refundAmount: z.number().min(0).optional(),
        refundReason: z.string().optional(),
      })
      .strict(),
  }),

  webhook: z.object({
    body: z.object({
      type: z.string(),
      data: z.object({
        object: z.object({
          id: z.string(),
          status: z.string(),
          amount: z.number(),
          currency: z.string(),
          metadata: z.any().optional(),
        }),
      }),
    }),
  }),
}
