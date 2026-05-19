import { Schema, model } from 'mongoose';
import { ITradeOffer } from './trade.interface';

const TradeOfferSchema = new Schema<ITradeOffer>(
  {
    senderId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    receiverId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    senderProductId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Product', 
      required: true 
    },
    receiverProductId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Product', 
      required: true 
    },
    cashSupplement: { 
      type: Number, 
      default: 0 
    },
    escrowStatus: { 
      type: String, 
      enum: ['pending', 'held', 'released', 'refunded'], 
      default: 'pending',
      index: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'declined', 'completed', 'expired'], 
      default: 'pending', 
      index: true 
    },
    expiresAt: { 
      type: Date, 
      required: true,
      index: true 
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export const TradeOffer = model<ITradeOffer>('TradeOffer', TradeOfferSchema);
export default TradeOffer;
