"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_AUDIENCE = exports.NOTIFICATION_CATEGORY = void 0;
var NOTIFICATION_CATEGORY;
(function (NOTIFICATION_CATEGORY) {
    NOTIFICATION_CATEGORY["GENERAL"] = "general";
    NOTIFICATION_CATEGORY["EVENT_ALERT"] = "event_alert";
    NOTIFICATION_CATEGORY["EVENT_INVITATION"] = "event_invitation";
    NOTIFICATION_CATEGORY["PROMOTION"] = "promotion";
})(NOTIFICATION_CATEGORY || (exports.NOTIFICATION_CATEGORY = NOTIFICATION_CATEGORY = {}));
var TARGET_AUDIENCE;
(function (TARGET_AUDIENCE) {
    TARGET_AUDIENCE["ALL_USER"] = "all_user";
    TARGET_AUDIENCE["ORGANIZER"] = "organizer";
    TARGET_AUDIENCE["ACTIVE_USER"] = "active_user";
    TARGET_AUDIENCE["ADMIN"] = "admin";
})(TARGET_AUDIENCE || (exports.TARGET_AUDIENCE = TARGET_AUDIENCE = {}));
