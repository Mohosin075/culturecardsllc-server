import { z } from 'zod'

/**
 * The client wants this form to stay "super basic": what they intend to sell,
 * plus acceptance of the seller policies. Name and email are already on the
 * account, so they are not asked for again.
 */
const applyAsSellerZodSchema = z.object({
  body: z.object({
    whatTheySell: z
      .string({ required_error: 'Tell us what you intend to sell.' })
      .trim()
      .min(3, 'Please describe what you intend to sell.')
      .max(500, 'Keep this under 500 characters.'),
    categories: z.array(z.string()).optional(),
    businessName: z.string().trim().max(200).optional(),
    acceptSellerPolicy: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the seller policy.' }),
    }),
    acceptTermsAndConditions: z.literal(true, {
      errorMap: () => ({
        message: 'You must accept the terms and conditions.',
      }),
    }),
    acceptMarketplaceRules: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the marketplace rules.' }),
    }),
  }),
})

const reviewApplicationZodSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(1000).optional(),
  }),
})

export const SellerValidations = {
  applyAsSellerZodSchema,
  reviewApplicationZodSchema,
}
