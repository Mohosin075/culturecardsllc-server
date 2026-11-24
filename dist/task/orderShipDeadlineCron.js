"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOrderShipDeadlineCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const order_model_1 = require("../app/modules/order/order.model");
const product_model_1 = require("../app/modules/product/product.model");
const chat_model_1 = require("../app/modules/chat/chat.model");
const message_model_1 = require("../app/modules/message/message.model");
const user_model_1 = require("../app/modules/user/user.model");
const pushnotificationHelper_1 = require("../helpers/pushnotificationHelper");
const marketplaceCharge_1 = require("../app/modules/payment/marketplaceCharge");
/**
 * Order Ship-Deadline Cron Job
 * Runs hourly.
 *
 * A paid order the seller never shipped would otherwise sit on `pending`
 * forever with the buyer's money held and no way out. This cancels anything
 * still unshipped past its `shipByDate`, refunds the buyer, and tells both
 * sides what happened.
 */
const startOrderShipDeadlineCron = () => {
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            const overdue = await order_model_1.Order.find({
                deliveryStatus: 'pending',
                paymentStatus: 'paid',
                shipByDate: { $ne: null, $lte: new Date() },
            }).populate('productId');
            if (overdue.length === 0)
                return;
            console.log(`[OrderShipDeadlineCron] Cancelling ${overdue.length} unshipped order(s).`);
            for (const order of overdue) {
                try {
                    await cancelAndRefund(order);
                }
                catch (error) {
                    console.error(`[OrderShipDeadlineCron] Failed on order ${order._id}:`, error);
                }
            }
        }
        catch (error) {
            console.error('[OrderShipDeadlineCron] Run failed:', error);
        }
    });
    console.log('⏰ Order ship-deadline cron scheduled (hourly)');
};
exports.startOrderShipDeadlineCron = startOrderShipDeadlineCron;
const cancelAndRefund = async (order) => {
    var _a, _b, _c, _d;
    const productTitle = ((_a = order.productId) === null || _a === void 0 ? void 0 : _a.title) || 'your item';
    const amount = ((_b = order.amountDetails) === null || _b === void 0 ? void 0 : _b.totalPaid) || 0;
    // 1. Refund first — never cancel an order while still holding the money.
    let refunded = false;
    if (order.paymentIntentId) {
        try {
            // Marketplace sales are direct charges on the seller's connected
            // account, so a platform-level refund cannot see them. Refund on
            // whichever account the charge actually lives on.
            const stripeAccountId = await marketplaceCharge_1.MarketplaceCharge.findChargeAccount({
                paymentIntentId: order.paymentIntentId,
                recordedAccountId: order.stripeAccountId,
                sellerId: (_c = order.sellerId) === null || _c === void 0 ? void 0 : _c.toString(),
            });
            // Full refund out of the seller's balance; ARIES's fee goes back too,
            // since the sale never happened.
            await marketplaceCharge_1.MarketplaceCharge.refundMarketplacePayment({
                paymentIntentId: order.paymentIntentId,
                stripeAccountId,
                reason: 'requested_by_customer',
            });
            refunded = true;
        }
        catch (error) {
            console.error(`[OrderShipDeadlineCron] Stripe refund failed for ${order._id}:`, error === null || error === void 0 ? void 0 : error.message);
            // Leave the order alone so the next run retries the refund.
            return;
        }
    }
    // 2. Mark the order cancelled with a visible trail.
    order.deliveryStatus = 'cancelled';
    order.paymentStatus = refunded ? 'refunded' : order.paymentStatus;
    order.cancelReason = 'Seller did not ship within the required window.';
    order.trackingDetails.journeyUpdates.push({
        status: 'Order Cancelled',
        description: refunded
            ? 'The seller did not ship in time. Your payment has been refunded.'
            : 'The seller did not ship in time. This order was cancelled.',
        timestamp: new Date(),
    });
    await order.save();
    // 3. Put the item back on sale.
    if ((_d = order.productId) === null || _d === void 0 ? void 0 : _d._id) {
        await product_model_1.Product.updateOne({ _id: order.productId._id }, { $inc: { stock: 1 }, $set: { status: 'active' } });
    }
    // 4. Tell both sides, in chat and by push.
    const chat = await chat_model_1.Chat.findOne({
        participants: { $all: [order.buyerId, order.sellerId] },
    });
    if (chat) {
        await message_model_1.Message.create({
            chatId: chat._id,
            sender: order.buyerId,
            text: `Order cancelled: ${productTitle} was not shipped in time.`,
            messageType: 'order_update',
            seen: false,
            metadata: {
                orderId: order._id.toString(),
                statusLabel: 'ORDER CANCELLED ❌',
                eta: refunded ? 'Refunded' : 'Refund pending',
            },
        });
    }
    const [buyer, seller] = await Promise.all([
        user_model_1.User.findById(order.buyerId).select('deviceToken'),
        user_model_1.User.findById(order.sellerId).select('deviceToken'),
    ]);
    if (buyer === null || buyer === void 0 ? void 0 : buyer.deviceToken) {
        await (0, pushnotificationHelper_1.sendPushNotification)(buyer.deviceToken, 'Order Cancelled & Refunded', `${productTitle} wasn't shipped in time. $${amount.toFixed(2)} has been refunded.`, { type: 'ORDER_UPDATE', orderId: order._id.toString() }).catch(() => { });
    }
    if (seller === null || seller === void 0 ? void 0 : seller.deviceToken) {
        await (0, pushnotificationHelper_1.sendPushNotification)(seller.deviceToken, 'Order Cancelled', `${productTitle} was cancelled because it wasn't shipped in time.`, { type: 'ORDER_UPDATE', orderId: order._id.toString() }).catch(() => { });
    }
};
