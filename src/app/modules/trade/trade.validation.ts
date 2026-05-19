import { z } from 'zod';

const createTradeOfferSchema = z.object({
  body: z.object({
    senderId: z.string({ required_error: 'Sender ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Sender ID format'),
    receiverId: z.string({ required_error: 'Receiver ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Receiver ID format'),
    senderProductId: z.string({ required_error: 'Sender Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Sender Product ID format'),
    receiverProductId: z.string({ required_error: 'Receiver Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Receiver Product ID format'),
    cashSupplement: z.number().nonnegative().optional()
  })
});

export const TradeValidations = {
  createTradeOfferSchema
};
