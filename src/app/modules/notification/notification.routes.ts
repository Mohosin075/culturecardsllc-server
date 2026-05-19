import express from 'express'
import { NotificationController } from './notification.controller'
import { NotificationValidations } from './notification.validation'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

router.get(
  '/',
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
  ),
  validateRequest(NotificationValidations.filter),
  NotificationController.getAllNotifications,
)

router.get(
  '/my',
  auth(
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
  ),
  NotificationController.getMyNotifications,
)

router.get(
  '/stats',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  NotificationController.getNotificationStats,
)

router.get(
  '/:id',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  NotificationController.getNotificationById,
)

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validateRequest(NotificationValidations.create),
  NotificationController.createNotification,
)

router.post(
  '/test-email',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validateRequest(NotificationValidations.sendEmail),
  NotificationController.sendTestEmail,
)

router.patch(
  '/read-all',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  NotificationController.markAllAsRead,
)

router.patch(
  '/:id',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  validateRequest(NotificationValidations.update),
  NotificationController.updateNotification,
)

router.patch(
  '/:id/read',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  NotificationController.markAsRead,
)

router.patch(
  '/:id/archive',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  NotificationController.archiveNotification,
)

router.delete(
  '/:id',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  NotificationController.deleteNotification,
)

export const NotificationRoutes = router
