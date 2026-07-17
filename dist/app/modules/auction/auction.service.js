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
    const auction = await auction_model_1.AuctionItem.create(payload);
    return auction;
};
const placeBidSecure = async (auctionItemId, bidderId, bidAmount) => {
    if (!mongoose_1.Types.ObjectId.isValid(auctionItemId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID');
    }
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
    return updatedAuction;
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
    return stream;
};
// ── Complete auction + trigger winner Stripe checkout ────────────────────────────
const completeAuction = async (auctionItemId, requestingUserId) => {
    var _a;
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
    // Mark product pending (escrow-like hold)
    await product_model_1.Product.findByIdAndUpdate(product._id, { status: 'pending' });
    // Mark auction completed
    auctionItem.status = 'completed';
    await auctionItem.save();
    // Get winner info
    const winner = await user_model_1.User.findById(auctionItem.highestBidderId).select('email name');
    if (!(winner === null || winner === void 0 ? void 0 : winner.email)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Winner email not found');
    }
    // Create Stripe checkout session for winner
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
            sellerId: ((_a = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _a === void 0 ? void 0 : _a.toString()) || '',
            winnerId: auctionItem.highestBidderId.toString(),
            auctionItemId: auctionItemId,
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
    return { checkoutUrl: stripeSession.url, auctionItem };
};
exports.AuctionServices = {
    generateAgoraToken,
    createLiveStream,
    getLiveStreams,
    createAuctionItem,
    placeBidSecure,
    updateLiveStreamStatus,
    completeAuction,
};
