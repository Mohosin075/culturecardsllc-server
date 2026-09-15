import express from 'express'
import { GiveawayController } from './giveaway.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// User Giveaway Actions
router.post(
  '/enter',
  auth(),
  GiveawayController.enterGiveaway,
)

router.get(
  '/my-status',
  auth(),
  GiveawayController.getMyStatus,
)

// Public info
router.get('/config', GiveawayController.getConfig)
router.get('/winners', GiveawayController.getWinners)

// Draw & Random Pool endpoints (Admin / Super Admin / Seller)
router.get(
  '/random-pool',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.SELLER),
  GiveawayController.getRandomPool,
)

router.post(
  '/draw-winner',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  GiveawayController.drawWinner,
)

// Admin Management
router.get(
  '/participants',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  GiveawayController.getParticipants,
)

router.patch(
  '/config',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  GiveawayController.updateConfig,
)

export const GiveawayRoutes = router

