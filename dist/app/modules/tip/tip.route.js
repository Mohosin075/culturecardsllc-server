"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipRoutes = void 0;
const express_1 = __importDefault(require("express"));
const tip_controller_1 = require("./tip.controller");
const tip_validation_1 = require("./tip.validation");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
router.post('/create-intent', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(tip_validation_1.TipValidation.createTipIntentZodSchema), tip_controller_1.TipController.createTipIntent);
router.post('/confirm', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(tip_validation_1.TipValidation.confirmTipZodSchema), tip_controller_1.TipController.confirmTip);
router.get('/stream/:streamId', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), tip_controller_1.TipController.getStreamTips);
router.get('/my-tips', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), tip_controller_1.TipController.getMySellerTips);
exports.TipRoutes = router;
