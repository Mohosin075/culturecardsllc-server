import { Model, Types } from 'mongoose'

export type IMessageType = 'text' | 'order_update' | 'trade_proposal'

export type IMessage = {
  chatId: Types.ObjectId
  sender: Types.ObjectId
  text?: string
  image?: string
  file?: string
  seen: boolean
  messageType?: IMessageType
  metadata?: {
    orderId?: string
    tradeOfferId?: string
    statusLabel?: string; // e.g. "ORDER SHIPPED 🚚" or "NEW TRADE OFFER 🎁"
    trackingNumber?: string
    eta?: string
  }
}

export type MessageModel = Model<IMessage, Record<string, unknown>>

