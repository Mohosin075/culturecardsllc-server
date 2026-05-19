"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auction_controller_1 = require("./auction.controller");
const router = express_1.default.Router();
router.get('/token', auction_controller_1.AuctionControllers.generateAgoraToken);
router.post('/stream', auction_controller_1.AuctionControllers.createLiveStream);
router.get('/streams', auction_controller_1.AuctionControllers.getLiveStreams);
router.post('/item', auction_controller_1.AuctionControllers.createAuctionItem);
router.post('/bid', auction_controller_1.AuctionControllers.placeBidSecure);
exports.AuctionRoutes = router;
exports.default = exports.AuctionRoutes;
