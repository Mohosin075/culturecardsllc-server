import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { TradeServices } from './trade.service'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import ApiError from '../../../errors/ApiError'
import { JwtPayload } from 'jsonwebtoken'

const createTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  // senderId always from authenticated user — never trust client body
  const payload = { ...req.body, senderId: user.userId }
  const result = await TradeServices.createTradeOffer(payload)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Trade proposal submitted successfully.',
    data: result,
  })
})

const getTradeOffers = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = (req.query.userId as string) || user.userId
  const type = (req.query.type as 'sent' | 'received') || 'received'

  if (!userId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'userId is required.',
    )
  }

  const result = await TradeServices.getTradeOffers(userId, type)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offers retrieved successfully.',
    data: result,
  })
})

const acceptTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await TradeServices.acceptTradeOffer(req.params.id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offer accepted successfully. Items held in secure escrow.',
    data: result,
  })
})

const declineTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await TradeServices.declineTradeOffer(req.params.id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offer declined.',
    data: result,
  })
})

const completeTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await TradeServices.completeTradeOffer(req.params.id, user.userId)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade completed successfully. Ownership transferred.',
    data: result,
  })
})

export const TradeControllers = {
  createTradeOffer,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
  completeTradeOffer,
}
