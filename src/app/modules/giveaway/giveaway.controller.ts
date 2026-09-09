import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { GiveawayService } from './giveaway.service'
import pick from '../../../shared/pick'
import { paginationFields } from '../../../interfaces/pagination'

const drawWinner = catchAsync(async (req: Request, res: Response) => {
  const { streamId } = req.body
  const result = await GiveawayService.drawLiveWinner(streamId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Giveaway winner drawn successfully: ${result.name}`,
    data: result,
  })
})

const getParticipants = catchAsync(async (req: Request, res: Response) => {
  const paginationOptions = pick(req.query, paginationFields)
  const status = req.query.status as string | undefined

  const result = await GiveawayService.getParticipants(paginationOptions, status)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Giveaway participants retrieved successfully',
    data: result,
  })
})

const getConfig = catchAsync(async (req: Request, res: Response) => {
  const result = await GiveawayService.getActiveConfig()

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Giveaway config retrieved successfully',
    data: result,
  })
})

const updateConfig = catchAsync(async (req: Request, res: Response) => {
  const result = await GiveawayService.updateGiveawayConfig(req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Giveaway config updated successfully',
    data: result,
  })
})

export const GiveawayController = {
  drawWinner,
  getParticipants,
  getConfig,
  updateConfig,
}
