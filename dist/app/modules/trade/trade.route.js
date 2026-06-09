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
const router = express_1.default.Router();
router.post('/offer', (0, validateRequest_1.default)(trade_validation_1.TradeValidations.createTradeOfferSchema), trade_controller_1.TradeControllers.createTradeOffer);
router.get('/offers', trade_controller_1.TradeControllers.getTradeOffers);
router.post('/accept/:id', trade_controller_1.TradeControllers.acceptTradeOffer);
router.post('/decline/:id', trade_controller_1.TradeControllers.declineTradeOffer);
exports.TradeRoutes = router;
exports.default = exports.TradeRoutes;
