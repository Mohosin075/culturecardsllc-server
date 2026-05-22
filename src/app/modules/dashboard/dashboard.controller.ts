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

export const dashboardController = {
  getOverviewData,
};
