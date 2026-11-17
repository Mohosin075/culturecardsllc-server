"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketHelper = void 0;
const colors_1 = __importDefault(require("colors"));
const user_model_1 = require("../app/modules/user/user.model");
const auction_model_1 = require("../app/modules/auction/auction.model");
const auction_service_1 = require("../app/modules/auction/auction.service");
const jwtHelper_1 = require("./jwtHelper");
const config_1 = __importDefault(require("../config"));
const mongoose_1 = require("mongoose");
/**
 * Verify the JWT sent in the socket handshake (auth.token, query.token or
 * Authorization header) and return the user id, or null if absent/invalid.
 */
const resolveSocketUserId = (socket) => {
    var _a, _b;
    const raw = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) ||
        ((_b = socket.handshake.query) === null || _b === void 0 ? void 0 : _b.token) ||
        socket.handshake.headers.authorization;
    if (!raw || typeof raw !== 'string')
        return null;
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    try {
        const payload = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
        const id = payload.userId || payload.authId;
        return id ? String(id) : null;
    }
    catch (_c) {
        return null;
    }
};
const socket = (io) => {
    io.on('connection', async (socket) => {
        console.log(colors_1.default.blue('A user connected:'), socket.id);
        // Security: identity comes ONLY from a verified JWT in the handshake.
        // Unauthenticated sockets may still connect (e.g. to watch), but they have
        // no userId, so every privileged event below rejects them.
        const authenticatedUserId = resolveSocketUserId(socket);
        if (authenticatedUserId) {
            ;
            socket.userId = authenticatedUserId;
            socket.data.userId = authenticatedUserId; // survives fetchSockets() across Redis nodes
            socket.join(authenticatedUserId);
            try {
                await user_model_1.User.findByIdAndUpdate(authenticatedUserId, {
                    isOnline: true,
                    lastActive: new Date(),
                });
            }
            catch (err) {
                console.error(colors_1.default.red('Failed to mark user online:'), err);
            }
        }
        // 1. Notification room registration (kept for backwards compatibility).
        // The client-sent id is ignored unless it matches the verified token.
        socket.on('join-notification', async (userId) => {
            const verifiedId = socket.userId;
            if (!verifiedId || (userId && String(userId) !== String(verifiedId))) {
                socket.emit('socket_error', {
                    statusCode: 401,
                    error: 'Unauthorized',
                    message: 'Valid access token required to join notifications.',
                });
                return;
            }
            socket.join(verifiedId);
        });
        // 2. Room subscriptions & live viewer tracking
        socket.on('join-stream', async (data) => {
            const { streamId, userId } = data;
            if (streamId) {
                const streamRoom = `stream:${streamId}`;
                // Re-joins (e.g. after a reconnect) must not inflate the viewer count.
                if (socket.rooms.has(streamRoom))
                    return;
                socket.join(streamRoom);
                console.log(colors_1.default.green(`User ${socket.id} joined stream room: ${streamId}`));
                // Increment Mongoose stream viewer count
                const stream = await auction_model_1.LiveStream.findByIdAndUpdate(streamId, { $inc: { viewersCount: 1 } }, { new: true });
                if (stream) {
                    io.to(streamRoom).emit('viewer-count-update', {
                        streamId,
                        viewersCount: stream.viewersCount,
                    });
                }
                socket.activeStreamId = streamId;
                // Only trust the verified socket identity, never the client-sent userId
                if (socket.userId) {
                    socket.streamUserId = socket.userId;
                }
            }
        });
        socket.on('leave-stream', async (data) => {
            const streamId = typeof data === 'string' ? data : data === null || data === void 0 ? void 0 : data.streamId;
            if (streamId) {
                const streamRoom = `stream:${streamId}`;
                socket.leave(streamRoom);
                console.log(colors_1.default.yellow(`User ${socket.id} left stream room: ${streamId}`));
                const stream = await auction_model_1.LiveStream.findByIdAndUpdate(streamId, { $inc: { viewersCount: -1 } }, { new: true });
                const currentCount = stream && stream.viewersCount > 0 ? stream.viewersCount : 0;
                if (stream && stream.viewersCount < 0) {
                    await auction_model_1.LiveStream.findByIdAndUpdate(streamId, {
                        $set: { viewersCount: 0 },
                    });
                }
                io.to(streamRoom).emit('viewer-count-update', {
                    streamId,
                    viewersCount: currentCount,
                });
                socket.activeStreamId = null;
            }
        });
        // 3. High-Concurrency Bidding Logic with Race-Condition Protection
        socket.on('place-bid', async (data) => {
            const { streamId, auctionItemId, bidAmount } = data;
            // Security: ALWAYS use the authenticated socket userId — never trust client-provided bidderId
            const authenticatedBidderId = socket.userId;
            try {
                if (!auctionItemId || !bidAmount) {
                    socket.emit('bid-error', {
                        message: 'Missing required bid parameters.',
                    });
                    return;
                }
                if (!authenticatedBidderId) {
                    socket.emit('bid-error', {
                        message: 'Unauthorized: Please join the notification room first (join-notification).',
                    });
                    return;
                }
                // Call the secure service that uses Mongoose lock validators and anti-sniping timers
                const updatedAuction = await auction_service_1.AuctionServices.placeBidSecure(auctionItemId, authenticatedBidderId, bidAmount);
                // Fetch bidder profile for display name in feed
                const bidderInfo = await user_model_1.User.findById(authenticatedBidderId).select('name fullName email image photo');
                // Broadcast updated auction item to stream room
                io.to(`stream:${streamId}`).emit('new-bid', {
                    streamId,
                    auctionItemId,
                    currentBid: updatedAuction.currentBid,
                    highestBidder: bidderInfo,
                    endsAt: updatedAuction.endsAt,
                });
                console.log(colors_1.default.green(`Bid placed successfully: $${bidAmount} by User:${authenticatedBidderId}`));
            }
            catch (err) {
                console.error(colors_1.default.red('Bidding error:'), err.message);
                socket.emit('bid-error', {
                    auctionItemId,
                    message: err.message || 'Bid rejected due to concurrency collision.',
                });
            }
        });
        // 4. Live Chat Overlay (comments) — server is the single source of truth.
        socket.on('stream-chat', async (data) => {
            var _a;
            try {
                const streamId = data === null || data === void 0 ? void 0 : data.streamId;
                const authenticatedUserId = socket.userId;
                const message = ((_a = data === null || data === void 0 ? void 0 : data.message) !== null && _a !== void 0 ? _a : '').toString().trim().slice(0, 300);
                if (!authenticatedUserId || !message || !streamId || !mongoose_1.Types.ObjectId.isValid(streamId))
                    return;
                // Basic anti-spam: max ~2 comments per second per socket
                const now = Date.now();
                const last = socket.lastChatAt || 0;
                if (now - last < 450) {
                    socket.emit('stream-chat-error', { clientId: data === null || data === void 0 ? void 0 : data.clientId, message: 'You are sending messages too fast.' });
                    return;
                }
                ;
                socket.lastChatAt = now;
                const userInfo = await user_model_1.User.findById(authenticatedUserId).select('name fullName image photo');
                const displayName = (userInfo === null || userInfo === void 0 ? void 0 : userInfo.fullName) || (userInfo === null || userInfo === void 0 ? void 0 : userInfo.name) || 'User';
                const messageId = new mongoose_1.Types.ObjectId();
                const timestamp = new Date();
                const updated = await auction_model_1.LiveStream.findOneAndUpdate({ _id: streamId, status: { $in: ['live', 'scheduled'] } }, {
                    $push: {
                        chatMessages: {
                            _id: messageId,
                            user: displayName,
                            userId: new mongoose_1.Types.ObjectId(authenticatedUserId),
                            message,
                            timestamp,
                            likedBy: [],
                        },
                    },
                }, { projection: { _id: 1 } });
                if (!updated) {
                    socket.emit('stream-chat-error', { clientId: data === null || data === void 0 ? void 0 : data.clientId, message: 'This show has ended.' });
                    return;
                }
                io.to(`stream:${streamId}`).emit('new-chat-message', {
                    streamId,
                    messageId: messageId.toString(),
                    clientId: data === null || data === void 0 ? void 0 : data.clientId,
                    user: {
                        _id: authenticatedUserId,
                        name: displayName,
                        image: (userInfo === null || userInfo === void 0 ? void 0 : userInfo.image) || (userInfo === null || userInfo === void 0 ? void 0 : userInfo.photo) || '',
                    },
                    message,
                    likes: 0,
                    timestamp,
                });
            }
            catch (err) {
                console.error(colors_1.default.red('stream-chat error:'), err === null || err === void 0 ? void 0 : err.message);
            }
        });
        // 4b. Like / unlike a comment (toggle, atomic, one like per user)
        socket.on('stream-chat-like', async (data) => {
            var _a;
            try {
                const authenticatedUserId = socket.userId;
                const { streamId, messageId } = data || {};
                if (!authenticatedUserId || !mongoose_1.Types.ObjectId.isValid(streamId) || !mongoose_1.Types.ObjectId.isValid(messageId))
                    return;
                const uid = new mongoose_1.Types.ObjectId(authenticatedUserId);
                const mid = new mongoose_1.Types.ObjectId(messageId);
                // Try to add the like; if the user already liked it, remove it instead.
                let liked = true;
                let doc = await auction_model_1.LiveStream.findOneAndUpdate({ _id: streamId, chatMessages: { $elemMatch: { _id: mid, likedBy: { $ne: uid } } } }, { $addToSet: { 'chatMessages.$.likedBy': uid } }, { new: true, projection: { chatMessages: { $elemMatch: { _id: mid } } } });
                if (!doc) {
                    liked = false;
                    doc = await auction_model_1.LiveStream.findOneAndUpdate({ _id: streamId, 'chatMessages._id': mid }, { $pull: { 'chatMessages.$.likedBy': uid } }, { new: true, projection: { chatMessages: { $elemMatch: { _id: mid } } } });
                }
                const msg = (_a = doc === null || doc === void 0 ? void 0 : doc.chatMessages) === null || _a === void 0 ? void 0 : _a[0];
                if (!msg)
                    return;
                io.to(`stream:${streamId}`).emit('chat-message-liked', {
                    streamId,
                    messageId,
                    likes: (msg.likedBy || []).length,
                    userId: authenticatedUserId,
                    liked,
                });
            }
            catch (err) {
                console.error(colors_1.default.red('stream-chat-like error:'), err === null || err === void 0 ? void 0 : err.message);
            }
        });
        // 5. Live Reactions Count
        socket.on('stream-reaction', async (data) => {
            const { streamId, reactionType } = data || {};
            if (!streamId || !mongoose_1.Types.ObjectId.isValid(streamId))
                return;
            // Clients batch taps (~1/sec). Cap each batch and rate-limit per socket
            // so a modified client can't flood the DB or the room.
            const now = Date.now();
            const last = socket.lastReactionAt || 0;
            if (now - last < 500)
                return;
            socket.lastReactionAt = now;
            const count = Math.min(Math.max(Math.floor(Number(data.count) || 1), 1), 30);
            try {
                const stream = await auction_model_1.LiveStream.findOneAndUpdate({ _id: streamId, status: 'live' }, { $inc: { likesCount: count } }, { new: true, projection: { likesCount: 1 } });
                if (!stream)
                    return;
                io.to(`stream:${streamId}`).emit('new-reaction', {
                    streamId,
                    reactionType: reactionType || 'heart',
                    count,
                    fromUserId: socket.userId || null,
                    likesCount: stream.likesCount,
                });
            }
            catch (err) {
                console.error(colors_1.default.red('stream-reaction error:'), err);
            }
        });
        // 6. Seller-controlled Spin Wheel Drop Calculation
        // Legacy random-prize spin (hardcoded prizes + global giveaway draw) is
        // disabled: it awarded prizes the seller never entered and marked random
        // platform giveaway participants as winners. The app uses the REST
        // spin-wheel endpoint, which spins the seller's own entries.
        socket.on('trigger-spin', () => {
            socket.emit('spin-error', {
                message: 'Please use the Spin Wheel in the latest app version.',
            });
        });
        // 6b. Seller-controlled Attach Spin Wheel Prize to Order
        socket.on('attach-spin-prize', async (data) => {
            const { streamId, itemName, buyerId, auctionItemId } = data;
            const authenticatedSellerId = socket.userId;
            try {
                if (!authenticatedSellerId) {
                    socket.emit('spin-error', { message: 'Unauthorized: Not authenticated.' });
                    return;
                }
                if (!streamId || !itemName) {
                    socket.emit('spin-error', { message: 'Missing streamId or itemName.' });
                    return;
                }
                await auction_service_1.AuctionServices.attachSpinWheelPrize(streamId, authenticatedSellerId, {
                    itemName,
                    buyerId,
                    auctionItemId,
                });
            }
            catch (err) {
                socket.emit('spin-error', {
                    message: err.message || 'Failed to attach spin prize.',
                });
            }
        });
        // 6c. Seller-controlled Run Item Giveaway
        socket.on('run-giveaway-item', async (data) => {
            const { streamId, itemTitle, productId, itemImage } = data;
            const authenticatedSellerId = socket.userId;
            try {
                if (!authenticatedSellerId) {
                    socket.emit('giveaway-error', { message: 'Unauthorized: Not authenticated.' });
                    return;
                }
                if (!streamId || !itemTitle) {
                    socket.emit('giveaway-error', { message: 'Missing streamId or itemTitle.' });
                    return;
                }
                await auction_service_1.AuctionServices.runStreamGiveawayItem(streamId, authenticatedSellerId, {
                    itemTitle,
                    productId,
                    itemImage,
                });
            }
            catch (err) {
                socket.emit('giveaway-error', {
                    message: err.message || 'Failed to run item giveaway.',
                });
            }
        });
        // 7. Seller-controlled Live Stream termination
        socket.on('end-stream', async (data) => {
            const { streamId } = data;
            // Security: use authenticated socket userId — never trust client-provided sellerId
            const authenticatedSellerId = socket.userId;
            try {
                if (!streamId) {
                    socket.emit('stream-error', {
                        message: 'Missing required parameter: streamId.',
                    });
                    return;
                }
                if (!authenticatedSellerId) {
                    socket.emit('stream-error', { message: 'Unauthorized: Not authenticated.' });
                    return;
                }
                const stream = await auction_model_1.LiveStream.findById(streamId);
                if (!stream) {
                    socket.emit('stream-error', { message: 'Stream session not found.' });
                    return;
                }
                // Authorize: Only the stream host can end the stream
                if (stream.sellerId.toString() !== authenticatedSellerId) {
                    socket.emit('stream-error', {
                        message: 'Unauthorized: Only the stream host can end the stream.',
                    });
                    return;
                }
                stream.status = 'ended';
                await stream.save();
                // Broadcast stream closure to all clients in the room
                io.to(`stream:${streamId}`).emit('stream-ended', {
                    streamId,
                    status: 'ended',
                });
                console.log(colors_1.default.red(`Live Stream ${streamId} terminated by host seller ${authenticatedSellerId}`));
            }
            catch (err) {
                socket.emit('stream-error', {
                    message: err.message || 'Failed to end stream session.',
                });
            }
        });
        // Handle Disconnections
        socket.on('disconnect', async () => {
            console.log(colors_1.default.red('A user disconnected:'), socket.id);
            // Update online status
            const userId = socket.userId;
            if (userId) {
                await user_model_1.User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastActive: new Date(),
                });
            }
            // Decrement viewer count if they left a stream room unexpectedly
            const streamId = socket.activeStreamId;
            if (streamId) {
                const stream = await auction_model_1.LiveStream.findByIdAndUpdate(streamId, { $inc: { viewersCount: -1 } }, { new: true });
                const currentCount = stream && stream.viewersCount > 0 ? stream.viewersCount : 0;
                if (stream && stream.viewersCount < 0) {
                    await auction_model_1.LiveStream.findByIdAndUpdate(streamId, {
                        $set: { viewersCount: 0 },
                    });
                }
                io.to(`stream:${streamId}`).emit('viewer-count-update', {
                    streamId,
                    viewersCount: currentCount,
                });
            }
        });
    });
};
exports.socketHelper = { socket };
