"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const user_model_1 = require("../app/modules/user/user.model");
node_cron_1.default.schedule('*/5 * * * *', async () => {
    try {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
        const result = await user_model_1.User.deleteMany({
            isVerified: false,
            createdAt: { $lt: cutoff },
        });
        console.log(`[CRON] Deleted ${result.deletedCount} unverified users (older than 5 minutes)`);
    }
    catch (error) {
        console.error('[CRON] Error deleting unverified users:', error);
    }
});
