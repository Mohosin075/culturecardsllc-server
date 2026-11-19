"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const user_1 = require("../../../enum/user");
const seller_controller_1 = require("./seller.controller");
const seller_validation_1 = require("./seller.validation");
const router = express_1.default.Router();
// ── Stripe redirect landings ───────────────────────────────────────────────
// Stripe sends the seller's browser here, so these must stay unauthenticated.
router.get('/stripe/return', seller_controller_1.SellerControllers.stripeReturn);
router.get('/stripe/refresh', seller_controller_1.SellerControllers.stripeRefresh);
// ── 1. Seller application ──────────────────────────────────────────────────
router.post('/apply', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(seller_validation_1.SellerValidations.applyAsSellerZodSchema), seller_controller_1.SellerControllers.applyAsSeller);
// ── 3. Status the app polls after coming back from Stripe ──────────────────
router.get('/application', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), seller_controller_1.SellerControllers.getMyApplication);
// ── 2. Stripe onboarding links ─────────────────────────────────────────────
router.post('/stripe/onboarding-link', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), seller_controller_1.SellerControllers.createOnboardingLink);
router.get('/stripe/dashboard-link', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), seller_controller_1.SellerControllers.createDashboardLink);
// ── Seller earnings, read from their Stripe balance ────────────────────────
router.get('/earnings', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), seller_controller_1.SellerControllers.getMyEarnings);
exports.SellerRoutes = router;
exports.default = exports.SellerRoutes;
