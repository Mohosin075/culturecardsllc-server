"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowRoutes = void 0;
const express_1 = __importDefault(require("express"));
const follow_controller_1 = require("./follow.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
router.post('/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), follow_controller_1.FollowControllers.toggleFollow);
router.get('/:id/followers', follow_controller_1.FollowControllers.getFollowers);
router.get('/:id/following', follow_controller_1.FollowControllers.getFollowing);
exports.FollowRoutes = router;
