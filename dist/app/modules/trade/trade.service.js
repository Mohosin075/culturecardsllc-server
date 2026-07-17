"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const trade_model_1 = require("./trade.model");
const product_model_1 = require("../product/product.model");
const message_model_1 = require("../message/message.model");
const chat_model_1 = require("../chat/chat.model");
const mongoose_1 = require("mongoose");
const server_1 = require("../../../server");
const pushnotificationHelper_1 = require("../../../helpers/pushnotificationHelper");
const user_model_1 = require("../user/user.model");
const config_1 = __importDefault(require("../../../config"));
const stripe_1 = __importDefault(require("../../../config/stripe"));
const createTradeOffer = async (payload) => {
    const { senderProductId, receiverProductId, senderId, receiverId } = payload;
    const senderProduct = await product_model_1.Product.findById(senderProductId);
    const receiverProduct = await product_model_1.Product.findById(receiverProductId);
    if (!senderProduct || !receiverProduct) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'One or both of the products were not found.');
    }
    if (!senderProduct.allowTrade || !receiverProduct.allowTrade) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'One or both items are not configured to allow trading.');
    }
    if (senderProduct.status !== 'active' ||
        receiverProduct.status !== 'active') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'One or both products are not currently active.');
    }
    payload.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    payload.status = 'pending';
    payload.escrowStatus = 'pending';
    const offer = (await trade_model_1.TradeOffer.create(payload));
    // Find existing chat between sender and receiver using participants array
    let chat = await chat_model_1.Chat.findOne({
        participants: { $all: [senderId, receiverId] },
    });
    if (!chat) {
        chat = await chat_model_1.Chat.create({
            participants: [senderId, receiverId],
        });
    }
    if (chat) {
        await message_model_1.Message.create({
            chatId: chat._id,
            sender: senderId,
            text: `Proposed a new trade swap offer: ${senderProduct.title} for ${receiverProduct.title}.`,
            messageType: 'trade_proposal',
            seen: false,
            metadata: {
                tradeOfferId: offer._id.toString(),
                statusLabel: 'NEW TRADE OFFER 🎁',
                eta: '24 Hours Expire',
            },
        });
    }
    return offer;
};
const getTradeOffers = async (userId, type) => {
    const query = {};
    if (type === 'sent') {
        query.senderId = new mongoose_1.Types.ObjectId(userId);
    }
    else {
        query.receiverId = new mongoose_1.Types.ObjectId(userId);
    }
    return await trade_model_1.TradeOffer.find(query)
        .populate('senderId', 'name fullName email image photo')
        .populate('receiverId', 'name fullName email image photo')
        .populate('senderProductId')
        .populate('receiverProductId');
};
const acceptTradeOffer = async (offerId) => {
    if (!mongoose_1.Types.ObjectId.isValid(offerId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Offer ID');
    }
    const offer = (await trade_model_1.TradeOffer.findById(offerId));
    if (!offer) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Trade offer not found');
    }
    if (offer.status !== 'pending') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This offer is no longer pending.');
    }
    const session = await trade_model_1.TradeOffer.startSession();
    session.startTransaction();
    try {
        offer.status = 'accepted';
        offer.escrowStatus = 'held';
        await offer.save({ session });
        await product_model_1.Product.findByIdAndUpdate(offer.senderProductId, { status: 'pending' }, { session });
        await product_model_1.Product.findByIdAndUpdate(offer.receiverProductId, { status: 'pending' }, { session });
        // Use participants[] array — consistent with Chat model schema
        let chat = await chat_model_1.Chat.findOne({
            participants: { $all: [offer.senderId, offer.receiverId] },
        });
        if (!chat) {
            const createdChats = await chat_model_1.Chat.create([{ participants: [offer.senderId, offer.receiverId] }], { session });
            chat = createdChats[0];
        }
        if (chat) {
            await message_model_1.Message.create([
                {
                    chatId: chat._id,
                    sender: offer.receiverId,
                    text: 'Accepted the trade swap offer! Escrow service is now Active & Secured.',
                    messageType: 'trade_proposal',
                    seen: false,
                    metadata: {
                        tradeOfferId: offer._id.toString(),
                        statusLabel: 'TRADE ACCEPTED 🤝',
                    },
                },
            ], { session });
        }
        await session.commitTransaction();
        // Notify sender via socket + push
        if (server_1.io) {
            server_1.io.to(offer.senderId.toString()).emit('trade-accepted', {
                tradeOfferId: offer._id.toString(),
                message: 'Your trade offer was accepted! 🤝',
            });
        }
        const senderUser = await user_model_1.User.findById(offer.senderId).select('deviceToken');
        if (senderUser === null || senderUser === void 0 ? void 0 : senderUser.deviceToken) {
            await (0, pushnotificationHelper_1.sendPushNotification)(senderUser.deviceToken, 'Trade Accepted 🤝', 'Your trade offer was accepted! Escrow is now active.', { type: 'TRADE_ACCEPTED', tradeOfferId: offer._id.toString() }).catch(() => { });
        }
        return offer;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
};
const declineTradeOffer = async (offerId) => {
    if (!mongoose_1.Types.ObjectId.isValid(offerId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Offer ID');
    }
    const offer = (await trade_model_1.TradeOffer.findById(offerId));
    if (!offer) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Trade offer not found');
    }
    if (offer.status !== 'pending') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This offer is no longer pending.');
    }
    offer.status = 'declined';
    await offer.save();
    // Use participants[] array — consistent with Chat model schema
    const chat = await chat_model_1.Chat.findOne({
        participants: { $all: [offer.senderId, offer.receiverId] },
    });
    if (chat) {
        await message_model_1.Message.create({
            chatId: chat._id,
            sender: offer.receiverId,
            text: 'Declined the trade swap offer.',
            messageType: 'trade_proposal',
            seen: false,
            metadata: {
                tradeOfferId: offer._id.toString(),
                statusLabel: 'TRADE DECLINED ❌',
            },
        });
    }
    // Notify sender
    if (server_1.io) {
        server_1.io.to(offer.senderId.toString()).emit('trade-declined', {
            tradeOfferId: offer._id.toString(),
            message: 'Your trade offer was declined ❌',
        });
    }
    const senderUser = await user_model_1.User.findById(offer.senderId).select('deviceToken');
    if (senderUser === null || senderUser === void 0 ? void 0 : senderUser.deviceToken) {
        await (0, pushnotificationHelper_1.sendPushNotification)(senderUser.deviceToken, 'Trade Declined ❌', 'Your trade offer was declined.', { type: 'TRADE_DECLINED', tradeOfferId: offer._id.toString() }).catch(() => { });
    }
    return offer;
};
// ─── Trade Complete: ownership swap + escrow release ───────────────────────
const completeTradeOffer = async (offerId, userId) => {
    if (!mongoose_1.Types.ObjectId.isValid(offerId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Offer ID');
    }
    const offer = (await trade_model_1.TradeOffer.findById(offerId)
        .populate('senderProductId')
        .populate('receiverProductId'));
    if (!offer) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Trade offer not found');
    }
    if (offer.status !== 'accepted') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Only accepted trade offers can be completed.');
    }
    // Authorization: only sender or receiver can complete
    const isSender = offer.senderId.toString() === userId;
    const isReceiver = offer.receiverId.toString() === userId;
    if (!isSender && !isReceiver) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not authorized to complete this trade.');
    }
    // ── Cash supplement: create Stripe checkout if needed ──────────────────
    if (offer.cashSupplement && offer.cashSupplement !== 0) {
        const payerId = offer.cashSupplement > 0 ? offer.senderId : offer.receiverId;
        const payerUser = await user_model_1.User.findById(payerId).select('email');
        if (!(payerUser === null || payerUser === void 0 ? void 0 : payerUser.email)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Payer user email not found');
        }
        const session = await stripe_1.default.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Trade Cash Supplement',
                            description: `Supplement for trading ${offer.senderProductId.title} ↔ ${offer.receiverProductId.title}`,
                        },
                        unit_amount: Math.round(Math.abs(offer.cashSupplement) * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${config_1.default.clientUrl}?trade_complete=true&offerId=${offer._id}`,
            cancel_url: `${config_1.default.clientUrl}/trade/cancel`,
            customer_email: payerUser.email,
            metadata: {
                purchaseType: 'trade_supplement',
                tradeOfferId: offer._id.toString(),
                senderId: offer.senderId.toString(),
                receiverId: offer.receiverId.toString(),
                senderProductId: offer.senderProductId._id.toString(),
                receiverProductId: offer.receiverProductId._id.toString(),
            },
        });
        return { checkoutUrl: session.url };
    }
    // ── No cash supplement: complete immediately ────────────────────────────
    const session = await trade_model_1.TradeOffer.startSession();
    session.startTransaction();
    try {
        // Swap product ownership
        await product_model_1.Product.findByIdAndUpdate(offer.senderProductId._id, { sellerId: offer.receiverId, status: 'active' }, { session });
        await product_model_1.Product.findByIdAndUpdate(offer.receiverProductId._id, { sellerId: offer.senderId, status: 'active' }, { session });
        // Update offer
        offer.status = 'completed';
        offer.escrowStatus = 'released';
        await offer.save({ session });
        // Chat message
        const chat = await chat_model_1.Chat.findOne({
            participants: { $all: [offer.senderId, offer.receiverId] },
        });
        if (chat) {
            await message_model_1.Message.create([
                {
                    chatId: chat._id,
                    sender: userId,
                    text: 'Trade completed! Items have been exchanged. ✅',
                    messageType: 'trade_proposal',
                    seen: false,
                    metadata: {
                        tradeOfferId: offer._id.toString(),
                        statusLabel: 'TRADE COMPLETED ✅',
                    },
                },
            ], { session });
        }
        await session.commitTransaction();
        // Notify both parties
        const notifyIds = [offer.senderId.toString(), offer.receiverId.toString()];
        notifyIds.forEach(uid => {
            if (server_1.io) {
                server_1.io.to(uid).emit('trade-completed', {
                    tradeOfferId: offer._id.toString(),
                    message: 'Trade completed! Ownership transferred. ✅',
                });
            }
        });
        return offer;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
};
exports.TradeServices = {
    createTradeOffer,
    getTradeOffers,
    acceptTradeOffer,
    declineTradeOffer,
    completeTradeOffer,
};
