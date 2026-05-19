import { Schema, model } from 'mongoose'
import { ICategory, CategoryModel } from './category.interface'

const categorySchema = new Schema<ICategory, CategoryModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
    },
    icon: {
      type: String,
    },
    theme: {
      type: String,
      trim: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },
    type: {
      type: String,
      enum: ['category', 'subcategory'],
      default: 'category',
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    trendingBadge: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

categorySchema.index({ name: 1, theme: 1, parent: 1 }, { unique: true })
categorySchema.index({ theme: 1 })
categorySchema.index({ parent: 1 })
categorySchema.index({ type: 1 })
categorySchema.index({ isPopular: 1 })
categorySchema.index({ isTrending: 1 })

export const Category = model<ICategory, CategoryModel>(
  'Category',
  categorySchema,
)
