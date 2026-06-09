"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const location_service_1 = require("./location.service");
const searchSuggestions = (0, catchAsync_1.default)(async (req, res) => {
    const query = req.query.q;
    const result = await location_service_1.LocationServices.searchSuggestions(query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Location suggestions retrieved successfully',
        data: result,
    });
});
const geocodeAddress = (0, catchAsync_1.default)(async (req, res) => {
    const address = req.query.address;
    const result = await location_service_1.LocationServices.geocodeAddress(address);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Location geocoded successfully',
        data: result,
    });
});
exports.LocationController = {
    searchSuggestions,
    geocodeAddress,
};
