import express from 'express'
import { FollowControllers } from './follow.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

router.post(
  '/:id',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  FollowControllers.toggleFollow
)

router.get('/:id/followers', FollowControllers.getFollowers)
router.get('/:id/following', FollowControllers.getFollowing)

export const FollowRoutes = router
