export type ISummaryCards = {
  totalUsers: number
  activeSellers: number
  liveStreamsNow: number
  totalTradesToday: number
  totalRevenue: number
  pendingDisputes: number
}

export type IRevenueData = {
  day: string
  amount: number
}

export type IUserGrowthData = {
  month: string
  users: number
}

export type IRecentOrder = {
  id: string
  title: string
  buyer: string
  amount: number
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled'
}

export type IRecentTrade = {
  id: string
  title: string
  sender: string
  receiver: string
  status: 'Pending' | 'Accepted' | 'Declined' | 'Completed' | 'Expired'
}

export type IFlaggedActivity = {
  username: string
  reason: string
  severity: 'High' | 'Medium' | 'Low'
}

export type IDashboardOverviewResponse = {
  summaryCards: ISummaryCards
  revenueLast7Days: IRevenueData[]
  userGrowth: IUserGrowthData[]
  tradeVsPurchaseRatio: {
    trades: number
    purchases: number
  }
  recentOrders: IRecentOrder[]
  recentTrades: IRecentTrade[]
  flaggedActivities: IFlaggedActivity[]
}

// --- SUB-MODULE INTERFACES ---

export type IUserManagementItem = {
  userId: string
  name: string
  username: string
  email: string
  role: 'Buyer/Seller' | 'Seller' | 'Buyer' | 'Trader'
  rating: number
  transactions: number
  status: 'Active' | 'Suspended'
}

export type ISellerVerificationRequest = {
  id?: string
  name: string
  email: string
  requestId: string
  category: 'Sneakers' | 'Cards' | 'Watches' | 'Fine Art' | 'Streetwear' | 'TCG'
  submitted: string
  submittedDocuments: string[]
  documents?: string[]
  status: 'Pending' | 'Approved' | 'Rejected'
}

export type IListingManagementItem = {
  listingId: string
  seller: string
  itemName: string
  price: number
  category:
    | 'Sneakers'
    | 'Watches'
    | 'Cards'
    | 'Tech'
    | 'Streetwear'
    | 'Fine Art'
    | 'TCG'
  views: number
  status: 'Live' | 'Sold' | 'Removed'
  isBoosted: boolean
}

export type ICurrentlyLiveStream = {
  streamId: string
  title: string
  seller: string
  category: 'Sneakers' | 'Watches' | 'Cards' | 'Fine Art' | 'Streetwear' | 'TCG'
  viewersCount: number
  duration: string
}

export type IScheduledStream = {
  streamId: string
  title: string
  seller: string
  category: 'Sneakers' | 'Watches' | 'Cards' | 'Fine Art' | 'Streetwear' | 'TCG'
  scheduledTime: string
}

export type ILiveStreamsOverview = {
  currentlyLive: ICurrentlyLiveStream[]
  scheduled: IScheduledStream[]
}

export type ITradeOverviewItem = {
  tradeId: string
  userA: string
  userB: string
  offeredItems: string
  valueMatch: number // percentage e.g. 95
  verification: 'Verified' | 'Direct'
  status: 'Pending' | 'Accepted' | 'Completed' | 'Disputed'
}

// --- PREVIOUS SCREENS INTERFACES ---

export type IDashboardOrderItem = {
  orderId: string
  buyer: string
  seller: string
  item: string
  totalPrice: number
  status: 'Shipped' | 'Pending' | 'Delivered' | 'Cancelled'
  deliveryDate: string // e.g. '2026-04-26' or '-'
}

export type IDashboardDisputeItem = {
  id?: string
  disputeId: string
  status: 'Open' | 'Reviewing' | 'Resolved' | 'Rejected'
  severity: 'Low' | 'Medium' | 'High'
  openedOn: string // date e.g. '2026-04-22'
  usersInvolved: string[] // e.g. ['John Doe', 'SneakerKing']
  orderOrTradeId: string // e.g. 'ORD-1234'
  issueType: string // e.g. 'Item not as described'
  description: string
}

export type ITransactionItem = {
  transactionId: string
  user: string
  type: 'Purchase' | 'Trade' | 'Boost'
  amount: number
  commission: number
  date: string
  status: 'Completed' | 'Pending' | 'Failed'
}

export type IDashboardPaymentsResponse = {
  summary: {
    totalRevenue: number
    commissionEarned: number
    pendingPayouts: number
    completedPayouts: number
  }
  recentTransactions: ITransactionItem[]
}

export type IBoostedListingItem = {
  boostId: string
  listingName: string
  seller: string
  boostLevel: 'Premium' | 'Standard'
  duration: string // e.g. '7 days'
  period: string // e.g. '2026-04-20 to 2026-04-27'
  impressions: number
  feePaid: number
  status: 'Active' | 'Expiring Soon' | 'Expired'
  productId?: string
  image?: string
  price?: number
}

export type ICategoryManagementItem = {
  name: string
  listingsCount: number
  subcategories: string[]
}

// --- NEW 3 SCREENS INTERFACES ---

export type ISystemNotificationItem = {
  id: string
  title: string
  category: 'Order Update' | 'Trade Update' | 'Dispute' | 'System Alert'
  message: string
  timeAgo: string // e.g. '5 minutes ago'
  isRead: boolean
}

export type IDashboardNotificationsResponse = {
  unreadCount: number
  notifications: ISystemNotificationItem[]
}

export type IReportsAndAnalyticsResponse = {
  summary: {
    totalSales: number
    totalSalesChange: string // e.g. '+12.5%'
    activeUsers: number
    activeUsersChange: string // e.g. '+19.4%'
    avgTransaction: number
    avgTransactionChange: string // e.g. '+5.2%'
  }
  salesByCategory: {
    category: string
    amount: number
  }[]
  topSellers: {
    name: string
    salesAmount: number
  }[]
  mostTradedItems: {
    category: string
    percentage: number
  }[]
  userEngagement: {
    month: string
    activeUsers: number
    newUsers: number
  }[]
}

export type IPlatformSettings = {
  commissionSettings: {
    purchaseCommission: number
    tradeCommission: number
  }
  paymentGateway: {
    primaryProcessor: string
    apiKey: string
    enableTestMode: boolean
  }
  notificationSettings: {
    newOrderNotifications: boolean
    disputeAlerts: boolean
    systemAlerts: boolean
  }
  securitySettings: {
    twoFactorAuthentication: boolean
    ipWhitelist: boolean
    sessionTimeout: number
  }
}
