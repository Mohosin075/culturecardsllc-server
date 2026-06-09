"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterestCategory = exports.SERVICE_TYPE = exports.USER_STATUS = exports.USER_ROLES = void 0;
// export enum USER_ROLES {
//   ADMIN = 'admin',
//   CREATOR = 'creator',
//   USER = 'user'
// }
var USER_ROLES;
(function (USER_ROLES) {
    USER_ROLES["SUPER_ADMIN"] = "super_admin";
    USER_ROLES["ADMIN"] = "admin";
    USER_ROLES["USER"] = "user";
    USER_ROLES["PROFESSIONAL"] = "professional";
})(USER_ROLES || (exports.USER_ROLES = USER_ROLES = {}));
var USER_STATUS;
(function (USER_STATUS) {
    USER_STATUS["ACTIVE"] = "active";
    USER_STATUS["INACTIVE"] = "inactive";
    USER_STATUS["DELETED"] = "deleted";
})(USER_STATUS || (exports.USER_STATUS = USER_STATUS = {}));
var SERVICE_TYPE;
(function (SERVICE_TYPE) {
    SERVICE_TYPE["PHOTOGRAPHY"] = "photography";
    SERVICE_TYPE["VIDEOGRAPHY"] = "videography";
    SERVICE_TYPE["VIDEO_EDITING"] = "video_editing";
    SERVICE_TYPE["PHOTO_EDITING"] = "photo_editing";
    SERVICE_TYPE["GRAPHIC_DESIGN"] = "graphic_design";
    SERVICE_TYPE["DRONE_PHOTOGRAPHY"] = "drone_photography";
    SERVICE_TYPE["EVENT_COVERAGE"] = "event_coverage";
    SERVICE_TYPE["STUDIO_RENTAL"] = "studio_rental";
})(SERVICE_TYPE || (exports.SERVICE_TYPE = SERVICE_TYPE = {}));
var InterestCategory;
(function (InterestCategory) {
    InterestCategory["LIVE_MUSIC"] = "live_music";
    InterestCategory["NIGHTLIFE"] = "nightlife";
    InterestCategory["CONCERTS"] = "concerts";
    InterestCategory["FOOD_DRINKS"] = "food_drinks";
    InterestCategory["COMEDY"] = "comedy";
    InterestCategory["ART_CULTURE"] = "art_culture";
    InterestCategory["WELLNESS"] = "wellness";
    InterestCategory["NETWORKING"] = "networking";
    InterestCategory["SPORTS"] = "sports";
    InterestCategory["TECH"] = "tech";
    InterestCategory["EDUCATION"] = "education";
    InterestCategory["FASHION"] = "fashion";
    InterestCategory["GAMING"] = "gaming";
    InterestCategory["TRAVEL"] = "travel";
    InterestCategory["OUTDOOR"] = "outdoor";
    InterestCategory["FAMILY"] = "family";
})(InterestCategory || (exports.InterestCategory = InterestCategory = {}));
