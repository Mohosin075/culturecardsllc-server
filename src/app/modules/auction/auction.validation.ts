import { z } from 'zod'

const createLiveStreamSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(3, 'Title must be at least 3 characters long'),
    coverImage: z.string({ required_error: 'Cover image is required' }),
    promoVideo: z.string().optional(),
    description: z.string().optional(),
    scheduledAt: z
      .string()
      .datetime({ message: 'Invalid ISO date-time string' })
      .optional(),
    scheduledStartTime: z.string().optional(),
    status: z.enum(['scheduled', 'live']).optional(),
    inventoryIds: z.array(z.string()).optional(),
    // sellerId is injected from req.user in the controller — not accepted from body
    agoraChannelName: z.string().optional(),
  }),
})

const toggleBookmarkSchema = z.object({
  params: z.object({
    streamId: z
      .string({ required_error: 'Stream ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Stream ID format'),
  }),
})

const createAuctionItemSchema = z.object({
  body: z.object({
    streamId: z
      .string({ required_error: 'Stream ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Stream ID format'),
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
    startingBid: z.number().nonnegative().optional(),
    bidIncrement: z
      .number()
      .positive('Bid increment must be greater than zero')
      .optional(),
    timerDuration: z
      .number()
      .min(5, 'Timer must be at least 5 seconds')
      .optional(),
  }),
})

const placeBidSchema = z.object({
  body: z.object({
    auctionItemId: z
      .string({ required_error: 'Auction Item ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Auction Item ID format'),
    // bidderId is injected from req.user in the controller — not accepted from body
    bidAmount: z
      .number({ required_error: 'Bid amount is required' })
      .positive('Bid amount must be greater than zero'),
  }),
})

const updateLiveStreamStatusSchema = z.object({
  body: z.object({
    status: z.enum(['scheduled', 'live', 'ended'], {
      required_error: 'Status is required',
    }),
  }),
})

const updateStreamInventorySchema = z.object({
  params: z.object({
    streamId: z
      .string({ required_error: 'Stream ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Stream ID format'),
  }),
  body: z.object({
    inventoryIds: z.array(
      z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
      { required_error: 'inventoryIds array is required' },
    ),
  }),
})

const quickStartAuctionSchema = z.object({
  body: z.object({
    streamId: z
      .string({ required_error: 'Stream ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Stream ID format'),
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
    startingBid: z.number().nonnegative().optional(),
    bidIncrement: z
      .number()
      .positive('Bid increment must be greater than zero')
      .optional(),
    timerDuration: z
      .number()
      .min(5, 'Timer must be at least 5 seconds')
      .optional(),
  }),
})

export const AuctionValidations = {
  createLiveStreamSchema,
  toggleBookmarkSchema,
  updateStreamInventorySchema,
  quickStartAuctionSchema,
  createAuctionItemSchema,
  placeBidSchema,
  updateLiveStreamStatusSchema,
}
