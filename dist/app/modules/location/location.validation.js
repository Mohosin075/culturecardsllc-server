"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationValidation = void 0;
const zod_1 = require("zod");
const searchSuggestionsSchema = zod_1.z.object({
    query: zod_1.z.object({
        q: zod_1.z.string({
            required_error: 'Search query (q) is required',
        }),
    }),
});
const geocodeAddressSchema = zod_1.z.object({
    query: zod_1.z.object({
        address: zod_1.z.string({
            required_error: 'Address is required',
        }),
    }),
});
exports.LocationValidation = {
    searchSuggestionsSchema,
    geocodeAddressSchema,
};
