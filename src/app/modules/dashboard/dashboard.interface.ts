export type ISummaryCards = {
  totalUsers: number;
  activeSellers: number;
  liveStreamsNow: number;
  totalTradesToday: number;
  totalRevenue: number;
  pendingDisputes: number;
};

export type IRevenueData = {
  day: string;
  amount: number;
};

export type IUserGrowthData = {
  month: string;
  users: number;
};

export type IRecentOrder = {
  id: string;
  title: string;
  buyer: string;
  amount: number;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
};

export type IRecentTrade = {
  id: string;
  title: string;
  sender: string;
  receiver: string;
  status: 'Pending' | 'Accepted' | 'Declined' | 'Completed' | 'Expired';
};

export type IFlaggedActivity = {
  username: string;
  reason: string;
  severity: 'High' | 'Medium' | 'Low';
};

export type IDashboardOverviewResponse = {
  summaryCards: ISummaryCards;
  revenueLast7Days: IRevenueData[];
  userGrowth: IUserGrowthData[];
  tradeVsPurchaseRatio: {
    trades: number;
    purchases: number;
  };
  recentOrders: IRecentOrder[];
  recentTrades: IRecentTrade[];
  flaggedActivities: IFlaggedActivity[];
};

// --- NEW SUB-MODULE INTERFACES ---

export type IUserManagementItem = {
  userId: string;
  name: string;
  username: string;
  email: string;
  role: 'Buyer/Seller' | 'Seller' | 'Buyer' | 'Trader';
  rating: number;
  transactions: number;
  status: 'Active' | 'Suspended';
};

export type ISellerVerificationRequest = {
  name: string;
  email: string;
  requestId: string;
  category: 'Sneakers' | 'Cards' | 'Watches' | 'Fine Art' | 'Streetwear' | 'TCG';
  submitted: string;
  submittedDocuments: string[];
  status: 'Pending' | 'Approved' | 'Rejected';
};

export type IListingManagementItem = {
  listingId: string;
  seller: string;
  itemName: string;
  price: number;
  category: 'Sneakers' | 'Watches' | 'Cards' | 'Tech' | 'Streetwear' | 'Fine Art' | 'TCG';
  views: number;
  status: 'Live' | 'Sold' | 'Removed';
  isBoosted: boolean;
};

export type ICurrentlyLiveStream = {
  streamId: string;
  title: string;
  seller: string;
  category: 'Sneakers' | 'Watches' | 'Cards' | 'Fine Art' | 'Streetwear' | 'TCG';
  viewersCount: number;
  duration: string;
};

export type IScheduledStream = {
  streamId: string;
  title: string;
  seller: string;
  category: 'Sneakers' | 'Watches' | 'Cards' | 'Fine Art' | 'Streetwear' | 'TCG';
  scheduledTime: string;
};

export type ILiveStreamsOverview = {
  currentlyLive: ICurrentlyLiveStream[];
  scheduled: IScheduledStream[];
};

export type ITradeOverviewItem = {
  tradeId: string;
  userA: string;
  userB: string;
  offeredItems: string;
  valueMatch: number; // percentage e.g. 95
  verification: 'Verified' | 'Direct';
  status: 'Pending' | 'Accepted' | 'Completed' | 'Disputed';
};
