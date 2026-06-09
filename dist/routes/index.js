'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
const user_route_1 = require('../app/modules/user/user.route')
const auth_route_1 = require('../app/modules/auth/auth.route')
const express_1 = __importDefault(require('express'))
const public_route_1 = require('../app/modules/public/public.route')
const support_route_1 = require('../app/modules/support/support.route')
const upload_route_1 = require('../app/modules/upload/upload.route')
const payment_route_1 = require('../app/modules/payment/payment.route')
const notification_routes_1 = require('../app/modules/notification/notification.routes')
const message_routes_1 = require('../app/modules/message/message.routes')
const chat_routes_1 = require('../app/modules/chat/chat.routes')
const review_route_1 = require('../app/modules/review/review.route')
const category_route_1 = require('../app/modules/category/category.route')
const favourite_route_1 = require('../app/modules/favourite/favourite.route')
const subscription_route_1 = require('../app/modules/subscription/subscription.route')
const location_route_1 = require('../app/modules/location/location.route')
const product_route_1 = require('../app/modules/product/product.route')
const auction_route_1 = require('../app/modules/auction/auction.route')
const trade_route_1 = require('../app/modules/trade/trade.route')
const order_route_1 = require('../app/modules/order/order.route')
const dashboard_route_1 = require('../app/modules/dashboard/dashboard.route')
const router = express_1.default.Router()
const apiRoutes = [
  {
    path: '/auth',
    route: auth_route_1.AuthRoutes,
  },
  {
    path: '/users',
    route: user_route_1.UserRoutes,
  },
  {
    path: '/subscription',
    route: subscription_route_1.SubscriptionRoutes,
  },
  { path: '/support', route: support_route_1.SupportRoutes },
  { path: '/notifications', route: notification_routes_1.NotificationRoutes },
  { path: '/upload', route: upload_route_1.UploadRoutes },
  { path: '/payment', route: payment_route_1.PaymentRoutes },
  { path: '/message', route: message_routes_1.MessageRoutes },
  { path: '/chat', route: chat_routes_1.ChatRoutes },
  { path: '/review', route: review_route_1.ReviewRoutes },
  { path: '/category', route: category_route_1.CategoryRoutes },
  { path: '/favourite', route: favourite_route_1.FavouriteRoutes },
  { path: '/public', route: public_route_1.PublicRoutes },
  { path: '/locations', route: location_route_1.LocationRoutes },
  { path: '/products', route: product_route_1.ProductRoutes },
  { path: '/auctions', route: auction_route_1.AuctionRoutes },
  { path: '/trades', route: trade_route_1.TradeRoutes },
  { path: '/orders', route: order_route_1.OrderRoutes },
  { path: '/dashboard', route: dashboard_route_1.DashboardRoutes },
]
apiRoutes.forEach(route => {
  router.use(route.path, route.route)
})
exports.default = router
