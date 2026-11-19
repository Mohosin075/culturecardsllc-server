"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiveawayRoutes = void 0;
const express_1 = __importDefault(require("express"));
const giveaway_controller_1 = require("./giveaway.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// User Giveaway Actions
router.post('/enter', (0, auth_1.default)(), giveaway_controller_1.GiveawayController.enterGiveaway);
router.get('/my-status', (0, auth_1.default)(), giveaway_controller_1.GiveawayController.getMyStatus);
// Public info
router.get('/config', giveaway_controller_1.GiveawayController.getConfig);
router.get('/winners', giveaway_controller_1.GiveawayController.getWinners);
// Draw & Random Pool endpoints (Admin / Super Admin / Seller)
router.get('/random-pool', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), giveaway_controller_1.GiveawayController.getRandomPool);
router.post('/draw-winner', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), giveaway_controller_1.GiveawayController.drawWinner);
// Admin Management
router.get('/participants', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), giveaway_controller_1.GiveawayController.getParticipants);
router.patch('/config', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), giveaway_controller_1.GiveawayController.updateConfig);
exports.GiveawayRoutes = router;
