"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewRoutes = void 0;
const express_1 = __importDefault(require("express"));
const review_controller_1 = require("./review.controller");
const auth_1 = __importDefault(require("../../middleware/auth"));
const user_1 = require("../../../enum/user");
const validateRequest_1 = __importDefault(require("../../middleware/validateRequest"));
const review_validation_1 = require("./review.validation");
const router = express_1.default.Router();
// Route for creating reviews & getting all reviews by type (assuming type is query param,
// but here it's a param so keeping separate routes)
router
    .route('/')
    .get(review_controller_1.ReviewController.getAllReviews)
    .post((0, auth_1.default)(...Object.values(user_1.USER_ROLES)), (0, validateRequest_1.default)(review_validation_1.createReviewSchema), review_controller_1.ReviewController.createReview);
router
    .route('/:bookingId/booking')
    .get((0, auth_1.default)(...Object.values(user_1.USER_ROLES)), review_controller_1.ReviewController.getReviewsByBooking);
router.route('/provider/:providerId').get(review_controller_1.ReviewController.getReviewsByProvider);
// router.route('/:type')
//   .get(auth(...roles), ReviewController.getAllReviews);
router
    .route('/:id')
    .get(review_controller_1.ReviewController.getSingleReview)
    .patch((0, auth_1.default)(...Object.values(user_1.USER_ROLES)), (0, validateRequest_1.default)(review_validation_1.updateReviewSchema), review_controller_1.ReviewController.updateReview)
    .delete((0, auth_1.default)(...Object.values(user_1.USER_ROLES)), review_controller_1.ReviewController.deleteReview);
exports.ReviewRoutes = router;
