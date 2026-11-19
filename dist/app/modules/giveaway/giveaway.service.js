"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiveawayService = void 0;
const giveaway_model_1 = require("./giveaway.model");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const user_model_1 = require("../user/user.model");
const mongoose_1 = require("mongoose");
const enterGiveaway = async (userId) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    if (!user.verified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Please verify your account to enter this giveaway.');
    }
    const activeConfig = await getActiveConfig();
    if (!activeConfig || !activeConfig.isActive) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Giveaway is currently closed.');
    }
    if (activeConfig.drawDate && new Date() > new Date(activeConfig.drawDate)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Giveaway entry deadline has passed.');
    }
    const slug = activeConfig.slug || 'michael-vick-jersey-2026';
    const existing = await giveaway_model_1.GiveawayParticipant.findOne({
        userId: user._id,
        giveawaySlug: slug,
    });
    if (existing) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, "You're already entered in this giveaway!");
    }
    const participant = await giveaway_model_1.GiveawayParticipant.create({
        userId: user._id,
        giveawaySlug: slug,
        name: user.fullName || user.name || 'Participant',
        email: user.email || '',
        status: 'active',
        enteredAt: new Date(),
        expiresAt: activeConfig.drawDate || undefined,
    });
    return participant;
};
const getMyStatus = async (userId) => {
    const user = await user_model_1.User.findById(userId).select('verified name fullName email');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    const activeConfig = await getActiveConfig();
    const slug = activeConfig.slug || 'michael-vick-jersey-2026';
    const entry = await giveaway_model_1.GiveawayParticipant.findOne({
        userId: user._id,
        giveawaySlug: slug,
    });
    return {
        isGiveawayActive: Boolean(activeConfig === null || activeConfig === void 0 ? void 0 : activeConfig.isActive),
        isUserVerified: Boolean(user.verified),
        hasEntered: Boolean(entry),
        enteredAt: (entry === null || entry === void 0 ? void 0 : entry.enteredAt) || null,
        status: (entry === null || entry === void 0 ? void 0 : entry.status) || null,
        config: activeConfig,
    };
};
const getRandomPool = async (limit = 100, slug) => {
    const activeConfig = await getActiveConfig();
    const targetSlug = slug || activeConfig.slug || 'michael-vick-jersey-2026';
    const participants = await giveaway_model_1.GiveawayParticipant.aggregate([
        {
            $match: {
                giveawaySlug: targetSlug,
                status: { $in: ['active', 'shortlisted'] },
            },
        },
        { $sample: { size: Math.max(1, Math.min(limit, 500)) } },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails',
            },
        },
        {
            $unwind: {
                path: '$userDetails',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                _id: 1,
                userId: 1,
                giveawaySlug: 1,
                name: 1,
                email: 1,
                status: 1,
                enteredAt: 1,
                'userDetails.name': 1,
                'userDetails.fullName': 1,
                'userDetails.username': 1,
                'userDetails.email': 1,
                'userDetails.profile': 1,
                'userDetails.address': 1,
                'userDetails.phone': 1,
            },
        },
    ]);
    return participants;
};
const autoEnrollUser = async (userId, name, email) => {
    try {
        const activeConfig = await getActiveConfig();
        const slug = activeConfig.slug || 'michael-vick-jersey-2026';
        const existing = await giveaway_model_1.GiveawayParticipant.findOne({ userId, giveawaySlug: slug });
        if (existing)
            return existing;
        const durationDays = activeConfig.durationDays || 14;
        const enteredAt = new Date();
        const expiresAt = activeConfig.drawDate ||
            new Date(enteredAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const participant = await giveaway_model_1.GiveawayParticipant.create({
            userId,
            giveawaySlug: slug,
            name,
            email,
            status: 'active',
            enteredAt,
            expiresAt,
        });
        return participant;
    }
    catch (error) {
        console.error('Auto giveaway enrollment error (non-fatal):', error);
        return null;
    }
};
const drawLiveWinner = async (streamId, participantId, userId) => {
    const now = new Date();
    const activeConfig = await getActiveConfig();
    const slug = activeConfig.slug || 'michael-vick-jersey-2026';
    let winnerParticipant = null;
    const targetId = participantId || userId;
    if (targetId && mongoose_1.Types.ObjectId.isValid(targetId)) {
        winnerParticipant = await giveaway_model_1.GiveawayParticipant.findOne({
            giveawaySlug: slug,
            $or: [{ _id: targetId }, { userId: targetId }],
        });
    }
    if (!winnerParticipant) {
        // Pick randomly via MongoDB $sample
        const results = await giveaway_model_1.GiveawayParticipant.aggregate([
            {
                $match: {
                    giveawaySlug: slug,
                    status: { $in: ['active', 'shortlisted'] },
                },
            },
            { $sample: { size: 1 } },
        ]);
        if (results.length === 0) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'No eligible giveaway participants available in the pool.');
        }
        winnerParticipant = results[0];
    }
    // Update winner status
    const updatedWinner = await giveaway_model_1.GiveawayParticipant.findByIdAndUpdate(winnerParticipant._id, {
        status: 'won',
        wonStreamId: streamId || null,
        wonAt: now,
    }, { new: true }).populate('userId', 'name fullName email profile address phone username');
    return updatedWinner;
};
const getWinners = async (slug) => {
    const activeConfig = await getActiveConfig();
    const targetSlug = slug || activeConfig.slug || 'michael-vick-jersey-2026';
    const winners = await giveaway_model_1.GiveawayParticipant.find({
        giveawaySlug: targetSlug,
        status: 'won',
    })
        .populate('userId', 'name fullName email profile username address phone')
        .sort({ wonAt: -1 });
    return winners;
};
const getParticipants = async (paginationOptions, status, slug) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    const whereConditions = {};
    if (status) {
        whereConditions.status = status;
    }
    if (slug) {
        whereConditions.giveawaySlug = slug;
    }
    const sortConditions = {};
    if (sortBy && sortOrder) {
        sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }
    else {
        sortConditions.createdAt = -1;
    }
    const result = await giveaway_model_1.GiveawayParticipant.find(whereConditions)
        .populate('userId', 'name fullName email profile address phone username')
        .sort(sortConditions)
        .skip(skip)
        .limit(limit);
    const total = await giveaway_model_1.GiveawayParticipant.countDocuments(whereConditions);
    return {
        meta: {
            page,
            limit,
            total,
        },
        data: result,
    };
};
const updateGiveawayConfig = async (payload) => {
    // Sync prizeImage and bannerUrl
    if (payload.bannerUrl && !payload.prizeImage) {
        payload.prizeImage = payload.bannerUrl;
    }
    if (payload.prizeImage && !payload.bannerUrl) {
        payload.bannerUrl = payload.prizeImage;
    }
    if (payload.title && !payload.prizeTitle) {
        payload.prizeTitle = payload.title;
    }
    let filter = {};
    if (payload.slug) {
        filter = { slug: payload.slug };
    }
    else {
        const active = await giveaway_model_1.GiveawayConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
        if (active) {
            filter = { _id: active._id };
        }
        else {
            filter = { slug: 'giannis-antetokounmpo-jersey-2026' };
        }
    }
    const result = await giveaway_model_1.GiveawayConfig.findOneAndUpdate(filter, { $set: payload }, { new: true, upsert: true });
    // If marked active, ensure other configs are deactivated
    if (payload.isActive === true && result) {
        await giveaway_model_1.GiveawayConfig.updateMany({ _id: { $ne: result._id } }, { $set: { isActive: false } });
    }
    return result;
};
const getActiveConfig = async () => {
    let configDoc = await giveaway_model_1.GiveawayConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
    if (!configDoc) {
        configDoc = await giveaway_model_1.GiveawayConfig.findOneAndUpdate({ slug: 'giannis-antetokounmpo-jersey-2026' }, {
            slug: 'giannis-antetokounmpo-jersey-2026',
            title: 'Giannis Antetokounmpo Jersey Giveaway',
            prizeTitle: 'Official Signed Giannis Antetokounmpo Jersey',
            prizeImage: '',
            bannerUrl: '',
            drawDate: new Date('2026-12-05T23:59:59.999Z'),
            durationDays: 30,
            isActive: true,
            description: 'Enter for a chance to win the Giannis Antetokounmpo Jersey! Winner will be drawn on December 5th.',
        }, { new: true, upsert: true });
        await giveaway_model_1.GiveawayConfig.updateMany({ slug: { $ne: 'giannis-antetokounmpo-jersey-2026' } }, { $set: { isActive: false } });
    }
    // upsert + new always returns a doc; this guard satisfies the type checker
    // (the nullable type here was failing `npm run build` and blocking deploys).
    if (!configDoc) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Giveaway configuration is unavailable.');
    }
    return configDoc;
};
exports.GiveawayService = {
    enterGiveaway,
    getMyStatus,
    getRandomPool,
    autoEnrollUser,
    drawLiveWinner,
    getWinners,
    getParticipants,
    updateGiveawayConfig,
    getActiveConfig,
};
