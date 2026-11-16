import express from 'express'
import multer from 'multer'
import { UploadController } from './upload.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

router.post(
  '/presign',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BUYER, USER_ROLES.SELLER),
  UploadController.presign,
)

router.post(
  '/image',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.BUYER, USER_ROLES.SELLER),
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  UploadController.uploadImage,
)

export const UploadRoutes = router
