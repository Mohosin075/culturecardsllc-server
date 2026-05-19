"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const passport_auth_controller_1 = require("./passport.auth/passport.auth.controller");
const custom_auth_controller_1 = require("./custom.auth/custom.auth.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const auth_validation_1 = require("./auth.validation");
const user_1 = require("../../../enum/user");
const auth_1 = __importDefault(require("../../middleware/auth"));
const router = express_1.default.Router();
router.post('/signup', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.createUserZodSchema), custom_auth_controller_1.CustomAuthController.createUser);
router.post('/admin-login', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.loginZodSchema), custom_auth_controller_1.CustomAuthController.adminLogin);
// i disabled the local login route because it is not used in the app
// router.post(
//   '/login',
//   validateRequest(AuthValidations.loginZodSchema),
//   passport.authenticate('local', { session: false }),
//   PassportAuthController.login,
// )
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport_1.default.authenticate('google', { session: false }), passport_auth_controller_1.PassportAuthController.googleAuthCallback);
router.post('/verify-account', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.verifyAccountZodSchema), custom_auth_controller_1.CustomAuthController.verifyAccount);
// custom login route
router.post('/login', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.loginZodSchema), custom_auth_controller_1.CustomAuthController.customLogin);
router.post('/forget-password', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.forgetPasswordZodSchema), custom_auth_controller_1.CustomAuthController.forgetPassword);
router.post('/reset-password', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.resetPasswordZodSchema), custom_auth_controller_1.CustomAuthController.resetPassword);
router.post('/resend-otp', 
// tempAuth(USER_ROLES.ADMIN, USER_ROLES.USER),
(0, validateRequest_1.default)(auth_validation_1.AuthValidations.resendOtpZodSchema), custom_auth_controller_1.CustomAuthController.resendOtp);
router.post('/change-password', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(auth_validation_1.AuthValidations.changePasswordZodSchema), custom_auth_controller_1.CustomAuthController.changePassword);
router.delete('/delete-account', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), (0, validateRequest_1.default)(auth_validation_1.AuthValidations.deleteAccount), custom_auth_controller_1.CustomAuthController.deleteAccount);
router.post('/refresh-token', custom_auth_controller_1.CustomAuthController.getRefreshToken);
router.post('/social-login', (0, validateRequest_1.default)(auth_validation_1.AuthValidations.socialLoginZodSchema), custom_auth_controller_1.CustomAuthController.socialLogin);
router.post('/logout', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER, user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.SUPER_ADMIN), custom_auth_controller_1.CustomAuthController.logout);
exports.AuthRoutes = router;
