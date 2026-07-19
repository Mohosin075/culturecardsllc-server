import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { FollowServices } from './follow.service'
import pick from '../../../shared/pick'

const toggleFollow = catchAsync(async (req: Request, res: Response) => {
  const { id: followingId } = req.params
  const followerId = (req as any).user.userId

  const result = await FollowServices.toggleFollow(followerId, followingId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  })
})

const getFollowers = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const paginationOptions = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder'])

  const result = await FollowServices.getFollowers(id, paginationOptions)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Followers retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getFollowing = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const paginationOptions = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder'])

  const result = await FollowServices.getFollowing(id, paginationOptions)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Following retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

export const FollowControllers = {
  toggleFollow,
  getFollowers,
  getFollowing,
}
