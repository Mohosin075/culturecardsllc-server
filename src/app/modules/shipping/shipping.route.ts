import express from 'express'
import auth from '../../middleware/auth'
import validateRequest from '../../middleware/validateRequest'
import { USER_ROLES } from '../../../enum/user'
import { ShippingControllers } from './shipping.controller'
import { ShippingValidations } from './shipping.validation'

const router = express.Router()

const ANY_USER = [
  USER_ROLES.BUYER,
  USER_ROLES.SELLER,
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN,
]

// Package sizes for the listing and trade forms.
router.get('/presets', ShippingControllers.getPackagePresets)

// The address this user ships from (printed on their labels).
router.get('/ship-from', auth(...ANY_USER), ShippingControllers.getShipFromAddress)
router.put(
  '/ship-from',
  auth(...ANY_USER),
  validateRequest(ShippingValidations.setShipFromZodSchema),
  ShippingControllers.setShipFromAddress,
)

// Live rates for a product to the buyer's address, shown at checkout.
router.post(
  '/rates',
  auth(...ANY_USER),
  validateRequest(ShippingValidations.quoteRatesZodSchema),
  ShippingControllers.quoteRates,
)

// The seller buys the label for a paid order.
router.post(
  '/orders/:orderId/label',
  auth(...ANY_USER),
  validateRequest(ShippingValidations.buyLabelZodSchema),
  ShippingControllers.buyLabelForOrder,
)

// Mock provider only: advance a package's tracking by one step.
router.post(
  '/orders/:orderId/simulate-tracking',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  ShippingControllers.simulateTrackingStep,
)

export const ShippingRoutes = router
export default ShippingRoutes
