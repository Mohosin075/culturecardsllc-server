"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRoutes = void 0;
const express_1 = __importDefault(require("express"));
const order_controller_1 = require("./order.controller");
const router = express_1.default.Router();
router.post('/', order_controller_1.OrderControllers.createOrder);
router.get('/user', order_controller_1.OrderControllers.getOrdersForUser);
router.get('/:id', order_controller_1.OrderControllers.getOrderById);
router.patch('/journey/:id', order_controller_1.OrderControllers.updateOrderJourney);
exports.OrderRoutes = router;
exports.default = exports.OrderRoutes;
