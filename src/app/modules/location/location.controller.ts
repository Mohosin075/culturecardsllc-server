import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { LocationServices } from './location.service'

const searchSuggestions = catchAsync(async (req: Request, res: Response) => {
  const query = req.query.q as string
  const result = await LocationServices.searchSuggestions(query)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Location suggestions retrieved successfully',
    data: result,
  })
})

const geocodeAddress = catchAsync(async (req: Request, res: Response) => {
  const address = req.query.address as string
  const result = await LocationServices.geocodeAddress(address)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Location geocoded successfully',
    data: result,
  })
})

export const LocationController = {
  searchSuggestions,
  geocodeAddress,
}
