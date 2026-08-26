"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const follow_model_1 = require("./follow.model");
const user_model_1 = require("../user/user.model");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const notification_integration_1 = require("../notification/notification.integration");
const toggleFollow = async (followerId, followingId) => {
    if (followerId === followingId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "You cannot follow yourself.");
    }
    const targetUser = await user_model_1.User.findById(followingId);
    if (!targetUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User to follow not found.');
    }
    const existingFollow = await follow_model_1.Follow.findOne({ followerId, followingId });
    if (existingFollow) {
        // Unfollow
        await follow_model_1.Follow.findOneAndDelete({ followerId, followingId });
        return { followed: false, message: 'Unfollowed successfully' };
    }
    else {
        // Follow
        await follow_model_1.Follow.create({ followerId, followingId });
        notification_integration_1.NotificationIntegration.onNewFollow(followerId, followingId).catch(err => console.error('Failed to send follow notification:', err));
        return { followed: true, message: 'Followed successfully' };
    }
};
const getFollowers = async (userId, paginationOptions) => {
    const { page, skip, limit, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    const [followers, total] = await Promise.all([
        follow_model_1.Follow.find({ followingId: userId })
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder })
            .populate('followerId', 'name fullName email image profile')
            .lean(),
        follow_model_1.Follow.countDocuments({ followingId: userId }),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: followers.map(f => f.followerId),
    };
};
const getFollowing = async (userId, paginationOptions) => {
    const { page, skip, limit, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    const [following, total] = await Promise.all([
        follow_model_1.Follow.find({ followerId: userId })
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder })
            .populate('followingId', 'name fullName email image profile')
            .lean(),
        follow_model_1.Follow.countDocuments({ followerId: userId }),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: following.map(f => f.followingId),
    };
};
exports.FollowServices = {
    toggleFollow,
    getFollowers,
    getFollowing,
};
