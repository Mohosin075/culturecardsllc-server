import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { TipServices } from './tip.service'

const createTipIntent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await TipServices.createTipIntent(user, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.status === 'succeeded' ? 'Tip completed successfully!' : 'Tip payment session created.',
    data: result,
  })
})

const confirmTip = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await TipServices.confirmTip(user, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Tip confirmed successfully! Thank you for supporting the host.',
    data: result,
  })
})

const getStreamTips = catchAsync(async (req: Request, res: Response) => {
  const { streamId } = req.params
  const result = await TipServices.getStreamTips(streamId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stream tips retrieved successfully.',
    data: result,
  })
})

const getMySellerTips = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const userId = user.userId || user._id || user.id
  const result = await TipServices.getMySellerTips(userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Seller tips and earnings retrieved successfully.',
    data: result,
  })
})

export const TipController = {
  createTipIntent,
  confirmTip,
  getStreamTips,
  getMySellerTips,
}
