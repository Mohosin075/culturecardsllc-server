"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("./user.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const user_validation_1 = require("./user.validation");
const processReqBody_1 = require("../../middleware/processReqBody");
const router = express_1.default.Router();
router.patch('/switch-role', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL), (0, validateRequest_1.default)(user_validation_1.switchRoleSchema), user_controller_1.UserController.switchRole);
router.get('/profile', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), user_controller_1.UserController.getProfile);
router.patch('/profile', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), (0, processReqBody_1.fileAndBodyProcessorUsingDiskStorage)(), (0, validateRequest_1.default)(user_validation_1.updateUserSchema), user_controller_1.UserController.updateProfile);
router.delete('/profile', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), user_controller_1.UserController.deleteProfile);
router.patch('/deactivate-profile', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.deactivateProfile);
// Removed missing ProfessionalProfileController stripe connect routes
router
    .route('/')
    .get((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.PROFESSIONAL), user_controller_1.UserController.getAllUsers);
router
    .route('/:userId')
    .get((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.USER), user_controller_1.UserController.getUserById)
    .delete((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.deleteUser)
    .patch((0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(user_validation_1.updateUserStatusSchema), user_controller_1.UserController.updateUserStatus);
exports.UserRoutes = router;
