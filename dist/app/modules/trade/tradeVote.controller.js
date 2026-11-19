"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeVoteControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const tradeVote_service_1 = require("./tradeVote.service");
const getTradeVoteFeed = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await tradeVote_service_1.TradeVoteServices.getTradeVoteFeed(user === null || user === void 0 ? void 0 : user.userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Trade voting feed retrieved successfully',
        meta: result.meta,
        data: result.data,
    });
});
const castVote = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const { option } = req.body;
    const result = await tradeVote_service_1.TradeVoteServices.castVote(id, user.userId, option);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Vote cast successfully',
        data: result,
    });
});
exports.TradeVoteControllers = {
    getTradeVoteFeed,
    castVote,
};
