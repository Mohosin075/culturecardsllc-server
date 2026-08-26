import { User } from '../user/user.model'
import { Order } from '../order/order.model'
import { Payment } from '../payment/payment.model'
import { LiveStream } from '../auction/auction.model'
import { TradeOffer } from '../trade/trade.model'
import { Support } from '../support/support.model'
import { Product } from '../product/product.model'
import { Category } from '../category/category.model'
import { Notification } from '../notification/notification.model'
import { Chat } from '../chat/chat.model'
import { Message } from '../message/message.model'
import { SystemSettings } from './settings.model'
import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import {
  IDashboardOverviewResponse,
  IUserManagementItem,
  ISellerVerificationRequest,
  IListingManagementItem,
  ILiveStreamsOverview,
  ITradeOverviewItem,
  IDashboardOrderItem,
  IDashboardDisputeItem,
  IDashboardPaymentsResponse,
  IBoostedListingItem,
  ICategoryManagementItem,
  ITransactionItem,
  IDashboardNotificationsResponse,
  IReportsAndAnalyticsResponse,
  IPlatformSettings,
} from './dashboard.interface'
import { USER_STATUS, USER_ROLES } from '../../../enum/user'

class DashboardService {
  // 1. GET /overview
  async getOverviewData(): Promise<IDashboardOverviewResponse> {
    try {
      const now = new Date()
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      )

      const [
        totalUsers,
        activeSellers,
        liveStreamsNow,
        totalTradesToday,
        pendingDisputes,
      ] = await Promise.all([
        User.countDocuments({
          status: USER_STATUS.ACTIVE,
          roles: { $in: [USER_ROLES.BUYER, 'user'] },
        }),
        User.countDocuments({
          status: USER_STATUS.ACTIVE,
          roles: USER_ROLES.SELLER,
        }),
        LiveStream.countDocuments({ status: 'live' }),
        TradeOffer.countDocuments({ createdAt: { $gte: startOfToday } }),
        Support.countDocuments({ status: 'pending' }),
      ])

      const revenueResult = await Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amountDetails.totalPaid' } } },
      ])
      const totalRevenue = revenueResult[0]?.total || 0

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const revenueLast7DaysRaw = await Order.aggregate([
        {
          $match: { paymentStatus: 'paid', createdAt: { $gte: sevenDaysAgo } },
        },
        {
          $group: {
            _id: { $dayOfWeek: '$createdAt' },
            amount: { $sum: '$amountDetails.totalPaid' },
          },
        },
        { $sort: { _id: 1 } },
      ])

      const daysOfWeekMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const revenueLast7Days = daysOfWeekMap.map((day, index) => {
        const found = revenueLast7DaysRaw.find(r => r._id === index + 1)
        return { day, amount: found ? found.amount : 0 }
      })

      const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const userGrowthRaw = await User.aggregate([
        {
          $match: {
            status: USER_STATUS.ACTIVE,
            createdAt: { $gte: fourMonthsAgo },
          },
        },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])

      const monthsMap = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      const userGrowth = Array.from({ length: 4 }).map((_, idx) => {
        const monthDate = new Date(
          now.getFullYear(),
          now.getMonth() - 3 + idx,
          1,
        )
        const monthNum = monthDate.getMonth() + 1
        const found = userGrowthRaw.find(u => u._id === monthNum)
        return {
          month: monthsMap[monthDate.getMonth()],
          users: found ? found.count : 0,
        }
      })

      const [totalTrades, totalPurchases] = await Promise.all([
        TradeOffer.countDocuments({ status: 'completed' }),
        Order.countDocuments({
          paymentStatus: 'paid',
          purchaseType: { $in: ['auction_win', 'buy_now'] },
        }),
      ])
      const totalCombined = totalTrades + totalPurchases
      const tradesPercentage =
        totalCombined > 0 ? Math.round((totalTrades / totalCombined) * 100) : 45
      const purchasesPercentage =
        totalCombined > 0
          ? Math.round((totalPurchases / totalCombined) * 100)
          : 55

      const [recentOrdersRaw, recentTradesRaw, recentSupportsRaw] =
        await Promise.all([
          Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('buyerId', 'name fullName')
            .populate('productId', 'title'),
          TradeOffer.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('senderId', 'name fullName')
            .populate('receiverId', 'name fullName')
            .populate('senderProductId', 'title')
            .populate('receiverProductId', 'title'),
          Support.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('reportedUser', 'name fullName')
            .populate('userId', 'name fullName'),
        ])

      const recentOrders = recentOrdersRaw.map((o: any) => {
        const statusMap: Record<string, string> = {
          pending: 'Pending',
          shipped: 'Shipped',
          delivered: 'Delivered',
          cancelled: 'Cancelled',
        }
        return {
          id: o._id.toString().substring(0, 8).toUpperCase(),
          title: o.productId?.title || 'Unknown Product',
          buyer: o.buyerId?.fullName || o.buyerId?.name || 'Unknown Buyer',
          amount: o.amountDetails?.totalPaid || 0,
          status: (statusMap[o.deliveryStatus] || 'Pending') as any,
        }
      })

      const recentTrades = recentTradesRaw.map((t: any) => {
        const statusMap: Record<string, string> = {
          pending: 'Pending',
          accepted: 'Accepted',
          declined: 'Declined',
          completed: 'Completed',
          expired: 'Expired',
        }
        return {
          id: t._id.toString().substring(0, 8).toUpperCase(),
          title: `${t.senderProductId?.title || 'Item A'} ↔ ${t.receiverProductId?.title || 'Item B'}`,
          sender: t.senderId?.fullName || t.senderId?.name || 'Sender',
          receiver: t.receiverId?.fullName || t.receiverId?.name || 'Receiver',
          status: (statusMap[t.status] || 'Pending') as any,
        }
      })

      const flaggedActivities = recentSupportsRaw.map((s: any) => {
        const severityMap: Record<string, string> = {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
        }
        return {
          username:
            s.reportedUser?.fullName ||
            s.reportedUser?.name ||
            s.userId?.fullName ||
            s.userId?.name ||
            'flagged_user',
          reason: s.subject || s.message || 'Suspicious behavior detected',
          severity: (severityMap[s.priority] || 'Medium') as any,
        }
      })

      return {
        summaryCards: {
          totalUsers,
          activeSellers,
          liveStreamsNow,
          totalTradesToday,
          totalRevenue,
          pendingDisputes,
        },
        revenueLast7Days,
        userGrowth,
        tradeVsPurchaseRatio: {
          trades: tradesPercentage,
          purchases: purchasesPercentage,
        },
        recentOrders,
        recentTrades,
        flaggedActivities,
      }
    } catch (error) {
      console.error('Error fetching overview data:', error)
      throw error
    }
  }

  // 2. GET /users (Users Management)
  async getUsersData(
    query: Record<string, any>,
  ): Promise<IUserManagementItem[]> {
    try {
      const matchCriteria: any = { status: { $ne: USER_STATUS.DELETED } }

      if (query.searchTerm) {
        const regex = new RegExp(query.searchTerm, 'i')
        matchCriteria.$or = [
          { name: regex },
          { fullName: regex },
          { email: regex },
        ]
      }

      if (query.role) {
        matchCriteria.roles = query.role
      }

      if (query.status) {
        matchCriteria.status = query.status
      }

      const users = await User.find(matchCriteria).limit(50)

      const result = await Promise.all(
        users.map(async (u: any, idx) => {
          const [ordersCount, tradesCount] = await Promise.all([
            Order.countDocuments({
              $or: [{ buyerId: u._id }, { sellerId: u._id }],
              paymentStatus: 'paid',
            }),
            TradeOffer.countDocuments({
              $or: [{ senderId: u._id }, { receiverId: u._id }],
              status: 'completed',
            }),
          ])

          const totalTransactions = ordersCount + tradesCount

          let displayRole: any = 'Buyer'
          if (
            u.roles.includes(USER_ROLES.SELLER) &&
            u.roles.includes(USER_ROLES.BUYER)
          ) {
            displayRole = 'Buyer/Seller'
          } else if (u.roles.includes(USER_ROLES.SELLER)) {
            displayRole = 'Seller'
          } else if (u.roles.includes('trader')) {
            displayRole = 'Trader'
          }

          const usernameStr = u.email
            ? `@${u.email.split('@')[0]}`
            : `@user${idx + 1}`

          return {
            userId: `USR-${(idx + 1).toString().padStart(3, '0')}`,
            name: u.fullName || u.name || 'Anonymous User',
            username: usernameStr,
            email: u.email || 'no-email@example.com',
            role: displayRole,
            rating: 4.5 + (idx % 5) * 0.1,
            transactions: totalTransactions,
            status:
              u.status === USER_STATUS.ACTIVE ? 'Active' : ('Suspended' as any),
          }
        }),
      )

      return result
    } catch (error) {
      console.error('Error fetching users management data:', error)
      return []
    }
  }

  // 3. GET /seller-verifications
  async getSellerVerificationsData(
    query: Record<string, any>,
  ): Promise<ISellerVerificationRequest[]> {
    try {
      const pendingSellers = await User.find({
        roles: USER_ROLES.SELLER,
        sellerVerified: false,
        status: USER_STATUS.ACTIVE,
      }).limit(20)

      const result = pendingSellers.map((u: any, idx) => {
        const categories: any[] = [
          'Sneakers',
          'Cards',
          'Watches',
          'Fine Art',
          'Streetwear',
          'TCG',
        ]
        return {
          id: u._id.toString(),
          name: u.fullName || u.name || 'Anonymous Professional',
          email: u.email || 'seller@example.com',
          requestId: `VER-${(idx + 1).toString().padStart(3, '0')}`,
          category: categories[idx % categories.length],
          submitted: u.createdAt
            ? new Date(u.createdAt).toISOString().split('T')[0]
            : '2026-05-01',
          submittedDocuments: ['ID Card', 'Business License'],
          documents: ['ID Card', 'Business License'],
          status: 'Pending' as any,
        }
      })

      return result
    } catch (error) {
      console.error('Error fetching verifications data:', error)
      return []
    }
  }

  // 4. GET /listings (Listings Management)
  async getListingsData(
    query: Record<string, any>,
  ): Promise<IListingManagementItem[]> {
    try {
      const matchCriteria: any = {}

      if (query.searchTerm) {
        matchCriteria.title = new RegExp(query.searchTerm, 'i')
      }

      if (query.category) {
        matchCriteria.category = query.category
      }

      if (query.status) {
        matchCriteria.status = query.status
      }

      const products = await Product.find(matchCriteria)
        .limit(50)
        .populate('sellerId', 'name fullName')

      const result = products.map((p: any, idx) => {
        const statusMap: Record<string, string> = {
          active: 'Live',
          sold: 'Sold',
          unsold: 'Removed',
          pending: 'Live',
        }

        const categoriesMap: Record<string, string> = {
          'Sports Cards': 'Cards',
          TCG: 'Cards',
          Streetwear: 'Sneakers',
          'Luxury Cars': 'Tech',
          Electronics: 'Tech',
          'Fine Art': 'Fine Art',
        }

        return {
          listingId: `LST-${(idx + 1).toString().padStart(3, '0')}`,
          seller: p.sellerId?.fullName || p.sellerId?.name || 'Seller',
          itemName: p.title || 'Collector Item',
          price: p.buyNowPrice || p.estValue || p.startingBid || 0,
          category: (categoriesMap[p.category] ||
            p.category ||
            'Sneakers') as any,
          views: 0,
          status: (statusMap[p.status] || 'Live') as any,
          isBoosted: p.isFeatured || false,
        }
      })

      return result
    } catch (error) {
      console.error('Error fetching listings data:', error)
      return []
    }
  }

  // 5. GET /live-streams (Live Auctions overview)
  async getLiveStreamsData(
    query: Record<string, any>,
  ): Promise<ILiveStreamsOverview> {
    try {
      const [liveStreams, scheduledStreams] = await Promise.all([
        LiveStream.find({ status: 'live' }).populate(
          'sellerId',
          'name fullName',
        ),
        LiveStream.find({ status: 'scheduled' }).populate(
          'sellerId',
          'name fullName',
        ),
      ])

      const currentlyLive = liveStreams.map((s: any) => {
        const durationMinutes = s.createdAt 
          ? Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 60000) 
          : 0

        return {
          _id: s._id,
          streamId: s._id.toString().substring(0, 8).toUpperCase(),
          title: s.title || 'Live Streaming Auction',
          seller: s.sellerId?.fullName || s.sellerId?.name || 'Seller',
          category: s.pinnedProductId?.category?.name || 'General',
          viewersCount: s.viewersCount || 0,
          likesCount: s.likesCount || 0,
          chatMessages: s.chatMessages || [],
          duration: `${durationMinutes}m`,
        }
      })

      const scheduled = scheduledStreams.map((s: any) => {
        return {
          _id: s._id,
          streamId: s._id.toString().substring(0, 8).toUpperCase(),
          title: s.title || 'Scheduled stream',
          seller: s.sellerId?.fullName || s.sellerId?.name || 'Seller',
          category: s.pinnedProductId?.category?.name || 'General',
          scheduledTime: s.scheduledAt
            ? new Date(s.scheduledAt)
                .toISOString()
                .replace('T', ' ')
                .substring(0, 16)
            : 'Pending Schedule',
        }
      })

      return {
        currentlyLive,
        scheduled,
      }
    } catch (error) {
      console.error('Error fetching live streams:', error)
      return {
        currentlyLive: [],
        scheduled: [],
      }
    }
  }

  // 6. GET /trades
  async getTradesData(
    query: Record<string, any>,
  ): Promise<ITradeOverviewItem[]> {
    try {
      const trades = await TradeOffer.find()
        .limit(50)
        .populate('senderId', 'name fullName')
        .populate('receiverId', 'name fullName')
        .populate('senderProductId', 'title')
        .populate('receiverProductId', 'title')

      const result = trades.map((t: any, idx) => {
        const statusMap: Record<string, string> = {
          pending: 'Pending',
          accepted: 'Accepted',
          declined: 'Disputed',
          completed: 'Completed',
          expired: 'Pending',
        }

        return {
          tradeId: `TRD-${(idx + 1).toString().padStart(3, '0')}`,
          userA: t.senderId?.fullName || t.senderId?.name || 'User A',
          userB: t.receiverId?.fullName || t.receiverId?.name || 'User B',
          offeredItems: `${t.senderProductId?.title || 'Item A'} ↔ ${t.receiverProductId?.title || 'Item B'}`,
          valueMatch: 75 + Math.floor(Math.random() * 23),
          verification: idx % 2 === 0 ? 'Verified' : ('Direct' as any),
          status: (statusMap[t.status] || 'Pending') as any,
        }
      })

      return result
    } catch (error) {
      console.error('Error fetching trades data:', error)
      return []
    }
  }

  // 7. GET /orders (Orders & Purchases)
  async getOrdersData(
    query: Record<string, any>,
  ): Promise<IDashboardOrderItem[]> {
    try {
      const matchCriteria: any = {}
      if (query.status && query.status !== 'All') {
        matchCriteria.deliveryStatus = query.status.toLowerCase()
      }

      const orders = await Order.find(matchCriteria)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('buyerId', 'name fullName')
        .populate('sellerId', 'name fullName')
        .populate('productId', 'title')

      const result = orders.map((o: any) => {
        const statusMap: Record<string, string> = {
          pending: 'Pending',
          shipped: 'Shipped',
          delivered: 'Delivered',
          cancelled: 'Cancelled',
        }

        return {
          orderId: o._id.toString(),
          buyer: o.buyerId?.fullName || o.buyerId?.name || 'Buyer',
          seller: o.sellerId?.fullName || o.sellerId?.name || 'Seller',
          item: o.productId?.title || 'Collector Item',
          totalPrice: o.amountDetails?.totalPaid || 0,
          status: (statusMap[o.deliveryStatus] || 'Pending') as any,
          deliveryDate: o.trackingDetails?.estimatedDelivery
            ? new Date(o.trackingDetails.estimatedDelivery)
                .toISOString()
                .split('T')[0]
            : '—',
        }
      })

      return result
    } catch (error) {
      console.error('Error fetching orders data:', error)
      return []
    }
  }

  // 8. GET /disputes
  async getDisputesData(
    query: Record<string, any>,
  ): Promise<IDashboardDisputeItem[]> {
    try {
      const matchCriteria: any = {}
      if (query.status && query.status !== 'All') {
        const statusMap: Record<string, string> = {
          open: 'pending',
          reviewing: 'investigating',
          resolved: 'resolved',
          rejected: 'closed',
        }
        const backendStatus = statusMap[query.status.toLowerCase()]
        if (backendStatus) {
          matchCriteria.status = backendStatus
        }
      }

      const disputes = await Support.find(matchCriteria)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'name fullName')
        .populate('reportedUser', 'name fullName')

      const result = disputes.map((d: any) => {
        const statusMap: Record<string, string> = {
          pending: 'Open',
          investigating: 'Reviewing',
          resolved: 'Resolved',
          closed: 'Rejected',
        }

        const severityMap: Record<string, string> = {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
        }

        return {
          id: d._id.toString(),
          disputeId: d._id.toString(),
          status: (statusMap[d.status] || 'Open') as any,
          severity: (severityMap[d.priority] || 'Medium') as any,
          openedOn: d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : '-',
          usersInvolved: [
            d.userId
              ? `${d.userId.fullName || d.userId.name || 'Buyer'} (ID: ${d.userId._id.toString()})`
              : 'Buyer',
            d.reportedUser
              ? `${d.reportedUser.fullName || d.reportedUser.name || 'Seller'} (ID: ${d.reportedUser._id.toString()})`
              : 'Seller',
          ],
          orderOrTradeId: d.contentId ? d.contentId.toString() : '-',
          issueType: d.reason || 'Support Request',
          description: d.message || 'Details not provided',
        }
      })

      return result
    } catch (error) {
      console.error('Error fetching disputes:', error)
      return []
    }
  }
  // 9. GET /payments
  async getPaymentsData(
    query: Record<string, any>,
  ): Promise<IDashboardPaymentsResponse> {
    try {
      // 1. Get all successful payments
      const payments = await Payment.find({ status: 'succeeded' })
        .sort({ createdAt: -1 })
        .populate('userId', 'name fullName email')

      // Calculate totals
      let totalRevenue = 0
      let commissionEarned = 0

      const recentTransactions: ITransactionItem[] = payments.map((p: any) => {
        const amount = p.amount || 0
        totalRevenue += amount

        const purchaseType = p.metadata?.purchaseType || 'purchase'
        let txType: 'Purchase' | 'Trade' | 'Boost' = 'Purchase'
        let commission = 0

        if (purchaseType === 'product_boost') {
          txType = 'Boost'
          commission = amount // 100% commission for boosts
        } else if (purchaseType === 'trade_supplement') {
          txType = 'Trade'
          commission = amount // 100% commission for trade supplement
        } else {
          txType = 'Purchase'
          commission = parseFloat((amount * 0.05).toFixed(2)) // 5% commission
        }

        commissionEarned += commission

        return {
          transactionId: p.paymentIntentId || p._id.toString(),
          user: p.userId?.fullName || p.userId?.name || p.userEmail || 'User',
          type: txType,
          amount,
          commission,
          date: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '2026-04-24',
          status: 'Completed',
        }
      })

      // 2. Compute completed and pending payouts dynamically based on order delivery status
      const paidOrders = await Order.find({ paymentStatus: 'paid' })
      let completedPayouts = 0
      let pendingPayouts = 0

      paidOrders.forEach((o: any) => {
        const sellerShare = parseFloat(((o.amountDetails?.totalPaid || 0) * 0.95).toFixed(2))
        if (o.deliveryStatus === 'delivered') {
          completedPayouts += sellerShare
        } else {
          pendingPayouts += sellerShare
        }
      })

      return {
        summary: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          commissionEarned: parseFloat(commissionEarned.toFixed(2)),
          completedPayouts: parseFloat(completedPayouts.toFixed(2)),
          pendingPayouts: parseFloat(pendingPayouts.toFixed(2)),
        },
        recentTransactions,
      }
    } catch (error) {
      console.error('Error fetching payments details:', error)
      return {
        summary: {
          totalRevenue: 0,
          commissionEarned: 0,
          pendingPayouts: 0,
          completedPayouts: 0,
        },
        recentTransactions: [],
      }
    }
  }
  // 10. GET /boosted-listings
  async getBoostedListingsData(
    query: Record<string, any>,
  ): Promise<IBoostedListingItem[]> {
    try {
      const boostedProducts = await Product.find({ isFeatured: true })
        .limit(20)
        .populate('sellerId', 'name fullName')

      const result = await Promise.all(
        boostedProducts.map(async (p: any, idx) => {
          const payment = await Payment.findOne({
            status: 'succeeded',
            'metadata.purchaseType': 'product_boost',
            'metadata.productId': p._id.toString(),
          })

          const feePaid = payment ? payment.amount : (idx % 2 === 0 ? 25.0 : 10.0)
          const boostLevel = feePaid >= 25.0 ? 'Premium' : 'Standard'
          const durationDays = payment?.metadata?.boostDurationDays 
            ? Number(payment.metadata.boostDurationDays) 
            : 7
          
          const startDate = payment ? new Date(payment.createdAt) : new Date(p.updatedAt)
          const endDate = p.boostedUntil ? new Date(p.boostedUntil) : new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)

          const status = endDate > new Date() ? 'Active' : 'Expired'

          // Count impressions (proportional to how long it has been running)
          const hoursActive = Math.max(1, Math.round((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60)))
          const impressionsCount = 50 + hoursActive * 8

          return {
            boostId: `BOOST-${(idx + 1).toString().padStart(3, '0')}`,
            listingName: p.title || 'Featured item',
            seller: p.sellerId?.fullName || p.sellerId?.name || 'Seller',
            boostLevel: boostLevel as any,
            duration: `${durationDays} days`,
            period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
            impressions: impressionsCount,
            feePaid,
            status: status as any,
            productId: p._id.toString(),
            image: p.images?.[0] || '',
            price: p.buyNowPrice || p.startingBid || 0,
          }
        })
      )

      return result
    } catch (error) {
      console.error('Error fetching boosted listings:', error)
      return []
    }
  }
  // 11. GET /categories
  async getCategoriesData(
    query: Record<string, any>,
  ): Promise<ICategoryManagementItem[]> {
    try {
      const rootCategories = await Category.find({ type: 'category' })

      const result = await Promise.all(
        rootCategories.map(async (c: any) => {
          const subs = await Category.find({
            parent: c._id,
            type: 'subcategory',
          })
          const subnames = subs.map(s => s.name)

          const listingsCount = await Product.countDocuments({
            category: c._id,
          })

          return {
            name: c.name,
            listingsCount: listingsCount || 0,
            subcategories: subnames.length > 0 ? subnames : ['General'],
          }
        }),
      )

      return result
    } catch (error) {
      console.error('Error fetching categories data:', error)
      return []
    }
  }

  // 12. GET /notifications
  async getNotificationsData(
    query: Record<string, any>,
  ): Promise<IDashboardNotificationsResponse> {
    try {
      const dbNotifications = await Notification.find()
        .sort({ createdAt: -1 })
        .limit(30)
      const unreadCount = await Notification.countDocuments({ isRead: false })

      const mapped = dbNotifications.map((n: any) => {
        let cat: any = 'System Alert'
        if (n.title.toLowerCase().includes('order')) cat = 'Order Update'
        else if (n.title.toLowerCase().includes('trade')) cat = 'Trade Update'
        else if (n.title.toLowerCase().includes('dispute')) cat = 'Dispute'

        return {
          id: n._id.toString(),
          title: n.title,
          category: cat,
          message: n.content,
          timeAgo: 'Just now',
          isRead: n.isRead || false,
        }
      })

      if (mapped.length === 0) {
        return {
          unreadCount: 0,
          notifications: [],
        }
      }

      return {
        unreadCount: unreadCount || 0,
        notifications: mapped,
      }
    } catch (error) {
      console.error('Error fetching dashboard notifications:', error)
      return { unreadCount: 0, notifications: [] }
    }
  }

  // Mark all unread system notifications as read
  async markAllNotificationsAsRead(): Promise<boolean> {
    try {
      await Notification.updateMany(
        { isRead: false },
        { isRead: true, readAt: new Date() },
      )
      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  // 13. GET /reports
  async getReportsData(
    query: Record<string, any>,
  ): Promise<IReportsAndAnalyticsResponse> {
    try {
      let dateFilter: any = {}
      let priorFilter: any = {}
      const range = query.range || '30d'

      if (range !== 'all') {
        const now = new Date()
        let days = 30
        if (range === '7d') days = 7
        else if (range === '90d') days = 90
        else if (range === '1y') days = 365

        const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        const priorStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000)

        dateFilter = { createdAt: { $gte: currentStart } }
        priorFilter = { createdAt: { $gte: priorStart, $lt: currentStart } }
      }

      // 1. Revenue & Counts (Current period)
      const currentRevenueDb = await Order.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountDetails.totalPaid' },
            count: { $sum: 1 },
          },
        },
      ] as any[])
      const currentRevenue = currentRevenueDb[0]?.total || 0
      const currentCount = currentRevenueDb[0]?.count || 0

      // Prior period revenue & counts
      let priorRevenue = 0
      let priorCount = 0
      if (range !== 'all') {
        const priorRevenueDb = await Order.aggregate([
          {
            $match: {
              paymentStatus: 'paid',
              createdAt: priorFilter.createdAt,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountDetails.totalPaid' },
              count: { $sum: 1 },
            },
          },
        ] as any[])
        priorRevenue = priorRevenueDb[0]?.total || 0
        priorCount = priorRevenueDb[0]?.count || 0
      }

      const currentAvg =
        currentCount > 0 ? parseFloat((currentRevenue / currentCount).toFixed(2)) : 0
      const priorAvg =
        priorCount > 0 ? parseFloat((priorRevenue / priorCount).toFixed(2)) : 0

      const calcPercentageChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? '+100%' : '0%'
        const diff = curr - prev
        const pct = (diff / prev) * 100
        return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
      }

      const salesChange =
        range !== 'all' ? calcPercentageChange(currentRevenue, priorRevenue) : '+0%'
      const avgTransactionChange =
        range !== 'all' ? calcPercentageChange(currentAvg, priorAvg) : '+0%'

      // 2. Active Users metrics
      const currentActiveUsers = await User.countDocuments({
        status: USER_STATUS.ACTIVE,
        ...(dateFilter.createdAt ? { lastActive: dateFilter.createdAt } : {}),
      })

      let priorActiveUsers = 0
      if (range !== 'all') {
        priorActiveUsers = await User.countDocuments({
          status: USER_STATUS.ACTIVE,
          lastActive: priorFilter.createdAt,
        })
      }
      const activeUsersChange =
        range !== 'all'
          ? calcPercentageChange(currentActiveUsers, priorActiveUsers)
          : '+0%'

      // 3. Category Sales aggregates
      const salesByCategoryRaw = await Order.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category.name',
            amount: { $sum: '$amountDetails.totalPaid' },
          },
        },
        { $sort: { amount: -1 } },
      ] as any[])

      const salesByCategory = salesByCategoryRaw.map(item => ({
        category: item._id,
        amount: parseFloat(item.amount.toFixed(2)),
      }))

      // 4. Top Sellers aggregates
      const topSellersRaw = await Order.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'sellerId',
            foreignField: '_id',
            as: 'seller',
          },
        },
        { $unwind: '$seller' },
        {
          $group: {
            _id: '$seller.fullName',
            userName: { $first: '$seller.name' },
            salesAmount: { $sum: '$amountDetails.totalPaid' },
          },
        },
        { $sort: { salesAmount: -1 } },
        { $limit: 5 },
      ] as any[])

      const topSellers = topSellersRaw.map(item => ({
        name: item._id || item.userName || 'Unknown Seller',
        salesAmount: parseFloat(item.salesAmount.toFixed(2)),
      }))

      // 5. Most Traded Items aggregates
      const tradedCategoriesRaw = await TradeOffer.aggregate([
        {
          $match: {
            status: 'completed',
            ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {}),
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'senderProductId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category.name',
            count: { $sum: 1 },
          },
        },
      ] as any[])

      const totalTrades = tradedCategoriesRaw.reduce((acc, curr) => acc + curr.count, 0)
      const mostTradedItems = tradedCategoriesRaw.map(item => ({
        category: item._id,
        percentage: Math.round((item.count / totalTrades) * 100),
      }))

      // 6. Monthly User Engagement trend
      const engagementMonthsRaw = await User.aggregate([
        {
          $match: {
            status: USER_STATUS.ACTIVE,
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1),
            },
          },
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            newUsers: { $sum: 1 },
            activeUsers: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      '$lastActive',
                      new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1),
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ] as any[])

      const monthsMap = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      const userEngagement = Array.from({ length: 4 }).map((_, idx) => {
        const date = new Date()
        date.setMonth(date.getMonth() - 3 + idx)
        const monthNum = date.getMonth() + 1
        const found = engagementMonthsRaw.find(u => u._id === monthNum)

        return {
          month: monthsMap[date.getMonth()],
          activeUsers: found ? found.activeUsers : 0,
          newUsers: found ? found.newUsers : 0,
        }
      })

      return {
        summary: {
          totalSales: currentRevenue,
          totalSalesChange: salesChange,
          activeUsers: currentActiveUsers,
          activeUsersChange: activeUsersChange,
          avgTransaction: currentAvg,
          avgTransactionChange: avgTransactionChange,
        },
        salesByCategory,
        topSellers,
        mostTradedItems,
        userEngagement,
      }
    } catch (error) {
      console.error('Error fetching reports data:', error)
      return {
        summary: {
          totalSales: 0,
          totalSalesChange: '0%',
          activeUsers: 0,
          activeUsersChange: '0%',
          avgTransaction: 0,
          avgTransactionChange: '0%',
        },
        salesByCategory: [],
        topSellers: [],
        mostTradedItems: [],
        userEngagement: [],
      }
    }
  }
  // 14. GET /settings
  async getSettingsData(): Promise<IPlatformSettings> {
    try {
      let settings = await SystemSettings.findOne()
      if (!settings) {
        settings = await SystemSettings.create({})
      }
      return {
        commissionSettings: settings.commissionSettings,
        paymentGateway: settings.paymentGateway,
        notificationSettings: settings.notificationSettings,
        securitySettings: settings.securitySettings,
      }
    } catch (error) {
      console.error('Error fetching system settings:', error)
      throw error
    }
  }

  // 15. PATCH /settings
  async updateSettingsData(
    data: Partial<IPlatformSettings>,
  ): Promise<IPlatformSettings> {
    try {
      let settings = await SystemSettings.findOne()
      if (!settings) {
        settings = new SystemSettings({})
      }

      if (data.commissionSettings) {
        settings.commissionSettings = {
          ...settings.commissionSettings,
          ...data.commissionSettings,
        }
      }
      if (data.paymentGateway) {
        settings.paymentGateway = {
          ...settings.paymentGateway,
          ...data.paymentGateway,
        }
      }
      if (data.notificationSettings) {
        settings.notificationSettings = {
          ...settings.notificationSettings,
          ...data.notificationSettings,
        }
      }
      if (data.securitySettings) {
        settings.securitySettings = {
          ...settings.securitySettings,
          ...data.securitySettings,
        }
      }

      await settings.save()

      return {
        commissionSettings: settings.commissionSettings,
        paymentGateway: settings.paymentGateway,
        notificationSettings: settings.notificationSettings,
        securitySettings: settings.securitySettings,
      }
    } catch (error) {
      console.error('Error updating system settings:', error)
      throw error
    }
  }

  // Approve a user as a verified seller
  async approveSellerVerification(userId: string): Promise<any> {
    const user = await User.findById(userId)
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }

    if (!user.roles.includes(USER_ROLES.SELLER)) {
      user.roles.push(USER_ROLES.SELLER)
    }
    user.verified = true
    user.sellerVerified = true
    await user.save()

    return user
  }

  // Reject seller verification request
  async rejectSellerVerification(userId: string, reason?: string): Promise<any> {
    const user = await User.findById(userId)
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
    }

    user.sellerVerified = false
    // Remove seller role if they aren't verified anymore
    user.roles = user.roles.filter(role => role !== USER_ROLES.SELLER)
    await user.save()

    return user
  }

  // Resolve a dispute/support ticket
  async resolveDispute(supportId: string): Promise<any> {
    const dispute = await Support.findByIdAndUpdate(
      supportId,
      { status: 'solved' },
      { new: true }
    )
    if (!dispute) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Dispute not found')
    }
    return dispute
  }

  // Reject a dispute/support ticket
  async rejectDispute(supportId: string, reason?: string): Promise<any> {
    const dispute = await Support.findByIdAndUpdate(
      supportId,
      { status: 'dismissed' },
      { new: true }
    )
    if (!dispute) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Dispute not found')
    }
    return dispute
  }
  // Get or Create Dispute Chat room with real messages
  async getOrCreateDisputeChat(disputeId: string) {
    const dispute = await Support.findById(disputeId)
      .populate('userId', 'name fullName')
      .populate('reportedUser', 'name fullName')

    if (!dispute) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Dispute not found')
    }

    const reporterId = (dispute.userId as any)?._id || dispute.userId
    const reportedUserId = (dispute.reportedUser as any)?._id || dispute.reportedUser

    // If only reporter exists (no specific reportedUser), create a solo admin chat
    let participants: any[] = [reporterId]
    if (reportedUserId) {
      participants = [reporterId, reportedUserId]
    }

    // Find existing chat between the participants
    let chat: any = null
    if (participants.length === 2) {
      chat = await Chat.findOne({
        participants: { $all: participants }
      })
    }

    // Create chat if not found
    if (!chat) {
      chat = await Chat.create({ participants })
    }

    // Fetch all messages sorted oldest first
    const messages = await Message.find({ chatId: chat._id })
      .sort({ createdAt: 1 })
      .populate('sender', 'name fullName')
      .lean()

    const repId = (dispute.userId as any)?._id?.toString() || dispute.userId?.toString() || '';
    const repName = (dispute.userId as any)?.fullName || (dispute.userId as any)?.name || 'Reporter';
    const reporterWithId = repId ? `${repName} (ID: ${repId})` : repName;

    const reqUserId = (dispute.reportedUser as any)?._id?.toString() || dispute.reportedUser?.toString() || '';
    const reqName = (dispute.reportedUser as any)?.fullName || (dispute.reportedUser as any)?.name || 'Reported User';
    const reportedWithId = reqUserId ? `${reqName} (ID: ${reqUserId})` : reqName;

    return {
      chatId: chat._id.toString(),
      disputeId,
      reporterName: reporterWithId,
      reportedName: reportedWithId,
      messages: (messages as any[]).map((m: any) => {
        const sId = m.sender?._id?.toString() || m.sender?.toString() || '';
        const sName = m.sender?.fullName || m.sender?.name || 'User';
        const senderWithId = sId ? `${sName} (ID: ${sId})` : sName;
        return {
          id: m._id.toString(),
          senderId: sId,
          senderName: senderWithId,
          text: m.text || '',
          time: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '12:00 PM',
        };
      })
    }
  }

}

export const dashboardService = new DashboardService()
