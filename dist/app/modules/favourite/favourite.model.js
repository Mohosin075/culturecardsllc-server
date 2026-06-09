"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Favourite = void 0;
const mongoose_1 = require("mongoose");
const favourite_interface_1 = require("./favourite.interface");
const favouriteSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    favouriteType: {
        type: String,
        enum: Object.values(favourite_interface_1.FavouriteType),
        required: true,
    },
    service: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Service',
    },
    provider: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Ensure unique favorite per user and target
favouriteSchema.index({ user: 1, service: 1 }, { unique: true, sparse: true });
favouriteSchema.index({ user: 1, provider: 1 }, { unique: true, sparse: true });
exports.Favourite = (0, mongoose_1.model)('Favourite', favouriteSchema);
