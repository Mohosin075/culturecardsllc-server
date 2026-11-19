"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeVoteValidations = void 0;
const zod_1 = require("zod");
const castVoteSchema = zod_1.z.object({
    body: zod_1.z.object({
        option: zod_1.z.enum(['A', 'B'], {
            required_error: "Option is required and must be 'A' or 'B'",
        }),
    }),
});
exports.TradeVoteValidations = {
    castVoteSchema,
};
