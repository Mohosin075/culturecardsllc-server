"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const order_service_1 = require("./order.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_1 = require("../../../enum/user");
const isAdmin = (user) => (user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.ADMIN || (user === null || user === void 0 ? void 0 : user.role) === user_1.USER_ROLES.SUPER_ADMIN;
const createOrder = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    // Security: buyer is always the authenticated user. Seller, payment status
    // and paid amount are resolved server-side in the service.
    const payload = { ...req.body, buyerId: user.userId || user.authId };
    const result = await order_service_1.OrderServices.createOrder(payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Order created and payment processed successfully.',
        data: result,
    });
});
const getOrdersForUser = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    // Only admins may look up another user's orders
    const userId = isAdmin(user)
        ? req.query.userId || user.userId
        : user.userId || user.authId;
    const role = req.query.role === 'seller' ? 'seller' : 'buyer';
    if (!userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'userId is required.');
    }
    const result = await order_service_1.OrderServices.getOrdersForUser(userId, role);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Orders retrieved successfully.',
        data: result,
    });
});
const getOrderById = (0, catchAsync_1.default)(async (req, res) => {
    var _a, _b, _c, _d;
    const user = req.user;
    const result = await order_service_1.OrderServices.getOrderById(req.params.id);
    if (!isAdmin(user)) {
        const me = String(user.userId || user.authId);
        const buyer = (_b = (_a = result.buyerId) === null || _a === void 0 ? void 0 : _a._id) !== null && _b !== void 0 ? _b : result.buyerId;
        const seller = (_d = (_c = result.sellerId) === null || _c === void 0 ? void 0 : _c._id) !== null && _d !== void 0 ? _d : result.sellerId;
        if (String(buyer) !== me && String(seller) !== me) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only view your own orders.');
        }
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Order details fetched successfully.',
        data: result,
    });
});
const updateOrderJourney = (0, catchAsync_1.default)(async (req, res) => {
    const { status, description, location } = req.body;
    const deliveryStatus = req.body.deliveryStatus || 'shipped';
    if (!status || !description) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'status and description are required for journey updates.');
    }
    const user = req.user;
    const result = await order_service_1.OrderServices.updateOrderJourney(req.params.id, { status, description, location, timestamp: new Date() }, deliveryStatus, { userId: String(user.userId || user.authId), isAdmin: isAdmin(user) });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Shipment checkpoint update pushed successfully.',
        data: result,
    });
});
exports.OrderControllers = {
    createOrder,
    getOrdersForUser,
    getOrderById,
    updateOrderJourney,
};
