"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTradeExpiryCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const trade_model_1 = require("../app/modules/trade/trade.model");
const product_model_1 = require("../app/modules/product/product.model");
const chat_model_1 = require("../app/modules/chat/chat.model");
const message_model_1 = require("../app/modules/message/message.model");
const server_1 = require("../server");
/**
 * Trade Expiry Cron Job
 * Runs every hour. Finds all pending trade offers past their expiresAt
 * and marks them as 'expired', restoring product statuses if needed.
 */
const startTradeExpiryCron = () => {
    node_cron_1.default.schedule('0 * * * *', async () => {
        console.log('[TradeExpiryCron] Running trade expiry check...');
        try {
            const expiredOffers = await trade_model_1.TradeOffer.find({
                status: 'pending',
                expiresAt: { $lte: new Date() },
            });
            if (expiredOffers.length === 0) {
                console.log('[TradeExpiryCron] No expired offers found.');
                return;
            }
            console.log(`[TradeExpiryCron] Found ${expiredOffers.length} expired offer(s).`);
            for (const offer of expiredOffers) {
                try {
                    // Mark offer expired
                    offer.status = 'expired';
                    await offer.save();
                    // Restore product statuses if they were somehow locked
                    await product_model_1.Product.updateMany({
                        _id: { $in: [offer.senderProductId, offer.receiverProductId] },
                        status: 'pending', // only restore if still pending (not sold/completed)
                    }, { status: 'active' });
                    // Chat notification
                    const chat = await chat_model_1.Chat.findOne({
                        participants: { $all: [offer.senderId, offer.receiverId] },
                    });
                    if (chat) {
                        await message_model_1.Message.create({
                            chatId: chat._id,
                            sender: offer.senderId,
                            text: 'Your trade offer has expired after 24 hours. ⏰',
                            messageType: 'trade_proposal',
                            seen: false,
                            metadata: {
                                tradeOfferId: offer._id.toString(),
                                statusLabel: 'TRADE EXPIRED ⏰',
                            },
                        });
                    }
                    // Socket notify both parties
                    if (server_1.io) {
                        [offer.senderId.toString(), offer.receiverId.toString()].forEach(uid => {
                            server_1.io.to(uid).emit('trade-expired', {
                                tradeOfferId: offer._id.toString(),
                                message: 'A trade offer has expired ⏰',
                            });
                        });
                    }
                }
                catch (innerErr) {
                    console.error(`[TradeExpiryCron] Failed to expire offer ${offer._id}:`, innerErr);
                }
            }
            console.log(`[TradeExpiryCron] Successfully expired ${expiredOffers.length} offer(s).`);
        }
        catch (err) {
            console.error('[TradeExpiryCron] Error during expiry check:', err);
        }
    });
    console.log('[TradeExpiryCron] Trade expiry cron job scheduled (every hour).');
};
exports.startTradeExpiryCron = startTradeExpiryCron;
