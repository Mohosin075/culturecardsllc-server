import express from 'express'
import { GiveawayController } from './giveaway.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// Public / Seller endpoint to draw winner
router.post(
  '/draw-winner',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  GiveawayController.drawWinner,
)

// Admin endpoints
router.get(
  '/participants',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  GiveawayController.getParticipants,
)

router.get('/config', GiveawayController.getConfig)

router.patch(
  '/config',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  GiveawayController.updateConfig,
)

export const GiveawayRoutes = router
