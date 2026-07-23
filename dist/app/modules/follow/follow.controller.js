"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowControllers = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const follow_service_1 = require("./follow.service");
const pick_1 = __importDefault(require("../../../shared/pick"));
const toggleFollow = (0, catchAsync_1.default)(async (req, res) => {
    const { id: followingId } = req.params;
    const followerId = req.user.userId;
    const result = await follow_service_1.FollowServices.toggleFollow(followerId, followingId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
});
const getFollowers = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const paginationOptions = (0, pick_1.default)(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await follow_service_1.FollowServices.getFollowers(id, paginationOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Followers retrieved successfully',
        meta: result.meta,
        data: result.data,
    });
});
const getFollowing = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const paginationOptions = (0, pick_1.default)(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await follow_service_1.FollowServices.getFollowing(id, paginationOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Following retrieved successfully',
        meta: result.meta,
        data: result.data,
    });
});
exports.FollowControllers = {
    toggleFollow,
    getFollowers,
    getFollowing,
};
