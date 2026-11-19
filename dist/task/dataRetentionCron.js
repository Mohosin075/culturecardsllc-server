"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDataRetentionCleanup = exports.startDataRetentionCron = void 0;
const notification_model_1 = require("../app/modules/notification/notification.model");
const token_model_1 = require("../app/modules/token/token.model");
const user_model_1 = require("../app/modules/user/user.model");
const giveaway_model_1 = require("../app/modules/giveaway/giveaway.model");
const user_1 = require("../enum/user");
const startDataRetentionCron = () => {
    console.log('🛡️ Data Retention & Auto-Delete Cron initialized.');
    // Run initial cleanup check 15 seconds after server startup, then run once every 24 hours
    setTimeout(exports.runDataRetentionCleanup, 15000);
    setInterval(exports.runDataRetentionCleanup, 24 * 60 * 60 * 1000);
};
exports.startDataRetentionCron = startDataRetentionCron;
const runDataRetentionCleanup = async () => {
    try {
        const now = new Date();
        console.log(`[DATA-RETENTION] Starting automated data retention cleanup task at ${now.toISOString()}...`);
        // 1. Purge Notifications older than 90 days
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const deletedNotifications = await notification_model_1.Notification.deleteMany({
            createdAt: { $lt: ninetyDaysAgo },
        });
        if (deletedNotifications.deletedCount > 0) {
            console.log(`[DATA-RETENTION] Purged ${deletedNotifications.deletedCount} notifications older than 90 days.`);
        }
        // 2. Clean expired session/OTP tokens
        const deletedTokens = await token_model_1.Token.deleteMany({
            $or: [
                { expireAt: { $lt: now } },
                { createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
            ],
        });
        if (deletedTokens.deletedCount > 0) {
            console.log(`[DATA-RETENTION] Cleaned ${deletedTokens.deletedCount} expired OTP/session tokens.`);
        }
        // 3. Auto-anonymize / purge deleted user PII accounts deleted > 30 days ago (US CCPA/Legal compliance)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const deletedUsers = await user_model_1.User.find({
            status: user_1.USER_STATUS.DELETED,
            updatedAt: { $lt: thirtyDaysAgo },
        });
        if (deletedUsers.length > 0) {
            for (const user of deletedUsers) {
                // Anonymize user PII to comply with retention & privacy laws while keeping transaction integrity
                await user_model_1.User.findByIdAndUpdate(user._id, {
                    $set: {
                        name: 'Deleted User',
                        fullName: 'Deleted User',
                        email: `deleted_${user._id}@deleted.culturecards.com`,
                        phone: '',
                        deviceToken: '',
                        appId: '',
                        image: '',
                        photo: '',
                    },
                });
            }
            console.log(`[DATA-RETENTION] Anonymized PII for ${deletedUsers.length} deleted user accounts older than 30 days.`);
        }
        // 4. Mark expired giveaway participants
        const expiredGiveaways = await giveaway_model_1.GiveawayParticipant.updateMany({ status: 'active', expiresAt: { $lt: now } }, { $set: { status: 'expired' } });
        if (expiredGiveaways.modifiedCount > 0) {
            console.log(`[DATA-RETENTION] Marked ${expiredGiveaways.modifiedCount} giveaway participants as expired.`);
        }
        console.log('[DATA-RETENTION] Automated data retention cleanup completed successfully.');
    }
    catch (error) {
        console.error('❌ Error during data retention cleanup task:', error);
    }
};
exports.runDataRetentionCleanup = runDataRetentionCleanup;
