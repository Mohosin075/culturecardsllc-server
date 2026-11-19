"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiveawayController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const giveaway_service_1 = require("./giveaway.service");
const pick_1 = __importDefault(require("../../../shared/pick"));
const pagination_1 = require("../../../interfaces/pagination");
const enterGiveaway = (0, catchAsync_1.default)(async (req, res) => {
    var _a, _b, _c;
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id) || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.authId);
    const result = await giveaway_service_1.GiveawayService.enterGiveaway(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: "You're Entered! / Successfully Entered into Giveaway",
        data: result,
    });
});
const getMyStatus = (0, catchAsync_1.default)(async (req, res) => {
    var _a, _b, _c;
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id) || ((_c = req.user) === null || _c === void 0 ? void 0 : _c.authId);
    const result = await giveaway_service_1.GiveawayService.getMyStatus(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Giveaway user status retrieved successfully',
        data: result,
    });
});
const getRandomPool = (0, catchAsync_1.default)(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const slug = req.query.slug;
    const result = await giveaway_service_1.GiveawayService.getRandomPool(limit, slug);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `${result.length} random giveaway participants retrieved successfully`,
        data: result,
    });
});
const drawWinner = (0, catchAsync_1.default)(async (req, res) => {
    var _a;
    const { streamId, participantId, userId } = req.body;
    const result = await giveaway_service_1.GiveawayService.drawLiveWinner(streamId, participantId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Giveaway winner drawn successfully: ${((_a = result === null || result === void 0 ? void 0 : result.userId) === null || _a === void 0 ? void 0 : _a.fullName) || (result === null || result === void 0 ? void 0 : result.name) || 'Winner'}`,
        data: result,
    });
});
const getWinners = (0, catchAsync_1.default)(async (req, res) => {
    const slug = req.query.slug;
    const result = await giveaway_service_1.GiveawayService.getWinners(slug);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Giveaway winners retrieved successfully',
        data: result,
    });
});
const getParticipants = (0, catchAsync_1.default)(async (req, res) => {
    const paginationOptions = (0, pick_1.default)(req.query, pagination_1.paginationFields);
    const status = req.query.status;
    const slug = req.query.slug;
    const result = await giveaway_service_1.GiveawayService.getParticipants(paginationOptions, status, slug);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Giveaway participants retrieved successfully',
        data: result,
    });
});
const getConfig = (0, catchAsync_1.default)(async (req, res) => {
    const result = await giveaway_service_1.GiveawayService.getActiveConfig();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Giveaway config retrieved successfully',
        data: result,
    });
});
const updateConfig = (0, catchAsync_1.default)(async (req, res) => {
    const result = await giveaway_service_1.GiveawayService.updateGiveawayConfig(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Giveaway config updated successfully',
        data: result,
    });
});
exports.GiveawayController = {
    enterGiveaway,
    getMyStatus,
    getRandomPool,
    drawWinner,
    getWinners,
    getParticipants,
    getConfig,
    updateConfig,
};
