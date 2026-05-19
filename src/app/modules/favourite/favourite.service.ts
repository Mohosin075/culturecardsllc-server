import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { FavouriteType, IFavourite } from './favourite.interface'
import { Favourite } from './favourite.model'
import { IPaginationOptions } from '../../../interfaces/pagination'
import { paginationHelper } from '../../../helpers/paginationHelper'

const toggleFavourite = async (
  userId: string,
  payload: Partial<IFavourite>,
) => {
  const { favouriteType, service, provider } = payload

  const filter: any = { user: userId, favouriteType }
  if (favouriteType === FavouriteType.SERVICE) {
    if (!service)
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Service ID is required')
    filter.service = service
  } else {
    if (!provider)
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Provider ID is required')
    filter.provider = provider
  }

  const existingFavourite = await Favourite.findOne(filter)

  if (existingFavourite) {
    await Favourite.findByIdAndDelete(existingFavourite._id)
    return { message: 'Removed from favourites', status: 'removed' }
  } else {
    await Favourite.create({ ...filter, user: userId })
    return { message: 'Added to favourites', status: 'added' }
  }
}

const getMyFavourites = async (
  userId: string,
  favouriteType: FavouriteType,
  paginationOptions: IPaginationOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(paginationOptions)

  const whereConditions: any = { user: userId }
  if (favouriteType) {
    whereConditions.favouriteType = favouriteType
  }

  const sortConditions: any = {}
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1
  } else {
    sortConditions.createdAt = -1
  }

  const result = await Favourite.find(whereConditions)
    .populate({
      path: 'service',
      populate: [
        { path: 'providerId', select: 'name email profile' },
        { path: 'category', select: 'name image' },
      ],
    })
    .populate('provider', 'name email profile')
    .skip(skip)
    .limit(limit)
    .sort(sortConditions)

  const total = await Favourite.countDocuments(whereConditions)

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  }
}

export const FavouriteService = {
  toggleFavourite,
  getMyFavourites,
}
