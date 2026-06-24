"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const trade_controller_1 = require("./trade.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const trade_validation_1 = require("./trade.validation");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// ============================================================
// All trade endpoints require authentication
// ============================================================
// POST /offer — Create new trade offer (authenticated users)
router.post('/offer', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), (0, validateRequest_1.default)(trade_validation_1.TradeValidations.createTradeOfferSchema), trade_controller_1.TradeControllers.createTradeOffer);
// GET /offers — List sent or received trade offers
router.get('/offers', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), trade_controller_1.TradeControllers.getTradeOffers);
// POST /accept/:id — Accept a trade offer (receiver only)
router.post('/accept/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), trade_controller_1.TradeControllers.acceptTradeOffer);
// POST /decline/:id — Decline a trade offer (receiver only)
router.post('/decline/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), trade_controller_1.TradeControllers.declineTradeOffer);
exports.TradeRoutes = router;
exports.default = exports.TradeRoutes;
