import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { Types } from 'mongoose'
import { TradeVote, UserVoteLog } from './tradeVote.model'
import { ITradeVote } from './tradeVote.interface'
import { TradeOffer } from './trade.model'
import { Product } from '../product/product.model'
import { User } from '../user/user.model'

/**
 * Format relative time (e.g. "Completed 2h ago")
 */
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Completed just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Completed ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Completed ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Completed ${days}d ago`
  const months = Math.floor(days / 30)
  return `Completed ${months}mo ago`
}

/**
 * 1. Fetch trade voting feed with user voting state and percentages
 */
const getTradeVoteFeed = async (
  userId?: string,
  query?: Record<string, any>,
) => {
  const page = Number(query?.page) || 1
  const limit = Number(query?.limit) || 10
  const skip = (page - 1) * limit

  const filter = { isActive: true }

  const total = await TradeVote.countDocuments(filter)
  const votes = await TradeVote.find(filter)
    .sort({ completedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()

  let userVoteMap = new Map<string, 'A' | 'B'>()

  if (userId && Types.ObjectId.isValid(userId) && votes.length > 0) {
    const tradeVoteIds = votes.map(v => v._id)
    const logs = await UserVoteLog.find({
      userId: new Types.ObjectId(userId),
      tradeVoteId: { $in: tradeVoteIds },
    }).lean()

    logs.forEach(log => {
      userVoteMap.set(log.tradeVoteId.toString(), log.votedOption)
    })
  }

  const data = votes.map(v => {
    const totalVotes = v.totalVotes || 0
    const votesA = v.votesA || 0
    const votesB = v.votesB || 0

    const percentageA =
      totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50
    const percentageB = totalVotes > 0 ? 100 - percentageA : 50

    const userVotedOption = userVoteMap.get(v._id.toString()) || null

    return {
      _id: v._id,
      tradeId: v.tradeId,
      category: v.category,
      timeAgo: formatTimeAgo(v.completedAt || v.createdAt),
      itemA: {
        name: v.itemA.name,
        value: v.itemA.value,
        image: v.itemA.image,
        traderName: v.itemA.traderName || 'Trader A',
      },
      itemB: {
        name: v.itemB.name,
        value: v.itemB.value,
        image: v.itemB.image,
        traderName: v.itemB.traderName || 'Trader B',
      },
      votesA,
      votesB,
      totalVotes,
      percentageA,
      percentageB,
      hasVoted: Boolean(userVotedOption),
      votedOption: userVotedOption,
      completedAt: v.completedAt,
    }
  })

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  }
}

/**
 * 2. Cast a vote on a trade
 */
const castVote = async (
  tradeVoteId: string,
  userId: string,
  option: 'A' | 'B',
) => {
  if (!Types.ObjectId.isValid(tradeVoteId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Trade Vote ID')
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid User ID')
  }

  const tradeVote = await TradeVote.findById(tradeVoteId)
  if (!tradeVote) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade vote not found')
  }

  if (!tradeVote.isActive) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Voting for this trade is closed.',
    )
  }

  // Self-voting prohibition: Traders cannot vote on their own trade
  const traderAId = tradeVote.itemA.traderId?.toString()
  const traderBId = tradeVote.itemB.traderId?.toString()
  if (traderAId === userId || traderBId === userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Traders cannot vote on their own trade.',
    )
  }

  // Create the vote log FIRST — the unique compound index on {userId, tradeVoteId}
  // acts as an atomic gate. If two concurrent requests slip past the status checks above,
  // only ONE will succeed here; the other gets a 11000 error before any $inc fires,
  // preventing vote count inflation.
  try {
    await UserVoteLog.create({
      userId: new Types.ObjectId(userId),
      tradeVoteId: new Types.ObjectId(tradeVoteId),
      votedOption: option,
    })
  } catch (error: any) {
    if (error.code === 11000) {
      // Covers both the manual re-vote case and concurrent race attempts
      throw new ApiError(
        StatusCodes.CONFLICT,
        'You have already voted on this trade!',
      )
    }
    throw error
  }

  // Vote log created — now atomically increment the counters
  const incField = option === 'A' ? { votesA: 1 } : { votesB: 1 }
  const updatedTrade = await TradeVote.findByIdAndUpdate(
    tradeVoteId,
    {
      $inc: { ...incField, totalVotes: 1 },
    },
    { new: true },
  )

  if (!updatedTrade) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade vote not found')
  }

  const pctA =
    updatedTrade.totalVotes > 0
      ? Math.round((updatedTrade.votesA / updatedTrade.totalVotes) * 100)
      : 50
  const pctB = 100 - pctA

  return {
    tradeVoteId: updatedTrade._id,
    votesA: updatedTrade.votesA,
    votesB: updatedTrade.votesB,
    totalVotes: updatedTrade.totalVotes,
    percentageA: pctA,
    percentageB: pctB,
    hasVoted: true,
    votedOption: option,
  }
}

/**
 * 3. Helper: Automatically create TradeVote record when a Trade is completed
 */
const createTradeVoteFromCompletedTrade = async (
  tradeOfferOrId: any,
): Promise<ITradeVote | null> => {
  try {
    const offerId = tradeOfferOrId?._id || tradeOfferOrId
    if (!offerId || !Types.ObjectId.isValid(offerId)) return null

    // Avoid duplicate creation
    const existing = await TradeVote.findOne({ tradeId: offerId })
    if (existing) return existing

    const rawTrade = (await TradeOffer.findById(offerId)) as any
    if (!rawTrade) return null

    const populatedTrade = (await TradeOffer.findById(offerId)
      .populate('senderProductId')
      .populate('receiverProductId')
      .populate('senderId', 'name fullName')
      .populate('receiverId', 'name fullName')) as any

    const senderProd = populatedTrade?.senderProductId
    const receiverProd = populatedTrade?.receiverProductId
    const senderUser = populatedTrade?.senderId
    const receiverUser = populatedTrade?.receiverId

    if (!senderProd || !receiverProd) return null

    const itemAImage =
      (senderProd.images && senderProd.images[0]) ||
      senderProd.image ||
      'https://placehold.co/400x400?text=Card+A'
    const itemBImage =
      (receiverProd.images && receiverProd.images[0]) ||
      receiverProd.image ||
      'https://placehold.co/400x400?text=Card+B'

    const itemAValue = senderProd.estValue
      ? `$${senderProd.estValue}`
      : senderProd.price
      ? `$${senderProd.price}`
      : '$0'

    const itemBValue = receiverProd.estValue
      ? `$${receiverProd.estValue}`
      : receiverProd.price
      ? `$${receiverProd.price}`
      : '$0'

    const category =
      senderProd.categoryName || receiverProd.categoryName || 'Trading Cards'

    const traderAId = senderUser?._id || rawTrade.senderId
    const traderBId = receiverUser?._id || rawTrade.receiverId

    const tradeVote = await TradeVote.create({
      tradeId: rawTrade._id,
      category,
      itemA: {
        name: senderProd.title || 'Product A',
        value: itemAValue,
        image: itemAImage,
        traderId: traderAId,
        traderName: senderUser?.name || senderUser?.fullName || 'Trader A',
      },
      itemB: {
        name: receiverProd.title || 'Product B',
        value: itemBValue,
        image: itemBImage,
        traderId: traderBId,
        traderName: receiverUser?.name || receiverUser?.fullName || 'Trader B',
      },
      votesA: 0,
      votesB: 0,
      totalVotes: 0,
      isActive: true,
      completedAt: rawTrade.updatedAt || new Date(),
    })

    return tradeVote
  } catch (error) {
    console.error('Failed to create TradeVote from completed trade:', error)
    return null
  }
}

export const TradeVoteServices = {
  getTradeVoteFeed,
  castVote,
  createTradeVoteFromCompletedTrade,
}
