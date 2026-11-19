import { z } from 'zod'

const createRefundRequestZodSchema = z.object({
  body: z.object({
    orderId: z.string({ required_error: 'orderId is required.' }),
    reason: z.enum([
      'item_not_received',
      'not_as_described',
      'damaged',
      'wrong_item',
      'other',
    ]),
    details: z.string().trim().max(2000).optional(),
    evidenceUrls: z.array(z.string()).max(10).optional(),
    /** Omit for a full refund of the order total. */
    requestedAmount: z.number().positive().optional(),
  }),
})

const reviewRefundRequestZodSchema = z.object({
  body: z.object({
    /** Lets an admin approve less than the buyer asked for. */
    amount: z.number().positive().optional(),
    note: z.string().trim().max(1000).optional(),
  }),
})

export const RefundValidations = {
  createRefundRequestZodSchema,
  reviewRefundRequestZodSchema,
}
