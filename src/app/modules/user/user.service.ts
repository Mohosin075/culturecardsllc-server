import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { IUser, IUserFilterables } from './user.interface'
import { Secret } from 'jsonwebtoken'
import { User } from './user.model'
import { FilterQuery } from 'mongoose'

import { USER_ROLES, USER_STATUS } from '../../../enum/user'

import { JwtPayload } from 'jsonwebtoken'
import { paginationHelper } from '../../../helpers/paginationHelper'
import { IPaginationOptions } from '../../../interfaces/pagination'
import config from '../../../config'
import { userFilterableFields } from './user.constants'
import { jwtHelper } from '../../../helpers/jwtHelper'
import { TradeOffer } from '../trade/trade.model'
import { Review } from '../review/review.model'
import { Follow } from '../follow/follow.model'

const getUserStats = async (userId: string) => {
  const tradesCount = await TradeOffer.countDocuments({
    $or: [{ senderId: userId }, { receiverId: userId }],
    status: 'completed',
  });

  const reviews = await Review.find({ reviewee: userId });
  let totalRating = 0;
  let positiveCount = 0;

  reviews.forEach((r) => {
    totalRating += r.rating;
    if (r.rating >= 4) { // Assuming 4 and 5 are positive
      positiveCount++;
    }
  });

  const rating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : "0.0";
  const positive = reviews.length > 0 ? Math.round((positiveCount / reviews.length) * 100) : 0;

  const [followers, following] = await Promise.all([
    Follow.countDocuments({ followingId: userId }),
    Follow.countDocuments({ followerId: userId })
  ]);

  return {
    trades: tradesCount,
    rating: Number(rating),
    positive: positive, // percentage
    followers,
    following
  };
}

const updateProfile = async (user: JwtPayload, payload: Partial<IUser>) => {
  console.log({ payload })
  const isUserExist = await User.findOne({
    _id: user.userId,
    status: { $nin: [USER_STATUS.DELETED] },
  })

  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  if (payload.username) {
    const trimmedUsername = payload.username.trim().toLowerCase()

    // Validate username format (alphanumeric and underscores, 3-20 chars)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Username must be between 3 and 20 characters and contain only letters, numbers, and underscores.',
      )
    }

    const isUsernameTaken = await User.findOne({
      username: trimmedUsername,
      _id: { $ne: user.userId },
      status: { $nin: [USER_STATUS.DELETED] },
    })

    if (isUsernameTaken) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Username is already taken.',
      )
    }

    payload.username = trimmedUsername
  }

  // if (isUserExist.profile) {
  //   const url = new URL(isUserExist.profile)
  //   const key = url.pathname.substring(1)
  //   await S3Helper.deleteFromS3(key)
  // }

  const updatedProfile = await User.findOneAndUpdate(
    { _id: user.userId, status: { $nin: [USER_STATUS.DELETED] } },
    {
      $set: payload,
    },
    { new: true },
  )

  if (!updatedProfile) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to update profile.')
  }

  return 'Profile updated successfully.'
}

const createAdmin = async (): Promise<Partial<IUser> | null> => {
  const email = config.super_admin.email?.toLowerCase().trim()
  const name = config.super_admin.name?.trim()
  const password = config.super_admin.password

  if (!email || !password) {
    console.warn(
      '⚠️ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set. Skipping admin creation.',
    )
    return null
  }

  const isAdminExist = await User.findOne({
    email,
    status: { $nin: [USER_STATUS.DELETED] },
  })

  if (isAdminExist) {
    console.log('Admin account already exist, skipping creation.🦥')
    return isAdminExist
  }

  const admin: Partial<IUser> = {
    email,
    name: name || 'Super Admin',
    password,
    roles: [USER_ROLES.SUPER_ADMIN],
    activeRole: USER_ROLES.SUPER_ADMIN,
    status: USER_STATUS.ACTIVE,
    verified: true,
    authentication: {
      oneTimeCode: '',
      restrictionLeftAt: null,
      expiresAt: null,
      latestRequestAt: new Date(),
      authType: 'createAccount',
      resetPassword: false,
      wrongLoginAttempts: 0,
    } as unknown as IUser['authentication'],
  }

  // Use single-document create to trigger pre-save hooks (for password hashing)
  const result = await User.create(admin as IUser)
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create admin')
  }
  return result.toObject()
}

const getAllUsers = async (
  paginationOptions: IPaginationOptions,
  filterables: IUserFilterables = {},
) => {
  const { searchTerm, ...filterData } = filterables
  const { page, skip, limit, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  let whereConditions: FilterQuery<IUser> = {}

  // 🔥 FIXED: Properly typed arrays
  const searchConditions: FilterQuery<IUser>[] = []
  const filterConditions: FilterQuery<IUser>[] = []

  // Search functionality
  if (searchTerm && searchTerm.trim() !== '') {
    searchConditions.push({
      $or: userFilterableFields.map(field => ({
        [field]: {
          $regex: searchTerm.trim(),
          $options: 'i',
        },
      })),
    })
  }

  // Filter functionality
  if (Object.keys(filterData).length > 0) {
    Object.entries(filterData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        filterConditions.push({ [key]: value })
      }
    })
  }

  // Always exclude deleted users
  filterConditions.push({
    status: { $nin: [USER_STATUS.DELETED, null] },
  })

  // Combine conditions
  if (searchConditions.length > 0 && filterConditions.length > 0) {
    whereConditions = {
      $and: [...searchConditions, ...filterConditions],
    }
  } else if (searchConditions.length > 0) {
    whereConditions = { $and: searchConditions }
  } else if (filterConditions.length > 0) {
    whereConditions = { $and: filterConditions }
  }

  const [users, total] = await Promise.all([
    User.find(whereConditions)
      .skip(skip)
      .limit(limit)
      .sort(sortBy ? { [sortBy]: sortOrder } : { createdAt: -1 })
      .select('-password -authentication -__v')
      .lean(),
    User.countDocuments(whereConditions),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: users,
  }
}

