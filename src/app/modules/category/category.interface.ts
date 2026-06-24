import { Model, Types } from 'mongoose'

export type ICategoryFilterables = {
  searchTerm?: string
  name?: string
  theme?: string
  parent?: string
  type?: string
  isActive?: boolean
}

export type ICategory = {
  _id: Types.ObjectId
  name: string
  description?: string
  image?: string
  icon?: string
  theme?: string
  parent?: Types.ObjectId | ICategory
  type?: 'category' | 'subcategory'
  isPopular?: boolean
  isTrending?: boolean
  trendingBadge?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type CategoryModel = Model<ICategory>
