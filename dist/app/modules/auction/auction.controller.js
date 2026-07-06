"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const auction_service_1 = require("./auction.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const generateAgoraToken = (0, catchAsync_1.default)(async (req, res) => {
    const channelName = req.query.channelName;
    const uid = req.query.uid ? Number(req.query.uid) : 0;
    const role = req.query.role || 'subscriber';
    if (!channelName) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'channelName is required as query parameter.');
    }
    const result = await auction_service_1.AuctionServices.generateAgoraToken(channelName, uid, role);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Agora token generated successfully.',
        data: result,
    });
});
const createLiveStream = (0, catchAsync_1.default)(async (req, res) => {
    const result = await auction_service_1.AuctionServices.createLiveStream(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Live stream session initialized successfully.',
        data: result,
    });
});
const getLiveStreams = (0, catchAsync_1.default)(async (req, res) => {
    const status = req.query.status;
    const result = await auction_service_1.AuctionServices.getLiveStreams(status);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Live streams fetched successfully.',
        data: result,
    });
});
const createAuctionItem = (0, catchAsync_1.default)(async (req, res) => {
    const result = await auction_service_1.AuctionServices.createAuctionItem(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Auction item registered successfully.',
        data: result,
    });
});
const placeBidSecure = (0, catchAsync_1.default)(async (req, res) => {
    const { auctionItemId, bidderId, bidAmount } = req.body;
    const result = await auction_service_1.AuctionServices.placeBidSecure(auctionItemId, bidderId, bidAmount);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Bid placed successfully.',
        data: result,
    });
});
const updateLiveStreamStatus = (0, catchAsync_1.default)(async (req, res) => {
    const { streamId } = req.params;
    const { status } = req.body;
    const user = req.user;
    const result = await auction_service_1.AuctionServices.updateLiveStreamStatus(streamId, user.userId, user.role, status);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Live stream status updated successfully.',
        data: result,
    });
});
exports.AuctionControllers = {
    generateAgoraToken,
    createLiveStream,
    getLiveStreams,
    createAuctionItem,
    placeBidSecure,
    updateLiveStreamStatus,
};
