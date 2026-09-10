"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const trade_controller_1 = require("./trade.controller");
const tradeVote_controller_1 = require("./tradeVote.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const trade_validation_1 = require("./trade.validation");
const tradeVote_validation_1 = require("./tradeVote.validation");
const auth_1 = __importStar(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// ============================================================
// 1. COMMUNITY TRADE VOTING SYSTEM (PUBLIC FEED / AUTH VOTE)
// ============================================================
// GET /votes/feed — Public/authenticated community trade voting feed
router.get('/votes/feed', auth_1.optionalAuth, tradeVote_controller_1.TradeVoteControllers.getTradeVoteFeed);
// POST /votes/:id/cast — Cast a vote on a trade (authenticated users)
router.post('/votes/:id/cast', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(tradeVote_validation_1.TradeVoteValidations.castVoteSchema), tradeVote_controller_1.TradeVoteControllers.castVote);
// ============================================================
// 2. TRADE OFFER MANAGEMENT
// ============================================================
// POST /offer — Create new trade offer (authenticated users)
router.post('/offer', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), (0, validateRequest_1.default)(trade_validation_1.TradeValidations.createTradeOfferSchema), trade_controller_1.TradeControllers.createTradeOffer);
// GET /offers — List sent or received trade offers
router.get('/offers', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), trade_controller_1.TradeControllers.getTradeOffers);
// GET /my — Alias for /offers
router.get('/my', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), trade_controller_1.TradeControllers.getTradeOffers);
// POST /accept/:id — Accept a trade offer (receiver only)
router.post('/accept/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), trade_controller_1.TradeControllers.acceptTradeOffer);
// POST /decline/:id — Decline a trade offer (receiver only)
router.post('/decline/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), trade_controller_1.TradeControllers.declineTradeOffer);
// POST /complete/:id — Complete an accepted trade (sender or receiver)
router.post('/complete/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), trade_controller_1.TradeControllers.completeTradeOffer);
exports.TradeRoutes = router;
exports.default = exports.TradeRoutes;
