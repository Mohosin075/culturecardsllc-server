import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { IProduct } from './product.interface'
import { Product } from './product.model'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import config from '../../../config'
import { User } from '../user/user.model'

const createProduct = async (payload: Partial<IProduct>): Promise<IProduct> => {
  const seller = await User.findById(payload.sellerId)
  if (!seller) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Seller not found')
  }

  if (!seller.sellerVerified) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your seller account is not verified yet. Please wait for admin approval.',
    )
  }

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

  return await Product.find(query)
    .populate('sellerId', 'name fullName email image photo')
    .populate('category', 'name image icon theme')
}

const getProductById = async (id: string): Promise<IProduct> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const result = await Product.findById(id)
    .populate('sellerId', 'name fullName email image photo stripeCustomerId')
    .populate('category', 'name image icon theme')
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

const boostProduct = async (
  productId: string,
  userId: string,
  boostDurationDays: number = 7,
): Promise<{ sessionId: string; url: string }> => {
  if (!Types.ObjectId.isValid(productId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }

  const product = await Product.findById(productId)
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }

  if (product.sellerId.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not authorized to boost this product')
  }

  // Cost calculation: e.g., $5 per day
  const amountPerDay = 5
  const totalAmount = amountPerDay * boostDurationDays

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Boost Listing: ${product.title}`,
            description: `Boost item listing for ${boostDurationDays} days`,
          },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${config.clientUrl}?boost_success=true&productId=${productId}`,
    cancel_url: `${config.clientUrl}/product/cancel`,
    metadata: {
      purchaseType: 'product_boost',
      productId: productId,
      boostDurationDays: boostDurationDays.toString(),
    },
  })

  return {
    sessionId: session.id,
    url: session.url!,
  }
}

export const ProductServices = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  boostProduct,
}
