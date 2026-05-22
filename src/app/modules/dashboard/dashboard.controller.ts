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

const getOrdersData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getOrdersData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Orders data retrieved successfully.',
    data: result,
  });
});

const getDisputesData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getDisputesData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Disputes data retrieved successfully.',
    data: result,
  });
});

const getPaymentsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getPaymentsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payments and revenue data retrieved successfully.',
    data: result,
  });
});

const getBoostedListingsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getBoostedListingsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Boosted listings data retrieved successfully.',
    data: result,
  });
});

const getCategoriesData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getCategoriesData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Categories management data retrieved successfully.',
    data: result,
  });
});

const getNotificationsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getNotificationsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notifications retrieved successfully.',
    data: result,
  });
});

const markAllNotificationsAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.markAllNotificationsAsRead();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All notifications marked as read.',
    data: result,
  });
});

const getReportsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getReportsData(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Reports and analytics data retrieved successfully.',
    data: result,
  });
});

const getSettingsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.getSettingsData();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Platform settings retrieved successfully.',
    data: result,
  });
});

const updateSettingsData = catchAsync(async (req: Request, res: Response) => {
  const result = await dashboardService.updateSettingsData(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Platform settings updated successfully.',
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
  getOrdersData,
  getDisputesData,
  getPaymentsData,
  getBoostedListingsData,
  getCategoriesData,
  getNotificationsData,
  markAllNotificationsAsRead,
  getReportsData,
  getSettingsData,
  updateSettingsData,
};