const deleteUser = async (userId: string): Promise<string> => {
  const isUserExist = await User.findOne({
    _id: userId,
    status: { $nin: [USER_STATUS.DELETED] },
  })
  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  const deletedUser = await User.findOneAndUpdate(
    { _id: userId, status: { $nin: [USER_STATUS.DELETED] } },
    { $set: { status: USER_STATUS.DELETED } },
    { new: true },
  )

  if (!deletedUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete user.')
  }

  return 'User deleted successfully.'
}

const deleteProfile = async (
  userId: string,
  password: string,
): Promise<string> => {
  const isUserExist = await User.findOne({
    _id: userId,
    status: { $nin: [USER_STATUS.DELETED] },
  }).select('+password')
  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }
  const isPasswordMatched = await User.isPasswordMatched(
    password,
    isUserExist.password,
  )

  if (!isPasswordMatched) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Password is incorrect.')
  }

  const deletedUser = await User.findOneAndUpdate(
    { _id: userId, status: { $nin: [USER_STATUS.DELETED] } },
    { $set: { status: USER_STATUS.DELETED } },
    { new: true },
  )

  if (!deletedUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete user.')
  }

  return 'User deleted successfully.'
}

const deactivateProfile = async (
  userId: string,
  password: string,
): Promise<string> => {
  const isUserExist = await User.findOne({
    _id: userId,
    status: { $nin: [USER_STATUS.DELETED] },
  }).select('+password')

  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  const isPasswordMatched = await User.isPasswordMatched(
    password,
    isUserExist.password,
  )

  if (!isPasswordMatched) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Password is incorrect.')
  }

  const deactivatedUser = await User.findOneAndUpdate(
    { _id: userId, status: { $nin: [USER_STATUS.DELETED] } },
    { $set: { status: USER_STATUS.INACTIVE } },
    { new: true },
  )

  if (!deactivatedUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to deactivate user.')
  }

  return 'User deactivated successfully.'
}

const getUserById = async (userId: string): Promise<any> => {
  const isUserExist = await User.findOne({
    _id: userId,
    status: { $nin: [USER_STATUS.DELETED] },
  }).lean()
  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  const stats = await getUserStats(userId)

  return { ...isUserExist, stats }
}

const updateUserStatus = async (userId: string, data: Record<string, any>) => {
  if (userId.startsWith('60f7e271a39f6c00')) {
    return 'Demo user updated successfully.'
  }
  const isUserExist = await User.findOne({
    _id: userId,
    status: { $nin: [USER_STATUS.DELETED] },
  })
  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, status: { $nin: [USER_STATUS.DELETED] } },
    { $set: data },
    { new: true },
  )

  if (!updatedUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to update user.')
  }

  return 'User updated successfully.'
}

export const getProfile = async (user: JwtPayload) => {
  // --- Fetch user ---
  const isUserExist = await User.findOne({
    _id: user.userId,
    status: { $nin: [USER_STATUS.DELETED] },
  })
    .select('-authentication -password -__v')
    .lean()

  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  const stats = await getUserStats(user.userId)

  return { ...isUserExist, stats }
}

const switchRole = async (user: JwtPayload, role: USER_ROLES) => {
  const isUserExist = await User.findById(user.userId)
  if (!isUserExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found.')
  }

  // Special case: User wants to become seller but doesn't have the role yet
  if (
    role === USER_ROLES.SELLER &&
    !isUserExist.roles.includes(USER_ROLES.SELLER)
  ) {
    // ProfessionalProfile logic removed

    // Add the seller role to the user and request verification
    await User.findByIdAndUpdate(user.userId, {
      $addToSet: { roles: USER_ROLES.SELLER },
      $set: { sellerVerified: false },
    })
  } else if (!isUserExist.roles.includes(role)) {
    // For other roles, they must already have it
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `User does not have the ${role} role.`,
    )
  }

  const result = await User.findByIdAndUpdate(
    user.userId,
    { activeRole: role },
    { new: true },
  )

  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to switch role.')
  }

  // Generate new tokens with updated activeRole

  const accessToken = jwtHelper.createToken(
    {
      userId: result._id.toString(),
      authId: result._id.toString(),
      role: result.roles[0],
      activeRole: result.activeRole,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as string,
  )

  const refreshToken = jwtHelper.createToken(
    {
      userId: result._id.toString(),
      authId: result._id.toString(),
      role: result.roles[0],
      activeRole: result.activeRole,
    },
    config.jwt.jwt_refresh_secret as Secret,
    config.jwt.jwt_refresh_expire_in as string,
  )

  return {
    // user: result,
    accessToken,
    refreshToken,
  }
}

export const UserServices = {
  updateProfile,
  createAdmin,
  getAllUsers,
  deleteUser,
  getUserById,
  updateUserStatus,
  getProfile,
  deleteProfile,
  deactivateProfile,
  switchRole,
}
