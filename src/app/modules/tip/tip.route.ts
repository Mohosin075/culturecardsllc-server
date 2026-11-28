import express from 'express'
import { TipController } from './tip.controller'
import { TipValidation } from './tip.validation'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

router.post(
  '/create-intent',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(TipValidation.createTipIntentZodSchema),
  TipController.createTipIntent,
)

router.post(
  '/confirm',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(TipValidation.confirmTipZodSchema),
  TipController.confirmTip,
)

router.get(
  '/admin/all',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  TipController.getAllTipsForAdmin,
)

router.get(
  '/stream/:streamId',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  TipController.getStreamTips,
)

router.get(
  '/my-tips',
  auth(USER_ROLES.SELLER, USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  TipController.getMySellerTips,
)

export const TipRoutes = router
