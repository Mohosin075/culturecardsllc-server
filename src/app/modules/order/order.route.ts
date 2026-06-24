import express from 'express'
import { OrderControllers } from './order.controller'
import validateRequest from '../../middleware/validateRequest'
import { OrderValidations } from './order.validation'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// ============================================================
// All order endpoints require authentication
// ============================================================

// POST / — Create new order (buyer only)
router.post(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.PROFESSIONAL),
  validateRequest(OrderValidations.createOrderSchema),
  OrderControllers.createOrder,
)

// GET /user — Fetch orders for the logged-in user (buyer or seller view)
router.get(
  '/user',
  auth(USER_ROLES.USER, USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  OrderControllers.getOrdersForUser,
)

// GET /:id — Fetch single order by ID
router.get(
  '/:id',
  auth(USER_ROLES.USER, USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  OrderControllers.getOrderById,
)

// PATCH /journey/:id — Push shipment checkpoint (seller or admin only)
router.patch(
  '/journey/:id',
  auth(USER_ROLES.USER, USER_ROLES.PROFESSIONAL, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(OrderValidations.updateOrderJourneySchema),
  OrderControllers.updateOrderJourney,
)

export const OrderRoutes = router
export default OrderRoutes
