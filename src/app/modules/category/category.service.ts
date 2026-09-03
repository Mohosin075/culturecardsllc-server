import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { ICategory, ICategoryFilterables } from './category.interface'
import { Category } from './category.model'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'
import { Product } from '../product/product.model'

const createCategory = async (payload: ICategory) => {
  const existingCategory = await Category.findOne({ name: payload.name })

  if (existingCategory) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Category with this name already exists',
    )
  }
  // Map images field from upload middleware to image field
  if ((payload as any).images) {
    payload.image = (payload as any).images[0]
    delete (payload as any).images
  }

  const result = await Category.create(payload)

  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create category')
  }

  return result
}

const getAllCategories = async (
  filters: ICategoryFilterables,
  paginationOptions: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  const { searchTerm, ...filterData } = filters

  const andConditions = []

  if (searchTerm) {
    andConditions.push({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ],
    })
  }

  if (Object.keys(filterData).length) {
    andConditions.push({
      $and: Object.entries(filterData).map(([field, value]) => ({
        [field]: value,
      })),
    })
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {}

  const pipeline: any[] = [
    { $match: whereConditions },
    { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        let: { catId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$category', '$$catId'] } } },
          { $count: 'count' },
        ],
        as: 'productCount',
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'parent',
        foreignField: '_id',
        as: 'parent',
      },
    },
    {
      $unwind: {
        path: '$parent',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        listingsCount: {
          $ifNull: [{ $arrayElemAt: ['$productCount.count', 0] }, 0],
        },
      },
    },
    {
      $project: {
        productCount: 0,
      },
    },
  ]

  const [dataWithCounts, total] = await Promise.all([
    Category.aggregate(pipeline),
    Category.countDocuments(whereConditions),
  ])

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: dataWithCounts,
  }
}

const getSingleCategory = async (id: string) => {
  const result = await Category.findById(id).populate('parent').lean()

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found')
  }

  return result
}

const getPopularCategories = async () => {
  const result = await Category.find({
    type: 'category',
    isPopular: true,
    isActive: true,
  })
    .select('name image icon description')
    .lean()

  return result
}

const getTrendingSubcategories = async () => {
  const result = await Category.find({
    type: 'subcategory',
    isTrending: true,
    isActive: true,
  })
    .select('name image icon theme trendingBadge description')
    .populate('parent', 'name')
    .lean()

  return result
}

const updateCategory = async (id: string, payload: Partial<ICategory>) => {
  const category = await Category.findById(id)

  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found')
  }

  if (payload.name && payload.name !== category.name) {
    const existingCategory = await Category.findOne({ name: payload.name })

    if (existingCategory) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Category with this name already exists',
      )
    }
  }

  // Map images field from upload middleware to image field
  if ((payload as any).images) {
    payload.image = (payload as any).images[0]
    delete (payload as any).images
  }

  const result = await Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  })

  return result
}

const deleteCategory = async (id: string) => {
  const category = await Category.findById(id)

  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Category not found')
  }

  // Delete associated subcategories if any
  await Category.deleteMany({ parent: id })

  const result = await Category.findByIdAndDelete(id)

  return result
}

export const CategoryServices = {
  createCategory,
  getAllCategories,
  getSingleCategory,
  getPopularCategories,
  getTrendingSubcategories,
  updateCategory,
  deleteCategory,
}
