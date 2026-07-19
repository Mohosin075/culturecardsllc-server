import { UserRoutes } from '../app/modules/user/user.route'
import { AuthRoutes } from '../app/modules/auth/auth.route'
import express, { Router } from 'express'
import { PublicRoutes } from '../app/modules/public/public.route'
import { SupportRoutes } from '../app/modules/support/support.route'
import { UploadRoutes } from '../app/modules/upload/upload.route'
import { PaymentRoutes } from '../app/modules/payment/payment.route'
import { NotificationRoutes } from '../app/modules/notification/notification.routes'
import { MessageRoutes } from '../app/modules/message/message.routes'
import { ChatRoutes } from '../app/modules/chat/chat.routes'
import { ReviewRoutes } from '../app/modules/review/review.route'
import { CategoryRoutes } from '../app/modules/category/category.route'
import { FavouriteRoutes } from '../app/modules/favourite/favourite.route'
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route'
import { LocationRoutes } from '../app/modules/location/location.route'
import { ProductRoutes } from '../app/modules/product/product.route'
import { AuctionRoutes } from '../app/modules/auction/auction.route'
import { TradeRoutes } from '../app/modules/trade/trade.route'
import { OrderRoutes } from '../app/modules/order/order.route'
import { DashboardRoutes } from '../app/modules/dashboard/dashboard.route'
import { FollowRoutes } from '../app/modules/follow/follow.route'

const router = express.Router()

const apiRoutes: { path: string; route: Router }[] = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/subscription',
    route: SubscriptionRoutes,
  },

  { path: '/support', route: SupportRoutes },
  { path: '/notifications', route: NotificationRoutes },
  { path: '/upload', route: UploadRoutes },
  { path: '/payment', route: PaymentRoutes },
  { path: '/message', route: MessageRoutes },
  { path: '/chat', route: ChatRoutes },
  { path: '/review', route: ReviewRoutes },
  { path: '/category', route: CategoryRoutes },
  { path: '/favourite', route: FavouriteRoutes },
  { path: '/public', route: PublicRoutes },
  { path: '/locations', route: LocationRoutes },
  { path: '/products', route: ProductRoutes },
  { path: '/auctions', route: AuctionRoutes },
  { path: '/trades', route: TradeRoutes },
  { path: '/orders', route: OrderRoutes },
  { path: '/dashboard', route: DashboardRoutes },
  { path: '/follow', route: FollowRoutes },
]

apiRoutes.forEach(route => {
  router.use(route.path, route.route)
})

export default router
