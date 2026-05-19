"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = void 0;
const mongoose_1 = require("mongoose");
const tokenSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    token: {
        type: String,
        required: true,
    },
    expireAt: {
        type: Date,
        required: true,
    },
}, {
    timestamps: true,
});
exports.Token = (0, mongoose_1.model)('Token', tokenSchema);
