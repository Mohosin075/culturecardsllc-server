import express from 'express'
import { TradeControllers } from './trade.controller'
import validateRequest from '../../middleware/validateRequest'
import { TradeValidations } from './trade.validation'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// ============================================================
// All trade endpoints require authentication
// ============================================================

// POST /offer — Create new trade offer (authenticated users)
router.post(
  '/offer',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  validateRequest(TradeValidations.createTradeOfferSchema),
  TradeControllers.createTradeOffer,
)

// GET /offers — List sent or received trade offers
router.get(
  '/offers',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  TradeControllers.getTradeOffers,
)

// POST /accept/:id — Accept a trade offer (receiver only)
router.post(
  '/accept/:id',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  TradeControllers.acceptTradeOffer,
)

// POST /decline/:id — Decline a trade offer (receiver only)
router.post(
  '/decline/:id',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  TradeControllers.declineTradeOffer,
)

export const TradeRoutes = router
export default TradeRoutes
