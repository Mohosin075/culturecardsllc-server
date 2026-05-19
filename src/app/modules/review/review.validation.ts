import { z } from 'zod'

export const createReviewSchema = z.object({
  body: z.object({
    bookingId: z.string(),
    reviewee: z.string().optional(),
    rating: z.number(),
    review: z.string(),
  }),
})

export const updateReviewSchema = z.object({
  body: z.object({
    reviewee: z.string().optional(),
    rating: z.number().optional(),
    review: z.string().optional(),
  }),
})
