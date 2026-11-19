"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const tip_service_1 = require("./tip.service");
const createTipIntent = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await tip_service_1.TipServices.createTipIntent(user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.status === 'succeeded' ? 'Tip completed successfully!' : 'Tip payment session created.',
        data: result,
    });
});
const confirmTip = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await tip_service_1.TipServices.confirmTip(user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Tip confirmed successfully! Thank you for supporting the host.',
        data: result,
    });
});
const getStreamTips = (0, catchAsync_1.default)(async (req, res) => {
    const { streamId } = req.params;
    const result = await tip_service_1.TipServices.getStreamTips(streamId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Stream tips retrieved successfully.',
        data: result,
    });
});
const getMySellerTips = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const userId = user.userId || user._id || user.id;
    const result = await tip_service_1.TipServices.getMySellerTips(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Seller tips and earnings retrieved successfully.',
        data: result,
    });
});
exports.TipController = {
    createTipIntent,
    confirmTip,
    getStreamTips,
    getMySellerTips,
};
