import express from 'express'
import { PaymentController } from './payment.controller'
import { PaymentValidations } from './payment.validation'
import validateRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// ============================================
// 1. PAYMENT METHOD MANAGEMENT (USER ONLY)
// ============================================

// GET /methods must be before GET /:id
router.get(
  '/methods',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  PaymentController.getMyPaymentMethods,
)

router.post(
  '/create-setup-intent',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  PaymentController.createSetupIntent,
)

// Specific PATCH must be before generic PATCH /:id
router.patch(
  '/methods/:id/default',
  auth(USER_ROLES.USER),
  PaymentController.setDefaultPaymentMethod,
)

router.delete(
  '/methods/:id',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  PaymentController.deletePaymentMethod,
)

// ============================================
// 2. CHECKOUT & INTENTS
// ============================================

router.post(
  '/create-checkout-session',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  validateRequest(PaymentValidations.create),
  PaymentController.createCheckoutSession,
)

router.get(
  '/verify-checkout/:sessionId',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  PaymentController.verifyCheckoutSession,
)

router.post(
  '/create-payment-intent',
  auth(
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
  ),
  validateRequest(PaymentValidations.create),
  PaymentController.createPaymentIntent,
)

router.post(
  '/ephemeral-key',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER, USER_ROLES.SUPER_ADMIN),
  PaymentController.createEphemeralKey,
)

// ============================================
// 3. PAYMENT RECORDS & INVOICES
// ============================================

router.get(
  '/',
  auth(
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
  ),
  PaymentController.getAllPayments,
)

router.get(
  '/my-payments',
  auth(
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
  ),
  PaymentController.getMyPayments,
)

// Dynamic routes with sub-paths first
router.get(
  '/:id/invoice',
  auth(
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.USER,
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
  ),
  PaymentController.generateInvoice,
)

router.post(
  '/:id/refund',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  PaymentController.refundPayment,
)

// Generic dynamic routes last
router.patch(
  '/:id',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  validateRequest(PaymentValidations.update),
  PaymentController.updatePayment,
)

router.get(
  '/:id',
  auth(USER_ROLES.PROFESSIONAL, USER_ROLES.USER),
  PaymentController.getSinglePayment,
)

export const PaymentRoutes = router
