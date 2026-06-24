import express from 'express'
import { MessageController } from './message.controller'
import { USER_ROLES } from '../../../enum/user'
import auth from '../../middleware/auth'
import { fileAndBodyProcessorUsingDiskStorage } from '../../middleware/processReqBody'
const router = express.Router()

router.post(
  '/',
  fileAndBodyProcessorUsingDiskStorage(),
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  MessageController.sendMessage,
)
router.get(
  '/:id',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  MessageController.getMessage,
)

export const MessageRoutes = router
