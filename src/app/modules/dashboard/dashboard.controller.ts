import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { dashboardService } from './dashboard.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';

const getOverviewData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getOverviewData();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Dashboard overview metrics retrieved successfully.',
    data: result,
  });
});

const getUsersData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getUsersData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Users management data retrieved successfully.',
    data: result,
  });
});

const getSellerVerificationsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getSellerVerificationsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Seller verifications retrieved successfully.',
    data: result,
  });
});

const getListingsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getListingsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Listings management data retrieved successfully.',
    data: result,
  });
});

const getLiveStreamsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getLiveStreamsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Live streams data retrieved successfully.',
    data: result,
  });
});

const getTradesData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getTradesData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trades data retrieved successfully.',
    data: result,
  });
});

export const dashboardController = {
  getOverviewData,
  getUsersData,
  getSellerVerificationsData,
  getListingsData,
  getLiveStreamsData,
  getTradesData,
};
