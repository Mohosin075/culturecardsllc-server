"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavouriteRoutes = void 0;
const express_1 = __importDefault(require("express"));
const favourite_controller_1 = require("./favourite.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const favourite_validation_1 = require("./favourite.validation");
const router = express_1.default.Router();
router.post('/toggle', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(favourite_validation_1.FavouriteValidation.toggleFavouriteZodSchema), favourite_controller_1.FavouriteController.toggleFavourite);
router.get('/my-favourites', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), favourite_controller_1.FavouriteController.getMyFavourites);
exports.FavouriteRoutes = router;
