import { Schema, Document } from 'mongoose'

export type IPurchaseType = 'auction_win' | 'buy_now' | 'trade_swap'

export type IDeliveryStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled'

export type IJourneyUpdate = {
  status: string
  description: string
  location?: string
  timestamp: Date
}

export type IOrderShipment = {
  provider: 'mock' | 'easypost'
  shipmentId: string
  rateId: string
  carrier: string
  service: string
  /** Dollars ARIES paid for the label. */
  labelCost: number
  trackerId?: string
  /** Last status the carrier reported. */
  trackingStatus?: string
  purchasedAt: Date
  /** Set when an unused label was voided. */
  refundedAt?: Date
}

export type IOrder = {
  buyerId: Schema.Types.ObjectId
  sellerId: Schema.Types.ObjectId
  productId: Schema.Types.ObjectId
  streamId?: Schema.Types.ObjectId
  isGiveaway?: boolean
  tradeOfferId?: Schema.Types.ObjectId
  purchaseType: IPurchaseType
  amountDetails: {
    itemSubtotal: number
    shipping: number
    taxes: number
    processingFee: number
    charityContribution: number
    totalPaid: number
    platformFee?: number
  }
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentIntentId?: string
  /**
   * The connected account the charge was made on. Absent for platform-side
   * payments (pre-Connect orders, giveaways). Refunds must be issued on the
   * same account the charge lives on.
   */
  stripeAccountId?: string
  shippingAddress: {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  deliveryStatus: IDeliveryStatus
  /** Deadline for the seller to ship; past it the order auto-cancels. */
  shipByDate?: Date
  cancelReason?: string
  trackingDetails: {
    carrier?: string
    trackingNumber?: string
    estimatedDelivery?: Date
    journeyUpdates: IJourneyUpdate[]
  }
  shippingWeight?: number
  shippingLabelUrl?: string
  /** USPS service the buyer paid for at checkout, e.g. "GroundAdvantage". */
  shippingService?: string
  /**
   * Set on auction wins that ship in the same package as an earlier order
   * (same buyer, same seller, within 12 hours). The label is bought on that
   * main order and shared with every order bundled into it.
   */
  bundledWithOrderId?: Schema.Types.ObjectId
  /**
   * The carrier shipment behind the label. Absent until the seller buys a
   * label through the shipping provider; older orders only ever had the mock
   * label in shippingLabelUrl.
   */
  shipment?: IOrderShipment
  spinWheelPrize?: string
  createdAt: Date
  updatedAt: Date
} & Document
