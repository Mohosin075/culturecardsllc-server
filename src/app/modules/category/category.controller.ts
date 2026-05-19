import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { paginationFields } from '../../../interfaces/pagination'
import pick from '../../../shared/pick'
import { CategoryServices } from './category.service'

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const categoryData = req.body
  const result = await CategoryServices.createCategory(categoryData)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Category created successfully',
    data: result,
  })
})

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const paginationOptions = pick(req.query, paginationFields)
  const filters = pick(req.query, [
    'searchTerm',
    'name',
    'theme',
    'parent',
    'type',
    'isActive',
  ])
  const result = await CategoryServices.getAllCategories(
    filters,
    paginationOptions,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Categories retrieved successfully',
    data: result,
  })
})

const getSingleCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await CategoryServices.getSingleCategory(id)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Category retrieved successfully',
    data: result,
  })
})

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const categoryData = req.body
  const result = await CategoryServices.updateCategory(id, categoryData)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Category updated successfully',
    data: result,
  })
})

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await CategoryServices.deleteCategory(id)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  })
})

const getPopularCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryServices.getPopularCategories()

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Popular categories retrieved successfully',
    data: result,
  })
})

const getTrendingSubcategories = catchAsync(
  async (req: Request, res: Response) => {
    const result = await CategoryServices.getTrendingSubcategories()

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Trending subcategories retrieved successfully',
      data: result,
    })
  },
)

export const CategoryController = {
  createCategory,
  getAllCategories,
  getSingleCategory,
  getPopularCategories,
  getTrendingSubcategories,
  updateCategory,
  deleteCategory,
}
