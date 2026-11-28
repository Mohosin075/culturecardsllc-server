import { renderAppBounce } from '../../../helpers/appBounce'
import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import config from '../../../config'
import { SellerServices } from './seller.service'

const applyAsSeller = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress

  const result = await SellerServices.applyAsSeller(
    user,
    {
      whatTheySell: req.body.whatTheySell,
      categories: req.body.categories,
      businessName: req.body.businessName,
    },
    ipAddress,
  )

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message:
      'Application submitted. Continue to Stripe to verify your identity and add payout details.',
    data: result,
  })
})

const getMyApplication = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const refresh = req.query.refresh !== 'false'

  const result = await SellerServices.getMyOnboardingState(user, { refresh })

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Seller onboarding status retrieved successfully.',
    data: result,
  })
})

const createOnboardingLink = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await SellerServices.getOnboardingLink(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stripe onboarding link created successfully.',
    data: result,
  })
})

const createDashboardLink = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await SellerServices.getStripeDashboardLink(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stripe dashboard link created successfully.',
    data: result,
  })
})

const getMyEarnings = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  const result = await SellerServices.getMyEarnings(user)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Seller earnings retrieved successfully.',
    data: result,
  })
})

/**
 * Stripe redirects the seller's browser here, so there is no JWT on the
 * request. Bounce them back into the app via the deep link; the app then
 * re-reads the real status from `GET /seller/application`.
 */
const renderBounce = (
  res: Response,
  opts: { heading: string; body: string },
): void => renderAppBounce(res, { ...opts, deepLink: config.seller.appReturnDeepLink })

const stripeReturn = catchAsync(async (req: Request, res: Response) => {
  renderBounce(res, {
    heading: 'Return to ARIES',
    body: 'Open the app to check your Stripe status. If Stripe still needs information, you can continue setup there. Once Stripe marks setup complete, your application can move to ARIES review.',
  })
})

const stripeRefresh = catchAsync(async (req: Request, res: Response) => {
  renderBounce(res, {
    heading: 'That link expired',
    body: 'Open the app and tap "Continue Stripe setup" to pick up where you left off.',
  })
})

export const SellerControllers = {
  applyAsSeller,
  getMyApplication,
  createOnboardingLink,
  createDashboardLink,
  getMyEarnings,
  stripeReturn,
  stripeRefresh,
}
