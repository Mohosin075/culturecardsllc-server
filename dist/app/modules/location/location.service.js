"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationServices = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const searchSuggestions = async (query) => {
    const apiKey = config_1.default.server_map_api_key;
    if (!apiKey) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Map API key is not configured');
    }
    try {
        const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
            params: {
                input: query,
                key: apiKey,
            },
        });
        if (response.data.status !== 'OK' &&
            response.data.status !== 'ZERO_RESULTS') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Google API Error: ${response.data.status}`);
        }
        const predictions = response.data.predictions || [];
        return predictions.map((prediction) => ({
            description: prediction.description,
            placeId: prediction.place_id,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text,
        }));
    }
    catch (error) {
        throw new ApiError_1.default(error.statusCode || http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, error.message || 'Failed to fetch suggestions');
    }
};
const geocodeAddress = async (address) => {
    const apiKey = config_1.default.server_map_api_key;
    if (!apiKey) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Map API key is not configured');
    }
    try {
        const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key: apiKey,
            },
        });
        if (response.data.status === 'ZERO_RESULTS') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Location not found');
        }
        if (response.data.status !== 'OK') {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Google API Error: ${response.data.status}`);
        }
        const result = response.data.results[0];
        const { lat, lng } = result.geometry.location;
        return {
            lat,
            lng,
            formattedAddress: result.formatted_address,
            placeId: result.place_id,
        };
    }
    catch (error) {
        throw new ApiError_1.default(error.statusCode || http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, error.message || 'Failed to geocode address');
    }
};
exports.LocationServices = {
    searchSuggestions,
    geocodeAddress,
};
