"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auction_controller_1 = require("./auction.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const auction_validation_1 = require("./auction.validation");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// GET /token — Generate Agora RTC token (authenticated users only)
router.get('/token', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), auction_controller_1.AuctionControllers.generateAgoraToken);
// POST /stream — Create live stream session (seller only)
router.post('/stream', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.createLiveStreamSchema), auction_controller_1.AuctionControllers.createLiveStream);
// GET /streams — List all live streams (public)
router.get('/streams', auction_controller_1.AuctionControllers.getLiveStreams);
// POST /item — Register a product as an auction item (seller only)
router.post('/item', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.createAuctionItemSchema), auction_controller_1.AuctionControllers.createAuctionItem);
// POST /bid — Place a bid on an auction item (authenticated users)
router.post('/bid', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.placeBidSchema), auction_controller_1.AuctionControllers.placeBidSecure);
// GET /stream/:streamId/items — Get auction items for a stream (authenticated users)
router.get('/stream/:streamId/items', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), auction_controller_1.AuctionControllers.getAuctionItemsByStream);
// PATCH /stream/:streamId/status — Update stream status (seller/admin)
router.patch('/stream/:streamId/status', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.updateLiveStreamStatusSchema), auction_controller_1.AuctionControllers.updateLiveStreamStatus);
// POST /item/:id/complete — Complete auction, trigger winner payment (seller only)
router.post('/item/:id/complete', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), auction_controller_1.AuctionControllers.completeAuction);
exports.AuctionRoutes = router;
exports.default = exports.AuctionRoutes;
