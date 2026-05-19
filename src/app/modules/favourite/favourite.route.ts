import express from 'express'
import { FavouriteController } from './favourite.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import validateRequest from '../../middleware/validateRequest'
import { FavouriteValidation } from './favourite.validation'

const router = express.Router()

router.post(
  '/toggle',
  auth(
    USER_ROLES.USER,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  validateRequest(FavouriteValidation.toggleFavouriteZodSchema),
  FavouriteController.toggleFavourite,
)

router.get(
  '/my-favourites',
  auth(
    USER_ROLES.USER,
    USER_ROLES.PROFESSIONAL,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN,
  ),
  FavouriteController.getMyFavourites,
)

export const FavouriteRoutes = router
