import { Schema, Document } from 'mongoose'

export type IPurchaseType = 'auction_win' | 'buy_now' | 'trade_swap'

export type IDeliveryStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled'

export type IJourneyUpdate = {
  status: string
  description: string
  location?: string
  timestamp: Date
}

export type IOrder = {
  buyerId: Schema.Types.ObjectId
  sellerId: Schema.Types.ObjectId
  productId: Schema.Types.ObjectId
  tradeOfferId?: Schema.Types.ObjectId
  purchaseType: IPurchaseType
  amountDetails: {
    itemSubtotal: number
    shipping: number
    taxes: number
    processingFee: number
    charityContribution: number
    totalPaid: number
  }
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentIntentId?: string
  shippingAddress: {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  deliveryStatus: IDeliveryStatus
  trackingDetails: {
    carrier?: string
    trackingNumber?: string
    estimatedDelivery?: Date
    journeyUpdates: IJourneyUpdate[]
  }
  shippingWeight?: number
  shippingLabelUrl?: string
  createdAt: Date
  updatedAt: Date
} & Document
