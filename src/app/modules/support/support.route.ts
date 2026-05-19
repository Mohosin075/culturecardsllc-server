import express from 'express'
import { SupportController } from './support.controller'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import { createSupportSchema, updateSupportSchema } from './support.validation'

const router = express.Router()

router.get(
  '/',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  SupportController.getAllSupports,
)

router.get(
  '/:id',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
  ),
  SupportController.getSingleSupport,
)

router.post(
  '/',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),

  validateRequest(createSupportSchema),

  SupportController.createSupport,
)

router.patch(
  '/:id',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
  ),

  validateRequest(updateSupportSchema),
  SupportController.updateSupport,
)

router.delete(
  '/:id',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
  ),
  SupportController.deleteSupport,
)

export const SupportRoutes = router
