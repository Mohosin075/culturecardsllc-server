import { z } from 'zod'

const createLiveStreamSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(3, 'Title must be at least 3 characters long'),
    description: z.string().optional(),
    scheduledAt: z
      .string()
      .datetime({ message: 'Invalid ISO date-time string' })
      .optional(),
    sellerId: z
      .string({ required_error: 'Seller ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Seller ID format'),
    agoraChannelName: z.string().optional(),
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
    bidderId: z
      .string({ required_error: 'Bidder ID is required' })
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Bidder ID format'),
    bidAmount: z
      .number({ required_error: 'Bid amount is required' })
      .positive('Bid amount must be greater than zero'),
  }),
})

export const AuctionValidations = {
  createLiveStreamSchema,
  createAuctionItemSchema,
  placeBidSchema,
}
