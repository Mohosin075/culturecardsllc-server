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
const createOrder = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const payload = { ...req.body, buyerId: req.body.buyerId || user.userId };
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
    const userId = req.query.userId || user.userId;
    const role = req.query.role || 'buyer';
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
    const result = await order_service_1.OrderServices.getOrderById(req.params.id);
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
    const result = await order_service_1.OrderServices.updateOrderJourney(req.params.id, { status, description, location, timestamp: new Date() }, deliveryStatus);
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
