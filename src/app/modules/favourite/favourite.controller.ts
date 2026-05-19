import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { paginationFields } from '../../../interfaces/pagination'
import pick from '../../../shared/pick'
import { FavouriteService } from './favourite.service'
import { JwtPayload } from 'jsonwebtoken'

const toggleFavourite = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload
  const result = await FavouriteService.toggleFavourite(userId, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  })
})

const getMyFavourites = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload
  const paginationOptions = pick(req.query, paginationFields)
  const { favouriteType } = req.query

  const result = await FavouriteService.getMyFavourites(
    userId,
    favouriteType as any,
    paginationOptions,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Favourites retrieved successfully',
    data: result,
  })
})

export const FavouriteController = {
  toggleFavourite,
  getMyFavourites,
}
