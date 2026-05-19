import express from 'express'
import { LocationController } from './location.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import validateRequest from '../../middleware/validateRequest'
import { LocationValidation } from './location.validation'

const router = express.Router()

// Allow authenticated users to search and geocode for bookings
router.get(
  '/search',
  auth(
    USER_ROLES.USER,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  validateRequest(LocationValidation.searchSuggestionsSchema),
  LocationController.searchSuggestions,
)

router.get(
  '/geocode',
  auth(
    USER_ROLES.USER,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  validateRequest(LocationValidation.geocodeAddressSchema),
  LocationController.geocodeAddress,
)

export const LocationRoutes = router
