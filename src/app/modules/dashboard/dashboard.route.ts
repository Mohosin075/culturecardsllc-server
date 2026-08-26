import express from 'express'
import { dashboardController } from './dashboard.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

router.get(
  '/overview',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getOverviewData,
)

router.get(
  '/users',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getUsersData,
)

router.get(
  '/seller-verifications',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getSellerVerificationsData,
)

router.get(
  '/listings',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getListingsData,
)

router.get(
  '/live-streams',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getLiveStreamsData,
)

router.get(
  '/trades',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getTradesData,
)

router.get(
  '/orders',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getOrdersData,
)

router.get(
  '/disputes',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getDisputesData,
)

router.get(
  '/payments',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getPaymentsData,
)

router.get(
  '/boosted-listings',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getBoostedListingsData,
)

router.get(
  '/categories',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getCategoriesData,
)

router.get(
  '/notifications',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getNotificationsData,
)

router.patch(
  '/notifications/mark-all-read',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.markAllNotificationsAsRead,
)

router.get(
  '/reports',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getReportsData,
)

router.get(
  '/settings',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getSettingsData,
)

router.patch(
  '/settings',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.updateSettingsData,
)

router.patch(
  '/seller-verifications/:userId/approve',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.approveSellerVerification,
)

router.patch(
  '/seller-verifications/:userId/reject',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.rejectSellerVerification,
)

router.patch(
  '/disputes/:id/resolve',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.resolveDispute,
)

router.patch(
  '/disputes/:id/reject',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.rejectDispute,
)

router.get(
  '/disputes/:id/chat',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getOrCreateDisputeChat,
)

export const DashboardRoutes = router
export default DashboardRoutes
