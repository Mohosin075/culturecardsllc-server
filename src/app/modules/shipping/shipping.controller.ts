import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { JwtPayload } from 'jsonwebtoken'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { ShippingServices } from './shipping.service'

const getPackagePresets = catchAsync(async (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Package presets retrieved successfully.',
    data: ShippingServices.getPackagePresets(),
  })
})

const getShipFromAddress = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await ShippingServices.getShipFromAddress(user.userId)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result
      ? 'Shipping address retrieved successfully.'
      : 'No shipping address set yet.',
    data: result,
  })
})

const setShipFromAddress = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await ShippingServices.setShipFromAddress(user.userId, req.body)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shipping address saved.',
    data: result,
  })
})

const quoteRates = catchAsync(async (req: Request, res: Response) => {
  const result = await ShippingServices.quoteRatesForProduct(req.body)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shipping rates retrieved successfully.',
    data: result,
  })
})

const buyLabelForOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await ShippingServices.buyLabelForOrder(
    user,
    req.params.orderId,
    req.body,
  )
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shipping label ready.',
    data: result,
  })
})

const simulateTrackingStep = catchAsync(async (req: Request, res: Response) => {
  const result = await ShippingServices.simulateTrackingStep(req.params.orderId)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Tracking moved one step forward (mock).',
    data: result,
  })
})

export const ShippingControllers = {
  getPackagePresets,
  getShipFromAddress,
  setShipFromAddress,
  quoteRates,
  buyLabelForOrder,
  simulateTrackingStep,
}
