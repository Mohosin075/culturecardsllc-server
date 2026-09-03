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
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  validateRequest(switchRoleSchema),
  UserController.switchRole,
)

router.get(
  '/profile',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.BUYER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.SELLER,
  ),
  UserController.getProfile,
)

router.patch(
  '/profile',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.BUYER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.SELLER,
  ),

  fileAndBodyProcessorUsingDiskStorage(),

  validateRequest(updateUserSchema),
  UserController.updateProfile,
)

router.delete(
  '/profile',
  auth(USER_ROLES.ADMIN, USER_ROLES.BUYER, USER_ROLES.SELLER),
  UserController.deleteProfile,
)

router.patch(
  '/deactivate-profile',
  auth(
    USER_ROLES.ADMIN,
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.SUPER_ADMIN,
  ),
  UserController.deactivateProfile,
)

router.post(
  '/block/:userId',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  UserController.blockUser,
)

router.post(
  '/unblock/:userId',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  UserController.unblockUser,
)

router.get(
  '/blocked-list',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  UserController.getBlockedUsers,
)

// Removed missing ProfessionalProfileController stripe connect routes
router
  .route('/')
  .get(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.SELLER),
    UserController.getAllUsers,
  )

router.get('/public/:userId', UserController.getUserById)

router
  .route('/:userId')
  .get(
    auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.BUYER, USER_ROLES.SELLER),
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
