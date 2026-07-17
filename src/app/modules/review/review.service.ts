import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { IReview } from './review.interface'
import { Review } from './review.model'
import { JwtPayload } from 'jsonwebtoken'
import mongoose from 'mongoose'
import { User } from '../user/user.model'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
// import { redisClient } from '../../../helpers/redis';

const createReview = async (user: JwtPayload, payload: IReview) => {
  payload.reviewer = user.userId

  if (!payload.reviewee) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Reviewee is required')
  }

  // Require either orderId or tradeOfferId (platform has no booking concept)
  if (!payload.orderId && !payload.tradeOfferId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Either orderId or tradeOfferId is required to leave a review.',
    )
  }

  const isUserExist = await User.findById(user.userId)
  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  }

  const reviewData = { ...payload, reviewer: user.userId }

  const session = await mongoose.startSession()
  try {
    session.startTransaction()
    const result = await Review.create([reviewData], { session })
    if (!result) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Failed to create Review, please try again later.',
      )
    }
    //now update the review count of the user
    await User.findByIdAndUpdate(
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
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Failed to create Review, please try again later.',
    )
  } finally {
    await session.endSession()
  }
}

const getAllReviews = async (
  type: 'reviewer' | 'reviewee',
  paginationOptions: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  // const cacheKey = `reviews:${type}:${user.userId}:page:${page}:limit:${limit}:sort:${sortBy}:${sortOrder}`

  // const cachedResult = await redisClient.get(cacheKey);

  // if(cachedResult){
  //   return JSON.parse(cachedResult);
  // }

  const [result, total] = await Promise.all([
    Review.find({})
      .populate('reviewer')
      .populate('reviewee')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder }),
    Review.countDocuments({}),
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

const getReviewsByOrder = async (
  user: JwtPayload,
  referenceId: string,
  type: 'reviewer' | 'reviewee',
  paginationOptions: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  // Match by orderId or tradeOfferId
  const query = {
    $or: [
      { orderId: referenceId },
      { tradeOfferId: referenceId },
    ],
  }

  const [result, total] = await Promise.all([
    Review.find(query)
      .populate('reviewer')
      .populate('reviewee')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder }),
    Review.countDocuments(query),
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

const getReviewsByProvider = async (
  providerId: string,
  paginationOptions: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  const [result, total] = await Promise.all([
    Review.find({ reviewee: providerId })
      .populate('reviewer')
      .populate('reviewee')
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder }),
    Review.countDocuments({ reviewee: providerId }),
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

const updateReview = async (
  user: JwtPayload,
  id: string,
  payload: Partial<IReview>,
) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const existingReview = await Review.findById(id).session(session)

    if (!existingReview) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'Review not found, please try again later.',
      )
    }
    if (existingReview?.reviewer.toString() !== user.userId) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        'You are not authorized to update this review.',
      )
    }
    const oldRating = existingReview.rating
    const newRating = payload.rating ?? oldRating

    // Update user rating
    await User.findByIdAndUpdate(
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
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Update review failed.',
    )
  } finally {
    await session.endSession()
  }
}

const deleteReview = async (id: string, user: JwtPayload) => {
  const session = await mongoose.startSession()
  try {
    session.startTransaction()

    const existingReview = await Review.findById(id).session(session)
    if (!existingReview) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'Review not found, please try again later.',
      )
    }

    if (existingReview.reviewer.toString() !== user.userId) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        'You are not authorized to delete this review.',
      )
    }

    // Update reviewee's rating and totalReview
    await User.findByIdAndUpdate(
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
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Delete review failed.',
    )
  } finally {
    await session.endSession()
  }
}

const getSingleReview = async (id: string, user: JwtPayload) => {
  console.log('Fetching single review with ID:', id)
  try {
    const review = await Review.findById(id)
    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Review not found')
    }

    return review
  } catch (error) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Get review failed')
  }
}

export const ReviewServices = {
  createReview,
  getAllReviews,
  updateReview,
  deleteReview,
  getSingleReview,
  getReviewsByOrder,
  getReviewsByProvider,
}
