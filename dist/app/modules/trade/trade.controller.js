"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const trade_service_1 = require("./trade.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const createTradeOffer = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    // senderId always from authenticated user — never trust client body
    const payload = { ...req.body, senderId: user.userId };
    const result = await trade_service_1.TradeServices.createTradeOffer(payload);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Trade proposal submitted successfully.',
        data: result,
    });
});
const getTradeOffers = (0, catchAsync_1.default)(async (req, res) => {
    const userId = req.query.userId;
    const type = req.query.type || 'received';
    if (!userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'userId is required as query parameter.');
    }
    const result = await trade_service_1.TradeServices.getTradeOffers(userId, type);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Trade offers retrieved successfully.',
        data: result,
    });
});
const acceptTradeOffer = (0, catchAsync_1.default)(async (req, res) => {
    const result = await trade_service_1.TradeServices.acceptTradeOffer(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Trade offer accepted successfully. Items held in secure escrow.',
        data: result,
    });
});
const declineTradeOffer = (0, catchAsync_1.default)(async (req, res) => {
    const result = await trade_service_1.TradeServices.declineTradeOffer(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Trade offer declined.',
        data: result,
    });
});
const completeTradeOffer = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await trade_service_1.TradeServices.completeTradeOffer(req.params.id, user.userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Trade completed successfully. Ownership transferred.',
        data: result,
    });
});
exports.TradeControllers = {
    createTradeOffer,
    getTradeOffers,
    acceptTradeOffer,
    declineTradeOffer,
    completeTradeOffer,
};
