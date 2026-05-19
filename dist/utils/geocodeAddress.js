"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeAddress = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const config_1 = __importDefault(require("../config"));
const geocodeAddress = async (location) => {
    try {
        const agent = new https_1.default.Agent({ family: 4 });
        const API_KEY = config_1.default.server_map_api_key;
        console.log('Geocoding Request Location:', location);
        const response = await axios_1.default.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: location.trim(),
                key: API_KEY,
            },
            httpsAgent: agent,
        });
        console.log('Geocoding Response Status:', response.data.status);
        if (response.data.error_message) {
            console.log('Geocoding Error Message:', response.data.error_message);
        }
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const result = response.data.results[0];
            const { lat, lng } = result.geometry.location;
            return {
                lat: lat,
                lng: lng,
                formattedAddress: result.formatted_address,
            };
        }
        console.log('No coordinates found for:', location);
        return null;
    }
    catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
};
exports.geocodeAddress = geocodeAddress;
