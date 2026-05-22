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
