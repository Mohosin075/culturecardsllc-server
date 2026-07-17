"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const http_status_codes_1 = require("http-status-codes");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const payment_model_1 = require("./payment.model");
const emailHelper_1 = require("../../../helpers/emailHelper");
const order_model_1 = require("../order/order.model");
const product_model_1 = require("../product/product.model");
const trade_model_1 = require("../trade/trade.model");
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("../message/message.model");
const server_1 = require("../../../server");
const handleCheckoutSessionCompleted = async (sessionData) => {
    var _a;
    try {
        console.log('🔔 Processing Checkout Session Completed:', sessionData.id);
        const sessionWithDetails = await stripe_1.default.checkout.sessions.retrieve(sessionData.id, {
            expand: ['payment_intent', 'line_items'],
        });
        let lookupId;
        if (typeof sessionWithDetails.payment_intent === 'string') {
            lookupId = sessionWithDetails.payment_intent;
        }
        else if ((_a = sessionWithDetails.payment_intent) === null || _a === void 0 ? void 0 : _a.id) {
            lookupId = sessionWithDetails.payment_intent.id;
        }
        else {
            lookupId = sessionWithDetails.id;
        }
        const mongoSession = await payment_model_1.Payment.startSession();
        mongoSession.startTransaction();
        try {
            const payment = await payment_model_1.Payment.findOne({
                $or: [
                    { paymentIntentId: lookupId },
                    { 'metadata.checkoutSessionId': sessionWithDetails.id },
                ],
            }).session(mongoSession);
            if (!payment) {
                throw new Error(`Payment not found for session: ${sessionWithDetails.id}`);
            }
            if (payment.status === 'succeeded') {
                await mongoSession.commitTransaction();
                return;
            }
            payment.status = 'succeeded';
            payment.metadata = { ...payment.metadata, ...sessionWithDetails };
            await payment.save({ session: mongoSession });
            const meta = (sessionWithDetails.metadata || {});
            const purchaseType = meta.purchaseType;
            // ─── BUY NOW: update order paymentStatus + product status ───────────────────
            if (purchaseType === 'buy_now' && meta.orderId) {
                await order_model_1.Order.findByIdAndUpdate(meta.orderId, { paymentStatus: 'paid' }, { session: mongoSession });
                if (meta.productId) {
                    await product_model_1.Product.findByIdAndUpdate(meta.productId, { status: 'sold' }, { session: mongoSession });
                }
            }
            // ─── AUCTION WIN: create order + mark product sold ─────────────────────────
            if (purchaseType === 'auction_win' && meta.productId && meta.winnerId && meta.sellerId) {
                const product = await product_model_1.Product.findById(meta.productId).session(mongoSession);
                if (product) {
                    // Create order
                    const [order] = await order_model_1.Order.create([
                        {
                            buyerId: meta.winnerId,
                            sellerId: meta.sellerId,
                            productId: meta.productId,
                            totalPrice: product.buyNowPrice || 0,
                            purchaseType: 'auction_win',
                            paymentStatus: 'paid',
                            deliveryStatus: 'pending',
                            trackingDetails: { journeyUpdates: [] },
                        },
                    ], { session: mongoSession });
                    // Mark product sold
                    await product_model_1.Product.findByIdAndUpdate(meta.productId, { status: 'sold', stock: 0 }, { session: mongoSession });
                    // Chat message to seller
                    const chat = await chat_model_1.Chat.findOne({
                        participants: { $all: [meta.winnerId, meta.sellerId] },
                    });
                    if (chat) {
                        await message_model_1.Message.create([
                            {
                                chatId: chat._id,
                                sender: meta.winnerId,
                                text: `🏆 Auction Won! Payment complete. Order #${order._id.toString().substring(0, 8).toUpperCase()} created.`,
                                messageType: 'order_update',
                                seen: false,
                                metadata: { orderId: order._id.toString(), statusLabel: 'AUCTION WON 🏆' },
                            },
                        ], { session: mongoSession });
                    }
                    // Socket notify seller
                    if (server_1.io) {
                        server_1.io.to(meta.sellerId).emit('auction-payment-received', {
                            orderId: order._id.toString(),
                            productId: meta.productId,
                            message: 'Auction payment received! Order created.',
                        });
                    }
                }
            }
            // ─── TRADE SUPPLEMENT: complete trade ownership swap ─────────────────────
            if (purchaseType === 'trade_supplement' && meta.tradeOfferId) {
                const tradeOffer = await trade_model_1.TradeOffer.findById(meta.tradeOfferId).session(mongoSession);
                if (tradeOffer && tradeOffer.status === 'accepted') {
                    // Swap ownership
                    await product_model_1.Product.findByIdAndUpdate(meta.senderProductId, { sellerId: meta.receiverId, status: 'active' }, { session: mongoSession });
                    await product_model_1.Product.findByIdAndUpdate(meta.receiverProductId, { sellerId: meta.senderId, status: 'active' }, { session: mongoSession });
                    tradeOffer.status = 'completed';
                    tradeOffer.escrowStatus = 'released';
                    await tradeOffer.save({ session: mongoSession });
                    // Chat message
                    const chat = await chat_model_1.Chat.findOne({
                        participants: { $all: [meta.senderId, meta.receiverId] },
                    });
                    if (chat) {
                        await message_model_1.Message.create([
                            {
                                chatId: chat._id,
                                sender: meta.senderId,
                                text: 'Trade completed! Payment received and items exchanged. ✅',
                                messageType: 'trade_proposal',
                                seen: false,
                                metadata: { tradeOfferId: meta.tradeOfferId, statusLabel: 'TRADE COMPLETED ✅' },
                            },
                        ], { session: mongoSession });
                    }
                    // Notify both parties
                    if (server_1.io) {
                        [meta.senderId, meta.receiverId].forEach(uid => {
                            server_1.io.to(uid).emit('trade-completed', {
                                tradeOfferId: meta.tradeOfferId,
                                message: 'Trade completed! Ownership transferred. ✅',
                            });
                        });
                    }
                }
            }
            // ─── PRODUCT BOOST: update product isFeatured + boostedUntil ───────────────
            if (purchaseType === 'product_boost' && meta.productId) {
                const durationDays = Number(meta.boostDurationDays || '7');
                const boostedUntil = new Date();
                boostedUntil.setDate(boostedUntil.getDate() + durationDays);
                await product_model_1.Product.findByIdAndUpdate(meta.productId, { isFeatured: true, boostedUntil }, { session: mongoSession });
            }
            await mongoSession.commitTransaction();
            console.log(`✅ Payment processed: ${sessionWithDetails.id} [${purchaseType || 'unknown'}]`);
            // Send confirmation email
            await emailHelper_1.emailHelper.sendEmail({
                to: payment.userEmail,
                subject: 'Payment Successful ✅',
                html: `<p>Your payment was processed successfully. Thank you for using CultureCards!</p>`,
            });
        }
        catch (error) {
            await mongoSession.abortTransaction();
            throw error;
        }
        finally {
            mongoSession.endSession();
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Checkout processing failed: ${errorMessage}`);
    }
};
const handleCheckoutSessionExpired = async (session) => {
    const mongoSession = await payment_model_1.Payment.startSession();
    mongoSession.startTransaction();
    try {
        const payment = await payment_model_1.Payment.findOne({
            $or: [
                { paymentIntentId: session.id },
                { 'metadata.checkoutSessionId': session.id },
            ],
        }).session(mongoSession);
        if (payment) {
            payment.status = 'failed';
            payment.metadata = { ...payment.metadata, ...session, expired: true };
            await payment.save({ session: mongoSession });
        }
        await mongoSession.commitTransaction();
    }
    catch (error) {
        await mongoSession.abortTransaction();
        throw error;
    }
    finally {
        mongoSession.endSession();
    }
};
const handlePaymentSuccess = async (paymentIntent) => {
    const mongoSession = await payment_model_1.Payment.startSession();
    mongoSession.startTransaction();
    try {
        // STRICT LOOKUP: First try paymentIntentId
        let payment = await payment_model_1.Payment.findOne({
            paymentIntentId: paymentIntent.id,
        }).session(mongoSession);
        // FALLBACK LOOKUP: Use bookingId from metadata
        if (!payment) {
            const metadata = paymentIntent.metadata || {};
            const bookingId = metadata.bookingId;
            if (bookingId) {
                payment = await payment_model_1.Payment.findOne({
                    bookingId,
                    status: 'pending',
                })
                    .sort({ createdAt: -1 })
                    .session(mongoSession);
                if (payment) {
                    payment.paymentIntentId = paymentIntent.id;
                }
                else {
                    console.log(`⚠️ No record found for bookingId: ${bookingId} with status: pending`);
                }
            }
            else {
                console.log('❌ No bookingId found in metadata. Cannot perform fallback lookup.');
            }
        }
        if (!payment) {
            await mongoSession.commitTransaction();
            return;
        }
        // Check if already processed
        if (payment.status === 'succeeded') {
            await mongoSession.commitTransaction();
            return;
        }
        // Update payment
        payment.status = 'succeeded';
        // Ensure we don't overwrite crucial metadata if it exists
        payment.metadata = { ...payment.metadata, ...paymentIntent };
        await payment.save({ session: mongoSession });
        // Booking and Wallet logic removed as requested
        await mongoSession.commitTransaction();
        console.log(`Successfully processed payment intent: ${paymentIntent.id}`);
        // Send email
        if (payment.userEmail) {
            await emailHelper_1.emailHelper.sendEmail({
                to: payment.userEmail,
                subject: 'Payment Successful',
                html: `<p>Your payment was successful.</p>`,
            });
        }
    }
    catch (error) {
        await mongoSession.abortTransaction();
        throw error;
    }
    finally {
        mongoSession.endSession();
    }
};
const handlePaymentFailure = async (paymentIntent) => {
    const mongoSession = await payment_model_1.Payment.startSession();
    mongoSession.startTransaction();
    try {
        let payment = await payment_model_1.Payment.findOne({
            paymentIntentId: paymentIntent.id,
        }).session(mongoSession);
        // Fallback for failure too
        if (!payment &&
            paymentIntent.metadata &&
            paymentIntent.metadata.bookingId) {
            payment = await payment_model_1.Payment.findOne({
                bookingId: paymentIntent.metadata.bookingId,
            }).session(mongoSession);
        }
        if (payment) {
            payment.status = 'failed';
            payment.metadata = { ...payment.metadata, ...paymentIntent };
            await payment.save({ session: mongoSession });
        }
        await mongoSession.commitTransaction();
    }
    catch (error) {
        await mongoSession.abortTransaction();
        throw error;
    }
    finally {
        mongoSession.endSession();
    }
};
exports.WebhookService = {
    handleWebhook: async (payload) => {
        try {
            const event = JSON.parse(payload.body.toString());
            console.log(`Processing webhook: ${event.type}`);
            switch (event.type) {
                case 'checkout.session.completed':
                    await handleCheckoutSessionCompleted(event.data.object);
                    break;
                case 'checkout.session.expired':
                    await handleCheckoutSessionExpired(event.data.object);
                    break;
                case 'payment_intent.succeeded':
                    await handlePaymentSuccess(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await handlePaymentFailure(event.data.object);
                    break;
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Webhook processing error:', errorMessage);
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, `Webhook processing failed: ${errorMessage}`);
        }
    },
};
