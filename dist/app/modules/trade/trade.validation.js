"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeValidations = void 0;
const zod_1 = require("zod");
const createTradeOfferSchema = zod_1.z.object({
    body: zod_1.z.object({
        senderId: zod_1.z.string({ required_error: 'Sender ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Sender ID format'),
        receiverId: zod_1.z.string({ required_error: 'Receiver ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Receiver ID format'),
        senderProductId: zod_1.z.string({ required_error: 'Sender Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Sender Product ID format'),
        receiverProductId: zod_1.z.string({ required_error: 'Receiver Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Receiver Product ID format'),
        cashSupplement: zod_1.z.number().nonnegative().optional()
    })
});
exports.TradeValidations = {
    createTradeOfferSchema
};
