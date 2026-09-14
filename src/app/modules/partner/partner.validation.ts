import { z } from 'zod'

const createPartnerZodSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Partner name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name cannot exceed 60 characters')
      .trim(),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address format')
      .toLowerCase()
      .trim(),
    promoCode: z
      .string({ required_error: 'Promo code is required' })
      .min(2, 'Promo code must be at least 2 characters')
      .max(20, 'Promo code cannot exceed 20 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Promo code must only contain letters, numbers, hyphens, and underscores')
      .transform(val => val.toUpperCase().trim()),
    revenueSharePercentage: z
      .number()
      .min(1, 'Revenue share must be at least 1%')
      .max(100, 'Revenue share cannot exceed 100%')
      .optional()
      .default(50),
  }),
})

const updateBankDetailsZodSchema = z.object({
  body: z.object({
    accountNumber: z
      .string({ required_error: 'Account number is required' })
      .min(4, 'Account number must be at least 4 digits')
      .max(34, 'Account number cannot exceed 34 characters')
      .trim(),
    routingNumber: z
      .string()
      .regex(/^\d{9}$/, 'US Routing number must be exactly 9 digits')
      .optional()
      .or(z.literal('')),
    bankName: z.string().max(100).optional(),
    accountHolderName: z.string().max(100).optional(),
  }),
})

export const PartnerValidations = {
  createPartnerZodSchema,
  updateBankDetailsZodSchema,
}
