import { Schema, Document } from 'mongoose'

export type IProductCategory =
  | 'Fine Art'
  | 'Sports Cards'
  | 'Rare Spirits'
  | 'Luxury Cars'
  | 'Electronics'
  | 'Streetwear'
  | 'TCG'
  | 'Digital Assets'

export type IProductCondition =
  | 'Mint'
  | 'Near Mint'
  | 'Excellent'
  | 'Good'
  | 'Fair'

export type IProduct = {
  sellerId: Schema.Types.ObjectId
  title: string
  description?: string
  images: string[]
  video?: string
  category: Schema.Types.ObjectId
  condition: IProductCondition
  estValue: number
  startingBid?: number
  reservePrice?: number
  buyNowPrice?: number
  status: 'active' | 'sold' | 'unsold' | 'pending'
  stock: number
  isFeatured: boolean
  boostedUntil?: Date
  allowTrade: boolean
  shippingWeight?: number
  allowOffers?: boolean
  minOfferAmount?: number
  shareCount?: number
  createdAt: Date
  updatedAt: Date
} & Document
