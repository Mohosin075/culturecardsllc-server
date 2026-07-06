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
// Weighted drop rates for the Seller's Spin Wheel:
// Common: 65%, Rare: 25%, Epic: 9%, Legendary: 1%
const SPIN_WHEEL_PRIZES = [
    {
        name: '10% Shop Coupon',
        rarity: 'Common',
        weight: 65,
        degreeMin: 0,
        degreeMax: 90,
    },
    {
        name: 'Free Mystery Sticker Pack',
        rarity: 'Rare',
        weight: 25,
        degreeMin: 91,
        degreeMax: 210,
    },
    {
        name: 'Rare Card Sleeves',
        rarity: 'Epic',
        weight: 9,
        degreeMin: 211,
        degreeMax: 330,
    },
    {
        name: 'Vintage Booster Pack (Legendary Drop)',
        rarity: 'Legendary',
        weight: 1,
        degreeMin: 331,
        degreeMax: 359,
    },
];
const pickWeightedPrize = () => {
    const randomValue = Math.floor(Math.random() * 100);
    let cumulativeWeight = 0;
    for (const prize of SPIN_WHEEL_PRIZES) {
        cumulativeWeight += prize.weight;
        if (randomValue < cumulativeWeight) {
            // Pick a random degree inside the slice for frontend animation mapping
            const degreeIndex = Math.floor(Math.random() * (prize.degreeMax - prize.degreeMin + 1) +
                prize.degreeMin);
            return { ...prize, degreeIndex };
        }
    }
    return { ...SPIN_WHEEL_PRIZES[0], degreeIndex: 45 };
};
const socket = (io) => {
    io.on('connection', (socket) => {
        console.log(colors_1.default.blue('A user connected:'), socket.id);
        // 1. Notification room registration
        socket.on('join-notification', async (userId) => {
            if (userId) {
                socket.join(userId);
                console.log(colors_1.default.green(`User ${socket.id} joined notification room: ${userId}`));
                await user_model_1.User.findByIdAndUpdate(userId, {
                    isOnline: true,
                    lastActive: new Date(),
                });
                socket.userId = userId;
            }
        });
        // 2. Room subscriptions & live viewer tracking
        socket.on('join-stream', async (data) => {
            const { streamId, userId } = data;
            if (streamId) {
                const streamRoom = `stream:${streamId}`;
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
                if (userId) {
                    socket.streamUserId = userId;
                }
            }
        });
        socket.on('leave-stream', async (streamId) => {
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
            const { streamId, auctionItemId, bidAmount, bidderId } = data;
            try {
                if (!auctionItemId || !bidAmount || !bidderId) {
                    socket.emit('bid-error', {
                        message: 'Missing required bid parameters.',
                    });
                    return;
                }
                // Call the secure service that uses Mongoose lock validators and anti-sniping timers
                const updatedAuction = await auction_service_1.AuctionServices.placeBidSecure(auctionItemId, bidderId, bidAmount);
                // Fetch bidder profile for display name in feed
                const bidderInfo = await user_model_1.User.findById(bidderId).select('name fullName email image photo');
                // Broadcast updated auction item to stream room
                io.to(`stream:${streamId}`).emit('new-bid', {
                    streamId,
                    auctionItemId,
                    currentBid: updatedAuction.currentBid,
                    highestBidder: bidderInfo,
                    endsAt: updatedAuction.endsAt,
                });
                console.log(colors_1.default.green(`Bid placed successfully: $${bidAmount} by User:${bidderId}`));
            }
            catch (err) {
                console.error(colors_1.default.red('Bidding error:'), err.message);
                socket.emit('bid-error', {
                    auctionItemId,
                    message: err.message || 'Bid rejected due to concurrency collision.',
                });
            }
        });
        // 4. Live Chat Overlay
        socket.on('stream-chat', async (data) => {
            const { streamId, userId, message } = data;
            if (streamId && userId && message) {
                const userInfo = await user_model_1.User.findById(userId).select('name fullName email image photo');
                io.to(`stream:${streamId}`).emit('new-chat-message', {
                    streamId,
                    user: userInfo,
                    message,
                    timestamp: new Date(),
                });
            }
        });
        // 5. Live Reactions Count
        socket.on('stream-reaction', async (data) => {
            const { streamId, reactionType } = data;
            if (streamId) {
                const stream = await auction_model_1.LiveStream.findByIdAndUpdate(streamId, { $inc: { likesCount: 1 } }, { new: true });
                io.to(`stream:${streamId}`).emit('new-reaction', {
                    streamId,
                    reactionType,
                    likesCount: stream ? stream.likesCount : 0,
                });
            }
        });
        // 6. Seller-controlled Spin Wheel Drop Calculation
        socket.on('trigger-spin', async (data) => {
            const { streamId, sellerId } = data;
            try {
                const stream = await auction_model_1.LiveStream.findById(streamId);
                if (!stream) {
                    socket.emit('spin-error', { message: 'Stream session not found.' });
                    return;
                }
                // Authorize: Only the stream seller can spin
                if (stream.sellerId.toString() !== sellerId) {
                    socket.emit('spin-error', {
                        message: 'Unauthorized: Only the stream host can trigger the Spin Wheel.',
                    });
                    return;
                }
                // Calculate weighted prize selection on secure backend
                const outcome = pickWeightedPrize();
                // Broadcast animation degree and outcome to room
                io.to(`stream:${streamId}`).emit('spin-result', {
                    streamId,
                    prizeName: outcome.name,
                    rarity: outcome.rarity,
                    degreeIndex: outcome.degreeIndex,
                    timestamp: new Date(),
                });
                console.log(colors_1.default.magenta(`Spin Wheel triggered. Prize: ${outcome.name} (${outcome.rarity})`));
            }
            catch (err) {
                socket.emit('spin-error', {
                    message: err.message || 'Spin wheel trigger failed.',
                });
            }
        });
        // 7. Seller-controlled Live Stream termination
        socket.on('end-stream', async (data) => {
            const { streamId, sellerId } = data;
            try {
                if (!streamId || !sellerId) {
                    socket.emit('stream-error', {
                        message: 'Missing required parameters: streamId or sellerId.',
                    });
                    return;
                }
                const stream = await auction_model_1.LiveStream.findById(streamId);
                if (!stream) {
                    socket.emit('stream-error', { message: 'Stream session not found.' });
                    return;
                }
                // Authorize: Only the stream host can end the stream
                if (stream.sellerId.toString() !== sellerId) {
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
                console.log(colors_1.default.red(`Live Stream ${streamId} terminated by host seller ${sellerId}`));
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
