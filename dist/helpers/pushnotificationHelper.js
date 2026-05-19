"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const config_1 = __importDefault(require("../config"));
const serviceAccountJson = Buffer.from(config_1.default.firebase_service_account_base64, 'base64').toString('utf8');
const serviceAccount = JSON.parse(serviceAccountJson);
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount),
});
const sendPushNotification = async (deviceToken, title, body, data, icon) => {
    console.log('Sending push notification to:', deviceToken);
    console.log('Notification data:', data);
    const message = {
        token: deviceToken,
        notification: { title, body },
        data,
        ...(icon && {
            android: {
                notification: { icon },
            },
        }),
        apns: {
            payload: {
                aps: {
                    'mutable-content': 1,
                },
            },
        },
    };
    try {
        const response = await firebase_admin_1.default.messaging().send(message);
        console.log('Successfully sent message:', response);
    }
    catch (error) {
        console.error('Error sending message:', error === null || error === void 0 ? void 0 : error.message, error);
    }
};
exports.sendPushNotification = sendPushNotification;
