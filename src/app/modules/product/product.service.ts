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
import { USER_ROLES } from '../../../enum/user'
import { SellerServices } from '../seller/seller.service'

/** A trade-only listing that is not a giveaway — no money changes hands. */
const isTradeOnlyListing = (p: Partial<IProduct>): boolean =>
  p.isTradeOnly === true && p.isGiveaway !== true

const SALE_FIELDS = [
  'buyNowPrice',
  'startingBid',
  'reservePrice',
  'allowOffers',
  'minOfferAmount',
] as const

const stripSaleFields = (p: Partial<IProduct>): void => {
  for (const field of SALE_FIELDS) delete p[field]
  p.allowTrade = true
}

const createProduct = async (payload: Partial<IProduct>): Promise<IProduct> => {
  const seller = await User.findById(payload.sellerId)
  if (!seller) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Seller not found')
  }

  if (isTradeOnlyListing(payload)) {
    // Client spec, section 6: anyone can list an item for trade without
    // seller approval. A trade-only item is never for sale, so any price
    // fields are dropped — otherwise it could be bought outright by someone
    // who was never approved to take money.
    stripSaleFields(payload)
  } else {
    // Seller activation (client spec, section 5): ARIES approval *and*
    // Stripe payout eligibility are both required before anything is listed
    // for sale.
    await SellerServices.assertSellerCanSell(seller._id)
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
    /** true only for the owner's own "My Inventory" view */
    includePrivate?: boolean
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
    includePrivate,
  } = filters
  const query: any = {}

  if (searchTerm) {
    const safe = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.$or = [
      { title: { $regex: safe, $options: 'i' } },
      { description: { $regex: safe, $options: 'i' } },
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
  // Private inventory (saved, not listed for trade) is only visible to its
  // owner via /products/my. Public lists never show it.
  if (!includePrivate && allowTrade === undefined) query.allowTrade = { $ne: false }
  // Exclude trade-only counter items from public marketplace listings
  if (!includePrivate) query.isTradeOnly = { $ne: true }
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
  userId?: string,
  userRole?: string,
): Promise<IProduct | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const product = await Product.findById(id)
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }
  if (userId && userRole !== USER_ROLES.ADMIN && userRole !== USER_ROLES.SUPER_ADMIN) {
    if (product.sellerId.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You can only edit your own listings')
    }
    // Sellers can't self-feature, change ownership or reset a sold/reserved item
    const p = payload as any
    delete p.isFeatured
    delete p.boostedUntil
    delete p.sellerId
    delete p.views
    delete p.shareCount
    if (p.status !== undefined) {
      const locked = product.status === 'sold' || product.status === 'pending'
      if (locked || !['active', 'unsold'].includes(p.status)) {
        delete p.status
      }
    }

    // Trade-only listings skip seller approval, so they must stay unsellable:
    // a trade item keeps no price, and turning one into a sale needs the
    // same approval as listing a sale item in the first place.
    const after = {
      isTradeOnly: p.isTradeOnly ?? product.isTradeOnly,
      isGiveaway: p.isGiveaway ?? product.isGiveaway,
    }
    if (isTradeOnlyListing(after)) {
      stripSaleFields(p)
    } else if (product.isTradeOnly) {
      await SellerServices.assertSellerCanSell(product.sellerId.toString())
    }
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

const deleteProduct = async (
  id: string,
  userId?: string,
  userRole?: string,
): Promise<IProduct | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Product ID')
  }
  const product = await Product.findById(id)
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found')
  }
  if (userId && userRole !== USER_ROLES.ADMIN && userRole !== USER_ROLES.SUPER_ADMIN) {
    if (product.sellerId.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own listings')
    }
  }
  const result = await Product.findByIdAndDelete(id)
  return result
}

const clearAllProducts = async (
  userId: string,
  userRole: string,
): Promise<{ deletedCount: number }> => {
  // Only a super admin may wipe the whole catalogue; everyone else can only
  // clear their own inventory.
  const filter =
    userRole === USER_ROLES.SUPER_ADMIN
      ? {}
      : { sellerId: new Types.ObjectId(userId) }
  const result = await Product.deleteMany(filter)
  return { deletedCount: result.deletedCount || 0 }
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

const incrementShareCount = async (id: string): Promise<IProduct | null> => {
  const result = await Product.findByIdAndUpdate(
    id,
    { $inc: { shareCount: 1 } },
    { new: true },
  )
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
  clearAllProducts,
  boostProduct,
  incrementShareCount,
}
