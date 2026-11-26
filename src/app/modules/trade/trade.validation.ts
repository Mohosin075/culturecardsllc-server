import { z } from 'zod'

const objectId = (label: string) =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label} format`)

const createTradeOfferSchema = z.object({
  body: z
    .object({
      // senderId is injected from req.user in controller — not accepted from body
      receiverId: objectId('Receiver ID'),
      // Several items per side (client #11). The single-item fields are what
      // older app builds send; either form is accepted.
      senderProductIds: z.array(objectId('Sender Product ID')).max(10).optional(),
      receiverProductIds: z.array(objectId('Receiver Product ID')).max(10).optional(),
      senderProductId: objectId('Sender Product ID').optional(),
      receiverProductId: objectId('Receiver Product ID').optional(),
      cashSupplement: z.number().optional(),
    })
    .refine(b => !!b.receiverProductId || !!b.receiverProductIds?.length, {
      message: 'Receiver Product ID is required',
      path: ['receiverProductId'],
    }),
})

const party = z.enum(['sender', 'receiver'])

const adminReceiveSchema = z.object({
  body: z.object({ party }),
})

const adminAuthenticateSchema = z.object({
  body: z.object({
    party,
    passed: z.boolean(),
    note: z.string().max(500).optional(),
  }),
})

const adminCancelSchema = z.object({
  body: z.object({
    faultParty: z.enum(['sender', 'receiver', 'both']).optional(),
    reason: z.string().min(3).max(300),
    dryRun: z.boolean().optional(),
  }),
})

export const TradeValidations = {
  createTradeOfferSchema,
  adminReceiveSchema,
  adminAuthenticateSchema,
  adminCancelSchema,
}
