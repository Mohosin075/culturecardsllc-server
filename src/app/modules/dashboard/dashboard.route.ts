import express from 'express';
import { dashboardController } from './dashboard.controller';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';

const router = express.Router();

router.get(
  '/overview',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getOverviewData
);

router.get(
  '/users',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getUsersData
);

router.get(
  '/seller-verifications',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getSellerVerificationsData
);

router.get(
  '/listings',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getListingsData
);

router.get(
  '/live-streams',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getLiveStreamsData
);

router.get(
  '/trades',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  dashboardController.getTradesData
);

export const DashboardRoutes = router;
export default DashboardRoutes;
