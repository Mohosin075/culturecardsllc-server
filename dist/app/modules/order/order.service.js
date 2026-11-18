"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderServices = exports.formatShipByDate = exports.addBusinessDays = exports.SHIP_WINDOW_BUSINESS_DAYS = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const order_model_1 = require("./order.model");
const product_model_1 = require("../product/product.model");
const payment_model_1 = require("../payment/payment.model");
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("../message/message.model");
const mongoose_1 = require("mongoose");
const pushnotificationHelper_1 = require("../../../helpers/pushnotificationHelper");
const shippingHelper_1 = require("../../../helpers/shippingHelper");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const user_model_1 = require("../user/user.model");
/** How long a seller has to hand the parcel over before the order auto-cancels. */
exports.SHIP_WINDOW_BUSINESS_DAYS = 3;
/** Adds business days (skipping Sat/Sun) to a date. */
const addBusinessDays = (from, days) => {
    const result = new Date(from);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6)
            added++;
    }
    return result;
};
exports.addBusinessDays = addBusinessDays;
/** Short, human date for chat/notification copy. */
const formatShipByDate = (date) => date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    })
    : 'soon';
exports.formatShipByDate = formatShipByDate;
/** Push + socket ping so the seller learns about an order without polling. */
const notifySellerOfNewOrder = async (order, productTitle) => {
    const orderId = order._id.toString();
    const io = global.io;
    if (io) {
        io.to(order.sellerId.toString()).emit('new-order', {
            orderId,
            productTitle,
            shipByDate: order.shipByDate,
        });
    }
    const seller = await user_model_1.User.findById(order.sellerId).select('deviceToken');
    if (!(seller === null || seller === void 0 ? void 0 : seller.deviceToken))
        return;
    await (0, pushnotificationHelper_1.sendPushNotification)(seller.deviceToken, 'New Order Received 📦', `${productTitle} — ship by ${(0, exports.formatShipByDate)(order.shipByDate)}.`, { type: 'NEW_ORDER', orderId });
};
const createOrder = async (payload) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const product = await product_model_1.Product.findById(payload.productId);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    if (product.stock <= 0 || product.status === 'sold') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Product is out of stock.');
    }
    payload.purchaseType = payload.purchaseType || 'buy_now';
    if (!payload.amountDetails) {
        payload.amountDetails = {
            itemSubtotal: product.buyNowPrice || product.estValue || 0,
            shipping: 0,
            taxes: 0,
            processingFee: 0,
            charityContribution: 0,
            totalPaid: payload.totalPaid || product.buyNowPrice || product.estValue || 0,
        };
    }
    else if (payload.amountDetails.totalPaid === undefined || payload.amountDetails.totalPaid === 0) {
        payload.amountDetails.totalPaid = payload.totalPaid ||
            ((payload.amountDetails.itemSubtotal || 0) + (payload.amountDetails.shipping || 0) + (payload.amountDetails.taxes || 0));
    }
    if (!payload.shippingAddress) {
        payload.shippingAddress = {
            street: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postalCode: '00000',
            country: 'USA',
        };
    }
    else {
        payload.shippingAddress.street = ((_a = payload.shippingAddress.street) === null || _a === void 0 ? void 0 : _a.trim()) || 'N/A';
        payload.shippingAddress.city = ((_b = payload.shippingAddress.city) === null || _b === void 0 ? void 0 : _b.trim()) || 'N/A';
        payload.shippingAddress.state = ((_c = payload.shippingAddress.state) === null || _c === void 0 ? void 0 : _c.trim()) || 'N/A';
        payload.shippingAddress.postalCode = ((_d = payload.shippingAddress.postalCode) === null || _d === void 0 ? void 0 : _d.trim()) || ((_e = payload.shippingAddress.zipCode) === null || _e === void 0 ? void 0 : _e.trim()) || '00000';
        payload.shippingAddress.country = ((_f = payload.shippingAddress.country) === null || _f === void 0 ? void 0 : _f.trim()) || 'USA';
    }
    // Security: seller always comes from the product, never from the client
    payload.sellerId = product.sellerId;
    if (String(payload.sellerId) === String(payload.buyerId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot buy your own item.');
    }
    // Security: payment status is decided server-side. An order is only "paid"
    // if the client supplies a Stripe PaymentIntent that actually succeeded,
    // covers the amount, and has not been used by another order.
    payload.paymentStatus = 'pending';
    if (payload.paymentIntentId) {
        const alreadyUsed = await order_model_1.Order.exists({ paymentIntentId: payload.paymentIntentId });
        if (alreadyUsed) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This payment has already been used for another order.');
        }
        let intent;
        try {
            intent = await stripe_1.default.paymentIntents.retrieve(payload.paymentIntentId);
        }
        catch (_h) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid payment reference.');
        }
        const claimedTotal = Number(((_g = payload.amountDetails) === null || _g === void 0 ? void 0 : _g.totalPaid) || 0);
        if (intent.status === 'succeeded' && intent.amount_received >= Math.round(claimedTotal * 100)) {
            payload.paymentStatus = 'paid';
            if (payload.amountDetails) {
                payload.amountDetails.totalPaid = intent.amount_received / 100;
            }
        }
    }
    // Populate shipping weight, tracking number, and mock PDF label
    await (0, shippingHelper_1.initializeOrderShipping)(payload, product);
    // The seller gets a fixed window to ship. The buyer sees this date, and
    // orderShipDeadlineCron cancels and refunds anything still unshipped past it.
    payload.shipByDate = (0, exports.addBusinessDays)(new Date(), exports.SHIP_WINDOW_BUSINESS_DAYS);
    const session = await order_model_1.Order.startSession();
    session.startTransaction();
    try {
        const orders = await order_model_1.Order.create([payload], { session });
        const order = orders[0];
        if (payload.paymentIntentId) {
            await payment_model_1.Payment.updateOne({ paymentIntentId: payload.paymentIntentId }, { status: 'succeeded', orderId: order._id }, { session });
        }
        // Atomic stock decrement: two buyers can't both take the last unit
        const reserved = await product_model_1.Product.findOneAndUpdate({ _id: product._id, stock: { $gt: 0 }, status: { $ne: 'sold' } }, { $inc: { stock: -1 } }, { new: true, session });
        if (!reserved) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Sorry, this item just sold out.');
        }
        if (reserved.stock <= 0) {
            await product_model_1.Product.updateOne({ _id: product._id }, { status: 'sold' }, { session });
        }
        // Use participants[] array — consistent with Chat model schema
        let chat = await chat_model_1.Chat.findOne({
            participants: { $all: [order.buyerId, order.sellerId] },
        });
        if (!chat) {
            const createdChats = await chat_model_1.Chat.create([{ participants: [order.buyerId, order.sellerId] }], { session });
            chat = createdChats[0];
        }
        if (chat) {
            await message_model_1.Message.create([
                {
                    chatId: chat._id,
                    // Sent on the buyer's behalf: with the seller as sender the
                    // message counted as their own, so it never showed as unread and
                    // the seller had no sign a new order had come in.
                    sender: order.buyerId,
                    text: `New order: ${product.title} (#${order._id.toString().substring(0, 8).toUpperCase()})`,
                    messageType: 'order_update',
                    seen: false,
                    metadata: {
                        orderId: order._id.toString(),
                        statusLabel: 'NEW ORDER 📦',
                        eta: `Ship by ${(0, exports.formatShipByDate)(payload.shipByDate)}`,
                    },
                },
            ], { session });
        }
        await session.commitTransaction();
        // Tell the seller there is something to pack. Non-blocking: the order is
        // already committed and must not fail over a notification.
        notifySellerOfNewOrder(order, product.title).catch(err => console.error('Failed to notify seller of new order:', err));
        return order;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
};
const getOrdersForUser = async (userId, role) => {
    const query = {};
    if (role === 'buyer') {
        query.buyerId = new mongoose_1.Types.ObjectId(userId);
    }
    else {
        query.sellerId = new mongoose_1.Types.ObjectId(userId);
    }
    return await order_model_1.Order.find(query)
        .populate('buyerId', 'name fullName email image photo')
        .populate('sellerId', 'name fullName email image photo')
        .populate('productId')
        .sort({ createdAt: -1 });
};
const getOrderById = async (id) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Order ID');
    }
    const order = await order_model_1.Order.findById(id)
        .populate('buyerId', 'name fullName email image photo')
        .populate('sellerId', 'name fullName email image photo')
        .populate('productId');
    if (!order) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Order details not found');
    }
    return order;
};
const updateOrderJourney = async (orderId, journeyUpdate, deliveryStatus, requester) => {
    var _a, _b, _c, _d;
    if (!mongoose_1.Types.ObjectId.isValid(orderId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Order ID');
    }
    const order = await order_model_1.Order.findById(orderId).populate('productId buyerId');
    if (!order) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Order not found');
    }
    // Security: seller (or admin) can push any checkpoint; the buyer may only
    // confirm delivery of their own order.
    if (requester && !requester.isAdmin) {
        const buyerRef = (_b = (_a = order.buyerId) === null || _a === void 0 ? void 0 : _a._id) !== null && _b !== void 0 ? _b : order.buyerId;
        const isSeller = String(order.sellerId) === requester.userId;
        const isBuyer = String(buyerRef) === requester.userId;
        if (!isSeller && !(isBuyer && deliveryStatus === 'delivered')) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, isBuyer
                ? 'Buyers can only confirm delivery.'
                : 'You can only update your own orders.');
        }
    }
    // A cancelled order must not keep the buyer's money, and the item goes back
    // on sale.
    if (deliveryStatus === 'cancelled' && order.deliveryStatus !== 'cancelled') {
        if (order.paymentStatus === 'paid' && order.paymentIntentId) {
            try {
                await stripe_1.default.refunds.create({ payment_intent: order.paymentIntentId });
                order.paymentStatus = 'refunded';
            }
            catch (error) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_GATEWAY, `Could not refund this order: ${error === null || error === void 0 ? void 0 : error.message}. It was left unchanged.`);
            }
        }
        const productRef = (_d = (_c = order.productId) === null || _c === void 0 ? void 0 : _c._id) !== null && _d !== void 0 ? _d : order.productId;
        if (productRef) {
            await product_model_1.Product.updateOne({ _id: productRef }, { $inc: { stock: 1 }, $set: { status: 'active' } });
        }
    }
    order.deliveryStatus = deliveryStatus;
    order.trackingDetails.journeyUpdates.push(journeyUpdate);
    await order.save();
    const buyerUser = order.buyerId;
    const buyerUserId = (buyerUser === null || buyerUser === void 0 ? void 0 : buyerUser._id)
        ? buyerUser._id.toString()
        : order.buyerId.toString();
    // Use participants[] array — consistent with Chat model schema
    const chat = await chat_model_1.Chat.findOne({
        participants: { $all: [buyerUserId, order.sellerId] },
    });
    if (chat) {
        const trackingMsg = `Order tracking update: ${journeyUpdate.description} (${journeyUpdate.status})`;
        await message_model_1.Message.create({
            chatId: chat._id,
            sender: order.sellerId,
            text: trackingMsg,
            messageType: 'order_update',
            seen: false,
            metadata: {
                orderId: order._id.toString(),
                statusLabel: deliveryStatus === 'shipped'
                    ? 'ORDER SHIPPED 🚚'
                    : 'SHIPMENT UPDATE 📦',
                trackingNumber: order.trackingDetails.trackingNumber,
                eta: journeyUpdate.location || 'In Transit',
            },
        });
    }
    if (buyerUser && buyerUser.deviceToken) {
        try {
            await (0, pushnotificationHelper_1.sendPushNotification)(buyerUser.deviceToken, `Order Update: ${journeyUpdate.status}`, `Your package: ${journeyUpdate.description}. Location: ${journeyUpdate.location || 'N/A'}`, { type: 'ORDER_UPDATE', orderId: order._id.toString() });
        }
        catch (err) {
            console.error('FCM Push notification dispatch failed:', err);
        }
    }
    return order;
};
exports.OrderServices = {
    createOrder,
    getOrdersForUser,
    getOrderById,
    updateOrderJourney,
};
