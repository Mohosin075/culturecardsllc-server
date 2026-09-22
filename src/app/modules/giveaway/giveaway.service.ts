import { GiveawayParticipant, GiveawayConfig } from './giveaway.model'
import { IGiveawayConfig } from './giveaway.interface'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
import { User } from '../user/user.model'
import { Types } from 'mongoose'


const enterGiveaway = async (userId: string) => {
  const user = await User.findById(userId)
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  }

  if (!user.verified) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Please verify your account to enter this giveaway.',
    )
  }

  const activeConfig = await getActiveConfig()
  if (!activeConfig || !activeConfig.isActive) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Giveaway is currently closed.')
  }

  if (activeConfig.drawDate && new Date() > new Date(activeConfig.drawDate)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Giveaway entry deadline has passed.',
    )
  }

  const slug = activeConfig.slug || 'michael-vick-jersey-2026'

  const existing = await GiveawayParticipant.findOne({
    userId: user._id,
    giveawaySlug: slug,
  })

  if (existing) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "You're already entered in this giveaway!",
    )
  }

  const participant = await GiveawayParticipant.create({
    userId: user._id,
    giveawaySlug: slug,
    name: user.fullName || user.name || 'Participant',
    email: user.email || '',
    status: 'active',
    enteredAt: new Date(),
    expiresAt: activeConfig.drawDate || undefined,
  })

  return participant
}

const getMyStatus = async (userId: string) => {
  const user = await User.findById(userId).select('verified name fullName email')
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  }

  const activeConfig = await getActiveConfig()
  const slug = activeConfig.slug || 'michael-vick-jersey-2026'

  const entry = await GiveawayParticipant.findOne({
    userId: user._id,
    giveawaySlug: slug,
  })

  return {
    isGiveawayActive: Boolean(activeConfig?.isActive),
    isUserVerified: Boolean(user.verified),
    hasEntered: Boolean(entry),
    enteredAt: entry?.enteredAt || null,
    status: entry?.status || null,
    config: activeConfig,
  }
}

const getRandomPool = async (limit = 100, slug?: string) => {
  const activeConfig = await getActiveConfig()
  const targetSlug = slug || activeConfig.slug || 'michael-vick-jersey-2026'

  const participants = await GiveawayParticipant.aggregate([
    {
      $match: {
        giveawaySlug: targetSlug,
        status: { $in: ['active', 'shortlisted'] },
      },
    },
    { $sample: { size: Math.max(1, Math.min(limit, 500)) } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userDetails',
      },
    },
    {
      $unwind: {
        path: '$userDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        giveawaySlug: 1,
        name: 1,
        email: 1,
        status: 1,
        enteredAt: 1,
        'userDetails.name': 1,
        'userDetails.fullName': 1,
        'userDetails.username': 1,
        'userDetails.email': 1,
        'userDetails.profile': 1,
        'userDetails.address': 1,
        'userDetails.phone': 1,
      },
    },
  ])

  return participants
}

const autoEnrollUser = async (userId: string, name: string, email: string) => {
  try {
    const activeConfig = await getActiveConfig()
    const slug = activeConfig.slug || 'michael-vick-jersey-2026'

    const existing = await GiveawayParticipant.findOne({ userId, giveawaySlug: slug })
    if (existing) return existing

    const durationDays = activeConfig.durationDays || 14
    const enteredAt = new Date()
    const expiresAt =
      activeConfig.drawDate ||
      new Date(enteredAt.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const participant = await GiveawayParticipant.create({
      userId,
      giveawaySlug: slug,
      name,
      email,
      status: 'active',
      enteredAt,
      expiresAt,
    })

    return participant
  } catch (error) {
    console.error('Auto giveaway enrollment error (non-fatal):', error)
    return null
  }
}

const drawLiveWinner = async (
  streamId?: string,
  participantId?: string,
  userId?: string,
) => {
  const now = new Date()
  const activeConfig = await getActiveConfig()
  const slug = activeConfig.slug || 'michael-vick-jersey-2026'

  let winnerParticipant: any = null
  const targetId = participantId || userId

  if (targetId && Types.ObjectId.isValid(targetId)) {
    winnerParticipant = await GiveawayParticipant.findOne({
      giveawaySlug: slug,
      $or: [{ _id: targetId }, { userId: targetId }],
    })
  }

  if (!winnerParticipant) {
    // Pick randomly via MongoDB $sample
    const results = await GiveawayParticipant.aggregate([
      {
        $match: {
          giveawaySlug: slug,
          status: { $in: ['active', 'shortlisted'] },
        },
      },
      { $sample: { size: 1 } },
    ])

    if (results.length === 0) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'No eligible giveaway participants available in the pool.',
      )
    }

    winnerParticipant = results[0]
  }

  // Update winner status
  const updatedWinner = await GiveawayParticipant.findByIdAndUpdate(
    winnerParticipant._id,
    {
      status: 'won',
      wonStreamId: streamId || null,
      wonAt: now,
    },
    { new: true },
  ).populate('userId', 'name fullName email profile address phone username')

  return updatedWinner
}

const getWinners = async (slug?: string) => {
  const activeConfig = await getActiveConfig()
  const targetSlug = slug || activeConfig.slug || 'michael-vick-jersey-2026'

  const winners = await GiveawayParticipant.find({
    giveawaySlug: targetSlug,
    status: 'won',
  })
    .populate('userId', 'name fullName email profile username address phone')
    .sort({ wonAt: -1 })

  return winners
}

const getParticipants = async (paginationOptions: IPaginationOptions, status?: string, slug?: string) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  const whereConditions: any = {}
  if (status) {
    whereConditions.status = status
  }
  if (slug) {
    whereConditions.giveawaySlug = slug
  }

  const sortConditions: any = {}
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1
  } else {
    sortConditions.createdAt = -1
  }

  const result = await GiveawayParticipant.find(whereConditions)
    .populate('userId', 'name fullName email profile address phone username')
    .sort(sortConditions)
    .skip(skip)
    .limit(limit)

  const total = await GiveawayParticipant.countDocuments(whereConditions)

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  }
}

const updateGiveawayConfig = async (payload: {
  slug?: string
  title?: string
  prizeTitle?: string
  prizeImage?: string
  drawDate?: Date
  durationDays?: number
  isActive?: boolean
  description?: string
}) => {
  const targetSlug = payload.slug || 'michael-vick-jersey-2026'
  const result = await GiveawayConfig.findOneAndUpdate(
    { slug: targetSlug },
    { $set: payload },
    { new: true, upsert: true },
  )
  return result
}

const getActiveConfig = async (): Promise<IGiveawayConfig> => {
  let configDoc = await GiveawayConfig.findOne({ isActive: true })
  if (!configDoc) {
    configDoc = await GiveawayConfig.create({
      slug: 'michael-vick-jersey-2026',
      title: 'Michael Vick Jersey Giveaway',
      prizeTitle: 'Official Signed Michael Vick Jersey',
      drawDate: new Date('2026-09-25T23:59:59.999Z'),
      durationDays: 14,
      isActive: true,
      description:
        'Enter for a chance to win the Michael Vick Jersey! Winner will be drawn on September 25th.',
    })
  }
  return configDoc
}


export const GiveawayService = {
  enterGiveaway,
  getMyStatus,
  getRandomPool,
  autoEnrollUser,
  drawLiveWinner,
  getWinners,
  getParticipants,
  updateGiveawayConfig,
  getActiveConfig,
}

