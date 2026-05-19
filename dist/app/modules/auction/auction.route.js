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
const router = Router();
function Router() {
    return express_1.default.Router();
}
router.get('/token', auction_controller_1.AuctionControllers.generateAgoraToken);
router.post('/stream', (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.createLiveStreamSchema), auction_controller_1.AuctionControllers.createLiveStream);
router.get('/streams', auction_controller_1.AuctionControllers.getLiveStreams);
router.post('/item', (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.createAuctionItemSchema), auction_controller_1.AuctionControllers.createAuctionItem);
router.post('/bid', (0, validateRequest_1.default)(auction_validation_1.AuctionValidations.placeBidSchema), auction_controller_1.AuctionControllers.placeBidSecure);
exports.AuctionRoutes = router;
exports.default = exports.AuctionRoutes;
