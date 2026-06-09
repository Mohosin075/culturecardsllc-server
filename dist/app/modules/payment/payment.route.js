"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const payment_controller_1 = require("./payment.controller");
const payment_validation_1 = require("./payment.validation");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// ============================================
// 1. PAYMENT METHOD MANAGEMENT (USER ONLY)
// ============================================
// GET /methods must be before GET /:id
router.get('/methods', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), payment_controller_1.PaymentController.getMyPaymentMethods);
router.post('/create-setup-intent', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), payment_controller_1.PaymentController.createSetupIntent);
// Specific PATCH must be before generic PATCH /:id
router.patch('/methods/:id/default', (0, auth_1.default)(user_1.USER_ROLES.USER), payment_controller_1.PaymentController.setDefaultPaymentMethod);
router.delete('/methods/:id', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), payment_controller_1.PaymentController.deletePaymentMethod);
// ============================================
// 2. CHECKOUT & INTENTS
// ============================================
router.post('/create-checkout-session', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER), (0, validateRequest_1.default)(payment_validation_1.PaymentValidations.create), payment_controller_1.PaymentController.createCheckoutSession);
router.get('/verify-checkout/:sessionId', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER), payment_controller_1.PaymentController.verifyCheckoutSession);
router.post('/create-payment-intent', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(payment_validation_1.PaymentValidations.create), payment_controller_1.PaymentController.createPaymentIntent);
router.post('/ephemeral-key', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN), payment_controller_1.PaymentController.createEphemeralKey);
// ============================================
// 3. PAYMENT RECORDS & INVOICES
// ============================================
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), payment_controller_1.PaymentController.getAllPayments);
router.get('/my-payments', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), payment_controller_1.PaymentController.getMyPayments);
// Dynamic routes with sub-paths first
router.get('/:id/invoice', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER, user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), payment_controller_1.PaymentController.generateInvoice);
router.post('/:id/refund', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), payment_controller_1.PaymentController.refundPayment);
// Generic dynamic routes last
router.patch('/:id', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(payment_validation_1.PaymentValidations.update), payment_controller_1.PaymentController.updatePayment);
router.get('/:id', (0, auth_1.default)(user_1.USER_ROLES.PROFESSIONAL, user_1.USER_ROLES.USER), payment_controller_1.PaymentController.getSinglePayment);
exports.PaymentRoutes = router;
