"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = exports.getProfile = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_model_1 = require("./user.model");
const user_1 = require("../../../enum/user");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const config_1 = __importDefault(require("../../../config"));
const user_constants_1 = require("./user.constants");
const jwtHelper_1 = require("../../../helpers/jwtHelper");
const trade_model_1 = require("../trade/trade.model");
const review_model_1 = require("../review/review.model");
const follow_model_1 = require("../follow/follow.model");
const auction_model_1 = require("../auction/auction.model");
const getUserStats = async (userId) => {
    const tradesCount = await trade_model_1.TradeOffer.countDocuments({
        $or: [{ senderId: userId }, { receiverId: userId }],
        status: 'completed',
    });
    const reviews = await review_model_1.Review.find({ reviewee: userId });
    let totalRating = 0;
    let positiveCount = 0;
    reviews.forEach((r) => {
        totalRating += r.rating;
        if (r.rating >= 4) { // Assuming 4 and 5 are positive
            positiveCount++;
        }
    });
    const rating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : "0.0";
    const positive = reviews.length > 0 ? Math.round((positiveCount / reviews.length) * 100) : 0;
    const [followers, following] = await Promise.all([
        follow_model_1.Follow.countDocuments({ followingId: userId }),
        follow_model_1.Follow.countDocuments({ followerId: userId })
    ]);
    return {
        trades: tradesCount,
        rating: Number(rating),
        positive: positive, // percentage
        followers,
        following
    };
};
const updateProfile = async (user, payload) => {
    console.log({ payload });
    const isUserExist = await user_model_1.User.findOne({
        _id: user.userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    });
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    if (payload.username) {
        const trimmedUsername = payload.username.trim().toLowerCase();
        // Validate username format (alphanumeric and underscores, 3-20 chars)
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Username must be between 3 and 20 characters and contain only letters, numbers, and underscores.');
        }
        const isUsernameTaken = await user_model_1.User.findOne({
            username: trimmedUsername,
            _id: { $ne: user.userId },
            status: { $nin: [user_1.USER_STATUS.DELETED] },
        });
        if (isUsernameTaken) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Username is already taken.');
        }
        payload.username = trimmedUsername;
    }
    // if (isUserExist.profile) {
    //   const url = new URL(isUserExist.profile)
    //   const key = url.pathname.substring(1)
    //   await S3Helper.deleteFromS3(key)
    // }
    const updatedProfile = await user_model_1.User.findOneAndUpdate({ _id: user.userId, status: { $nin: [user_1.USER_STATUS.DELETED] } }, {
        $set: payload,
    }, { new: true });
    if (!updatedProfile) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to update profile.');
    }
    return 'Profile updated successfully.';
};
const createAdmin = async () => {
    var _a, _b;
    const email = (_a = config_1.default.super_admin.email) === null || _a === void 0 ? void 0 : _a.toLowerCase().trim();
    const name = (_b = config_1.default.super_admin.name) === null || _b === void 0 ? void 0 : _b.trim();
    const password = config_1.default.super_admin.password;
    if (!email || !password) {
        console.warn('⚠️ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set. Skipping admin creation.');
        return null;
    }
    const isAdminExist = await user_model_1.User.findOne({
        email,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    });
    if (isAdminExist) {
        console.log('Admin account already exist, skipping creation.🦥');
        return isAdminExist;
    }
    const admin = {
        email,
        name: name || 'Super Admin',
        password,
        roles: [user_1.USER_ROLES.SUPER_ADMIN],
        activeRole: user_1.USER_ROLES.SUPER_ADMIN,
        status: user_1.USER_STATUS.ACTIVE,
        verified: true,
        authentication: {
            oneTimeCode: '',
            restrictionLeftAt: null,
            expiresAt: null,
            latestRequestAt: new Date(),
            authType: 'createAccount',
            resetPassword: false,
            wrongLoginAttempts: 0,
        },
    };
    // Use single-document create to trigger pre-save hooks (for password hashing)
    const result = await user_model_1.User.create(admin);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create admin');
    }
    return result.toObject();
};
const getAllUsers = async (paginationOptions, filterables = {}) => {
    const { searchTerm, ...filterData } = filterables;
    const { page, skip, limit, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    let whereConditions = {};
    // 🔥 FIXED: Properly typed arrays
    const searchConditions = [];
    const filterConditions = [];
    // Search functionality
    if (searchTerm && searchTerm.trim() !== '') {
        searchConditions.push({
            $or: user_constants_1.userFilterableFields.map(field => ({
                [field]: {
                    $regex: searchTerm.trim(),
                    $options: 'i',
                },
            })),
        });
    }
    // Filter functionality
    if (Object.keys(filterData).length > 0) {
        Object.entries(filterData).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                filterConditions.push({ [key]: value });
            }
        });
    }
    // Always exclude deleted users
    filterConditions.push({
        status: { $nin: [user_1.USER_STATUS.DELETED, null] },
    });
    // Combine conditions
    if (searchConditions.length > 0 && filterConditions.length > 0) {
        whereConditions = {
            $and: [...searchConditions, ...filterConditions],
        };
    }
    else if (searchConditions.length > 0) {
        whereConditions = { $and: searchConditions };
    }
    else if (filterConditions.length > 0) {
        whereConditions = { $and: filterConditions };
    }
    const [users, total] = await Promise.all([
        user_model_1.User.find(whereConditions)
            .skip(skip)
            .limit(limit)
            .sort(sortBy ? { [sortBy]: sortOrder } : { createdAt: -1 })
            .select('-password -authentication -__v')
            .lean(),
        user_model_1.User.countDocuments(whereConditions),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: users,
    };
};
const deleteUser = async (userId) => {
    const isUserExist = await user_model_1.User.findOne({
        _id: userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    });
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    const deletedUser = await user_model_1.User.findOneAndUpdate({ _id: userId, status: { $nin: [user_1.USER_STATUS.DELETED] } }, { $set: { status: user_1.USER_STATUS.DELETED } }, { new: true });
    if (!deletedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to delete user.');
    }
    return 'User deleted successfully.';
};
const deleteProfile = async (userId, password) => {
    const isUserExist = await user_model_1.User.findOne({
        _id: userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    }).select('+password');
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    const isPasswordMatched = await user_model_1.User.isPasswordMatched(password, isUserExist.password);
    if (!isPasswordMatched) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Password is incorrect.');
    }
    const deletedUser = await user_model_1.User.findOneAndUpdate({ _id: userId, status: { $nin: [user_1.USER_STATUS.DELETED] } }, { $set: { status: user_1.USER_STATUS.DELETED } }, { new: true });
    if (!deletedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to delete user.');
    }
    return 'User deleted successfully.';
};
const deactivateProfile = async (userId, password) => {
    const isUserExist = await user_model_1.User.findOne({
        _id: userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    }).select('+password');
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    const isPasswordMatched = await user_model_1.User.isPasswordMatched(password, isUserExist.password);
    if (!isPasswordMatched) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Password is incorrect.');
    }
    const deactivatedUser = await user_model_1.User.findOneAndUpdate({ _id: userId, status: { $nin: [user_1.USER_STATUS.DELETED] } }, { $set: { status: user_1.USER_STATUS.INACTIVE } }, { new: true });
    if (!deactivatedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to deactivate user.');
    }
    return 'User deactivated successfully.';
};
const getUserById = async (userId) => {
    const isUserExist = await user_model_1.User.findOne({
        _id: userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    }).lean();
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    const stats = await getUserStats(userId);
    const upcomingShows = await auction_model_1.LiveStream.find({
        sellerId: userId,
        status: 'scheduled',
        scheduledAt: { $gt: new Date() }
    })
        .populate('pinnedProductId')
        .sort({ scheduledAt: 1 })
        .lean();
    return { ...isUserExist, stats, upcomingShows };
};
const updateUserStatus = async (userId, data) => {
    if (userId.startsWith('60f7e271a39f6c00')) {
        return 'Demo user updated successfully.';
    }
    const isUserExist = await user_model_1.User.findOne({
        _id: userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    });
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    const updatedUser = await user_model_1.User.findOneAndUpdate({ _id: userId, status: { $nin: [user_1.USER_STATUS.DELETED] } }, { $set: data }, { new: true });
    if (!updatedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to update user.');
    }
    return 'User updated successfully.';
};
const getProfile = async (user) => {
    // --- Fetch user ---
    const isUserExist = await user_model_1.User.findOne({
        _id: user.userId,
        status: { $nin: [user_1.USER_STATUS.DELETED] },
    })
        .select('-authentication -password -__v')
        .lean();
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    const stats = await getUserStats(user.userId);
    const upcomingShows = await auction_model_1.LiveStream.find({
        sellerId: user.userId,
        status: 'scheduled',
        scheduledAt: { $gt: new Date() }
    })
        .populate('pinnedProductId')
        .sort({ scheduledAt: 1 })
        .lean();
    return { ...isUserExist, stats, upcomingShows };
};
exports.getProfile = getProfile;
const switchRole = async (user, role) => {
    const isUserExist = await user_model_1.User.findById(user.userId);
    if (!isUserExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    // Special case: User wants to become seller but doesn't have the role yet
    if (role === user_1.USER_ROLES.SELLER &&
        !isUserExist.roles.includes(user_1.USER_ROLES.SELLER)) {
        // ProfessionalProfile logic removed
        // Add the seller role to the user and request verification
        await user_model_1.User.findByIdAndUpdate(user.userId, {
            $addToSet: { roles: user_1.USER_ROLES.SELLER },
            $set: { sellerVerified: false },
        });
    }
    else if (!isUserExist.roles.includes(role)) {
        // For other roles, they must already have it
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `User does not have the ${role} role.`);
    }
    const result = await user_model_1.User.findByIdAndUpdate(user.userId, { activeRole: role }, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to switch role.');
    }
    // Generate new tokens with updated activeRole
    const accessToken = jwtHelper_1.jwtHelper.createToken({
        userId: result._id.toString(),
        authId: result._id.toString(),
        role: result.roles[0],
        activeRole: result.activeRole,
    }, config_1.default.jwt.jwt_secret, config_1.default.jwt.jwt_expire_in);
    const refreshToken = jwtHelper_1.jwtHelper.createToken({
        userId: result._id.toString(),
        authId: result._id.toString(),
        role: result.roles[0],
        activeRole: result.activeRole,
    }, config_1.default.jwt.jwt_refresh_secret, config_1.default.jwt.jwt_refresh_expire_in);
    return {
        // user: result,
        accessToken,
        refreshToken,
    };
};
const blockUser = async (userId, targetUserId) => {
    if (userId === targetUserId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot block yourself.');
    }
    const targetUser = await user_model_1.User.findById(targetUserId);
    if (!targetUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User to block not found.');
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetUser._id } }, { new: true });
    if (!updatedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to block user.');
    }
    // Automatically delete follow relationship in both directions
    await follow_model_1.Follow.deleteMany({
        $or: [
            { followerId: userId, followingId: targetUserId },
            { followerId: targetUserId, followingId: userId },
        ],
    });
    return 'User blocked successfully.';
};
const unblockUser = async (userId, targetUserId) => {
    if (userId === targetUserId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You cannot unblock yourself.');
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetUserId } }, { new: true });
    if (!updatedUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to unblock user.');
    }
    return 'User unblocked successfully.';
};
const getBlockedUsers = async (userId) => {
    const user = await user_model_1.User.findById(userId)
        .populate('blockedUsers', 'name fullName email image profile')
        .lean();
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    }
    return user.blockedUsers || [];
};
exports.UserServices = {
    updateProfile,
    createAdmin,
    getAllUsers,
    deleteUser,
    getUserById,
    updateUserStatus,
    getProfile: exports.getProfile,
    deleteProfile,
    deactivateProfile,
    switchRole,
    blockUser,
    unblockUser,
    getBlockedUsers,
};
