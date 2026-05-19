"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionValidations = void 0;
const zod_1 = require("zod");
const createLiveStreamSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({ required_error: 'Title is required' }).min(3, 'Title must be at least 3 characters long'),
        description: zod_1.z.string().optional(),
        scheduledAt: zod_1.z.string().datetime({ message: 'Invalid ISO date-time string' }).optional(),
        sellerId: zod_1.z.string({ required_error: 'Seller ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Seller ID format'),
        agoraChannelName: zod_1.z.string().optional()
    })
});
const createAuctionItemSchema = zod_1.z.object({
    body: zod_1.z.object({
        streamId: zod_1.z.string({ required_error: 'Stream ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Stream ID format'),
        productId: zod_1.z.string({ required_error: 'Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID format'),
        startingBid: zod_1.z.number().nonnegative().optional(),
        bidIncrement: zod_1.z.number().positive('Bid increment must be greater than zero').optional(),
        timerDuration: zod_1.z.number().min(5, 'Timer must be at least 5 seconds').optional()
    })
});
const placeBidSchema = zod_1.z.object({
    body: zod_1.z.object({
        auctionItemId: zod_1.z.string({ required_error: 'Auction Item ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Auction Item ID format'),
        bidderId: zod_1.z.string({ required_error: 'Bidder ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Bidder ID format'),
        bidAmount: zod_1.z.number({ required_error: 'Bid amount is required' }).positive('Bid amount must be greater than zero')
    })
});
exports.AuctionValidations = {
    createLiveStreamSchema,
    createAuctionItemSchema,
    placeBidSchema
};
