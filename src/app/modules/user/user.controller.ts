import { Request, Response } from 'express'

import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'

import { UserServices } from './user.service'
import pick from '../../../shared/pick'
import { paginationFields } from '../../../interfaces/pagination'
import { JwtPayload } from 'jsonwebtoken'
import ApiError from '../../../errors/ApiError'
import { userFilterableFields } from './user.constants'

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  console.log(req.body)
  const { images, ...userData } = req.body

  if (images) {
    userData.profile = Array.isArray(images) ? images[0] : images
  }
  const result = await UserServices.updateProfile(req.user!, userData)
  sendResponse<string>(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  })
})

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const paginationOptions = pick(req.query, paginationFields)
  const filterables = pick(req.query, userFilterableFields)
  const result = await UserServices.getAllUsers(paginationOptions, filterables)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Users retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params
  const result = await UserServices.deleteUser(userId)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User deleted successfully',
    data: result,
  })
})

const deleteProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const { password } = req.body

  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is required')
  }

  const result = await UserServices.deleteProfile(user.userId, password)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User profile deleted successfully',
    data: result,
  })
})

const deactivateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const { password } = req.body

  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is required')
  }

  const result = await UserServices.deactivateProfile(user.userId, password)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message:
      'User profile deactivated successfully. You can reactivate by logging in again.',
    data: result,
  })
})

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params
  const result = await UserServices.getUserById(userId)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User retrieved successfully',
    data: result,
  })
})

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params
  if (req.body.status === undefined && req.body.verified === undefined) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Status or verified field is required')
  }
  const result = await UserServices.updateUserStatus(userId, req.body)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User updated successfully',
    data: result,
  })
})

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getProfile(req.user!)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User profile retrieved successfully',
    data: result,
  })
})

const switchRole = catchAsync(async (req: Request, res: Response) => {
  const { role } = req.body
  const result = await UserServices.switchRole(req.user!, role)

  // Set refresh token in cookie
  res.cookie('refreshToken', result.refreshToken, {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Role switched successfully. Please use the new token.',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  })
})

export const UserController = {
  updateProfile,
  getAllUsers,
  deleteUser,
  getUserById,
  updateUserStatus,
  getProfile,
  deleteProfile,
  deactivateProfile,
  switchRole,
}
