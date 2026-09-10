import express from 'express'
import { TradeControllers } from './trade.controller'
import { TradeVoteControllers } from './tradeVote.controller'
import validateRequest from '../../middleware/validateRequest'
import { TradeValidations } from './trade.validation'
import { TradeVoteValidations } from './tradeVote.validation'
import auth, { optionalAuth } from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// ============================================================
// 1. COMMUNITY TRADE VOTING SYSTEM (PUBLIC FEED / AUTH VOTE)
// ============================================================

// GET /votes/feed — Public/authenticated community trade voting feed
router.get('/votes/feed', optionalAuth, TradeVoteControllers.getTradeVoteFeed)

// POST /votes/:id/cast — Cast a vote on a trade (authenticated users)
router.post(
  '/votes/:id/cast',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  validateRequest(TradeVoteValidations.castVoteSchema),
  TradeVoteControllers.castVote,
)

// ============================================================
// 2. TRADE OFFER MANAGEMENT
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

// GET /my — Alias for /offers
router.get(
  '/my',
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

// POST /complete/:id — Complete an accepted trade (sender or receiver)
router.post(
  '/complete/:id',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  TradeControllers.completeTradeOffer,
)

export const TradeRoutes = router
export default TradeRoutes
