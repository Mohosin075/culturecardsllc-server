"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const order_model_1 = require("./order.model");
const product_model_1 = require("../product/product.model");
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("../message/message.model");
const mongoose_1 = require("mongoose");
const pushnotificationHelper_1 = require("../../../helpers/pushnotificationHelper");
const shippingHelper_1 = require("../../../helpers/shippingHelper");
const createOrder = async (payload) => {
    const product = await product_model_1.Product.findById(payload.productId);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    if (product.stock <= 0) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Product is out of stock.');
    }
    // Populate shipping weight, tracking number, and mock PDF label
    await (0, shippingHelper_1.initializeOrderShipping)(payload, product);
    const session = await order_model_1.Order.startSession();
    session.startTransaction();
    try {
        const orders = await order_model_1.Order.create([payload], { session });
        const order = orders[0];
        product.stock -= 1;
        if (product.stock === 0) {
            product.status = 'sold';
        }
        await product.save({ session });
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
                    sender: order.sellerId,
                    text: `Order Confirmed: ${product.title} (#${order._id.toString().substring(0, 8).toUpperCase()})`,
                    messageType: 'order_update',
                    seen: false,
                    metadata: {
                        orderId: order._id.toString(),
                        statusLabel: 'ORDER CONFIRMED 📦',
                        eta: 'Delivery Pending',
                    },
                },
            ], { session });
        }
        await session.commitTransaction();
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
        .populate('productId');
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
const updateOrderJourney = async (orderId, journeyUpdate, deliveryStatus) => {
    if (!mongoose_1.Types.ObjectId.isValid(orderId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Order ID');
    }
    const order = await order_model_1.Order.findById(orderId).populate('productId buyerId');
    if (!order) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Order not found');
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
