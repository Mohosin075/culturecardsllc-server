import express from 'express'
import { UploadController } from './upload.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

router.post(
  '/presign',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BUYER, USER_ROLES.SELLER),
  UploadController.presign,
)

export const UploadRoutes = router
