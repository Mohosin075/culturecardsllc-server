import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { AuctionServices } from './auction.service'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import ApiError from '../../../errors/ApiError'
import { JwtPayload } from 'jsonwebtoken'

const generateAgoraToken = catchAsync(async (req: Request, res: Response) => {
  const channelName = req.query.channelName as string
  const uid = req.query.uid ? Number(req.query.uid) : 0
  const role = (req.query.role as 'publisher' | 'subscriber') || 'subscriber'

  if (!channelName) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'channelName is required as query parameter.',
    )
  }

  const result = await AuctionServices.generateAgoraToken(
    channelName,
    uid,
    role,
  )
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Agora token generated successfully.',
    data: result,
  })
})

const createLiveStream = catchAsync(async (req: Request, res: Response) => {
  const result = await AuctionServices.createLiveStream(req.body)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Live stream session initialized successfully.',
    data: result,
  })
})

const getLiveStreams = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as string
  const result = await AuctionServices.getLiveStreams(status)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Live streams fetched successfully.',
    data: result,
  })
})

const createAuctionItem = catchAsync(async (req: Request, res: Response) => {
  const result = await AuctionServices.createAuctionItem(req.body)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Auction item registered successfully.',
    data: result,
  })
})

const placeBidSecure = catchAsync(async (req: Request, res: Response) => {
  const { auctionItemId, bidderId, bidAmount } = req.body
  const result = await AuctionServices.placeBidSecure(
    auctionItemId,
    bidderId,
    bidAmount,
  )
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Bid placed successfully.',
    data: result,
  })
})

const updateLiveStreamStatus = catchAsync(async (req: Request, res: Response) => {
  const { streamId } = req.params
  const { status } = req.body
  const user = req.user as JwtPayload

  const result = await AuctionServices.updateLiveStreamStatus(
    streamId,
    user.userId,
    user.role,
    status,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Live stream status updated successfully.',
    data: result,
  })
})

export const AuctionControllers = {
  generateAgoraToken,
  createLiveStream,
  getLiveStreams,
  createAuctionItem,
  placeBidSecure,
  updateLiveStreamStatus,
}
