"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const auction_model_1 = require("./auction.model");
const agora_access_token_1 = require("agora-access-token");
const config_1 = __importDefault(require("../../../config"));
const mongoose_1 = require("mongoose");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const product_model_1 = require("../product/product.model");
const user_model_1 = require("../user/user.model");
const server_1 = require("../../../server");
const order_model_1 = require("../order/order.model");
const shippingHelper_1 = require("../../../helpers/shippingHelper");
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("../message/message.model");
const notification_integration_1 = require("../notification/notification.integration");
const notification_service_1 = require("../notification/notification.service");
const notification_interface_1 = require("../notification/notification.interface");
const payment_model_1 = require("../payment/payment.model");
const generateAgoraToken = async (channelName, uid = 0, role = 'subscriber') => {
    const appId = config_1.default.agora.app_id;
    const appCertificate = config_1.default.agora.app_certificate;
    if (!appId || !appCertificate) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Agora configuration (App ID or App Certificate) is missing from system configuration.');
    }
    const agoraRole = role === 'publisher' ? agora_access_token_1.RtcRole.PUBLISHER : agora_access_token_1.RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600 * 2; // 2 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    const token = agora_access_token_1.RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, agoraRole, privilegeExpiredTs);
    return {
        token,
        appId,
        channelName,
        uid,
    };
};
const createLiveStream = async (payload) => {
    const seller = await user_model_1.User.findById(payload.sellerId);
    if (!seller) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Seller not found');
    }
    if (!seller.sellerVerified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your seller account is not verified yet. Please wait for admin approval.');
    }
    if (!payload.agoraChannelName) {
        payload.agoraChannelName = `channel_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    return await auction_model_1.LiveStream.create(payload);
};
const getLiveStreams = async (status) => {
    const query = {};
    if (status)
        query.status = status;
    return await auction_model_1.LiveStream.find(query)
        .populate('sellerId', 'name fullName email image photo')
        .populate('pinnedProductId');
};
const createAuctionItem = async (payload) => {
    const { startingBid, ...rest } = payload;
    const duration = rest.timerDuration || 60;
    const endsAt = rest.endsAt || new Date(Date.now() + duration * 1000);
    const auction = await auction_model_1.AuctionItem.create({
        ...rest,
        currentBid: startingBid !== null && startingBid !== void 0 ? startingBid : 0,
        status: 'active',
        endsAt,
    });
    return auction;
};
const placeBidSecure = async (auctionItemId, bidderId, bidAmount) => {
    if (!mongoose_1.Types.ObjectId.isValid(auctionItemId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID');
    }
    // ── DEBUG: Fetch current state before the atomic update ──────
    const currentState = await auction_model_1.AuctionItem.findById(auctionItemId).select('status currentBid highestBidderId endsAt');
    console.log(`\n[BID-DEBUG] ──────────────────────────────────────`);
    console.log(`[BID-DEBUG] auctionItemId : ${auctionItemId}`);
    console.log(`[BID-DEBUG] bidderId      : ${bidderId}`);
    console.log(`[BID-DEBUG] bidAmount     : ${bidAmount}`);
    if (!currentState) {
        console.log(`[BID-DEBUG] RESULT: ITEM NOT FOUND IN DB`);
    }
    else {
        console.log(`[BID-DEBUG] DB status     : ${currentState.status}`);
        console.log(`[BID-DEBUG] DB currentBid : ${currentState.currentBid}`);
        console.log(`[BID-DEBUG] DB endsAt     : ${currentState.endsAt}`);
        const statusOk = currentState.status === 'active';
        const bidOk = bidAmount > currentState.currentBid || currentState.currentBid === 0;
        console.log(`[BID-DEBUG] status=active?: ${statusOk}  |  bid>currentBid?: ${bidOk}`);
        if (!statusOk)
            console.log(`[BID-DEBUG] ❌ FAIL REASON: status is "${currentState.status}", expected "active"`);
        if (!bidOk)
            console.log(`[BID-DEBUG] ❌ FAIL REASON: bidAmount (${bidAmount}) is NOT greater than currentBid (${currentState.currentBid})`);
        if (statusOk && bidOk)
            console.log(`[BID-DEBUG] ✅ Should PASS atomic update`);
    }
    console.log(`[BID-DEBUG] ──────────────────────────────────────\n`);
    // ── END DEBUG ────────────────────────────────────────────────
    // 1. Atomically find and update ONLY if the new bid is higher than the current bid
    // This uses a concurrency-safe atomic query lock to protect against over-bidding race conditions.
    const updatedAuction = await auction_model_1.AuctionItem.findOneAndUpdate({
        _id: new mongoose_1.Types.ObjectId(auctionItemId),
        status: 'active',
        $or: [{ currentBid: { $lt: bidAmount } }, { currentBid: 0 }],
    }, {
        $set: {
            currentBid: bidAmount,
            highestBidderId: new mongoose_1.Types.ObjectId(bidderId),
        },
    }, { new: true }).populate('productId');
    if (!updatedAuction) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Bid rejected: Someone placed a higher or equal bid first.');
    }
    // 2. Anti-Sniping Check: If bid placed within last 10 seconds, extend endsAt by 15 seconds
    const tenSecondsFromNow = new Date(Date.now() + 10000);
    if (updatedAuction.endsAt && updatedAuction.endsAt < tenSecondsFromNow) {
        const extendedTime = new Date(updatedAuction.endsAt.getTime() + 15000);
        await auction_model_1.AuctionItem.findByIdAndUpdate(auctionItemId, {
            $set: { endsAt: extendedTime },
        });
        updatedAuction.endsAt = extendedTime;
    }
    // 3. Broadcast new-bid event to all stream room viewers
    if (server_1.io && updatedAuction.streamId) {
        const bidderInfo = await user_model_1.User.findById(bidderId).select('name fullName email image photo');
        server_1.io.to(`stream:${updatedAuction.streamId.toString()}`).emit('new-bid', {
            streamId: updatedAuction.streamId.toString(),
            auctionItemId: updatedAuction._id,
            currentBid: updatedAuction.currentBid,
            highestBidder: bidderInfo,
            endsAt: updatedAuction.endsAt,
        });
    }
    return updatedAuction;
};
// Get active auction items for a live stream
const getAuctionItemsByStream = async (streamId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    return await auction_model_1.AuctionItem.find({ streamId: new mongoose_1.Types.ObjectId(streamId) })
        .populate('productId')
        .sort({ createdAt: -1 });
};
const updateLiveStreamStatus = async (streamId, userId, userRole, status) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    // Authorize: Only the seller who owns the stream, or an admin/super_admin can update status
    if (userRole !== 'admin' &&
        userRole !== 'super_admin' &&
        stream.sellerId.toString() !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only the stream host or administrators can change the stream status.');
    }
    stream.status = status;
    await stream.save();
    if (status === 'live') {
        notification_integration_1.NotificationIntegration.onLiveStreamGoLive(stream.sellerId.toString(), streamId, stream.title).catch(err => console.error('Failed to send go-live notification to followers:', err));
    }
    return stream;
};
// ── Complete auction + trigger winner Stripe checkout ────────────────────────────
const completeAuction = async (auctionItemId, requestingUserId) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!mongoose_1.Types.ObjectId.isValid(auctionItemId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID');
    }
    const auctionItem = (await auction_model_1.AuctionItem.findById(auctionItemId)
        .populate('productId')
        .populate('streamId'));
    if (!auctionItem) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Auction item not found');
    }
    if (auctionItem.status !== 'active') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Auction cannot be completed. Current status: ${auctionItem.status}`);
    }
    if (!auctionItem.highestBidderId) {
        // No bids placed: mark as failed
        auctionItem.status = 'failed';
        await auctionItem.save();
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Auction ended with no bids. Status set to failed.');
    }
    // Check reservePrice
    const product = auctionItem.productId;
    if (product.reservePrice && auctionItem.currentBid < product.reservePrice) {
        auctionItem.status = 'failed';
        await auctionItem.save();
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Reserve price not met (current: $${auctionItem.currentBid}, reserve: $${product.reservePrice}). Auction failed.`);
    }
    // Authorize: only the stream seller or admin can complete
    const stream = auctionItem.streamId;
    if (stream &&
        stream.sellerId.toString() !== requestingUserId &&
        requestingUserId !== 'admin') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the auction host can complete this auction.');
    }
    // Get winner info
    const winner = await user_model_1.User.findById(auctionItem.highestBidderId);
    if (!winner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Winner profile not found');
    }
    let isAutoPaid = false;
    let paymentIntentId;
    // 1. Try automatic off-session charge if the winner has saved card details on Stripe
    if (winner.stripeCustomerId) {
        try {
            const paymentMethods = await stripe_1.default.paymentMethods.list({
                customer: winner.stripeCustomerId,
                type: 'card',
            });
            if (paymentMethods.data.length > 0) {
                const paymentMethodId = paymentMethods.data[0].id;
                const paymentIntent = await stripe_1.default.paymentIntents.create({
                    amount: Math.round(auctionItem.currentBid * 100),
                    currency: 'usd',
                    customer: winner.stripeCustomerId,
                    payment_method: paymentMethodId,
                    off_session: true,
                    confirm: true,
                    metadata: {
                        purchaseType: 'auction_win',
                        productId: product._id.toString(),
                        sellerId: ((_a = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                        winnerId: auctionItem.highestBidderId.toString(),
                        auctionItemId: auctionItemId,
                    },
                });
                if (paymentIntent.status === 'succeeded') {
                    isAutoPaid = true;
                    paymentIntentId = paymentIntent.id;
                    console.log(`[AUTO-PAY] Instant card charge succeeded for Auction:${auctionItemId}`);
                }
            }
        }
        catch (autoPayError) {
            console.error('[AUTO-PAY] Automatic charge failed. Falling back to checkout session:', autoPayError);
        }
    }
    // 2. If charged successfully, create the paid Order immediately
    if (isAutoPaid) {
        const shippingAddress = {
            street: ((_b = winner.address) === null || _b === void 0 ? void 0 : _b.presentAddress) || '123 Collectors St',
            city: ((_c = winner.address) === null || _c === void 0 ? void 0 : _c.city) || 'Collector City',
            state: 'AP',
            postalCode: ((_d = winner.address) === null || _d === void 0 ? void 0 : _d.postalCode) || '10001',
            country: ((_e = winner.address) === null || _e === void 0 ? void 0 : _e.country) || 'US',
        };
        const orderPayload = {
            buyerId: auctionItem.highestBidderId,
            sellerId: stream === null || stream === void 0 ? void 0 : stream.sellerId,
            productId: product._id,
            purchaseType: 'auction_win',
            paymentStatus: 'paid',
            deliveryStatus: 'pending',
            shippingAddress,
            paymentIntentId,
            amountDetails: {
                itemSubtotal: auctionItem.currentBid,
                shipping: 0,
                taxes: 0,
                processingFee: 0,
                charityContribution: 0,
                totalPaid: auctionItem.currentBid,
            },
        };
        // Initialize shipping weight, rate, tracking, and label PDF on disk (supports bundling)
        const existingOrder = await order_model_1.Order.findOne({
            buyerId: auctionItem.highestBidderId,
            sellerId: stream === null || stream === void 0 ? void 0 : stream.sellerId,
            deliveryStatus: 'pending',
            purchaseType: 'auction_win',
            createdAt: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }
        });
        if (existingOrder) {
            orderPayload.trackingDetails = {
                carrier: existingOrder.trackingDetails.carrier,
                trackingNumber: existingOrder.trackingDetails.trackingNumber,
                estimatedDelivery: existingOrder.trackingDetails.estimatedDelivery,
                journeyUpdates: []
            };
            orderPayload.shippingLabelUrl = existingOrder.shippingLabelUrl;
            orderPayload.shippingWeight = 0;
            orderPayload.amountDetails.shipping = 0;
        }
        else {
            await (0, shippingHelper_1.initializeOrderShipping)(orderPayload, product);
        }
        const [order] = await order_model_1.Order.create([orderPayload]);
        // Mark product sold
        await product_model_1.Product.findByIdAndUpdate(product._id, { status: 'sold', stock: 0 });
        // Mark auction completed
        auctionItem.status = 'completed';
        await auctionItem.save();
        // 1. Create order update message in chat
        try {
            const chat = await chat_model_1.Chat.findOne({
                participants: { $all: [auctionItem.highestBidderId.toString(), stream.sellerId.toString()] },
            });
            if (chat) {
                await message_model_1.Message.create({
                    chatId: chat._id,
                    sender: auctionItem.highestBidderId,
                    text: `🏆 Auction Won! Payment complete. Order #${order._id.toString().substring(0, 8).toUpperCase()} created.`,
                    messageType: 'order_update',
                    seen: false,
                    metadata: { orderId: order._id.toString(), statusLabel: 'AUCTION WON 🏆' },
                });
            }
        }
        catch (chatError) {
            console.error('Failed to create auction win chat message:', chatError);
        }
        // 2. Notify seller via socket
        if (server_1.io && (stream === null || stream === void 0 ? void 0 : stream.sellerId)) {
            server_1.io.to(stream.sellerId.toString()).emit('auction-payment-received', {
                orderId: order._id.toString(),
                productId: product._id.toString(),
                message: 'Auction payment received! Order created.',
            });
        }
        // 3. Notify winner via socket
        if (server_1.io) {
            server_1.io.to(auctionItem.highestBidderId.toString()).emit('auction-won', {
                auctionItemId,
                productTitle: product.title,
                winningBid: auctionItem.currentBid,
                isAutoPaid: true,
                message: `🏆 Congratulations! You won the auction for ${product.title}. Payment of $${auctionItem.currentBid} was charged automatically!`,
            });
        }
        // 4. Send Push Notification to winner
        notification_integration_1.NotificationIntegration.onAuctionWon(auctionItem.highestBidderId, (stream === null || stream === void 0 ? void 0 : stream.sellerId) || '', product.title, auctionItem.currentBid, auctionItemId).catch(err => console.error('Failed to send auction won push notification:', err));
        return { checkoutUrl: '', auctionItem };
    }
    // 3. Fallback: Create Stripe checkout session for manual payment
    await product_model_1.Product.findByIdAndUpdate(product._id, { status: 'pending' });
    auctionItem.status = 'completed';
    await auctionItem.save();
    if (!winner.email) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Winner email not found');
    }
    const stripeSession = await stripe_1.default.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Auction Win: ${product.title}`,
                        description: `You won the auction! Highest bid: $${auctionItem.currentBid}`,
                    },
                    unit_amount: Math.round(auctionItem.currentBid * 100),
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${config_1.default.clientUrl}?auction_won=true&auctionItemId=${auctionItemId}`,
        cancel_url: `${config_1.default.clientUrl}/auction/cancel`,
        customer_email: winner.email,
        metadata: {
            purchaseType: 'auction_win',
            productId: product._id.toString(),
            sellerId: ((_f = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _f === void 0 ? void 0 : _f.toString()) || '',
            winnerId: auctionItem.highestBidderId.toString(),
            auctionItemId: auctionItemId,
        },
    });
    // Create Payment record for tracking & webhook safety
    await payment_model_1.Payment.create({
        userId: auctionItem.highestBidderId,
        userEmail: winner.email,
        amount: auctionItem.currentBid,
        currency: 'usd',
        paymentMethod: 'stripe',
        paymentIntentId: stripeSession.id,
        status: 'pending',
        metadata: {
            purchaseType: 'auction_win',
            productId: product._id.toString(),
            sellerId: ((_g = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _g === void 0 ? void 0 : _g.toString()) || '',
            winnerId: auctionItem.highestBidderId.toString(),
            auctionItemId: auctionItemId,
            checkoutSessionId: stripeSession.id,
        },
    });
    // Notify winner via socket
    if (server_1.io) {
        server_1.io.to(auctionItem.highestBidderId.toString()).emit('auction-won', {
            auctionItemId,
            productTitle: product.title,
            winningBid: auctionItem.currentBid,
            checkoutUrl: stripeSession.url,
            message: `🏆 You won the auction for ${product.title}! Please complete your payment.`,
        });
    }
    // Send Push Notification to winner for manual checkout
    notification_service_1.NotificationServices.createNotification({
        userId: auctionItem.highestBidderId.toString(),
        title: 'Auction Won! 🏆',
        content: `Congratulations! You won the auction for "${product.title}" for $${auctionItem.currentBid}. Please complete your payment.`,
        type: notification_interface_1.NotificationType.AUCTION_WON,
        channel: notification_interface_1.NotificationChannel.PUSH,
        priority: notification_interface_1.NotificationPriority.HIGH,
        metadata: {
            sellerId: ((_h = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _h === void 0 ? void 0 : _h.toString()) || '',
            auctionItemId,
            bidAmount: auctionItem.currentBid.toString(),
        },
        actionUrl: stripeSession.url || undefined,
        actionText: 'Pay Now',
    }).catch(err => console.error('Failed to create manual payment auction won notification:', err));
    return { checkoutUrl: stripeSession.url, auctionItem };
};
exports.AuctionServices = {
    generateAgoraToken,
    createLiveStream,
    getLiveStreams,
    createAuctionItem,
    getAuctionItemsByStream,
    placeBidSecure,
    updateLiveStreamStatus,
    completeAuction,
};
