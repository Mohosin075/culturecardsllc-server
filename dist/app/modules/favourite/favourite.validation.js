"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavouriteValidation = void 0;
const zod_1 = require("zod");
const favourite_interface_1 = require("./favourite.interface");
const toggleFavouriteZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        favouriteType: zod_1.z.enum(Object.values(favourite_interface_1.FavouriteType)),
        service: zod_1.z.string().optional(),
        provider: zod_1.z.string().optional(),
    })
        .refine(data => {
        if (data.favouriteType === favourite_interface_1.FavouriteType.SERVICE && !data.service)
            return false;
        if (data.favouriteType === favourite_interface_1.FavouriteType.PROVIDER && !data.provider)
            return false;
        return true;
    }, {
        message: 'Either service or provider ID must be provided based on favouriteType',
    }),
});
exports.FavouriteValidation = {
    toggleFavouriteZodSchema,
};
