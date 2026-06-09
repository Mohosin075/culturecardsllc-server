"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const notification_service_1 = require("../app/modules/notification/notification.service");
// Run every minute to check for scheduled notifications
node_cron_1.default.schedule('* * * * *', async () => {
    console.log('Checking for scheduled notifications...');
    await notification_service_1.NotificationServices.sendScheduledNotifications();
});
