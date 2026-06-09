'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.Message = void 0
const mongoose_1 = require('mongoose')
const messageSchema = new mongoose_1.Schema(
  {
    chatId: {
      type: mongoose_1.Schema.Types.ObjectId,
      required: true,
      ref: 'Chat',
    },
    sender: {
      type: mongoose_1.Schema.Types.ObjectId,
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
      orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order' },
      tradeOfferId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'TradeOffer',
      },
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
exports.Message = (0, mongoose_1.model)('Message', messageSchema)
