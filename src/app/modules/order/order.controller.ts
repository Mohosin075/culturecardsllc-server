import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { OrderServices } from './order.service'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import ApiError from '../../../errors/ApiError'
import { JwtPayload } from 'jsonwebtoken'
import { USER_ROLES } from '../../../enum/user'
import {
  OrderHistoryService,
  HistoryPeriod,
  HistoryStatus,
} from './orderHistory.service'

const isAdmin = (user: JwtPayload) =>
  user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPER_ADMIN

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  // Security: buyer is always the authenticated user. Seller, payment status
  // and paid amount are resolved server-side in the service.
  const payload = { ...req.body, buyerId: user.userId || user.authId }
  const result = await OrderServices.createOrder(payload)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Order created and payment processed successfully.',
    data: result,
  })
})

const getOrdersForUser = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  // Only admins may look up another user's orders
  const userId = isAdmin(user)
    ? (req.query.userId as string) || user.userId
    : user.userId || user.authId
  const role = req.query.role === 'seller' ? 'seller' : 'buyer'

  if (!userId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'userId is required.',
    )
  }

  const result = await OrderServices.getOrdersForUser(userId, role)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Orders retrieved successfully.',
    data: result,
  })
})

const PERIODS: HistoryPeriod[] = ['7d', '30d', 'all']
const STATUSES: HistoryStatus[] = ['paid', 'shipped', 'delivered', 'refunded']

const getOrderHistory = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  // History is always the caller's own; there is no userId parameter.
  const userId = String(user.userId || user.authId || '')
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Not signed in.')
  }

  const role = req.query.role === 'seller' ? 'seller' : 'buyer'
  const periodQ = String(req.query.period || 'all') as HistoryPeriod
  if (!PERIODS.includes(periodQ)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'period must be 7d, 30d or all.')
  }
  const statusQ = req.query.status ? (String(req.query.status) as HistoryStatus) : undefined
  if (statusQ && !STATUSES.includes(statusQ)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'status must be paid, shipped, delivered or refunded.',
    )
  }
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)))

  const result = await OrderHistoryService.getOrderHistory({
    userId,
    role,
    period: periodQ,
    status: statusQ,
    page,
    limit,
  })
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Order history retrieved successfully.',
    data: result,
  })
})

const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await OrderServices.getOrderById(req.params.id)
  if (!isAdmin(user)) {
    const me = String(user.userId || user.authId)
    const buyer = (result.buyerId as any)?._id ?? result.buyerId
    const seller = (result.sellerId as any)?._id ?? result.sellerId
    if (String(buyer) !== me && String(seller) !== me) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You can only view your own orders.')
    }
  }
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Order details fetched successfully.',
    data: result,
  })
})

const updateOrderJourney = catchAsync(async (req: Request, res: Response) => {
  const { status, description, location } = req.body
  const deliveryStatus = req.body.deliveryStatus || 'shipped'

  if (!status || !description) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'status and description are required for journey updates.',
    )
  }

  const user = req.user as JwtPayload
  const result = await OrderServices.updateOrderJourney(
    req.params.id,
    { status, description, location, timestamp: new Date() },
    deliveryStatus,
    { userId: String(user.userId || user.authId), isAdmin: isAdmin(user) },
  )

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shipment checkpoint update pushed successfully.',
    data: result,
  })
})

export const OrderControllers = {
  createOrder,
  getOrdersForUser,
  getOrderHistory,
  getOrderById,
  updateOrderJourney,
}
