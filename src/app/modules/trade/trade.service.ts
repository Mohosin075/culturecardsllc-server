import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { TradeOffer } from './trade.model';
import { ITradeOffer } from './trade.interface';
import { Product } from '../product/product.model';
import { Message } from '../message/message.model';
import { Chat } from '../chat/chat.model';
import { Types } from 'mongoose';

const createTradeOffer = async (payload: Partial<ITradeOffer>): Promise<ITradeOffer> => {
  const { senderProductId, receiverProductId, senderId, receiverId } = payload;

  const senderProduct = await Product.findById(senderProductId);
  const receiverProduct = await Product.findById(receiverProductId);

  if (!senderProduct || !receiverProduct) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'One or both of the products were not found.');
  }

  if (!senderProduct.allowTrade || !receiverProduct.allowTrade) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'One or both items are not configured to allow trading.');
  }

  if (senderProduct.status !== 'active' || receiverProduct.status !== 'active') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'One or both products are not currently active.');
  }

  payload.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  payload.status = 'pending';
  payload.escrowStatus = 'pending';

  const offer = await TradeOffer.create(payload) as any;

  let chat = await Chat.findOne({
    $or: [
      { creator: senderId, participant: receiverId },
      { creator: receiverId, participant: senderId }
    ]
  });

  if (!chat) {
    chat = await Chat.create({
      creator: senderId,
      participant: receiverId
    });
  }

  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: senderId,
      text: `Proposed a new trade swap offer: ${senderProduct.title} for ${receiverProduct.title}.`,
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: 'NEW TRADE OFFER 🎁',
        eta: '24 Hours Expire'
      }
    });
  }

  return offer;
};

const getTradeOffers = async (userId: string, type: 'sent' | 'received'): Promise<ITradeOffer[]> => {
  const query: any = {};
  if (type === 'sent') {
    query.senderId = new Types.ObjectId(userId);
  } else {
    query.receiverId = new Types.ObjectId(userId);
  }

  return await TradeOffer.find(query)
    .populate('senderId', 'name fullName email image photo')
    .populate('receiverId', 'name fullName email image photo')
    .populate('senderProductId')
    .populate('receiverProductId');
};

const acceptTradeOffer = async (offerId: string): Promise<ITradeOffer> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID');
  }

  const offer = await TradeOffer.findById(offerId) as any;
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found');
  }

  if (offer.status !== 'pending') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This offer is no longer pending.');
  }

  const session = await TradeOffer.startSession();
  session.startTransaction();

  try {
    offer.status = 'accepted';
    offer.escrowStatus = 'held';
    await offer.save({ session });

    await Product.findByIdAndUpdate(offer.senderProductId, { status: 'pending' }, { session });
    await Product.findByIdAndUpdate(offer.receiverProductId, { status: 'pending' }, { session });

    let chat = await Chat.findOne({
      $or: [
        { creator: offer.senderId, participant: offer.receiverId },
        { creator: offer.receiverId, participant: offer.senderId }
      ]
    });

    if (!chat) {
      const createdChats = await Chat.create([{
        creator: offer.senderId,
        participant: offer.receiverId
      }], { session });
      chat = createdChats[0];
    }

    if (chat) {
      await Message.create([{
        chatId: chat._id,
        sender: offer.receiverId,
        text: 'Accepted the trade swap offer! Escrow service is now Active & Secured.',
        messageType: 'trade_proposal',
        seen: false,
        metadata: {
          tradeOfferId: offer._id.toString(),
          statusLabel: 'TRADE ACCEPTED 🤝',
        }
      }], { session });
    }

    await session.commitTransaction();
    return offer;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const declineTradeOffer = async (offerId: string): Promise<ITradeOffer> => {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Offer ID');
  }

  const offer = await TradeOffer.findById(offerId) as any;
  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Trade offer not found');
  }

  if (offer.status !== 'pending') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This offer is no longer pending.');
  }

  offer.status = 'declined';
  await offer.save();

  const chat = await Chat.findOne({
    $or: [
      { creator: offer.senderId, participant: offer.receiverId },
      { creator: offer.receiverId, participant: offer.senderId }
    ]
  });

  if (chat) {
    await Message.create({
      chatId: chat._id,
      sender: offer.receiverId,
      text: 'Declined the trade swap offer.',
      messageType: 'trade_proposal',
      seen: false,
      metadata: {
        tradeOfferId: offer._id.toString(),
        statusLabel: 'TRADE DECLINED ❌',
      }
    });
  }

  return offer;
};

export const TradeServices = {
  createTradeOffer,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
};
