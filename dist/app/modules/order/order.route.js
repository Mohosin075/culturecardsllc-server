"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderRoutes = void 0;
const express_1 = __importDefault(require("express"));
const order_controller_1 = require("./order.controller");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const order_validation_1 = require("./order.validation");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const router = express_1.default.Router();
// ============================================================
// All order endpoints require authentication
// ============================================================
// POST / — Create new order (buyer only)
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER), (0, validateRequest_1.default)(order_validation_1.OrderValidations.createOrderSchema), order_controller_1.OrderControllers.createOrder);
// GET /user — Fetch orders for the logged-in user (buyer or seller view)
router.get('/user', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), order_controller_1.OrderControllers.getOrdersForUser);
// GET /:id — Fetch single order by ID
router.get('/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), order_controller_1.OrderControllers.getOrderById);
// PATCH /journey/:id — Push shipment checkpoint (seller or admin only)
router.patch('/journey/:id', (0, auth_1.default)(user_1.USER_ROLES.BUYER, user_1.USER_ROLES.SELLER, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(order_validation_1.OrderValidations.updateOrderJourneySchema), order_controller_1.OrderControllers.updateOrderJourney);
exports.OrderRoutes = router;
exports.default = exports.OrderRoutes;
