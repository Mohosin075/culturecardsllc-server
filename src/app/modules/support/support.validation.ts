import { z } from 'zod'
import { SUPPORT_STATUS } from '../../../enum/support'

export const createSupportSchema = z.object({
  body: z.object({
    userId: z.string().optional(),
    subject: z.string().optional(),
    message: z.string(),
    status: z
      .enum([
        SUPPORT_STATUS.PENDING,
        SUPPORT_STATUS.UNDER_REVIEW,
        SUPPORT_STATUS.SOLVED,
        SUPPORT_STATUS.DISMISSED,
        SUPPORT_STATUS.DELETED,
      ])
      .optional(),
    attachments: z.array(z.string()).optional(),
    contentType: z.enum(['comment', 'review']),
    reason: z.enum(['harassment', 'spam', 'fraud', 'other']).optional(),
  }),
})

export const updateSupportSchema = z.object({
  body: z.object({
    subject: z.string().optional(),
    message: z.string().optional(),
    status: z
      .enum([
        SUPPORT_STATUS.PENDING,
        SUPPORT_STATUS.UNDER_REVIEW,
        SUPPORT_STATUS.SOLVED,
        SUPPORT_STATUS.DISMISSED,
        SUPPORT_STATUS.DELETED,
      ])
      .optional(),
    attachments: z.array(z.string()).optional(),
  }),
})
