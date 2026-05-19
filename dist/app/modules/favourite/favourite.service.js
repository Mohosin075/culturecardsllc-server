"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavouriteService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const favourite_interface_1 = require("./favourite.interface");
const favourite_model_1 = require("./favourite.model");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const toggleFavourite = async (userId, payload) => {
    const { favouriteType, service, provider } = payload;
    const filter = { user: userId, favouriteType };
    if (favouriteType === favourite_interface_1.FavouriteType.SERVICE) {
        if (!service)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Service ID is required');
        filter.service = service;
    }
    else {
        if (!provider)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Provider ID is required');
        filter.provider = provider;
    }
    const existingFavourite = await favourite_model_1.Favourite.findOne(filter);
    if (existingFavourite) {
        await favourite_model_1.Favourite.findByIdAndDelete(existingFavourite._id);
        return { message: 'Removed from favourites', status: 'removed' };
    }
    else {
        await favourite_model_1.Favourite.create({ ...filter, user: userId });
        return { message: 'Added to favourites', status: 'added' };
    }
};
const getMyFavourites = async (userId, favouriteType, paginationOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    const whereConditions = { user: userId };
    if (favouriteType) {
        whereConditions.favouriteType = favouriteType;
    }
    const sortConditions = {};
    if (sortBy && sortOrder) {
        sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }
    else {
        sortConditions.createdAt = -1;
    }
    const result = await favourite_model_1.Favourite.find(whereConditions)
        .populate({
        path: 'service',
        populate: [
            { path: 'providerId', select: 'name email profile' },
            { path: 'category', select: 'name image' },
        ],
    })
        .populate('provider', 'name email profile')
        .skip(skip)
        .limit(limit)
        .sort(sortConditions);
    const total = await favourite_model_1.Favourite.countDocuments(whereConditions);
    return {
        meta: {
            page,
            limit,
            total,
        },
        data: result,
    };
};
exports.FavouriteService = {
    toggleFavourite,
    getMyFavourites,
};
