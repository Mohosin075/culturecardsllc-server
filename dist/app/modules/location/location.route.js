"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const location_controller_1 = require("./location.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const location_validation_1 = require("./location.validation");
const router = express_1.default.Router();
// Allow authenticated users to search and geocode for bookings
router.get('/search', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(location_validation_1.LocationValidation.searchSuggestionsSchema), location_controller_1.LocationController.searchSuggestions);
router.get('/geocode', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(location_validation_1.LocationValidation.geocodeAddressSchema), location_controller_1.LocationController.geocodeAddress);
exports.LocationRoutes = router;
