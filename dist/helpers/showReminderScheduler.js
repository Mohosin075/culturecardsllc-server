"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initShowReminderScheduler = void 0;
const auction_model_1 = require("../app/modules/auction/auction.model");
const notification_integration_1 = require("../app/modules/notification/notification.integration");
const initShowReminderScheduler = () => {
    console.log('⏰ Show Reminder Scheduler initialized (15-min notification checker).');
    // Run initial check after 10 seconds, then every 60 seconds
    setTimeout(checkAndSendReminders, 10000);
    setInterval(checkAndSendReminders, 60000);
};
exports.initShowReminderScheduler = initShowReminderScheduler;
const checkAndSendReminders = async () => {
    try {
        const now = new Date();
        const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000);
        // Find scheduled streams starting within 15 minutes that haven't sent reminders yet
        const upcomingStreams = await auction_model_1.LiveStream.find({
            status: 'scheduled',
            reminderSent: { $ne: true },
            scheduledStartTime: { $lte: fifteenMinutesLater, $gte: now },
        }).populate('sellerId', 'name fullName');
        if (upcomingStreams.length === 0)
            return;
        for (const stream of upcomingStreams) {
            const seller = stream.sellerId;
            const sellerName = (seller === null || seller === void 0 ? void 0 : seller.fullName) || (seller === null || seller === void 0 ? void 0 : seller.name) || 'Host';
            console.log(`[REMINDER] Sending 15-min push notifications for stream: "${stream.title}" (${stream._id})`);
            await notification_integration_1.NotificationIntegration.onScheduledShowReminder(stream._id.toString(), stream.title, sellerName);
            // Mark reminder as sent
            await auction_model_1.LiveStream.findByIdAndUpdate(stream._id, {
                $set: { reminderSent: true },
            });
        }
    }
    catch (error) {
        console.error('Error in checkAndSendReminders scheduler:', error);
    }
};
