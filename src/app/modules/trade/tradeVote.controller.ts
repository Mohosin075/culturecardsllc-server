import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { TradeVoteServices } from './tradeVote.service'
import { JwtPayload } from 'jsonwebtoken'

const getTradeVoteFeed = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload | undefined
  const result = await TradeVoteServices.getTradeVoteFeed(
    user?.userId,
    req.query,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade voting feed retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const castVote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const { id } = req.params
  const { option } = req.body

  const result = await TradeVoteServices.castVote(id, user.userId, option)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Vote cast successfully',
    data: result,
  })
})

export const TradeVoteControllers = {
  getTradeVoteFeed,
  castVote,
}
