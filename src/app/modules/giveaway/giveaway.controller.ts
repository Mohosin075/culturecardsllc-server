import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { GiveawayService } from './giveaway.service'
import pick from '../../../shared/pick'
import { paginationFields } from '../../../interfaces/pagination'

const enterGiveaway = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.userId || (req.user as any)?._id || (req.user as any)?.authId
  const result = await GiveawayService.enterGiveaway(userId)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "You're Entered! / Successfully Entered into Giveaway",
    data: result,
  })
})

const getMyStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.userId || (req.user as any)?._id || (req.user as any)?.authId
  const result = await GiveawayService.getMyStatus(userId)


  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Giveaway user status retrieved successfully',
    data: result,
  })
})

const getRandomPool = catchAsync(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100
  const slug = req.query.slug as string | undefined
  const result = await GiveawayService.getRandomPool(limit, slug)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `${result.length} random giveaway participants retrieved successfully`,
    data: result,
  })
})

const drawWinner = catchAsync(async (req: Request, res: Response) => {
  const { streamId, participantId } = req.body
  const result = await GiveawayService.drawLiveWinner(streamId, participantId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Giveaway winner drawn successfully: ${result?.name || 'Winner'}`,
    data: result,
  })
})

const getWinners = catchAsync(async (req: Request, res: Response) => {
  const slug = req.query.slug as string | undefined
  const result = await GiveawayService.getWinners(slug)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Giveaway winners retrieved successfully',
    data: result,
  })
})

const getParticipants = catchAsync(async (req: Request, res: Response) => {
  const paginationOptions = pick(req.query, paginationFields)
  const status = req.query.status as string | undefined
  const slug = req.query.slug as string | undefined

  const result = await GiveawayService.getParticipants(
    paginationOptions,
    status,
    slug,
  )

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
  enterGiveaway,
  getMyStatus,
  getRandomPool,
  drawWinner,
  getWinners,
  getParticipants,
  getConfig,
  updateConfig,
}

