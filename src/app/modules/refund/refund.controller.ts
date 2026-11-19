import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { RefundServices } from './refund.service'

const createRefundRequest = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await RefundServices.createRefundRequest(user, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message:
      'Refund request submitted. ARIES will review it and let you know the outcome.',
    data: result,
  })
})

const getMyRefundRequests = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await RefundServices.getMyRefundRequests(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Refund requests retrieved successfully.',
    data: result,
  })
})

const getSellerRefundRequests = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any
    const result = await RefundServices.getRefundRequestsForSeller(user)

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Refund requests retrieved successfully.',
      data: result,
    })
  },
)

const getSellerDisputes = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await RefundServices.getDisputesForSeller(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Disputes retrieved successfully.',
    data: result,
  })
})

// ── Admin ──────────────────────────────────────────────────────────────────

const listRefundRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await RefundServices.listRefundRequestsForAdmin(req.query)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Refund requests retrieved successfully.',
    data: result,
  })
})

const approveRefundRequest = catchAsync(async (req: Request, res: Response) => {
  const admin = req.user as any
  const result = await RefundServices.approveRefundRequest(
    req.params.id,
    admin.userId,
    { amount: req.body?.amount, note: req.body?.note },
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message:
      'Refund approved. Stripe has reversed the charge from the seller’s balance.',
    data: result,
  })
})

const rejectRefundRequest = catchAsync(async (req: Request, res: Response) => {
  const admin = req.user as any
  const result = await RefundServices.rejectRefundRequest(
    req.params.id,
    admin.userId,
    req.body?.note,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Refund request rejected.',
    data: result,
  })
})

const listDisputes = catchAsync(async (req: Request, res: Response) => {
  const result = await RefundServices.listDisputesForAdmin(req.query)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Disputes retrieved successfully.',
    data: result,
  })
})

export const RefundControllers = {
  createRefundRequest,
  getMyRefundRequests,
  getSellerRefundRequests,
  getSellerDisputes,
  listRefundRequests,
  approveRefundRequest,
  rejectRefundRequest,
  listDisputes,
}
