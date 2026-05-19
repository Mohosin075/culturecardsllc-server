import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { OrderServices } from './order.service';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.createOrder(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Order created and payment processed successfully.',
    data: result,
  });
});

const getOrdersForUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const role = (req.query.role as 'buyer' | 'seller') || 'buyer';

  if (!userId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'userId is required as query parameter.');
  }

  const result = await OrderServices.getOrdersForUser(userId, role);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Orders retrieved successfully.',
    data: result,
  });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.getOrderById(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Order details fetched successfully.',
    data: result,
  });
});

const updateOrderJourney = catchAsync(async (req: Request, res: Response) => {
  const { status, description, location } = req.body;
  const deliveryStatus = req.body.deliveryStatus || 'shipped';

  if (!status || !description) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'status and description are required for journey updates.');
  }

  const result = await OrderServices.updateOrderJourney(
    req.params.id,
    { status, description, location, timestamp: new Date() },
    deliveryStatus
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shipment checkpoint update pushed successfully.',
    data: result,
  });
});

export const OrderControllers = {
  createOrder,
  getOrdersForUser,
  getOrderById,
  updateOrderJourney,
};
