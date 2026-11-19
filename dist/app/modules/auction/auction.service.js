"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionServices = void 0;
const crypto_1 = __importDefault(require("crypto"));
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const auction_model_1 = require("./auction.model");
const savedShow_model_1 = require("./savedShow.model");
const agora_access_token_1 = require("agora-access-token");
const config_1 = __importDefault(require("../../../config"));
const mongoose_1 = require("mongoose");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const product_model_1 = require("../product/product.model");
const user_model_1 = require("../user/user.model");
const server_1 = require("../../../server");
const order_model_1 = require("../order/order.model");
const shippingHelper_1 = require("../../../helpers/shippingHelper");
const seller_service_1 = require("../seller/seller.service");
const marketplaceCharge_1 = require("../payment/marketplaceCharge");
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("../message/message.model");
const notification_integration_1 = require("../notification/notification.integration");
const notification_service_1 = require("../notification/notification.service");
const notification_interface_1 = require("../notification/notification.interface");
const payment_model_1 = require("../payment/payment.model");
const partner_service_1 = require("../partner/partner.service");
const category_model_1 = require("../category/category.model");
const generateAgoraToken = async (channelName, uid = 0, role = 'subscriber', requestingUserId) => {
    const appId = config_1.default.agora.app_id;
    const appCertificate = config_1.default.agora.app_certificate;
    if (!appId || !appCertificate) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Agora configuration (App ID or App Certificate) is missing from system configuration.');
    }
    // Security: only the stream's host may get a publisher (broadcast) token
    if (role === 'publisher') {
        const hostStream = await auction_model_1.LiveStream.findOne({ agoraChannelName: channelName }).select('sellerId');
        if (!hostStream || !requestingUserId || hostStream.sellerId.toString() !== requestingUserId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the host of this live show can broadcast on it.');
        }
    }
    if (requestingUserId) {
        const liveStream = await auction_model_1.LiveStream.findOne({ agoraChannelName: channelName });
        if (liveStream) {
            const isBlocked = await user_model_1.User.findOne({
                _id: { $in: [requestingUserId, liveStream.sellerId.toString()] },
                blockedUsers: { $in: [requestingUserId, liveStream.sellerId.toString()] },
            });
            if (isBlocked) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Cannot access this stream due to block restrictions.');
            }
        }
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
    // Seller activation (client spec, section 5): a seller cannot livestream
    // until ARIES approved them and Stripe cleared them for payouts.
    await seller_service_1.SellerServices.assertSellerCanSell(seller._id);
    if (!payload.agoraChannelName) {
        payload.agoraChannelName = `channel_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    // Determine status & timestamps
    if (!payload.status) {
        payload.status = payload.scheduledStartTime ? 'scheduled' : 'live';
    }
    // Auto-inherit isCelebrity from seller if not explicitly provided
    if (payload.isCelebrity === undefined) {
        payload.isCelebrity = Boolean(seller.isCelebrity);
    }
    if (payload.status === 'live') {
        payload.startedAt = new Date();
    }
    const stream = await auction_model_1.LiveStream.create(payload);
    // Send go live notification if immediate live
    if (stream.status === 'live') {
        notification_integration_1.NotificationIntegration.onLiveStreamGoLive(stream.sellerId.toString(), stream._id.toString(), stream.title).catch(err => console.error('Failed to send go-live notification:', err));
    }
    return stream;
};
const startScheduledStream = async (streamId, sellerId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only the stream host can start this scheduled show.');
    }
    stream.status = 'live';
    stream.startedAt = new Date();
    await stream.save();
    // Trigger push notification to seller's followers
    notification_integration_1.NotificationIntegration.onLiveStreamGoLive(stream.sellerId.toString(), stream._id.toString(), stream.title).catch(err => console.error('Failed to send go-live notification for scheduled stream:', err));
    return stream;
};
const toggleBookmarkShow = async (userId, streamId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    const existing = await savedShow_model_1.SavedShow.findOne({ userId, streamId });
    if (existing) {
        await savedShow_model_1.SavedShow.findByIdAndDelete(existing._id);
        return { isBookmarked: false };
    }
    else {
        await savedShow_model_1.SavedShow.create({ userId, streamId });
        return { isBookmarked: true };
    }
};
const getSavedShows = async (userId) => {
    const savedDocs = await savedShow_model_1.SavedShow.find({ userId })
        .populate({
        path: 'streamId',
        populate: [
            { path: 'sellerId', select: 'name fullName email image photo profile isCelebrity' },
            { path: 'inventoryIds' },
        ],
    })
        .sort({ createdAt: -1 });
    // Filter out any deleted or non-scheduled streams
    const result = savedDocs
        .filter(doc => doc.streamId && doc.streamId.status !== 'ended')
        .map(doc => doc.streamId);
    return result;
};
const updateStreamInventory = async (streamId, sellerId, inventoryIds) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only the stream host can update the inventory.');
    }
    // Validate product IDs exist and are available (not sold/pending)
    const products = await product_model_1.Product.find({ _id: { $in: inventoryIds } });
    if (products.length !== inventoryIds.length) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'One or more invalid Product IDs provided.');
    }
    // Block sold or pending products from being listed in inventory
    const unavailableProducts = products.filter(p => p.status === 'sold' || p.status === 'pending');
    if (unavailableProducts.length > 0) {
        const titles = unavailableProducts.map(p => p.title).join(', ');
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `The following products are unavailable (sold or pending): ${titles}`);
    }
    stream.inventoryIds = inventoryIds.map(id => new mongoose_1.Types.ObjectId(id));
    await stream.save();
    return (await auction_model_1.LiveStream.findById(streamId).populate('inventoryIds'));
};
const getStreamInventory = async (streamId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId).populate('inventoryIds');
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    return stream.inventoryIds || [];
};
const quickStartAuctionItem = async (payload, sellerId) => {
    const { streamId, productId, startingBid, timerDuration, bidIncrement } = payload;
    if (!mongoose_1.Types.ObjectId.isValid(streamId) || !mongoose_1.Types.ObjectId.isValid(productId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID or Product ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only the stream host can launch active auctions.');
    }
    const product = await product_model_1.Product.findById(productId);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    if (product.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only auction your own items.');
    }
    if (product.status !== 'active' || (product.stock !== undefined && product.stock <= 0)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, product.status === 'pending'
            ? 'This item is reserved in a pending trade or checkout.'
            : 'This item is sold out or unavailable.');
    }
    // One running auction per item at a time
    const running = await auction_model_1.AuctionItem.exists({ productId: product._id, status: 'active' });
    if (running) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This item is already being auctioned.');
    }
    // Create auction item via createAuctionItem helper
    // bidIncrement is always forced to 1 (Fixed $1 Bid Increment Policy — never allow client override)
    const auctionItem = await createAuctionItem({
        streamId: new mongoose_1.Types.ObjectId(streamId),
        productId: new mongoose_1.Types.ObjectId(productId),
        startingBid: startingBid !== null && startingBid !== void 0 ? startingBid : (product.startingBid || product.buyNowPrice || product.estValue || 0),
        timerDuration: timerDuration || 60,
        bidIncrement: 1,
    });
    return auctionItem;
};
const getLiveStreams = async (status, requestingUserId, isCelebrity) => {
    const query = {};
    if (status)
        query.status = status;
    if (typeof isCelebrity === 'boolean')
        query.isCelebrity = isCelebrity;
    if (requestingUserId) {
        // 1. Users blocked by current user
        const user = await user_model_1.User.findById(requestingUserId).select('blockedUsers');
        const blockedByUser = (user === null || user === void 0 ? void 0 : user.blockedUsers) || [];
        // 2. Users who blocked current user
        const usersWhoBlockedMe = await user_model_1.User.find({ blockedUsers: requestingUserId }).select('_id');
        const blockedByOthers = usersWhoBlockedMe.map(u => u._id);
        const allExcludedUsers = [...blockedByUser, ...blockedByOthers];
        if (allExcludedUsers.length > 0) {
            query.sellerId = { $nin: allExcludedUsers };
        }
    }
    return await auction_model_1.LiveStream.find(query)
        .populate('sellerId', 'name fullName email image photo profile isCelebrity')
        .populate('pinnedProductId')
        .populate('inventoryIds')
        .sort({ isCelebrity: -1, createdAt: -1 })
        .limit(50)
        .lean();
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
    // Update pinnedProductId on the LiveStream so viewers always see the current item
    if (rest.streamId && rest.productId) {
        await auction_model_1.LiveStream.findByIdAndUpdate(rest.streamId, {
            pinnedProductId: rest.productId,
        });
    }
    // Populate product details for the socket payload
    const populatedAuction = await auction_model_1.AuctionItem.findById(auction._id).populate('productId');
    // Broadcast to all viewers in the live stream room in real-time
    if (server_1.io && rest.streamId) {
        server_1.io.to(`stream:${rest.streamId.toString()}`).emit('new-auction-item', {
            streamId: rest.streamId.toString(),
            auctionItem: populatedAuction,
        });
    }
    return (populatedAuction || auction);
};
const placeBidSecure = async (auctionItemId, bidderId, bidAmount) => {
    if (!mongoose_1.Types.ObjectId.isValid(auctionItemId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID');
    }
    const currentState = await auction_model_1.AuctionItem.findById(auctionItemId).select('status currentBid highestBidderId endsAt streamId bidIncrement');
    if (!currentState) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Auction Item not found.');
    }
    if (currentState.status !== 'active') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Auction is not active. Current status: ${currentState.status}`);
    }
    // Timer ended: no more bids (1.5s grace for network latency)
    if (currentState.endsAt && new Date(currentState.endsAt).getTime() + 1500 < Date.now()) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Bidding has closed for this item.');
    }
    // Check if either user has blocked the other
    const stream = await auction_model_1.LiveStream.findById(currentState.streamId);
    if (stream && stream.sellerId.toString() === bidderId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You can't bid on your own auction.");
    }
    if (stream) {
        const isBlocked = await user_model_1.User.findOne({
            _id: { $in: [bidderId, stream.sellerId.toString()] },
            blockedUsers: { $in: [bidderId, stream.sellerId.toString()] },
        });
        if (isBlocked) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Cannot place bid due to block restrictions.');
        }
    }
    // Fixed $1 Bid Increment Enforcement:
    // If no bids placed yet (!currentState.highestBidderId):
    //   First bid equals startingBid (if currentBid > 0) or passed bidAmount or 1.
    // Once a highest bidder exists (currentState.highestBidderId):
    //   Target bid MUST be exactly currentBid + 1.
    let targetBidAmount;
    if (!currentState.highestBidderId) {
        targetBidAmount = bidAmount || currentState.currentBid || 1;
        if (bidAmount && currentState.currentBid > 0 && bidAmount < currentState.currentBid) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Bid amount cannot be lower than starting bid of $${currentState.currentBid}.`);
        }
    }
    else {
        targetBidAmount = currentState.currentBid + 1;
        if (bidAmount && bidAmount !== targetBidAmount) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Fixed $1 bid increment required. Expected bid is $${targetBidAmount}.`);
        }
    }
    // 1. Atomically find and update ONLY if the target bid is higher than or equal to required initial bid / higher than current bid
    const updatedAuction = await auction_model_1.AuctionItem.findOneAndUpdate({
        _id: new mongoose_1.Types.ObjectId(auctionItemId),
        status: 'active',
        $or: [
            { currentBid: { $lt: targetBidAmount } },
            { highestBidderId: null },
        ],
    }, {
        $set: {
            currentBid: targetBidAmount,
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
    // Prevent reviving an already ended stream session
    if (stream.status === 'ended' && status !== 'ended') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This live stream has already ended and cannot be revived.');
    }
    stream.status = status;
    if (status === 'ended') {
        stream.endedAt = new Date();
    }
    await stream.save();
    if (status === 'live') {
        notification_integration_1.NotificationIntegration.onLiveStreamGoLive(stream.sellerId.toString(), streamId, stream.title).catch(err => console.error('Failed to send go-live notification to followers:', err));
    }
    else if (status === 'ended') {
        const io = global.io;
        if (io) {
            io.to(`stream:${streamId}`).emit('stream-ended', { streamId, status: 'ended' });
        }
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
    // Authorize FIRST (before any state change): only the stream host can complete
    const stream = auctionItem.streamId;
    if (stream &&
        stream.sellerId.toString() !== requestingUserId &&
        requestingUserId !== 'admin') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Only the auction host can complete this auction.');
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
    // Atomically claim this auction so two concurrent "complete" calls can't
    // both create an order / charge the winner.
    const claimed = await auction_model_1.AuctionItem.findOneAndUpdate({ _id: auctionItem._id, status: 'active' }, { $set: { status: 'completed' } });
    if (!claimed) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This auction is already being completed.');
    }
    auctionItem.status = 'completed';
    // Get winner info
    const winner = await user_model_1.User.findById(auctionItem.highestBidderId);
    if (!winner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Winner profile not found');
    }
    let isAutoPaid = false;
    let paymentIntentId;
    // 1. Try automatic off-session charge if the winner has saved card details.
    //
    // This is a direct charge on the seller's connected account: Stripe's fee
    // comes out of the seller's proceeds and ARIES's cut is taken as the
    // application fee, so the money is already split by the time the order
    // exists. If the seller is not payout-ready the charge is refused, and the
    // winner falls through to the checkout session below.
    const auctionSellerId = ((_a = stream === null || stream === void 0 ? void 0 : stream.sellerId) === null || _a === void 0 ? void 0 : _a.toString()) || '';
    if (winner.stripeCustomerId && auctionSellerId) {
        try {
            const charge = await marketplaceCharge_1.MarketplaceCharge.chargeSavedCardDirect({
                buyerId: auctionItem.highestBidderId.toString(),
                sellerId: auctionSellerId,
                totalAmount: auctionItem.currentBid,
                itemSubtotal: auctionItem.currentBid,
                metadata: {
                    purchaseType: 'auction_win',
                    productId: product._id.toString(),
                    winnerId: auctionItem.highestBidderId.toString(),
                    auctionItemId: auctionItemId,
                },
            });
            if (charge) {
                isAutoPaid = true;
                paymentIntentId = charge.paymentIntentId;
                console.log(`[AUTO-PAY] Direct charge succeeded for Auction:${auctionItemId} on ${charge.stripeAccountId} (platform fee ${charge.applicationFeeAmount}¢)`);
            }
        }
        catch (autoPayError) {
            console.error('[AUTO-PAY] Automatic charge failed. Falling back to checkout session:', autoPayError);
        }
    }
    // Sandbox Test Mode Bypass — ONLY when TEST_MODE=true is explicitly set AND
    // the server is not running in production. A missing saved card or a "test"
    // email no longer marks an order paid: those winners go to Stripe Checkout below.
    const isTestEnv = process.env.TEST_MODE === 'true' && config_1.default.node_env !== 'production';
    if (!isAutoPaid && isTestEnv) {
        isAutoPaid = true;
        paymentIntentId = `pi_test_sandbox_${Date.now()}`;
        console.log(`[SANDBOX] Test payment automatically confirmed for Auction:${auctionItemId}`);
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
            streamId: stream === null || stream === void 0 ? void 0 : stream._id,
            isGiveaway: product.isGiveaway || false,
            spinWheelPrize: auctionItem.spinWheelPrize,
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
        // Record partner commission (50/50 split)
        partner_service_1.PartnerService.recordCommissionForOrder({
            buyerId: auctionItem.highestBidderId.toString(),
            orderId: order._id.toString(),
            transactionAmount: auctionItem.currentBid,
        }).catch(err => console.error('Failed to record partner commission:', err));
        // Decrement product stock by 1; mark status as sold only when stock reaches 0
        const currentStock = typeof product.stock === 'number' ? product.stock : 1;
        const newStock = Math.max(0, currentStock - 1);
        const newStatus = newStock > 0 ? 'active' : 'sold';
        await product_model_1.Product.findByIdAndUpdate(product._id, { status: newStatus, stock: newStock });
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
    // Decrement stock by 1 for manual checkout session; if remaining stock > 0 keep active, else set pending
    const currentStock = typeof product.stock === 'number' ? product.stock : 1;
    const newStock = Math.max(0, currentStock - 1);
    const newStatus = newStock > 0 ? 'active' : 'pending';
    await product_model_1.Product.findByIdAndUpdate(product._id, { status: newStatus, stock: newStock });
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
const LIVE_ITEM_PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?q=80&w=800';
/** Accepts a category ObjectId or a category name; returns a valid id or null. */
const resolveCategoryId = async (input) => {
    if (input && mongoose_1.Types.ObjectId.isValid(input)) {
        const byId = await category_model_1.Category.findById(input).select('_id');
        if (byId)
            return byId._id;
    }
    if (input) {
        const name = input.split('(')[0].trim();
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const byName = await category_model_1.Category.findOne({
            name: { $regex: `^${escaped}$`, $options: 'i' },
        }).select('_id');
        if (byName)
            return byName._id;
    }
    const other = await category_model_1.Category.findOne({ name: { $regex: '^Other', $options: 'i' } }).select('_id');
    return (other === null || other === void 0 ? void 0 : other._id) || null;
};
/** Maps grading labels (PSA 10, BGS 9.5, Raw…) onto the product condition enum. */
const normalizeCondition = (input) => {
    const allowed = ['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'];
    if (!input)
        return 'Near Mint';
    const exact = allowed.find(c => c.toLowerCase() === input.trim().toLowerCase());
    if (exact)
        return exact;
    const grade = parseFloat(input.replace(/[^0-9.]/g, ''));
    if (!isNaN(grade)) {
        if (grade >= 9.5)
            return 'Mint';
        if (grade >= 8)
            return 'Near Mint';
        if (grade >= 6)
            return 'Excellent';
        if (grade >= 4)
            return 'Good';
        return 'Fair';
    }
    return 'Near Mint';
};
const addStreamInventoryItem = async (streamId, sellerId, payload) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only the stream host can add items');
    }
    let productId = payload.productId;
    let product = null;
    if (stream.status === 'ended') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This live show has already ended.');
    }
    if (productId) {
        if (!mongoose_1.Types.ObjectId.isValid(productId)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
        }
        product = await product_model_1.Product.findById(productId);
        if (!product) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
        }
        if (product.sellerId.toString() !== sellerId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only add your own items to your show.');
        }
        if (product.status === 'sold' || product.status === 'pending') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This item is already sold or reserved.');
        }
        if (payload.isGiveaway !== undefined && product.isGiveaway !== payload.isGiveaway) {
            product.isGiveaway = payload.isGiveaway;
            await product.save();
        }
    }
    else if (payload.title) {
        // Create new product on-the-fly without leaving stream
        const categoryId = await resolveCategoryId(payload.category);
        if (!categoryId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please choose a valid category.');
        }
        const price = Number(payload.buyNowPrice || payload.startingBid || 0);
        product = await product_model_1.Product.create({
            sellerId: new mongoose_1.Types.ObjectId(sellerId),
            title: payload.title,
            buyNowPrice: price,
            startingBid: Number(payload.startingBid || payload.buyNowPrice || 0),
            estValue: price,
            category: categoryId,
            condition: normalizeCondition(payload.condition),
            allowTrade: false,
            isGiveaway: payload.isGiveaway || false,
            status: 'active',
            images: payload.images && payload.images.length
                ? payload.images
                : [LIVE_ITEM_PLACEHOLDER_IMAGE],
            description: payload.isGiveaway ? 'Live Stream Giveaway Item' : 'Live Stream Item',
        });
        productId = product._id.toString();
    }
    else {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Either productId or item title is required');
    }
    // Append to stream inventory if not already present
    const existingIds = (stream.inventoryIds || []).map(id => id.toString());
    if (productId && !existingIds.includes(productId)) {
        stream.inventoryIds = [...(stream.inventoryIds || []), new mongoose_1.Types.ObjectId(productId)];
        await stream.save();
    }
    // Real-time broadcast to all viewers in the stream room
    server_1.io.to(`stream:${streamId}`).emit('stream-inventory-item-added', {
        streamId,
        product,
        isGiveaway: payload.isGiveaway || false,
    });
    return product;
};
const attachSpinWheelPrize = async (streamId, sellerId, payload) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only host can attach spin prizes');
    }
    const { itemName, auctionItemId, buyerId } = payload;
    if (!itemName) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Item name is required for spin prize');
    }
    let updatedAuctionItem = null;
    let updatedOrder = null;
    // 1. Update AuctionItem
    if (auctionItemId && mongoose_1.Types.ObjectId.isValid(auctionItemId)) {
        updatedAuctionItem = await auction_model_1.AuctionItem.findByIdAndUpdate(auctionItemId, { spinWheelPrize: itemName }, { new: true });
    }
    else {
        updatedAuctionItem = await auction_model_1.AuctionItem.findOneAndUpdate({ streamId: new mongoose_1.Types.ObjectId(streamId) }, { spinWheelPrize: itemName }, { sort: { updatedAt: -1 }, new: true });
    }
    // 2. Attach to Buyer's Order if exists
    const targetBuyerId = buyerId || (updatedAuctionItem === null || updatedAuctionItem === void 0 ? void 0 : updatedAuctionItem.highestBidderId);
    if (targetBuyerId && mongoose_1.Types.ObjectId.isValid(targetBuyerId)) {
        updatedOrder = await order_model_1.Order.findOneAndUpdate({
            buyerId: new mongoose_1.Types.ObjectId(targetBuyerId),
            sellerId: new mongoose_1.Types.ObjectId(sellerId),
        }, { spinWheelPrize: itemName }, { sort: { createdAt: -1 }, new: true });
    }
    // Broadcast to room
    server_1.io.to(`stream:${streamId}`).emit('spin-prize-attached', {
        streamId,
        itemName,
        buyerId: targetBuyerId,
        auctionItemId: updatedAuctionItem === null || updatedAuctionItem === void 0 ? void 0 : updatedAuctionItem._id,
    });
    return {
        streamId,
        itemName,
        buyerId: targetBuyerId,
        auctionItem: updatedAuctionItem,
        order: updatedOrder,
    };
};
const runStreamGiveawayItem = async (streamId, sellerId, payload) => {
    var _a, _b, _c, _d;
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only host can run giveaways');
    }
    if (stream.status !== 'live') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Giveaways can only run during a live show.');
    }
    // The prize must be the host's own, still-available item
    let giveawayProduct = null;
    if (payload.productId) {
        if (!mongoose_1.Types.ObjectId.isValid(payload.productId)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
        }
        giveawayProduct = await product_model_1.Product.findById(payload.productId);
        if (!giveawayProduct || giveawayProduct.sellerId.toString() !== sellerId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only give away your own items.');
        }
        if (giveawayProduct.status !== 'active' || ((_a = giveawayProduct.stock) !== null && _a !== void 0 ? _a : 1) <= 0) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This item is no longer available.');
        }
    }
    // Draw from signed-in viewers currently watching THIS show (not a global pool)
    const room = `stream:${streamId}`;
    const sockets = server_1.io ? await server_1.io.in(room).fetchSockets() : [];
    const eligible = Array.from(new Set(sockets
        .map(s => { var _a; return (_a = s.data) === null || _a === void 0 ? void 0 : _a.userId; })
        .filter((id) => !!id && id !== sellerId)));
    if (eligible.length === 0) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No signed-in viewers are watching right now. Try again when viewers join.');
    }
    const winnerId = eligible[crypto_1.default.randomInt(eligible.length)];
    const winnerUser = await user_model_1.User.findById(winnerId);
    if (!winnerUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Winner profile not found.');
    }
    const winnerData = {
        id: winnerUser._id.toString(),
        name: winnerUser.fullName || winnerUser.name || 'Lucky Viewer',
    };
    // $0 order so the winner's prize ships like any purchase
    let giveawayOrder = null;
    if (giveawayProduct) {
        try {
            const addr = winnerUser.address || {};
            const giveawayPayload = {
                buyerId: winnerUser._id,
                sellerId: stream.sellerId,
                productId: giveawayProduct._id,
                streamId: stream._id,
                isGiveaway: true,
                purchaseType: 'auction_win',
                paymentStatus: 'paid',
                deliveryStatus: 'pending',
                shippingAddress: {
                    street: addr.presentAddress || 'Pending — winner to confirm',
                    city: addr.city || 'Pending',
                    state: addr.state || 'Pending',
                    postalCode: addr.postalCode || 'Pending',
                    country: addr.country || 'US',
                },
                amountDetails: {
                    itemSubtotal: 0,
                    shipping: 0,
                    taxes: 0,
                    processingFee: 0,
                    charityContribution: 0,
                    totalPaid: 0,
                },
            };
            await (0, shippingHelper_1.initializeOrderShipping)(giveawayPayload, giveawayProduct);
            const [createdOrder] = await order_model_1.Order.create([giveawayPayload]);
            giveawayOrder = createdOrder;
            const newStock = Math.max(0, ((_b = giveawayProduct.stock) !== null && _b !== void 0 ? _b : 1) - 1);
            await product_model_1.Product.findByIdAndUpdate(giveawayProduct._id, {
                stock: newStock,
                status: newStock > 0 ? 'active' : 'sold',
            });
        }
        catch (orderErr) {
            console.error('Failed to create giveaway order:', orderErr);
        }
    }
    server_1.io.to(room).emit('giveaway-winner', {
        streamId,
        prizeName: payload.itemTitle,
        itemImage: payload.itemImage,
        productId: payload.productId,
        winner: winnerData,
        winnerName: winnerData.name,
        buyerId: winnerData.id,
        timestamp: new Date(),
    });
    server_1.io.to(winnerData.id).emit('giveaway-won', {
        streamId,
        prizeName: payload.itemTitle,
        orderId: ((_c = giveawayOrder === null || giveawayOrder === void 0 ? void 0 : giveawayOrder._id) === null || _c === void 0 ? void 0 : _c.toString()) || null,
        needsAddress: !((_d = winnerUser.address) === null || _d === void 0 ? void 0 : _d.presentAddress),
    });
    return {
        streamId,
        prizeTitle: payload.itemTitle,
        productId: payload.productId,
        itemImage: payload.itemImage,
        winner: winnerData,
        eligibleViewers: eligible.length,
        order: giveawayOrder,
    };
};
// UPDATE 3: Spin Wheel / Randomizer (Server-decided with strict 4 items maximum limit)
const spinWheel = async (streamId, sellerId, payload) => {
    var _a, _b;
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    if (stream.sellerId.toString() !== sellerId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Unauthorized: Only the host can spin the wheel');
    }
    const rawItems = payload.items || [];
    const items = rawItems
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    // Enforce limit of 4 items strictly in backend validation
    if (items.length < 2) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Spin wheel requires at least 2 items.');
    }
    if (items.length > 4) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Spin wheel allows a maximum of 4 items.');
    }
    // Server-side authoritative RNG decision (so outcome cannot be manipulated on client)
    const winningIndex = Math.floor(Math.random() * items.length);
    const winningItem = items[winningIndex];
    // Persist winning prize on Buyer's Order if orderId or buyerId provided
    let updatedOrder = null;
    if (payload.orderId && mongoose_1.Types.ObjectId.isValid(payload.orderId)) {
        // Only this seller's own order can receive the prize
        updatedOrder = await order_model_1.Order.findOneAndUpdate({ _id: payload.orderId, sellerId: new mongoose_1.Types.ObjectId(sellerId) }, { spinWheelPrize: winningItem }, { new: true });
    }
    else if (payload.buyerId && mongoose_1.Types.ObjectId.isValid(payload.buyerId)) {
        // Attach to the buyer's order from THIS show (not any older order)
        updatedOrder = await order_model_1.Order.findOneAndUpdate({
            buyerId: new mongoose_1.Types.ObjectId(payload.buyerId),
            sellerId: new mongoose_1.Types.ObjectId(sellerId),
            streamId: new mongoose_1.Types.ObjectId(streamId),
        }, { spinWheelPrize: winningItem }, { sort: { createdAt: -1 }, new: true });
        if (!updatedOrder) {
            // Order not created yet (checkout pending): store it on the buyer's
            // winning auction item; it is copied into the order when it's created.
            await auction_model_1.AuctionItem.findOneAndUpdate({
                streamId: new mongoose_1.Types.ObjectId(streamId),
                highestBidderId: new mongoose_1.Types.ObjectId(payload.buyerId),
            }, { spinWheelPrize: winningItem }, { sort: { updatedAt: -1 } });
        }
    }
    // Broadcast real-time spin result to both host and viewers
    const spinResultPayload = {
        streamId,
        items,
        winningIndex,
        winningItem,
        orderId: payload.orderId || ((_a = updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder._id) === null || _a === void 0 ? void 0 : _a.toString()),
        buyerId: payload.buyerId || ((_b = updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder.buyerId) === null || _b === void 0 ? void 0 : _b.toString()),
        timestamp: new Date(),
    };
    if (server_1.io) {
        server_1.io.to(`stream:${streamId}`).emit('spin-wheel:result', spinResultPayload);
        server_1.io.to(streamId).emit('spin-wheel:result', spinResultPayload);
    }
    return {
        streamId,
        items,
        winningIndex,
        winningItem,
        orderId: payload.orderId || (updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder._id),
        order: updatedOrder,
    };
};
// UPDATE 4: Real-time Live Sales View for Seller during show
const getStreamSales = async (streamId, sellerId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId);
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream session not found');
    }
    const query = {
        $or: [
            { streamId: new mongoose_1.Types.ObjectId(streamId) },
            { productId: { $in: stream.inventoryIds || [] } },
        ],
    };
    if (sellerId) {
        query.sellerId = new mongoose_1.Types.ObjectId(sellerId);
    }
    const orders = await order_model_1.Order.find(query)
        .populate('buyerId', 'name fullName email image photo profile')
        .populate('productId', 'title images price startingBid buyNowPrice isGiveaway')
        .sort({ createdAt: -1 })
        .lean();
    const totalRevenue = orders.reduce((acc, curr) => { var _a, _b; return acc + (((_a = curr.amountDetails) === null || _a === void 0 ? void 0 : _a.totalPaid) || ((_b = curr.amountDetails) === null || _b === void 0 ? void 0 : _b.itemSubtotal) || 0); }, 0);
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid').length;
    return {
        streamId,
        totalOrders: orders.length,
        paidOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        orders: orders.map(o => {
            var _a, _b, _c, _d;
            return ({
                _id: o._id,
                orderId: o._id,
                buyer: o.buyerId,
                product: o.productId,
                amount: ((_a = o.amountDetails) === null || _a === void 0 ? void 0 : _a.totalPaid) || ((_b = o.amountDetails) === null || _b === void 0 ? void 0 : _b.itemSubtotal) || 0,
                paymentStatus: o.paymentStatus,
                deliveryStatus: o.deliveryStatus,
                spinWheelPrize: o.spinWheelPrize || null,
                isGiveaway: o.isGiveaway || false,
                shippingLabelUrl: o.shippingLabelUrl || null,
                trackingNumber: ((_c = o.trackingDetails) === null || _c === void 0 ? void 0 : _c.trackingNumber) || null,
                carrier: ((_d = o.trackingDetails) === null || _d === void 0 ? void 0 : _d.carrier) || 'USPS',
                createdAt: o.createdAt,
            });
        }),
    };
};
// UPDATE 6: Post-show Summary Screen Data & Shipping Labels
const getStreamSummary = async (streamId, sellerId) => {
    if (!mongoose_1.Types.ObjectId.isValid(streamId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Stream ID');
    }
    const stream = await auction_model_1.LiveStream.findById(streamId).populate('sellerId', 'name fullName email');
    if (!stream) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Live stream not found');
    }
    const salesData = await getStreamSales(streamId, sellerId);
    // Extract shipping labels ready for printing
    const labels = salesData.orders
        .filter(o => o.shippingLabelUrl)
        .map(o => {
        var _a, _b, _c;
        return ({
            orderId: o._id,
            buyerName: ((_a = o.buyer) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = o.buyer) === null || _b === void 0 ? void 0 : _b.name) || 'Valued Customer',
            productTitle: ((_c = o.product) === null || _c === void 0 ? void 0 : _c.title) || 'Auction Item',
            trackingNumber: o.trackingNumber,
            carrier: o.carrier,
            shippingLabelUrl: o.shippingLabelUrl,
        });
    });
    return {
        stream: {
            id: stream._id,
            title: stream.title,
            status: stream.status,
            startedAt: stream.startedAt || stream.createdAt,
            endedAt: stream.endedAt || new Date(),
        },
        metrics: {
            totalItemsSold: salesData.totalOrders,
            paidOrders: salesData.paidOrders,
            totalRevenue: salesData.totalRevenue,
        },
        orders: salesData.orders,
        labels,
    };
};
exports.AuctionServices = {
    generateAgoraToken,
    createLiveStream,
    startScheduledStream,
    toggleBookmarkShow,
    getSavedShows,
    updateStreamInventory,
    getStreamInventory,
    quickStartAuctionItem,
    getLiveStreams,
    createAuctionItem,
    getAuctionItemsByStream,
    placeBidSecure,
    updateLiveStreamStatus,
    completeAuction,
    addStreamInventoryItem,
    attachSpinWheelPrize,
    runStreamGiveawayItem,
    spinWheel,
    getStreamSales,
    getStreamSummary,
};
