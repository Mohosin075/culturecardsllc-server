'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.ReviewServices = void 0
const http_status_codes_1 = require('http-status-codes')
const ApiError_1 = __importDefault(require('../../../errors/ApiError'))
const review_model_1 = require('./review.model')
const mongoose_1 = __importDefault(require('mongoose'))
const user_model_1 = require('../user/user.model')
const paginationHelper_1 = require('../../../helpers/paginationHelper')
// import { redisClient } from '../../../helpers/redis';
const createReview = async (user, payload) => {
  payload.reviewer = user.userId
  if (!payload.reviewee) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'Reviewee is required',
    )
  }
  const isUserExist = await user_model_1.User.findById(user.userId)
  if (!isUserExist) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.NOT_FOUND,
      'User not found',
    )
  }
  const reviewData = { ...payload, reviewer: user.userId }
  const session = await mongoose_1.default.startSession()
  try {
    session.startTransaction()
    const result = await review_model_1.Review.create([reviewData], { session })
    if (!result) {
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.BAD_REQUEST,
        'Failed to create Review, please try again later.',
      )
    }
    //now update the review count of the user
    await user_model_1.User.findByIdAndUpdate(
      payload.reviewee,
      [
        {
          $set: {
            totalReview: { $add: [{ $ifNull: ['$totalReview', 0] }, 1] },
            rating: {
              $divide: [
                {
                  $add: [
                    {
                      $multiply: [
                        { $ifNull: ['$rating', 0] },
                        { $ifNull: ['$totalReview', 0] },
                      ],
                    },
                    payload.rating,
                  ],
                },
                { $add: [{ $ifNull: ['$totalReview', 0] }, 1] },
              ],
            },
          },
        },
      ],
      { session, new: true },
    )
    // Booking, Service and ProfessionalProfile logic has been removed as per request
    await session.commitTransaction()
    return result[0]
  } catch (error) {
    console.log({ error })
    await session.abortTransaction()
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.BAD_REQUEST,
      'Failed to create Review, please try again later.',
    )
  } finally {
    await session.endSession()
  }
}
const getAllReviews = async (type, paginationOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper_1.paginationHelper.calculatePagination(paginationOptions)
  // const cacheKey = `reviews:${type}:${user.userId}:page:${page}:limit:${limit}:sort:${sortBy}:${sortOrder}`
  // const cachedResult = await redisClient.get(cacheKey);
  // if(cachedResult){
  //   return JSON.parse(cachedResult);
  // }
  const [result, total] = await Promise.all([
    review_model_1.Review.find({})
      .populate('reviewer')
      .populate('reviewee')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder }),
    review_model_1.Review.countDocuments({}),
  ])
  //cache the result
  // await redisClient.setex(cacheKey, JSON.stringify({ meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data: result }), 60 * 3); // 2 minutes
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  }
}
const getReviewsByBooking = async (
  user,
  bookingId,
  type,
  paginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper_1.paginationHelper.calculatePagination(paginationOptions)
  const cacheKey = `reviews:${type}:${user.userId}:booking:${bookingId}:page:${page}:limit:${limit}:sort:${sortBy}:${sortOrder}`
  // const cachedResult = await redisClient.get(cacheKey);
  // if(cachedResult){
  //   return JSON.parse(cachedResult);
  // }
  const [result, total] = await Promise.all([
    review_model_1.Review.find({ bookingId: bookingId })
      .populate('reviewer')
      .populate('reviewee')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder }),
    review_model_1.Review.countDocuments({ bookingId: bookingId }),
  ])
  //cache the result
  // await redisClient.setex(cacheKey, JSON.stringify({ meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data: result }), 60 * 3); // 2 minutes
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  }
}
const getReviewsByProvider = async (providerId, paginationOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper_1.paginationHelper.calculatePagination(paginationOptions)
  const [result, total] = await Promise.all([
    review_model_1.Review.find({ reviewee: providerId })
      .populate('reviewer')
      .populate('reviewee')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder }),
    review_model_1.Review.countDocuments({ reviewee: providerId }),
  ])
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  }
}
const updateReview = async (user, id, payload) => {
  var _a
  const session = await mongoose_1.default.startSession()
  try {
    session.startTransaction()
    const existingReview =
      await review_model_1.Review.findById(id).session(session)
    if (!existingReview) {
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.NOT_FOUND,
        'Review not found, please try again later.',
      )
    }
    if (
      (existingReview === null || existingReview === void 0
        ? void 0
        : existingReview.reviewer.toString()) !== user.userId
    ) {
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.UNAUTHORIZED,
        'You are not authorized to update this review.',
      )
    }
    const oldRating = existingReview.rating
    const newRating =
      (_a = payload.rating) !== null && _a !== void 0 ? _a : oldRating
    // Update user rating
    await user_model_1.User.findByIdAndUpdate(
      existingReview.reviewee,
      [
        {
          $set: {
            rating: {
              $cond: [
                { $eq: ['$totalReview', 0] },
                0,
                {
                  $divide: [
                    {
                      $add: [
                        {
                          $subtract: [
                            { $multiply: ['$rating', '$totalReview'] },
                            oldRating,
                          ],
                        },
                        newRating,
                      ],
                    },
                    '$totalReview',
                  ],
                },
              ],
            },
          },
        },
      ],
      { session, new: true },
    )
    // Update review document
    if (payload.rating !== undefined) existingReview.rating = newRating
    if (payload.review !== undefined) existingReview.review = payload.review
    await existingReview.save({ session })
    await session.commitTransaction()
    //clear the cache
    // await redisClient.del(`reviews:reviewer:${existingReview.reviewer}:*`);
    // await redisClient.del(`reviews:reviewee:${existingReview.reviewee}:*`);
    return 'Review updated successfully'
  } catch (error) {
    console.log({ error })
    await session.abortTransaction()
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
      'Update review failed.',
    )
  } finally {
    await session.endSession()
  }
}
const deleteReview = async (id, user) => {
  const session = await mongoose_1.default.startSession()
  try {
    session.startTransaction()
    const existingReview =
      await review_model_1.Review.findById(id).session(session)
    if (!existingReview) {
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.NOT_FOUND,
        'Review not found, please try again later.',
      )
    }
    if (existingReview.reviewer.toString() !== user.userId) {
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.UNAUTHORIZED,
        'You are not authorized to delete this review.',
      )
    }
    // Update reviewee's rating and totalReview
    await user_model_1.User.findByIdAndUpdate(
      existingReview.reviewee,
      [
        {
          $set: {
            totalReview: {
              $max: [{ $add: ['$totalReview', -1] }, 0], // avoid negative count
            },
            rating: {
              $cond: [
                { $lte: ['$totalReview', 1] }, // if after deletion totalReview will be 0 or less
                0,
                {
                  $divide: [
                    {
                      $subtract: [
                        { $multiply: ['$rating', '$totalReview'] },
                        existingReview.rating,
                      ],
                    },
                    { $add: ['$totalReview', -1] },
                  ],
                },
              ],
            },
          },
        },
      ],
      { session, new: true },
    )
    await existingReview.deleteOne({ session })
    await session.commitTransaction()
    //clear the cache
    // await redisClient.del(`reviews:reviewer:${user.userId}:*`);
    // await redisClient.del(`reviews:reviewee:${existingReview.reviewee}:*`);
    return 'Review deleted successfully'
  } catch (error) {
    console.error('Error deleting review:', error)
    await session.abortTransaction()
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
      'Delete review failed.',
    )
  } finally {
    await session.endSession()
  }
}
const getSingleReview = async (id, user) => {
  console.log('Fetching single review with ID:', id)
  try {
    const review = await review_model_1.Review.findById(id)
    if (!review) {
      throw new ApiError_1.default(
        http_status_codes_1.StatusCodes.NOT_FOUND,
        'Review not found',
      )
    }
    return review
  } catch (error) {
    throw new ApiError_1.default(
      http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR,
      'Get review failed',
    )
  }
}
exports.ReviewServices = {
  createReview,
  getAllReviews,
  updateReview,
  deleteReview,
  getSingleReview,
  getReviewsByBooking,
  getReviewsByProvider,
}
