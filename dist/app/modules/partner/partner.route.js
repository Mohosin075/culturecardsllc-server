"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerRoutes = void 0;
const express_1 = __importDefault(require("express"));
const partner_controller_1 = require("./partner.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const partner_validation_1 = require("./partner.validation");
const router = express_1.default.Router();
// POST /create — Admin creates partner account & promo code
router.post('/create', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(partner_validation_1.PartnerValidations.createPartnerZodSchema), partner_controller_1.PartnerController.createPartnerByAdmin);
// GET /all — Admin views all partners
router.get('/all', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), partner_controller_1.PartnerController.getAllPartners);
// GET /dashboard — Secret Token authenticated magic link dashboard query
router.get('/validate-code', partner_controller_1.PartnerController.validatePromoCode);
// OTP Security Routes
router.post('/request-otp', partner_controller_1.PartnerController.requestPartnerOTP);
router.post('/verify-otp', partner_controller_1.PartnerController.verifyPartnerOTP);
router.get('/dashboard', partner_controller_1.PartnerController.getPartnerDashboardByToken);
// PATCH /bank-details — Update bank info via access token
router.patch('/bank-details', (0, validateRequest_1.default)(partner_validation_1.PartnerValidations.updateBankDetailsZodSchema), partner_controller_1.PartnerController.updatePartnerBankDetails);
// POST /:partnerId/send-email — Resend magic link email to partner
router.post('/:partnerId/send-email', (0, auth_1.default)(user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), partner_controller_1.PartnerController.sendMagicLinkEmailToPartner);
exports.PartnerRoutes = router;
