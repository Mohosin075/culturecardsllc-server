import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { IProduct } from './product.interface'
import { Product } from './product.model'
import { Types } from 'mongoose'

const createProduct = async (payload: Partial<IProduct>): Promise<IProduct> => {
  const result = await Product.create(payload)
  return result
}

const getAllProducts = async (filters: {
  searchTerm?: string
  category?: string
  condition?: string
  allowTrade?: boolean
  status?: string
  sellerId?: string
  minPrice?: number
  maxPrice?: number
}): Promise<IProduct[]> => {
  const {
    searchTerm,
    category,
    condition,
    allowTrade,
    status,
    sellerId,
    minPrice,
    maxPrice,
  } = filters
  const query: any = {}

  if (searchTerm) {
    query.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
    ]
  }

  if (category) query.category = category
  if (condition) query.condition = condition
  if (allowTrade !== undefined) query.allowTrade = allowTrade
  if (status) query.status = status
  if (sellerId) query.sellerId = new Types.ObjectId(sellerId)

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.estValue = {}
    if (minPrice !== undefined) query.estValue.$gte = Number(minPrice)
    if (maxPrice !== undefined) query.estValue.$lte = Number(maxPrice)
  }

  return await Product.find(query).populate(
    'sellerId',
    'name fullName email image photo',
  )
}

const getProductById = async (id: string): Promise<IProduct> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const result = await Product.findById(id).populate(
    'sellerId',
    'name fullName email image photo stripeCustomerId',
  )
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }
  return result
}

const updateProduct = async (
  id: string,
  payload: Partial<IProduct>,
): Promise<IProduct | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const result = await Product.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }
  return result
}

const deleteProduct = async (id: string): Promise<IProduct | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const result = await Product.findByIdAndDelete(id)
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }
  return result
}

export const ProductServices = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
}
