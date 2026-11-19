import express from 'express'
import auth from '../../middleware/auth'
import validateRequest from '../../middleware/validateRequest'
import { USER_ROLES } from '../../../enum/user'
import { SellerControllers } from './seller.controller'
import { SellerValidations } from './seller.validation'

const router = express.Router()

// ── Stripe redirect landings ───────────────────────────────────────────────
// Stripe sends the seller's browser here, so these must stay unauthenticated.
router.get('/stripe/return', SellerControllers.stripeReturn)
router.get('/stripe/refresh', SellerControllers.stripeRefresh)

// ── 1. Seller application ──────────────────────────────────────────────────
router.post(
  '/apply',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  validateRequest(SellerValidations.applyAsSellerZodSchema),
  SellerControllers.applyAsSeller,
)

// ── 3. Status the app polls after coming back from Stripe ──────────────────
router.get(
  '/application',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  SellerControllers.getMyApplication,
)

// ── 2. Stripe onboarding links ─────────────────────────────────────────────
router.post(
  '/stripe/onboarding-link',
  auth(
    USER_ROLES.BUYER,
    USER_ROLES.SELLER,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  SellerControllers.createOnboardingLink,
)

router.get(
  '/stripe/dashboard-link',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  SellerControllers.createDashboardLink,
)

export const SellerRoutes = router
export default SellerRoutes
