import { GiveawayParticipant, GiveawayConfig } from './giveaway.model'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'

const autoEnrollUser = async (userId: string, name: string, email: string) => {
  try {
    const existing = await GiveawayParticipant.findOne({ userId })
    if (existing) return existing

    let durationDays = 14
    const activeConfig = await GiveawayConfig.findOne({ isActive: true }).lean()
    if (activeConfig && activeConfig.durationDays) {
      durationDays = activeConfig.durationDays
    }

    const enteredAt = new Date()
    const expiresAt = new Date(enteredAt.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const participant = await GiveawayParticipant.create({
      userId,
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

const drawLiveWinner = async (streamId?: string) => {
  const now = new Date()

  // Mark expired participants
  await GiveawayParticipant.updateMany(
    { status: 'active', expiresAt: { $lt: now } },
    { $set: { status: 'expired' } },
  )

  // Use MongoDB $sample for scalable random selection (no memory overhead)
  const results = await GiveawayParticipant.aggregate([
    {
      $match: {
        status: 'active',
        expiresAt: { $gte: now },
      },
    },
    { $sample: { size: 1 } },
  ])

  if (results.length === 0) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'No active giveaway participants available in the pool.',
    )
  }

  const winner = results[0]

  // Update winner status
  await GiveawayParticipant.findByIdAndUpdate(winner._id, {
    status: 'won',
    wonStreamId: streamId || null,
    wonAt: now,
  })

  // Return only safe fields (no email for socket broadcast privacy)
  return {
    _id: winner._id,
    userId: winner.userId,
    name: winner.name,
    status: 'won',
    wonAt: now,
  }
}

const getParticipants = async (paginationOptions: IPaginationOptions, status?: string) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  const whereConditions: any = {}
  if (status) {
    whereConditions.status = status
  }

  const sortConditions: any = {}
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1
  } else {
    sortConditions.createdAt = -1
  }

  const result = await GiveawayParticipant.find(whereConditions)
    .populate('userId', 'name email profileImage')
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

const updateGiveawayConfig = async (payload: { durationDays?: number; title?: string; isActive?: boolean }) => {
  const result = await GiveawayConfig.findOneAndUpdate(
    { isActive: true },
    { $set: payload },
    { new: true, upsert: true },
  )
  return result
}

const getActiveConfig = async () => {
  const configDoc = await GiveawayConfig.findOne({ isActive: true }).lean()
  if (!configDoc) {
    const created = await GiveawayConfig.create({
      title: 'Welcome Giveaway (No Purchase Necessary)',
      durationDays: 14,
      isActive: true,
    })
    return created.toObject()
  }
  return configDoc
}

export const GiveawayService = {
  autoEnrollUser,
  drawLiveWinner,
  getParticipants,
  updateGiveawayConfig,
  getActiveConfig,
}
