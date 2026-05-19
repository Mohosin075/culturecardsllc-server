import { Schema, model } from 'mongoose';
import { ILiveStream, IAuctionItem } from './auction.interface';

const LiveStreamSchema = new Schema<ILiveStream>(
  {
    sellerId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      trim: true 
    },
    scheduledAt: { 
      type: Date 
    },
    status: { 
      type: String, 
      enum: ['scheduled', 'live', 'ended'], 
      default: 'scheduled', 
      index: true 
    },
    agoraChannelName: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    pinnedProductId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Product' 
    },
    viewersCount: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    likesCount: { 
      type: Number, 
      default: 0,
      min: 0 
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

const AuctionItemSchema = new Schema<IAuctionItem>(
  {
    streamId: { 
      type: Schema.Types.ObjectId, 
      ref: 'LiveStream', 
      required: true, 
      index: true 
    },
    productId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Product', 
      required: true, 
      index: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'active', 'completed', 'failed'], 
      default: 'pending', 
      index: true 
    },
    currentBid: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    highestBidderId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      default: null,
      index: true 
    },
    bidIncrement: { 
      type: Number, 
      default: 5,
      min: 1 
    },
    timerDuration: { 
      type: Number, 
      default: 60,
      min: 5 
    },
    endsAt: { 
      type: Date,
      index: true
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

export const LiveStream = model<ILiveStream>('LiveStream', LiveStreamSchema);
export const AuctionItem = model<IAuctionItem>('AuctionItem', AuctionItemSchema);
