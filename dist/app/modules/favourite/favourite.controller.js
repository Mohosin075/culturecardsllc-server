"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavouriteController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const pagination_1 = require("../../../interfaces/pagination");
const pick_1 = __importDefault(require("../../../shared/pick"));
const favourite_service_1 = require("./favourite.service");
const toggleFavourite = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.user;
    const result = await favourite_service_1.FavouriteService.toggleFavourite(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
});
const getMyFavourites = (0, catchAsync_1.default)(async (req, res) => {
    const { userId } = req.user;
    const paginationOptions = (0, pick_1.default)(req.query, pagination_1.paginationFields);
    const { favouriteType } = req.query;
    const result = await favourite_service_1.FavouriteService.getMyFavourites(userId, favouriteType, paginationOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Favourites retrieved successfully',
        data: result,
    });
});
exports.FavouriteController = {
    toggleFavourite,
    getMyFavourites,
};
