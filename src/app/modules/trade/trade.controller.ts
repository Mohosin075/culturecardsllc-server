import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { TradeServices } from './trade.service'
import { TradeFulfillment } from './tradeFulfillment.service'
import { TradeSettlementServices } from './tradeSettlement.service'
import { TradeOffer } from './trade.model'
import { USER_ROLES } from '../../../enum/user'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import ApiError from '../../../errors/ApiError'
import { JwtPayload } from 'jsonwebtoken'

const createTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  // senderId always from authenticated user — never trust client body
  const payload = { ...req.body, senderId: user.userId }
  const result = await TradeServices.createTradeOffer(payload)
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Trade proposal submitted successfully.',
    data: result,
  })
})

const getTradeOffers = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const userId = (req.query.userId as string) || user.userId
  const type = (req.query.type as 'sent' | 'received') || 'received'

  if (!userId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'userId is required.',
    )
  }

  const result = await TradeServices.getTradeOffers(userId, type)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offers retrieved successfully.',
    data: result,
  })
})

const acceptTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await TradeServices.acceptTradeOffer(req.params.id, user.userId, user.role)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offer accepted. Both traders now pay their fee and shipping.',
    data: result,
  })
})

const declineTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await TradeServices.declineTradeOffer(req.params.id, user.userId, user.role)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade offer declined.',
    data: result,
  })
})

const completeTradeOffer = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result: any = await TradeServices.completeTradeOffer(
    req.params.id,
    user.userId,
  )

  // Three shapes come back: a payment this user still owes, a note that the
  // other side has not paid yet, or the trade as it travels through ARIES.
  const message = result?.clientSecret
    ? 'Pay your trade fee and shipping to continue.'
    : result?.awaitingCounterparty
      ? 'Your payment is settled. Waiting for the other trader to pay.'
      : result?.stage === 'completed'
        ? 'Trade completed. Ownership transferred.'
        : 'Payment received. Your items now travel through ARIES for authentication.'

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message,
    data: result,
  })
})

const isAdmin = (user: JwtPayload) =>
  user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPER_ADMIN

const assertCanView = async (offerId: string, user: JwtPayload) => {
  if (isAdmin(user)) return
  const offer = await TradeOffer.findById(offerId).select('senderId receiverId').lean()
  if (!offer) throw new ApiError(StatusCodes.NOT_FOUND, 'Trade not found')
  if (![String(offer.senderId), String(offer.receiverId)].includes(String(user.userId))) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not part of this trade.')
  }
}

const getTradeDetail = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await TradeFulfillment.getTradeForUser(req.params.id, user.userId, isAdmin(user))
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade retrieved successfully.',
    data: result,
  })
})

const payExtraCharge = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const result = await TradeSettlementServices.createExtraChargeIntent(req.params.id, user.userId)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'nothingDue' in result ? 'Nothing is due on this trade.' : 'Pay the shipping difference.',
    data: result,
  })
})

// ── Admin ───────────────────────────────────────────────────────────────────

const adminListTrades = catchAsync(async (req: Request, res: Response) => {
  const { stage, status, search } = req.query as Record<string, string>
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const filter: any = {}
  if (stage) filter.stage = stage
  if (status) filter.status = status
  else filter.status = { $in: ['accepted', 'completed', 'cancelled'] }
  if (search) filter.tradeCode = new RegExp(`^${search.replace(/[^A-Za-z0-9-]/g, '')}`, 'i')

  const [data, total] = await Promise.all([
    TradeOffer.find(filter)
      .select('-history -shipments.events')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('senderId', 'name fullName email')
      .populate('receiverId', 'name fullName email')
      .populate('senderProductIds', 'title images estValue')
      .populate('receiverProductIds', 'title images estValue')
      .lean(),
    TradeOffer.countDocuments(filter),
  ])
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trades retrieved successfully.',
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
    data,
  } as any)
})

const adminAction = (
  run: (req: Request, user: JwtPayload) => Promise<any>,
  message: string,
) =>
  catchAsync(async (req: Request, res: Response) => {
    const user = req.user as JwtPayload
    await run(req, user)
    const result = await TradeFulfillment.getTradeForUser(req.params.id, user.userId, true)
    sendResponse(res, { statusCode: StatusCodes.OK, success: true, message, data: result })
  })

const adminMarkReceived = adminAction(
  (req, user) => TradeFulfillment.markReceived(req.params.id, req.body.party, user.userId),
  'Item marked as received.',
)

const adminAuthenticate = adminAction(
  (req, user) =>
    TradeFulfillment.authenticateItem(req.params.id, req.body.party, req.body.passed, req.body.note, user.userId),
  'Authentication recorded.',
)

const adminShipBack = adminAction(
  (req, user) => TradeFulfillment.shipBack(req.params.id, user.userId),
  'Return labels bought.',
)

const adminRetryLabels = adminAction(
  (req, user) => TradeFulfillment.startFulfillment(req.params.id, user.userId),
  'Inbound labels checked.',
)

const adminComplete = adminAction(
  (req, user) => TradeFulfillment.completeTrade(req.params.id, user.userId),
  'Trade completed.',
)

const adminCancel = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const { faultParty, reason, dryRun } = req.body
  const { plan } = await TradeFulfillment.cancelTrade(req.params.id, {
    faultParty,
    reason,
    dryRun,
    actorId: user.userId,
  })
  const trade = await TradeFulfillment.getTradeForUser(req.params.id, user.userId, true)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: dryRun ? 'Cancellation preview.' : 'Trade cancelled and refunds issued.',
    data: { plan, trade },
  })
})

const getTradeSettlement = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  await assertCanView(req.params.id, user)
  const result = await TradeServices.getSettlement(req.params.id)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Trade settlement status retrieved successfully.',
    data: result,
  })
})

export const TradeControllers = {
  createTradeOffer,
  getTradeOffers,
  acceptTradeOffer,
  declineTradeOffer,
  completeTradeOffer,
  getTradeSettlement,
  getTradeDetail,
  payExtraCharge,
  adminListTrades,
  adminMarkReceived,
  adminAuthenticate,
  adminShipBack,
  adminRetryLabels,
  adminComplete,
  adminCancel,
}
