import { Schema, Document } from 'mongoose';

export type IProductCategory = 
  | 'Fine Art' 
  | 'Sports Cards' 
  | 'Rare Spirits' 
  | 'Luxury Cars' 
  | 'Electronics' 
  | 'Streetwear' 
  | 'TCG' 
  | 'Digital Assets';

export type IProductCondition = 
  | 'Mint' 
  | 'Near Mint' 
  | 'Excellent' 
  | 'Good' 
  | 'Fair';

export interface IProduct extends Document {
  sellerId: Schema.Types.ObjectId;
  title: string;
  description?: string;
  images: string[];
  video?: string;
  category: IProductCategory;
  condition: IProductCondition;
  estValue: number;
  startingBid?: number;
  reservePrice?: number;
  buyNowPrice?: number;
  status: 'active' | 'sold' | 'unsold' | 'pending';
  stock: number;
  isFeatured: boolean;
  allowTrade: boolean;
  createdAt: Date;
  updatedAt: Date;
}
