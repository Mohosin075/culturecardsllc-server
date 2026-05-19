import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { LiveStream, AuctionItem } from './auction.model';
import { ILiveStream, IAuctionItem } from './auction.interface';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import config from '../../../config';
import { Types } from 'mongoose';

const generateAgoraToken = async (
  channelName: string,
  uid: number = 0,
  role: 'publisher' | 'subscriber' = 'subscriber'
): Promise<{ token: string; appId: string; channelName: string; uid: number }> => {
  const appId = config.agora.app_id;
  const appCertificate = config.agora.app_certificate;

  if (!appId || !appCertificate) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora configuration (App ID or App Certificate) is missing from system configuration.'
    );
  }

  const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expirationTimeInSeconds = 3600 * 2; // 2 hours
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs
  );

  return {
    token,
    appId,
    channelName,
    uid
  };
};

const createLiveStream = async (payload: Partial<ILiveStream>): Promise<ILiveStream> => {
  if (!payload.agoraChannelName) {
    payload.agoraChannelName = `channel_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }
  return await LiveStream.create(payload);
};

const getLiveStreams = async (status?: string): Promise<ILiveStream[]> => {
  const query: any = {};
  if (status) query.status = status;
  return await LiveStream.find(query)
    .populate('sellerId', 'name fullName email image photo')
    .populate('pinnedProductId');
};

const createAuctionItem = async (payload: Partial<IAuctionItem>): Promise<IAuctionItem> => {
  const auction = await AuctionItem.create(payload);
  return auction;
};

const placeBidSecure = async (
  auctionItemId: string,
  bidderId: string,
  bidAmount: number
): Promise<IAuctionItem> => {
  if (!Types.ObjectId.isValid(auctionItemId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Auction Item ID');
  }

  // 1. Atomically find and update ONLY if the new bid is higher than the current bid
  // This uses a concurrency-safe atomic query lock to protect against over-bidding race conditions.
  const updatedAuction = await AuctionItem.findOneAndUpdate(
    {
      _id: new Types.ObjectId(auctionItemId),
      status: 'active',
      $or: [
        { currentBid: { $lt: bidAmount } },
        { currentBid: 0 }
      ]
    },
    {
      $set: {
        currentBid: bidAmount,
        highestBidderId: new Types.ObjectId(bidderId),
      }
    },
    { new: true }
  ).populate('productId');

  if (!updatedAuction) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Bid rejected: Someone placed a higher or equal bid first.'
    );
  }

  // 2. Anti-Sniping Check: If bid placed within last 10 seconds, extend endsAt by 15 seconds
  const tenSecondsFromNow = new Date(Date.now() + 10000);
  if (updatedAuction.endsAt && updatedAuction.endsAt < tenSecondsFromNow) {
    const extendedTime = new Date(updatedAuction.endsAt.getTime() + 15000);
    await AuctionItem.findByIdAndUpdate(auctionItemId, { $set: { endsAt: extendedTime } });
    updatedAuction.endsAt = extendedTime;
  }

  return updatedAuction;
};

export const AuctionServices = {
  generateAgoraToken,
  createLiveStream,
  getLiveStreams,
  createAuctionItem,
  placeBidSecure,
};
