"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const config_1 = __importDefault(require("../../../config"));
const seller_service_1 = require("./seller.service");
const applyAsSeller = (0, catchAsync_1.default)(async (req, res) => {
    var _a, _b;
    const user = req.user;
    const ipAddress = ((_b = (_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim()) ||
        req.socket.remoteAddress;
    const result = await seller_service_1.SellerServices.applyAsSeller(user, {
        whatTheySell: req.body.whatTheySell,
        categories: req.body.categories,
        businessName: req.body.businessName,
    }, ipAddress);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Application submitted. Continue to Stripe to verify your identity and add payout details.',
        data: result,
    });
});
const getMyApplication = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const refresh = req.query.refresh !== 'false';
    const result = await seller_service_1.SellerServices.getMyOnboardingState(user, { refresh });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Seller onboarding status retrieved successfully.',
        data: result,
    });
});
const createOnboardingLink = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await seller_service_1.SellerServices.getOnboardingLink(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Stripe onboarding link created successfully.',
        data: result,
    });
});
const createDashboardLink = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await seller_service_1.SellerServices.getStripeDashboardLink(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Stripe dashboard link created successfully.',
        data: result,
    });
});
const getMyEarnings = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await seller_service_1.SellerServices.getMyEarnings(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Seller earnings retrieved successfully.',
        data: result,
    });
});
/**
 * Stripe redirects the seller's browser here, so there is no JWT on the
 * request. Bounce them back into the app via the deep link; the app then
 * re-reads the real status from `GET /seller/application`.
 */
const renderBounce = (res, opts) => {
    const deepLink = config_1.default.seller.appReturnDeepLink;
    res.status(http_status_codes_1.StatusCodes.OK).send(`<!doctype html>
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
</html>`);
};
const stripeReturn = (0, catchAsync_1.default)(async (req, res) => {
    renderBounce(res, {
        heading: 'Return to ARIES',
        body: 'Open the app to check your Stripe status. If Stripe still needs information, you can continue setup there. Once Stripe marks setup complete, your application can move to ARIES review.',
    });
});
const stripeRefresh = (0, catchAsync_1.default)(async (req, res) => {
    renderBounce(res, {
        heading: 'That link expired',
        body: 'Open the app and tap "Continue Stripe setup" to pick up where you left off.',
    });
});
exports.SellerControllers = {
    applyAsSeller,
    getMyApplication,
    createOnboardingLink,
    createDashboardLink,
    getMyEarnings,
    stripeReturn,
    stripeRefresh,
};
