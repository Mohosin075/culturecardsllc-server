import { Schema, model } from 'mongoose'
import { IMessage, MessageModel } from './message.interface'

const messageSchema = new Schema<IMessage, MessageModel>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Chat',
    },
    sender: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    text: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: false,
    },
    file: {
      type: String,
      required: false,
    },
    seen: {
      type: Boolean,
      default: false,
    },
    messageType: {
      type: String,
      enum: ['text', 'order_update', 'trade_proposal'],
      default: 'text',
    },
    metadata: {
      orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
      tradeOfferId: { type: Schema.Types.ObjectId, ref: 'TradeOffer' },
      statusLabel: { type: String },
      trackingNumber: { type: String },
      eta: { type: String },
    },
  },
  {
    timestamps: true,
  },
)

messageSchema.index({ chatId: 1, createdAt: -1 })
messageSchema.index({ sender: 1 })
messageSchema.index({ chatId: 1, seen: 1 })

export const Message = model<IMessage, MessageModel>('Message', messageSchema)
