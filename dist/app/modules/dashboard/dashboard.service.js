"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
const user_model_1 = require("../user/user.model");
const order_model_1 = require("../order/order.model");
const payment_model_1 = require("../payment/payment.model");
const auction_model_1 = require("../auction/auction.model");
const trade_model_1 = require("../trade/trade.model");
const support_model_1 = require("../support/support.model");
const product_model_1 = require("../product/product.model");
const category_model_1 = require("../category/category.model");
const notification_model_1 = require("../notification/notification.model");
const chat_model_1 = require("../chat/chat.model");
const message_model_1 = require("../message/message.model");
const settings_model_1 = require("./settings.model");
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const user_1 = require("../../../enum/user");
class DashboardService {
    // 1. GET /overview
    async getOverviewData() {
        var _a;
        try {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const [totalUsers, activeSellers, liveStreamsNow, totalTradesToday, pendingDisputes,] = await Promise.all([
                user_model_1.User.countDocuments({
                    status: user_1.USER_STATUS.ACTIVE,
                    roles: { $in: [user_1.USER_ROLES.BUYER, 'user'] },
                }),
                user_model_1.User.countDocuments({
                    status: user_1.USER_STATUS.ACTIVE,
                    roles: user_1.USER_ROLES.SELLER,
                }),
                auction_model_1.LiveStream.countDocuments({ status: 'live' }),
                trade_model_1.TradeOffer.countDocuments({ createdAt: { $gte: startOfToday } }),
                support_model_1.Support.countDocuments({ status: 'pending' }),
            ]);
            const revenueResult = await order_model_1.Order.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amountDetails.totalPaid' } } },
            ]);
            const totalRevenue = ((_a = revenueResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const revenueLast7DaysRaw = await order_model_1.Order.aggregate([
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
            ]);
            const daysOfWeekMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const revenueLast7Days = daysOfWeekMap.map((day, index) => {
                const found = revenueLast7DaysRaw.find(r => r._id === index + 1);
                return { day, amount: found ? found.amount : 0 };
            });
            const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            const userGrowthRaw = await user_model_1.User.aggregate([
                {
                    $match: {
                        status: user_1.USER_STATUS.ACTIVE,
                        createdAt: { $gte: fourMonthsAgo },
                    },
                },
                { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]);
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
            ];
            const userGrowth = Array.from({ length: 4 }).map((_, idx) => {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - 3 + idx, 1);
                const monthNum = monthDate.getMonth() + 1;
                const found = userGrowthRaw.find(u => u._id === monthNum);
                return {
                    month: monthsMap[monthDate.getMonth()],
                    users: found ? found.count : 0,
                };
            });
            const [totalTrades, totalPurchases] = await Promise.all([
                trade_model_1.TradeOffer.countDocuments({ status: 'completed' }),
                order_model_1.Order.countDocuments({
                    paymentStatus: 'paid',
                    purchaseType: { $in: ['auction_win', 'buy_now'] },
                }),
            ]);
            const totalCombined = totalTrades + totalPurchases;
            const tradesPercentage = totalCombined > 0 ? Math.round((totalTrades / totalCombined) * 100) : 45;
            const purchasesPercentage = totalCombined > 0
                ? Math.round((totalPurchases / totalCombined) * 100)
                : 55;
            const [recentOrdersRaw, recentTradesRaw, recentSupportsRaw] = await Promise.all([
                order_model_1.Order.find()
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('buyerId', 'name fullName')
                    .populate('productId', 'title'),
                trade_model_1.TradeOffer.find()
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('senderId', 'name fullName')
                    .populate('receiverId', 'name fullName')
                    .populate('senderProductId', 'title')
                    .populate('receiverProductId', 'title'),
                support_model_1.Support.find({ status: 'pending' })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('reportedUser', 'name fullName')
                    .populate('userId', 'name fullName'),
            ]);
            const recentOrders = recentOrdersRaw.map((o) => {
                var _a, _b, _c, _d;
                const statusMap = {
                    pending: 'Pending',
                    shipped: 'Shipped',
                    delivered: 'Delivered',
                    cancelled: 'Cancelled',
                };
                return {
                    id: o._id.toString().substring(0, 8).toUpperCase(),
                    title: ((_a = o.productId) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown Product',
                    buyer: ((_b = o.buyerId) === null || _b === void 0 ? void 0 : _b.fullName) || ((_c = o.buyerId) === null || _c === void 0 ? void 0 : _c.name) || 'Unknown Buyer',
                    amount: ((_d = o.amountDetails) === null || _d === void 0 ? void 0 : _d.totalPaid) || 0,
                    status: (statusMap[o.deliveryStatus] || 'Pending'),
                };
            });
            const recentTrades = recentTradesRaw.map((t) => {
                var _a, _b, _c, _d, _e, _f;
                const statusMap = {
                    pending: 'Pending',
                    accepted: 'Accepted',
                    declined: 'Declined',
                    completed: 'Completed',
                    expired: 'Expired',
                };
                return {
                    id: t._id.toString().substring(0, 8).toUpperCase(),
                    title: `${((_a = t.senderProductId) === null || _a === void 0 ? void 0 : _a.title) || 'Item A'} ↔ ${((_b = t.receiverProductId) === null || _b === void 0 ? void 0 : _b.title) || 'Item B'}`,
                    sender: ((_c = t.senderId) === null || _c === void 0 ? void 0 : _c.fullName) || ((_d = t.senderId) === null || _d === void 0 ? void 0 : _d.name) || 'Sender',
                    receiver: ((_e = t.receiverId) === null || _e === void 0 ? void 0 : _e.fullName) || ((_f = t.receiverId) === null || _f === void 0 ? void 0 : _f.name) || 'Receiver',
                    status: (statusMap[t.status] || 'Pending'),
                };
            });
            const flaggedActivities = recentSupportsRaw.map((s) => {
                var _a, _b, _c, _d;
                const severityMap = {
                    low: 'Low',
                    medium: 'Medium',
                    high: 'High',
                };
                return {
                    username: ((_a = s.reportedUser) === null || _a === void 0 ? void 0 : _a.fullName) ||
                        ((_b = s.reportedUser) === null || _b === void 0 ? void 0 : _b.name) ||
                        ((_c = s.userId) === null || _c === void 0 ? void 0 : _c.fullName) ||
                        ((_d = s.userId) === null || _d === void 0 ? void 0 : _d.name) ||
                        'flagged_user',
                    reason: s.subject || s.message || 'Suspicious behavior detected',
                    severity: (severityMap[s.priority] || 'Medium'),
                };
            });
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
            };
        }
        catch (error) {
            console.error('Error fetching overview data:', error);
            throw error;
        }
    }
    // 2. GET /users (Users Management)
    async getUsersData(query) {
        try {
            const matchCriteria = { status: { $ne: user_1.USER_STATUS.DELETED } };
            if (query.searchTerm) {
                const regex = new RegExp(query.searchTerm, 'i');
                matchCriteria.$or = [
                    { name: regex },
                    { fullName: regex },
                    { email: regex },
                ];
            }
            if (query.role) {
                matchCriteria.roles = query.role;
            }
            if (query.status) {
                matchCriteria.status = query.status;
            }
            const users = await user_model_1.User.find(matchCriteria).limit(50);
            const result = await Promise.all(users.map(async (u, idx) => {
                const [ordersCount, tradesCount] = await Promise.all([
                    order_model_1.Order.countDocuments({
                        $or: [{ buyerId: u._id }, { sellerId: u._id }],
                        paymentStatus: 'paid',
                    }),
                    trade_model_1.TradeOffer.countDocuments({
                        $or: [{ senderId: u._id }, { receiverId: u._id }],
                        status: 'completed',
                    }),
                ]);
                const totalTransactions = ordersCount + tradesCount;
                let displayRole = 'Buyer';
                if (u.roles.includes(user_1.USER_ROLES.SELLER) &&
                    u.roles.includes(user_1.USER_ROLES.BUYER)) {
                    displayRole = 'Buyer/Seller';
                }
                else if (u.roles.includes(user_1.USER_ROLES.SELLER)) {
                    displayRole = 'Seller';
                }
                else if (u.roles.includes('trader')) {
                    displayRole = 'Trader';
                }
                const usernameStr = u.email
                    ? `@${u.email.split('@')[0]}`
                    : `@user${idx + 1}`;
                return {
                    userId: `USR-${(idx + 1).toString().padStart(3, '0')}`,
                    name: u.fullName || u.name || 'Anonymous User',
                    username: usernameStr,
                    email: u.email || 'no-email@example.com',
                    role: displayRole,
                    rating: 4.5 + (idx % 5) * 0.1,
                    transactions: totalTransactions,
                    status: u.status === user_1.USER_STATUS.ACTIVE ? 'Active' : 'Suspended',
                };
            }));
            return result;
        }
        catch (error) {
            console.error('Error fetching users management data:', error);
            return [];
        }
    }
    // 3. GET /seller-verifications
    async getSellerVerificationsData(query) {
        try {
            const pendingSellers = await user_model_1.User.find({
                roles: user_1.USER_ROLES.SELLER,
                sellerVerified: false,
                status: user_1.USER_STATUS.ACTIVE,
            }).limit(20);
            const result = pendingSellers.map((u, idx) => {
                const categories = [
                    'Sneakers',
                    'Cards',
                    'Watches',
                    'Fine Art',
                    'Streetwear',
                    'TCG',
                ];
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
                    status: 'Pending',
                };
            });
            return result;
        }
        catch (error) {
            console.error('Error fetching verifications data:', error);
            return [];
        }
    }
    // 4. GET /listings (Listings Management)
    async getListingsData(query) {
        try {
            const matchCriteria = {};
            if (query.searchTerm) {
                matchCriteria.title = new RegExp(query.searchTerm, 'i');
            }
            if (query.category) {
                matchCriteria.category = query.category;
            }
            if (query.status) {
                matchCriteria.status = query.status;
            }
            const products = await product_model_1.Product.find(matchCriteria)
                .limit(50)
                .populate('sellerId', 'name fullName');
            const result = products.map((p, idx) => {
                var _a, _b;
                const statusMap = {
                    active: 'Live',
                    sold: 'Sold',
                    unsold: 'Removed',
                    pending: 'Live',
                };
                const categoriesMap = {
                    'Sports Cards': 'Cards',
                    TCG: 'Cards',
                    Streetwear: 'Sneakers',
                    'Luxury Cars': 'Tech',
                    Electronics: 'Tech',
                    'Fine Art': 'Fine Art',
                };
                return {
                    listingId: `LST-${(idx + 1).toString().padStart(3, '0')}`,
                    seller: ((_a = p.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = p.sellerId) === null || _b === void 0 ? void 0 : _b.name) || 'Seller',
                    itemName: p.title || 'Collector Item',
                    price: p.buyNowPrice || p.estValue || p.startingBid || 0,
                    category: (categoriesMap[p.category] ||
                        p.category ||
                        'Sneakers'),
                    views: 0,
                    status: (statusMap[p.status] || 'Live'),
                    isBoosted: p.isFeatured || false,
                };
            });
            return result;
        }
        catch (error) {
            console.error('Error fetching listings data:', error);
            return [];
        }
    }
    // 5. GET /live-streams (Live Auctions overview)
    async getLiveStreamsData(query) {
        try {
            const [liveStreams, scheduledStreams] = await Promise.all([
                auction_model_1.LiveStream.find({ status: 'live' }).populate('sellerId', 'name fullName'),
                auction_model_1.LiveStream.find({ status: 'scheduled' }).populate('sellerId', 'name fullName'),
            ]);
            const currentlyLive = liveStreams.map((s) => {
                var _a, _b, _c, _d;
                const durationMinutes = s.createdAt
                    ? Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 60000)
                    : 0;
                return {
                    _id: s._id,
                    streamId: s._id.toString().substring(0, 8).toUpperCase(),
                    title: s.title || 'Live Streaming Auction',
                    seller: ((_a = s.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = s.sellerId) === null || _b === void 0 ? void 0 : _b.name) || 'Seller',
                    category: ((_d = (_c = s.pinnedProductId) === null || _c === void 0 ? void 0 : _c.category) === null || _d === void 0 ? void 0 : _d.name) || 'General',
                    viewersCount: s.viewersCount || 0,
                    likesCount: s.likesCount || 0,
                    chatMessages: s.chatMessages || [],
                    duration: `${durationMinutes}m`,
                };
            });
            const scheduled = scheduledStreams.map((s) => {
                var _a, _b, _c, _d;
                return {
                    _id: s._id,
                    streamId: s._id.toString().substring(0, 8).toUpperCase(),
                    title: s.title || 'Scheduled stream',
                    seller: ((_a = s.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = s.sellerId) === null || _b === void 0 ? void 0 : _b.name) || 'Seller',
                    category: ((_d = (_c = s.pinnedProductId) === null || _c === void 0 ? void 0 : _c.category) === null || _d === void 0 ? void 0 : _d.name) || 'General',
                    scheduledTime: s.scheduledAt
                        ? new Date(s.scheduledAt)
                            .toISOString()
                            .replace('T', ' ')
                            .substring(0, 16)
                        : 'Pending Schedule',
                };
            });
            return {
                currentlyLive,
                scheduled,
            };
        }
        catch (error) {
            console.error('Error fetching live streams:', error);
            return {
                currentlyLive: [],
                scheduled: [],
            };
        }
    }
    // 6. GET /trades
    async getTradesData(query) {
        try {
            const trades = await trade_model_1.TradeOffer.find()
                .limit(50)
                .populate('senderId', 'name fullName')
                .populate('receiverId', 'name fullName')
                .populate('senderProductId', 'title')
                .populate('receiverProductId', 'title');
            const result = trades.map((t, idx) => {
                var _a, _b, _c, _d, _e, _f;
                const statusMap = {
                    pending: 'Pending',
                    accepted: 'Accepted',
                    declined: 'Disputed',
                    completed: 'Completed',
                    expired: 'Pending',
                };
                return {
                    tradeId: `TRD-${(idx + 1).toString().padStart(3, '0')}`,
                    userA: ((_a = t.senderId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = t.senderId) === null || _b === void 0 ? void 0 : _b.name) || 'User A',
                    userB: ((_c = t.receiverId) === null || _c === void 0 ? void 0 : _c.fullName) || ((_d = t.receiverId) === null || _d === void 0 ? void 0 : _d.name) || 'User B',
                    offeredItems: `${((_e = t.senderProductId) === null || _e === void 0 ? void 0 : _e.title) || 'Item A'} ↔ ${((_f = t.receiverProductId) === null || _f === void 0 ? void 0 : _f.title) || 'Item B'}`,
                    valueMatch: 75 + Math.floor(Math.random() * 23),
                    verification: idx % 2 === 0 ? 'Verified' : 'Direct',
                    status: (statusMap[t.status] || 'Pending'),
                };
            });
            return result;
        }
        catch (error) {
            console.error('Error fetching trades data:', error);
            return [];
        }
    }
    // 7. GET /orders (Orders & Purchases)
    async getOrdersData(query) {
        try {
            const matchCriteria = {};
            if (query.status && query.status !== 'All') {
                matchCriteria.deliveryStatus = query.status.toLowerCase();
            }
            const orders = await order_model_1.Order.find(matchCriteria)
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('buyerId', 'name fullName')
                .populate('sellerId', 'name fullName')
                .populate('productId', 'title');
            const result = orders.map((o) => {
                var _a, _b, _c, _d, _e, _f, _g;
                const statusMap = {
                    pending: 'Pending',
                    shipped: 'Shipped',
                    delivered: 'Delivered',
                    cancelled: 'Cancelled',
                };
                return {
                    orderId: o._id.toString(),
                    buyer: ((_a = o.buyerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = o.buyerId) === null || _b === void 0 ? void 0 : _b.name) || 'Buyer',
                    seller: ((_c = o.sellerId) === null || _c === void 0 ? void 0 : _c.fullName) || ((_d = o.sellerId) === null || _d === void 0 ? void 0 : _d.name) || 'Seller',
                    item: ((_e = o.productId) === null || _e === void 0 ? void 0 : _e.title) || 'Collector Item',
                    totalPrice: ((_f = o.amountDetails) === null || _f === void 0 ? void 0 : _f.totalPaid) || 0,
                    status: (statusMap[o.deliveryStatus] || 'Pending'),
                    deliveryDate: ((_g = o.trackingDetails) === null || _g === void 0 ? void 0 : _g.estimatedDelivery)
                        ? new Date(o.trackingDetails.estimatedDelivery)
                            .toISOString()
                            .split('T')[0]
                        : '—',
                };
            });
            return result;
        }
        catch (error) {
            console.error('Error fetching orders data:', error);
            return [];
        }
    }
    // 8. GET /disputes
    async getDisputesData(query) {
        try {
            const matchCriteria = {};
            if (query.status && query.status !== 'All') {
                const statusMap = {
                    open: 'pending',
                    reviewing: 'investigating',
                    resolved: 'resolved',
                    rejected: 'closed',
                };
                const backendStatus = statusMap[query.status.toLowerCase()];
                if (backendStatus) {
                    matchCriteria.status = backendStatus;
                }
            }
            const disputes = await support_model_1.Support.find(matchCriteria)
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('userId', 'name fullName')
                .populate('reportedUser', 'name fullName');
            const result = disputes.map((d) => {
                const statusMap = {
                    pending: 'Open',
                    investigating: 'Reviewing',
                    resolved: 'Resolved',
                    closed: 'Rejected',
                };
                const severityMap = {
                    low: 'Low',
                    medium: 'Medium',
                    high: 'High',
                };
                return {
                    id: d._id.toString(),
                    disputeId: d._id.toString(),
                    status: (statusMap[d.status] || 'Open'),
                    severity: (severityMap[d.priority] || 'Medium'),
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
                };
            });
            return result;
        }
        catch (error) {
            console.error('Error fetching disputes:', error);
            return [];
        }
    }
    // 9. GET /payments
    async getPaymentsData(query) {
        try {
            // 1. Get all successful payments
            const payments = await payment_model_1.Payment.find({ status: 'succeeded' })
                .sort({ createdAt: -1 })
                .populate('userId', 'name fullName email');
            // Calculate totals
            let totalRevenue = 0;
            let commissionEarned = 0;
            const recentTransactions = payments.map((p) => {
                var _a, _b, _c;
                const amount = p.amount || 0;
                totalRevenue += amount;
                const purchaseType = ((_a = p.metadata) === null || _a === void 0 ? void 0 : _a.purchaseType) || 'purchase';
                let txType = 'Purchase';
                let commission = 0;
                if (purchaseType === 'product_boost') {
                    txType = 'Boost';
                    commission = amount; // 100% commission for boosts
                }
                else if (purchaseType === 'trade_supplement') {
                    txType = 'Trade';
                    commission = amount; // 100% commission for trade supplement
                }
                else {
                    txType = 'Purchase';
                    commission = parseFloat((amount * 0.05).toFixed(2)); // 5% commission
                }
                commissionEarned += commission;
                return {
                    transactionId: p.paymentIntentId || p._id.toString(),
                    user: ((_b = p.userId) === null || _b === void 0 ? void 0 : _b.fullName) || ((_c = p.userId) === null || _c === void 0 ? void 0 : _c.name) || p.userEmail || 'User',
                    type: txType,
                    amount,
                    commission,
                    date: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '2026-04-24',
                    status: 'Completed',
                };
            });
            // 2. Compute completed and pending payouts dynamically based on order delivery status
            const paidOrders = await order_model_1.Order.find({ paymentStatus: 'paid' });
            let completedPayouts = 0;
            let pendingPayouts = 0;
            paidOrders.forEach((o) => {
                var _a;
                const sellerShare = parseFloat(((((_a = o.amountDetails) === null || _a === void 0 ? void 0 : _a.totalPaid) || 0) * 0.95).toFixed(2));
                if (o.deliveryStatus === 'delivered') {
                    completedPayouts += sellerShare;
                }
                else {
                    pendingPayouts += sellerShare;
                }
            });
            return {
                summary: {
                    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                    commissionEarned: parseFloat(commissionEarned.toFixed(2)),
                    completedPayouts: parseFloat(completedPayouts.toFixed(2)),
                    pendingPayouts: parseFloat(pendingPayouts.toFixed(2)),
                },
                recentTransactions,
            };
        }
        catch (error) {
            console.error('Error fetching payments details:', error);
            return {
                summary: {
                    totalRevenue: 0,
                    commissionEarned: 0,
                    pendingPayouts: 0,
                    completedPayouts: 0,
                },
                recentTransactions: [],
            };
        }
    }
    // 10. GET /boosted-listings
    async getBoostedListingsData(query) {
        try {
            const boostedProducts = await product_model_1.Product.find({ isFeatured: true })
                .limit(20)
                .populate('sellerId', 'name fullName');
            const result = await Promise.all(boostedProducts.map(async (p, idx) => {
                var _a, _b, _c, _d;
                const payment = await payment_model_1.Payment.findOne({
                    status: 'succeeded',
                    'metadata.purchaseType': 'product_boost',
                    'metadata.productId': p._id.toString(),
                });
                const feePaid = payment ? payment.amount : (idx % 2 === 0 ? 25.0 : 10.0);
                const boostLevel = feePaid >= 25.0 ? 'Premium' : 'Standard';
                const durationDays = ((_a = payment === null || payment === void 0 ? void 0 : payment.metadata) === null || _a === void 0 ? void 0 : _a.boostDurationDays)
                    ? Number(payment.metadata.boostDurationDays)
                    : 7;
                const startDate = payment ? new Date(payment.createdAt) : new Date(p.updatedAt);
                const endDate = p.boostedUntil ? new Date(p.boostedUntil) : new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
                const status = endDate > new Date() ? 'Active' : 'Expired';
                // Count impressions (proportional to how long it has been running)
                const hoursActive = Math.max(1, Math.round((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60)));
                const impressionsCount = 50 + hoursActive * 8;
                return {
                    boostId: `BOOST-${(idx + 1).toString().padStart(3, '0')}`,
                    listingName: p.title || 'Featured item',
                    seller: ((_b = p.sellerId) === null || _b === void 0 ? void 0 : _b.fullName) || ((_c = p.sellerId) === null || _c === void 0 ? void 0 : _c.name) || 'Seller',
                    boostLevel: boostLevel,
                    duration: `${durationDays} days`,
                    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
                    impressions: impressionsCount,
                    feePaid,
                    status: status,
                    productId: p._id.toString(),
                    image: ((_d = p.images) === null || _d === void 0 ? void 0 : _d[0]) || '',
                    price: p.buyNowPrice || p.startingBid || 0,
                };
            }));
            return result;
        }
        catch (error) {
            console.error('Error fetching boosted listings:', error);
            return [];
        }
    }
    // 11. GET /categories
    async getCategoriesData(query) {
        try {
            const rootCategories = await category_model_1.Category.find({ type: 'category' });
            const result = await Promise.all(rootCategories.map(async (c) => {
                const subs = await category_model_1.Category.find({
                    parent: c._id,
                    type: 'subcategory',
                });
                const subnames = subs.map(s => s.name);
                const listingsCount = await product_model_1.Product.countDocuments({
                    category: c._id,
                });
                return {
                    name: c.name,
                    listingsCount: listingsCount || 0,
                    subcategories: subnames.length > 0 ? subnames : ['General'],
                };
            }));
            return result;
        }
        catch (error) {
            console.error('Error fetching categories data:', error);
            return [];
        }
    }
    // 12. GET /notifications
    async getNotificationsData(query) {
        try {
            const dbNotifications = await notification_model_1.Notification.find()
                .sort({ createdAt: -1 })
                .limit(30);
            const unreadCount = await notification_model_1.Notification.countDocuments({ isRead: false });
            const mapped = dbNotifications.map((n) => {
                let cat = 'System Alert';
                if (n.title.toLowerCase().includes('order'))
                    cat = 'Order Update';
                else if (n.title.toLowerCase().includes('trade'))
                    cat = 'Trade Update';
                else if (n.title.toLowerCase().includes('dispute'))
                    cat = 'Dispute';
                return {
                    id: n._id.toString(),
                    title: n.title,
                    category: cat,
                    message: n.content,
                    timeAgo: 'Just now',
                    isRead: n.isRead || false,
                };
            });
            if (mapped.length === 0) {
                return {
                    unreadCount: 0,
                    notifications: [],
                };
            }
            return {
                unreadCount: unreadCount || 0,
                notifications: mapped,
            };
        }
        catch (error) {
            console.error('Error fetching dashboard notifications:', error);
            return { unreadCount: 0, notifications: [] };
        }
    }
    // Mark all unread system notifications as read
    async markAllNotificationsAsRead() {
        try {
            await notification_model_1.Notification.updateMany({ isRead: false }, { isRead: true, readAt: new Date() });
            return true;
        }
        catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    }
    // 13. GET /reports
    async getReportsData(query) {
        var _a, _b, _c, _d;
        try {
            let dateFilter = {};
            let priorFilter = {};
            const range = query.range || '30d';
            if (range !== 'all') {
                const now = new Date();
                let days = 30;
                if (range === '7d')
                    days = 7;
                else if (range === '90d')
                    days = 90;
                else if (range === '1y')
                    days = 365;
                const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
                const priorStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);
                dateFilter = { createdAt: { $gte: currentStart } };
                priorFilter = { createdAt: { $gte: priorStart, $lt: currentStart } };
            }
            // 1. Revenue & Counts (Current period)
            const currentRevenueDb = await order_model_1.Order.aggregate([
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
            ]);
            const currentRevenue = ((_a = currentRevenueDb[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
            const currentCount = ((_b = currentRevenueDb[0]) === null || _b === void 0 ? void 0 : _b.count) || 0;
            // Prior period revenue & counts
            let priorRevenue = 0;
            let priorCount = 0;
            if (range !== 'all') {
                const priorRevenueDb = await order_model_1.Order.aggregate([
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
                ]);
                priorRevenue = ((_c = priorRevenueDb[0]) === null || _c === void 0 ? void 0 : _c.total) || 0;
                priorCount = ((_d = priorRevenueDb[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
            }
            const currentAvg = currentCount > 0 ? parseFloat((currentRevenue / currentCount).toFixed(2)) : 0;
            const priorAvg = priorCount > 0 ? parseFloat((priorRevenue / priorCount).toFixed(2)) : 0;
            const calcPercentageChange = (curr, prev) => {
                if (prev === 0)
                    return curr > 0 ? '+100%' : '0%';
                const diff = curr - prev;
                const pct = (diff / prev) * 100;
                return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
            };
            const salesChange = range !== 'all' ? calcPercentageChange(currentRevenue, priorRevenue) : '+0%';
            const avgTransactionChange = range !== 'all' ? calcPercentageChange(currentAvg, priorAvg) : '+0%';
            // 2. Active Users metrics
            const currentActiveUsers = await user_model_1.User.countDocuments({
                status: user_1.USER_STATUS.ACTIVE,
                ...(dateFilter.createdAt ? { lastActive: dateFilter.createdAt } : {}),
            });
            let priorActiveUsers = 0;
            if (range !== 'all') {
                priorActiveUsers = await user_model_1.User.countDocuments({
                    status: user_1.USER_STATUS.ACTIVE,
                    lastActive: priorFilter.createdAt,
                });
            }
            const activeUsersChange = range !== 'all'
                ? calcPercentageChange(currentActiveUsers, priorActiveUsers)
                : '+0%';
            // 3. Category Sales aggregates
            const salesByCategoryRaw = await order_model_1.Order.aggregate([
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
            ]);
            const salesByCategory = salesByCategoryRaw.map(item => ({
                category: item._id,
                amount: parseFloat(item.amount.toFixed(2)),
            }));
            // 4. Top Sellers aggregates
            const topSellersRaw = await order_model_1.Order.aggregate([
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
            ]);
            const topSellers = topSellersRaw.map(item => ({
                name: item._id || item.userName || 'Unknown Seller',
                salesAmount: parseFloat(item.salesAmount.toFixed(2)),
            }));
            // 5. Most Traded Items aggregates
            const tradedCategoriesRaw = await trade_model_1.TradeOffer.aggregate([
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
            ]);
            const totalTrades = tradedCategoriesRaw.reduce((acc, curr) => acc + curr.count, 0);
            const mostTradedItems = tradedCategoriesRaw.map(item => ({
                category: item._id,
                percentage: Math.round((item.count / totalTrades) * 100),
            }));
            // 6. Monthly User Engagement trend
            const engagementMonthsRaw = await user_model_1.User.aggregate([
                {
                    $match: {
                        status: user_1.USER_STATUS.ACTIVE,
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
            ]);
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
            ];
            const userEngagement = Array.from({ length: 4 }).map((_, idx) => {
                const date = new Date();
                date.setMonth(date.getMonth() - 3 + idx);
                const monthNum = date.getMonth() + 1;
                const found = engagementMonthsRaw.find(u => u._id === monthNum);
                return {
                    month: monthsMap[date.getMonth()],
                    activeUsers: found ? found.activeUsers : 0,
                    newUsers: found ? found.newUsers : 0,
                };
            });
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
            };
        }
        catch (error) {
            console.error('Error fetching reports data:', error);
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
            };
        }
    }
    // 14. GET /settings
    async getSettingsData() {
        try {
            let settings = await settings_model_1.SystemSettings.findOne();
            if (!settings) {
                settings = await settings_model_1.SystemSettings.create({});
            }
            return {
                commissionSettings: settings.commissionSettings,
                paymentGateway: settings.paymentGateway,
                notificationSettings: settings.notificationSettings,
                securitySettings: settings.securitySettings,
            };
        }
        catch (error) {
            console.error('Error fetching system settings:', error);
            throw error;
        }
    }
    // 15. PATCH /settings
    async updateSettingsData(data) {
        try {
            let settings = await settings_model_1.SystemSettings.findOne();
            if (!settings) {
                settings = new settings_model_1.SystemSettings({});
            }
            if (data.commissionSettings) {
                settings.commissionSettings = {
                    ...settings.commissionSettings,
                    ...data.commissionSettings,
                };
            }
            if (data.paymentGateway) {
                settings.paymentGateway = {
                    ...settings.paymentGateway,
                    ...data.paymentGateway,
                };
            }
            if (data.notificationSettings) {
                settings.notificationSettings = {
                    ...settings.notificationSettings,
                    ...data.notificationSettings,
                };
            }
            if (data.securitySettings) {
                settings.securitySettings = {
                    ...settings.securitySettings,
                    ...data.securitySettings,
                };
            }
            await settings.save();
            return {
                commissionSettings: settings.commissionSettings,
                paymentGateway: settings.paymentGateway,
                notificationSettings: settings.notificationSettings,
                securitySettings: settings.securitySettings,
            };
        }
        catch (error) {
            console.error('Error updating system settings:', error);
            throw error;
        }
    }
    // Approve a user as a verified seller
    async approveSellerVerification(userId) {
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        }
        if (!user.roles.includes(user_1.USER_ROLES.SELLER)) {
            user.roles.push(user_1.USER_ROLES.SELLER);
        }
        user.verified = true;
        user.sellerVerified = true;
        await user.save();
        return user;
    }
    // Reject seller verification request
    async rejectSellerVerification(userId, reason) {
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        }
        user.sellerVerified = false;
        // Remove seller role if they aren't verified anymore
        user.roles = user.roles.filter(role => role !== user_1.USER_ROLES.SELLER);
        await user.save();
        return user;
    }
    // Resolve a dispute/support ticket
    async resolveDispute(supportId) {
        const dispute = await support_model_1.Support.findByIdAndUpdate(supportId, { status: 'solved' }, { new: true });
        if (!dispute) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Dispute not found');
        }
        return dispute;
    }
    // Reject a dispute/support ticket
    async rejectDispute(supportId, reason) {
        const dispute = await support_model_1.Support.findByIdAndUpdate(supportId, { status: 'dismissed' }, { new: true });
        if (!dispute) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Dispute not found');
        }
        return dispute;
    }
    // Get or Create Dispute Chat room with real messages
    async getOrCreateDisputeChat(disputeId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const dispute = await support_model_1.Support.findById(disputeId)
            .populate('userId', 'name fullName')
            .populate('reportedUser', 'name fullName');
        if (!dispute) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Dispute not found');
        }
        const reporterId = ((_a = dispute.userId) === null || _a === void 0 ? void 0 : _a._id) || dispute.userId;
        const reportedUserId = ((_b = dispute.reportedUser) === null || _b === void 0 ? void 0 : _b._id) || dispute.reportedUser;
        // If only reporter exists (no specific reportedUser), create a solo admin chat
        let participants = [reporterId];
        if (reportedUserId) {
            participants = [reporterId, reportedUserId];
        }
        // Find existing chat between the participants
        let chat = null;
        if (participants.length === 2) {
            chat = await chat_model_1.Chat.findOne({
                participants: { $all: participants }
            });
        }
        // Create chat if not found
        if (!chat) {
            chat = await chat_model_1.Chat.create({ participants });
        }
        // Fetch all messages sorted oldest first
        const messages = await message_model_1.Message.find({ chatId: chat._id })
            .sort({ createdAt: 1 })
            .populate('sender', 'name fullName')
            .lean();
        const repId = ((_d = (_c = dispute.userId) === null || _c === void 0 ? void 0 : _c._id) === null || _d === void 0 ? void 0 : _d.toString()) || ((_e = dispute.userId) === null || _e === void 0 ? void 0 : _e.toString()) || '';
        const repName = ((_f = dispute.userId) === null || _f === void 0 ? void 0 : _f.fullName) || ((_g = dispute.userId) === null || _g === void 0 ? void 0 : _g.name) || 'Reporter';
        const reporterWithId = repId ? `${repName} (ID: ${repId})` : repName;
        const reqUserId = ((_j = (_h = dispute.reportedUser) === null || _h === void 0 ? void 0 : _h._id) === null || _j === void 0 ? void 0 : _j.toString()) || ((_k = dispute.reportedUser) === null || _k === void 0 ? void 0 : _k.toString()) || '';
        const reqName = ((_l = dispute.reportedUser) === null || _l === void 0 ? void 0 : _l.fullName) || ((_m = dispute.reportedUser) === null || _m === void 0 ? void 0 : _m.name) || 'Reported User';
        const reportedWithId = reqUserId ? `${reqName} (ID: ${reqUserId})` : reqName;
        return {
            chatId: chat._id.toString(),
            disputeId,
            reporterName: reporterWithId,
            reportedName: reportedWithId,
            messages: messages.map((m) => {
                var _a, _b, _c, _d, _e;
                const sId = ((_b = (_a = m.sender) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = m.sender) === null || _c === void 0 ? void 0 : _c.toString()) || '';
                const sName = ((_d = m.sender) === null || _d === void 0 ? void 0 : _d.fullName) || ((_e = m.sender) === null || _e === void 0 ? void 0 : _e.name) || 'User';
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
        };
    }
}
exports.dashboardService = new DashboardService();
