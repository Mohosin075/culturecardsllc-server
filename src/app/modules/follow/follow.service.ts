import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { Follow } from './follow.model'
import { User } from '../user/user.model'
import { paginationHelper } from '../../../helpers/paginationHelper'
import { IPaginationOptions } from '../../../interfaces/pagination'

const toggleFollow = async (followerId: string, followingId: string) => {
  if (followerId === followingId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "You cannot follow yourself.")
  }

  const targetUser = await User.findById(followingId)
  if (!targetUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User to follow not found.')
  }

  const existingFollow = await Follow.findOne({ followerId, followingId })

  if (existingFollow) {
    // Unfollow
    await Follow.findOneAndDelete({ followerId, followingId })
    return { followed: false, message: 'Unfollowed successfully' }
  } else {
    // Follow
    await Follow.create({ followerId, followingId })
    return { followed: true, message: 'Followed successfully' }
  }
}

const getFollowers = async (userId: string, paginationOptions: IPaginationOptions) => {
  const { page, skip, limit, sortBy, sortOrder } = paginationHelper.calculatePagination(paginationOptions)

  const [followers, total] = await Promise.all([
    Follow.find({ followingId: userId })
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .populate('followerId', 'name fullName email image profile')
      .lean(),
    Follow.countDocuments({ followingId: userId }),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: followers.map(f => f.followerId),
  }
}

const getFollowing = async (userId: string, paginationOptions: IPaginationOptions) => {
  const { page, skip, limit, sortBy, sortOrder } = paginationHelper.calculatePagination(paginationOptions)

  const [following, total] = await Promise.all([
    Follow.find({ followerId: userId })
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder })
      .populate('followingId', 'name fullName email image profile')
      .lean(),
    Follow.countDocuments({ followerId: userId }),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: following.map(f => f.followingId),
  }
}

export const FollowServices = {
  toggleFollow,
  getFollowers,
  getFollowing,
}
