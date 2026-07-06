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
const router = Router();
function Router() {
    return express_1.default.Router();
}
router.get('/token', auction_controller_1.AuctionControllers.generateAgoraToken);
router.post('/stream', (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.createLiveStreamSchema), auction_controller_1.AuctionControllers.createLiveStream);
router.get('/streams', auction_controller_1.AuctionControllers.getLiveStreams);
router.post('/item', (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.createAuctionItemSchema), auction_controller_1.AuctionControllers.createAuctionItem);
router.post('/bid', (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.placeBidSchema), auction_controller_1.AuctionControllers.placeBidSecure);
router.patch('/stream/:streamId/status', (0, auth_1.default)(user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.updateLiveStreamStatusSchema), auction_controller_1.AuctionControllers.updateLiveStreamStatus);
exports.AuctionRoutes = router;
exports.default = exports.AuctionRoutes;
