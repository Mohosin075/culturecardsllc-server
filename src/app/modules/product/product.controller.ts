import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { ProductServices } from './product.service'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { JwtPayload } from 'jsonwebtoken'

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.createProduct(req.body)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Product created successfully.',
    data: result,
  })
})

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    searchTerm: req.query.searchTerm as string,
    category: req.query.category as string,
    condition: req.query.condition as string,
    allowTrade: req.query.allowTrade
      ? req.query.allowTrade === 'true'
      : undefined,
    status: req.query.status as string,
    sellerId: req.query.sellerId as string,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
  }

  const paginationOptions = {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    sortBy: req.query.sortBy as string,
    sortOrder: req.query.sortOrder as 'asc' | 'desc',
  }

  const result = await ProductServices.getAllProducts(filters, paginationOptions)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Products fetched successfully.',
    meta: result.meta,
    data: result.data,
  })
})

const getProductById = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.getProductById(req.params.id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product fetched successfully.',
    data: result,
  })
})

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.updateProduct(req.params.id, req.body)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product updated successfully.',
    data: result,
  })
})

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.deleteProduct(req.params.id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product deleted successfully.',
    data: result,
  })
})

const boostProduct = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const boostDurationDays = req.body.boostDurationDays ? Number(req.body.boostDurationDays) : 7
  const result = await ProductServices.boostProduct(req.params.id, user.userId, boostDurationDays)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Boost Checkout session created successfully.',
    data: result,
  })
})

export const ProductControllers = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  boostProduct,
}
