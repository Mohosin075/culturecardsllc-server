import { z } from 'zod'

export const createReviewSchema = z.object({
  body: z.object({
    orderId: z.string().optional(),
    tradeOfferId: z.string().optional(),
    reviewee: z.string({
      required_error: 'Reviewee is required',
    }),
    rating: z.number().min(1).max(5),
    review: z.string(),
  }),
})

export const updateReviewSchema = z.object({
  body: z.object({
    reviewee: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    review: z.string().optional(),
  }),
})

