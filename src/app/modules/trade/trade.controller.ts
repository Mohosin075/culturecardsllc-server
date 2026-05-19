import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TradeServices } from './trade.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';

const createTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await TradeServices.createTradeOffer(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Trade proposal submitted successfully.',
    data: result,
  });
});

const getTradeOffers = catchAsync(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const type = (req.query.type as 'sent' | 'received') || 'received';

  if (!userId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'userId is required as query parameter.');
  }

  const result = await TradeServices.getTradeOffers(userId, type);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offers retrieved successfully.',
    data: result,
  });
});

const acceptTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await TradeServices.acceptTradeOffer(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offer accepted successfully. Items held in secure escrow.',
    data: result,
  });
});

const declineTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const result = await TradeServices.declineTradeOffer(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offer declined.',
    data: result,
  });
});

export const TradeControllers = {
  createTradeOffer,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
};
