import express from 'express'
import auth from '../../middleware/auth'
import validateRequest from '../../middleware/validateRequest'
import { USER_ROLES } from '../../../enum/user'
import { RefundControllers } from './refund.controller'
import { RefundValidations } from './refund.validation'

const router = express.Router()

// ── Buyer ──────────────────────────────────────────────────────────────────
// "Buyers request refunds through ARIES" — this never reverses a charge on
// its own; an admin decides.
router.post(
  '/request',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  validateRequest(RefundValidations.createRefundRequestZodSchema),
  RefundControllers.createRefundRequest,
)

router.get(
  '/my-requests',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  RefundControllers.getMyRefundRequests,
)

// ── Seller ─────────────────────────────────────────────────────────────────
router.get(
  '/seller-requests',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  RefundControllers.getSellerRefundRequests,
)

router.get(
  '/seller-disputes',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  RefundControllers.getSellerDisputes,
)

// ── Admin review ───────────────────────────────────────────────────────────
router.get(
  '/requests',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  RefundControllers.listRefundRequests,
)

router.patch(
  '/requests/:id/approve',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(RefundValidations.reviewRefundRequestZodSchema),
  RefundControllers.approveRefundRequest,
)

router.patch(
  '/requests/:id/reject',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(RefundValidations.reviewRefundRequestZodSchema),
  RefundControllers.rejectRefundRequest,
)

// Stripe chargebacks, mirrored from the Connect webhook.
router.get(
  '/disputes',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  RefundControllers.listDisputes,
)

export const RefundRoutes = router
export default RefundRoutes
