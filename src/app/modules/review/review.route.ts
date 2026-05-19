import express from 'express'
import { ReviewController } from './review.controller'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'
import validateRequest from '../../middleware/validateRequest'
import { createReviewSchema, updateReviewSchema } from './review.validation'

const router = express.Router()

// Route for creating reviews & getting all reviews by type (assuming type is query param,
// but here it's a param so keeping separate routes)
router
  .route('/')
  .get(ReviewController.getAllReviews)
  .post(
    auth(...Object.values(USER_ROLES)),
    validateRequest(createReviewSchema),
    ReviewController.createReview,
  )

router
  .route('/:bookingId/booking')
  .get(auth(...Object.values(USER_ROLES)), ReviewController.getReviewsByBooking)

router.route('/provider/:providerId').get(ReviewController.getReviewsByProvider)

// router.route('/:type')
//   .get(auth(...roles), ReviewController.getAllReviews);

router
  .route('/:id')
  .get(ReviewController.getSingleReview)
  .patch(
    auth(...Object.values(USER_ROLES)),
    validateRequest(updateReviewSchema),
    ReviewController.updateReview,
  )
  .delete(auth(...Object.values(USER_ROLES)), ReviewController.deleteReview)

export const ReviewRoutes = router
