"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOrderAutoDeliverCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const order_model_1 = require("../app/modules/order/order.model");
const chat_model_1 = require("../app/modules/chat/chat.model");
const message_model_1 = require("../app/modules/message/message.model");
const pushnotificationHelper_1 = require("../helpers/pushnotificationHelper");
const server_1 = require("../server");
/**
 * Order Auto-Deliver Cron Job
 * Runs every day at midnight (00:00).
 * Finds all orders in 'shipped' status with 'paid' payment that have been in transit
 * for 14 or more days, and marks them as 'delivered' automatically.
 */
const startOrderAutoDeliverCron = () => {
    node_cron_1.default.schedule('0 0 * * *', async () => {
        var _a, _b, _c, _d;
        console.log('[OrderAutoDeliverCron] Running 14-day auto-delivery check...');
        try {
            const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            const eligibleOrders = await order_model_1.Order.find({
                deliveryStatus: 'shipped',
                paymentStatus: 'paid',
                updatedAt: { $lte: fourteenDaysAgo },
            }).populate('buyerId sellerId productId');
            if (eligibleOrders.length === 0) {
                console.log('[OrderAutoDeliverCron] No shipped orders reached 14 days limit.');
                return;
            }
            console.log(`[OrderAutoDeliverCron] Found ${eligibleOrders.length} order(s) to auto-deliver.`);
            for (const order of eligibleOrders) {
                try {
                    const journeyUpdate = {
                        status: 'Delivered',
                        description: 'Package automatically marked as delivered (14-day transit completed).',
                        location: ((_a = order.shippingAddress) === null || _a === void 0 ? void 0 : _a.city)
                            ? `${order.shippingAddress.city}, ${order.shippingAddress.state || ''}`
                            : 'Destination',
                        timestamp: new Date(),
                    };
                    order.deliveryStatus = 'delivered';
                    if (!order.trackingDetails) {
                        order.trackingDetails = { journeyUpdates: [] };
                    }
                    order.trackingDetails.journeyUpdates.push(journeyUpdate);
                    await order.save();
                    const buyerUser = order.buyerId;
                    const buyerUserId = (buyerUser === null || buyerUser === void 0 ? void 0 : buyerUser._id) ? buyerUser._id.toString() : (_b = order.buyerId) === null || _b === void 0 ? void 0 : _b.toString();
                    const sellerUserId = ((_c = order.sellerId) === null || _c === void 0 ? void 0 : _c._id) ? order.sellerId._id.toString() : (_d = order.sellerId) === null || _d === void 0 ? void 0 : _d.toString();
                    // 1. Create In-App Chat Update
                    if (buyerUserId && sellerUserId) {
                        const chat = await chat_model_1.Chat.findOne({
                            participants: { $all: [buyerUserId, sellerUserId] },
                        });
                        if (chat) {
                            await message_model_1.Message.create({
                                chatId: chat._id,
                                sender: sellerUserId,
                                text: `Order Delivered: Package auto-confirmed as delivered. #${order._id.toString().substring(0, 8).toUpperCase()}`,
                                messageType: 'order_update',
                                seen: false,
                                metadata: {
                                    orderId: order._id.toString(),
                                    statusLabel: 'ORDER DELIVERED ✅',
                                    trackingNumber: order.trackingDetails.trackingNumber,
                                    eta: journeyUpdate.location,
                                },
                            });
                        }
                    }
                    // 2. Dispatch FCM Push Notification to Buyer
                    if (buyerUser && buyerUser.deviceToken) {
                        try {
                            await (0, pushnotificationHelper_1.sendPushNotification)(buyerUser.deviceToken, 'Order Delivered ✅', 'Your package has been auto-marked as delivered. Thank you for shopping with CultureCards!', { type: 'ORDER_UPDATE', orderId: order._id.toString() });
                        }
                        catch (fcmErr) {
                            console.error(`[OrderAutoDeliverCron] Push notification failed for order ${order._id}:`, fcmErr);
                        }
                    }
                    // 3. Socket broadcast to buyer & seller if active
                    if (server_1.io && buyerUserId && sellerUserId) {
                        [buyerUserId, sellerUserId].forEach(uid => {
                            server_1.io.to(uid).emit('order-status-updated', {
                                orderId: order._id.toString(),
                                deliveryStatus: 'delivered',
                                message: 'Order has been delivered ✅',
                            });
                        });
                    }
                    console.log(`[OrderAutoDeliverCron] Auto-delivered order: ${order._id}`);
                }
                catch (innerErr) {
                    console.error(`[OrderAutoDeliverCron] Failed to auto-deliver order ${order._id}:`, innerErr);
                }
            }
            console.log(`[OrderAutoDeliverCron] Processed ${eligibleOrders.length} auto-delivery orders successfully.`);
        }
        catch (err) {
            console.error('[OrderAutoDeliverCron] Error during auto-deliver check:', err);
        }
    });
    console.log('[OrderAutoDeliverCron] Order auto-delivery cron job scheduled (daily at midnight).');
};
exports.startOrderAutoDeliverCron = startOrderAutoDeliverCron;
