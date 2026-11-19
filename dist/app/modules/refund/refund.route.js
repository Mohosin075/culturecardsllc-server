"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const user_1 = require("../../../enum/user");
const refund_controller_1 = require("./refund.controller");
const refund_validation_1 = require("./refund.validation");
const router = express_1.default.Router();
// ── Buyer ──────────────────────────────────────────────────────────────────
// "Buyers request refunds through ARIES" — this never reverses a charge on
// its own; an admin decides.
router.post('/request', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(refund_validation_1.RefundValidations.createRefundRequestZodSchema), refund_controller_1.RefundControllers.createRefundRequest);
router.get('/my-requests', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), refund_controller_1.RefundControllers.getMyRefundRequests);
// ── Seller ─────────────────────────────────────────────────────────────────
router.get('/seller-requests', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), refund_controller_1.RefundControllers.getSellerRefundRequests);
router.get('/seller-disputes', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), refund_controller_1.RefundControllers.getSellerDisputes);
// ── Admin review ───────────────────────────────────────────────────────────
router.get('/requests', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), refund_controller_1.RefundControllers.listRefundRequests);
router.patch('/requests/:id/approve', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(refund_validation_1.RefundValidations.reviewRefundRequestZodSchema), refund_controller_1.RefundControllers.approveRefundRequest);
router.patch('/requests/:id/reject', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(refund_validation_1.RefundValidations.reviewRefundRequestZodSchema), refund_controller_1.RefundControllers.rejectRefundRequest);
// Stripe chargebacks, mirrored from the Connect webhook.
router.get('/disputes', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), refund_controller_1.RefundControllers.listDisputes);
exports.RefundRoutes = router;
exports.default = exports.RefundRoutes;
