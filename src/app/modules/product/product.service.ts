import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { IProduct } from './product.interface'
import { Product } from './product.model'
import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import config from '../../../config'
import { User } from '../user/user.model'
import { Payment } from '../payment/payment.model'

import { Category } from '../category/category.model'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'

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

const populateCategoriesSafely = async (products: any[]) => {
  if (!products || products.length === 0) return []

  const categoryValues = Array.from(
    new Set(products.map(p => p.category).filter(Boolean)),
  )

  if (categoryValues.length === 0) return products

  const validObjectIds = categoryValues.filter(c => Types.ObjectId.isValid(c))
  const stringNames = categoryValues.filter(c => !Types.ObjectId.isValid(c))

  const searchConditions: any[] = []
  if (validObjectIds.length > 0) {
    searchConditions.push({ _id: { $in: validObjectIds } })
  }
  if (stringNames.length > 0) {
    searchConditions.push({ name: { $in: stringNames } })
  }

  const categories =
    searchConditions.length > 0
      ? await Category.find({ $or: searchConditions })
          .select('name image icon theme parent type')
          .lean()
      : []

  const categoryMap = new Map<string, any>()
  categories.forEach(cat => {
    categoryMap.set(cat._id.toString(), cat)
    categoryMap.set(cat.name.toLowerCase(), cat)
  })

  return products.map(p => {
    if (!p.category) return p

    if (typeof p.category === 'object' && p.category._id) return p

    const catKey = p.category.toString()
    const foundCategory =
      categoryMap.get(catKey) || categoryMap.get(catKey.toLowerCase())

    return {
      ...p,
      category: foundCategory || { name: catKey },
    }
  })
}

const getAllProducts = async (
  filters: {
    searchTerm?: string
    category?: string
    condition?: string
    allowTrade?: boolean
    status?: string
    sellerId?: string
    minPrice?: number
    maxPrice?: number
  },
  paginationOptions: IPaginationOptions = {},
): Promise<{
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  data: IProduct[]
}> => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

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

  if (category) {
    if (Types.ObjectId.isValid(category)) {
      query.category = category
    } else {
      const categoryDoc = await Category.findOne({
        name: { $regex: `^${category}$`, $options: 'i' },
      }).select('_id')
      if (categoryDoc) {
        query.category = categoryDoc._id
      } else {
        query.category = category
      }
    }
  }
  if (condition) query.condition = condition
  if (allowTrade !== undefined) query.allowTrade = allowTrade
  if (status) query.status = status
  if (sellerId && Types.ObjectId.isValid(sellerId)) {
    query.sellerId = new Types.ObjectId(sellerId)
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.estValue = {}
    if (minPrice !== undefined) query.estValue.$gte = Number(minPrice)
    if (maxPrice !== undefined) query.estValue.$lte = Number(maxPrice)
  }

  const sortConditions: any = {}
  if (sortBy) {
    sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1
  } else {
    sortConditions.createdAt = -1
  }

  const [rawProducts, total] = await Promise.all([
    Product.find(query)
      .populate('sellerId', 'name fullName email image photo')
      .sort(sortConditions)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ])

  const result = await populateCategoriesSafely(rawProducts)

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result as unknown as IProduct[],
  }
}

const getProductById = async (id: string): Promise<IProduct> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const rawProduct = await Product.findById(id)
    .populate('sellerId', 'name fullName email image photo stripeCustomerId')
    .lean()
  if (!rawProduct) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }
  const [result] = await populateCategoriesSafely([rawProduct])
  return result as unknown as IProduct
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

  const user = await User.findById(userId)
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
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

  // Create Payment record for tracking & webhook safety
  await Payment.create({
    userId: userId,
    userEmail: user.email,
    amount: totalAmount,
    currency: 'usd',
    paymentMethod: 'stripe',
    paymentIntentId: session.id,
    status: 'pending',
    metadata: {
      purchaseType: 'product_boost',
      productId: productId,
      boostDurationDays: boostDurationDays.toString(),
      checkoutSessionId: session.id,
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
