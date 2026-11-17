import { z } from 'zod'

const createTipIntentZodSchema = z.object({
  body: z.object({
    streamId: z.string({ required_error: 'streamId is required' }),
    amount: z.number({ required_error: 'amount is required' }).min(1, 'Minimum tip amount is $1'),
    paymentMethodId: z.string().optional(),
    message: z.string().max(200, 'Message cannot exceed 200 characters').optional(),
  }),
})

const confirmTipZodSchema = z.object({
  body: z.object({
    streamId: z.string({ required_error: 'streamId is required' }),
    paymentIntentId: z.string({ required_error: 'paymentIntentId is required' }),
    amount: z.number().min(1),
    message: z.string().max(200, 'Message cannot exceed 200 characters').optional(),
  }),
})

export const TipValidation = {
  createTipIntentZodSchema,
  confirmTipZodSchema,
}
