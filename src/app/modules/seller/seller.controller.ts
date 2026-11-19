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
): void => {
  const deepLink = config.seller.appReturnDeepLink
  res.status(StatusCodes.OK).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ARIES</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: #11111A; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px; text-align: center;
  }
  .card { max-width: 420px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { color: rgba(255,255,255,.65); font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
  a {
    display: inline-block; background: #8B9BFF; color: #fff; text-decoration: none;
    padding: 14px 28px; border-radius: 16px; font-weight: 700; font-size: 14px;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>${opts.heading}</h1>
    <p>${opts.body}</p>
    <a href="${deepLink}">Return to ARIES</a>
  </div>
  <script>setTimeout(function () { window.location.replace(${JSON.stringify(deepLink)}) }, 600)</script>
</body>
</html>`)
}

const stripeReturn = catchAsync(async (req: Request, res: Response) => {
  renderBounce(res, {
    heading: 'Stripe setup complete',
    body: 'Your details are with Stripe. Your application is now pending ARIES approval — we will let you know as soon as it is reviewed.',
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
