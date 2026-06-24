import express from 'express'
import { ChatController } from './chat.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
const router = express.Router()

router.post(
  '/contact-admin',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  ChatController.createAdminChat,
)
router.post(
  '/:id',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.SELLER,
  ),
  ChatController.createChat,
)
router.get(
  '/',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.SELLER,
  ),
  ChatController.getChat,
)

export const ChatRoutes = router
