import express from 'express'
import { UserController } from './user.controller'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

import {
  switchRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from './user.validation'
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody'
const router = express.Router()

router.patch(
  '/switch-role',
  auth(USER_ROLES.USER, USER_ROLES.PROFESSIONAL),
  validateRequest(switchRoleSchema),
  UserController.switchRole,
)

router.get(
  '/profile',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),
  UserController.getProfile,
)

router.patch(
  '/profile',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.PROFESSIONAL,
  ),

  fileAndBodyProcessorUsingDiskStorage(),

  validateRequest(updateUserSchema),
  UserController.updateProfile,
)

router.delete(
  '/profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  UserController.deleteProfile,
)

router.patch(
  '/deactivate-profile',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.USER,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.SUPER_ADMIN,
  ),
  UserController.deactivateProfile,
)
// Removed missing ProfessionalProfileController stripe connect routes
router
  .route('/')
  .get(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.PROFESSIONAL),
    UserController.getAllUsers,
  )

router
  .route('/:userId')
  .get(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    UserController.getUserById,
  )
  .delete(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    UserController.deleteUser,
  )
  .patch(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
    validateRequest(updateUserStatusSchema),
    UserController.updateUserStatus,
  )

export const UserRoutes = router
