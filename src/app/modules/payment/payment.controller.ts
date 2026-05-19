import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { PaymentServices } from './payment.service'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import pick from '../../../shared/pick'
import { IPaymentFilterables } from './payment.interface'
import { paymentFilterableFields } from './payment.constants'
import { JwtPayload } from 'jsonwebtoken'
import { paginationFields } from '../../../interfaces/pagination'

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload
    const result = await PaymentServices.createCheckoutSession(user, req.body)

    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Checkout session created successfully',
      data: result,
    })
  },
)

const verifyCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const result = await PaymentServices.verifyCheckoutSession(sessionId)

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Payment verified successfully',
      data: result,
    })
  },
)

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  await PaymentServices.handleWebhook({
    body: req.body,
    headers: req.headers,
  })

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Webhook processed successfully',
    data: null,
  })
})

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user
  const filters = pick(
    req.query,
    paymentFilterableFields,
  ) as IPaymentFilterables
  const paginationOptions = pick(req.query, paginationFields)

  const result = await PaymentServices.getAllPayments(
    user as JwtPayload,
    filters,
    paginationOptions,
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payments retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await PaymentServices.getSinglePayment(id)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment retrieved successfully',
    data: result,
  })
})

const updatePayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await PaymentServices.updatePayment(id, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment updated successfully',
    data: result,
  })
})

const refundPayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const { reason } = req.body
  const result = await PaymentServices.refundPayment(id, reason)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment refunded successfully',
    data: result,
  })
})

// ============================================
// FLUTTER STRIPE CONTROLLERS
// ============================================

const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await PaymentServices.createPaymentIntent(user, req.body)

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Payment Intent created successfully',
    data: result,
  })
})

const createEphemeralKey = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const { apiVersion } = req.body
  const result = await PaymentServices.createEphemeralKey(user, apiVersion)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Ephemeral key created successfully',
    data: result,
  })
})

// ============================================
// EXISTING CONTROLLERS
// ============================================

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const paginationOptions = pick(req.query, paginationFields)

  const result = await PaymentServices.getMyPayments(user, paginationOptions)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My payments retrieved successfully',
    meta: result.meta,
    data: result.data,
  })
})

const generateInvoice = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  const result = await PaymentServices.generateInvoice(id)

  if (Buffer.isBuffer(result)) {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${id.substring(0, 8)}.pdf`,
    )
    res.status(StatusCodes.OK).send(result)
    return
  }

  if (typeof result === 'string' && result.startsWith('http')) {
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Invoice URL retrieved successfully',
      data: { url: result },
    })
    return
  }

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoice generated successfully',
    data: result,
  })
})

const createSetupIntent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await PaymentServices.createSetupIntent(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Setup intent created successfully',
    data: result,
  })
})

const getMyPaymentMethods = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await PaymentServices.getMyPaymentMethods(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment methods retrieved successfully',
    data: result,
  })
})

const deletePaymentMethod = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const { id } = req.params
  const result = await PaymentServices.deletePaymentMethod(user, id)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment method deleted successfully',
    data: result,
  })
})

const setDefaultPaymentMethod = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload
    const { id } = req.params
    const result = await PaymentServices.setDefaultPaymentMethod(user, id)

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Default payment method updated successfully',
      data: result,
    })
  },
)

export const PaymentController = {
  handleWebhook,
  getAllPayments,
  getSinglePayment,
  updatePayment,
  refundPayment,
  getMyPayments,
  createCheckoutSession,
  verifyCheckoutSession,
  // Flutter Stripe controllers
  createPaymentIntent,
  createEphemeralKey,
  generateInvoice,
  createSetupIntent,
  getMyPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
}
