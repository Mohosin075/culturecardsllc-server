"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRoutes = void 0;
const express_1 = __importDefault(require("express"));
const chat_controller_1 = require("./chat.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
router.post('/contact-admin', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL), chat_controller_1.ChatController.createAdminChat);
router.post('/:id', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), chat_controller_1.ChatController.createChat);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), chat_controller_1.ChatController.getChat);
exports.ChatRoutes = router;
