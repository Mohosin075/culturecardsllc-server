import express from 'express'
import { PartnerController } from './partner.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import validateRequest from '../../middleware/validateRequest'
import { PartnerValidations } from './partner.validation'

const router = express.Router()

// POST /create — Admin creates partner account & promo code
router.post(
  '/create',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(PartnerValidations.createPartnerZodSchema),
  PartnerController.createPartnerByAdmin,
)

// GET /all — Admin views all partners
router.get(
  '/all',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  PartnerController.getAllPartners,
)

// GET /dashboard — Secret Token authenticated magic link dashboard query
router.get('/dashboard', PartnerController.getPartnerDashboardByToken)

// PATCH /bank-details — Update bank info via access token
router.patch(
  '/bank-details',
  validateRequest(PartnerValidations.updateBankDetailsZodSchema),
  PartnerController.updatePartnerBankDetails,
)

// POST /:partnerId/send-email — Resend magic link email to partner
router.post(
  '/:partnerId/send-email',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  PartnerController.sendMagicLinkEmailToPartner,
)

export const PartnerRoutes = router
