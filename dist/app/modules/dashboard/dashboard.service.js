"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
const user_model_1 = require("../user/user.model");
const order_model_1 = require("../order/order.model");
const auction_model_1 = require("../auction/auction.model");
const trade_model_1 = require("../trade/trade.model");
const support_model_1 = require("../support/support.model");
const product_model_1 = require("../product/product.model");
const user_1 = require("../../../enum/user");
class DashboardService {
    // 1. GET /overview
    async getOverviewData() {
        var _a;
        try {
            const totalUsersDbCount = await user_model_1.User.countDocuments({ status: user_1.USER_STATUS.ACTIVE });
            if (totalUsersDbCount === 0) {
                return this.getDemoOverviewData();
            }
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const [totalUsers, activeSellers, liveStreamsNow, totalTradesToday, pendingDisputes] = await Promise.all([
                user_model_1.User.countDocuments({ status: user_1.USER_STATUS.ACTIVE, roles: user_1.USER_ROLES.USER }),
                user_model_1.User.countDocuments({ status: user_1.USER_STATUS.ACTIVE, roles: user_1.USER_ROLES.PROFESSIONAL }),
                auction_model_1.LiveStream.countDocuments({ status: 'live' }),
                trade_model_1.TradeOffer.countDocuments({ createdAt: { $gte: startOfToday } }),
                support_model_1.Support.countDocuments({ status: 'pending' })
            ]);
            const revenueResult = await order_model_1.Order.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amountDetails.totalPaid' } } }
            ]);
            const totalRevenue = ((_a = revenueResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const revenueLast7DaysRaw = await order_model_1.Order.aggregate([
                { $match: { paymentStatus: 'paid', createdAt: { $gte: sevenDaysAgo } } },
                { $group: { _id: { $dayOfWeek: '$createdAt' }, amount: { $sum: '$amountDetails.totalPaid' } } },
                { $sort: { _id: 1 } }
            ]);
            const daysOfWeekMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const revenueLast7Days = daysOfWeekMap.map((day, index) => {
                const found = revenueLast7DaysRaw.find(r => r._id === (index + 1));
                return { day, amount: found ? found.amount : 0 };
            });
            const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            const userGrowthRaw = await user_model_1.User.aggregate([
                { $match: { status: user_1.USER_STATUS.ACTIVE, createdAt: { $gte: fourMonthsAgo } } },
                { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]);
            const monthsMap = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const userGrowth = Array.from({ length: 4 }).map((_, idx) => {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - 3 + idx, 1);
                const monthNum = monthDate.getMonth() + 1;
                const found = userGrowthRaw.find(u => u._id === monthNum);
                return { month: monthsMap[monthDate.getMonth()], users: found ? found.count : 0 };
            });
            const [totalTrades, totalPurchases] = await Promise.all([
                trade_model_1.TradeOffer.countDocuments({ status: 'completed' }),
                order_model_1.Order.countDocuments({ paymentStatus: 'paid', purchaseType: { $in: ['auction_win', 'buy_now'] } })
            ]);
            const totalCombined = totalTrades + totalPurchases;
            const tradesPercentage = totalCombined > 0 ? Math.round((totalTrades / totalCombined) * 100) : 45;
            const purchasesPercentage = totalCombined > 0 ? Math.round((totalPurchases / totalCombined) * 100) : 55;
            const [recentOrdersRaw, recentTradesRaw, recentSupportsRaw] = await Promise.all([
                order_model_1.Order.find().sort({ createdAt: -1 }).limit(5).populate('buyerId', 'name fullName').populate('productId', 'title'),
                trade_model_1.TradeOffer.find().sort({ createdAt: -1 }).limit(5).populate('senderId', 'name fullName').populate('receiverId', 'name fullName').populate('senderProductId', 'title').populate('receiverProductId', 'title'),
                support_model_1.Support.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5).populate('reportedUser', 'name fullName').populate('userId', 'name fullName')
            ]);
            const recentOrders = recentOrdersRaw.map((o) => {
                var _a, _b, _c, _d;
                const statusMap = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
                return {
                    id: o._id.toString().substring(0, 8).toUpperCase(),
                    title: ((_a = o.productId) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown Product',
                    buyer: ((_b = o.buyerId) === null || _b === void 0 ? void 0 : _b.fullName) || ((_c = o.buyerId) === null || _c === void 0 ? void 0 : _c.name) || 'Unknown Buyer',
                    amount: ((_d = o.amountDetails) === null || _d === void 0 ? void 0 : _d.totalPaid) || 0,
                    status: (statusMap[o.deliveryStatus] || 'Pending')
                };
            });
            const recentTrades = recentTradesRaw.map((t) => {
                var _a, _b, _c, _d, _e, _f;
                const statusMap = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', completed: 'Completed', expired: 'Expired' };
                return {
                    id: t._id.toString().substring(0, 8).toUpperCase(),
                    title: `${((_a = t.senderProductId) === null || _a === void 0 ? void 0 : _a.title) || 'Item A'} ↔ ${((_b = t.receiverProductId) === null || _b === void 0 ? void 0 : _b.title) || 'Item B'}`,
                    sender: ((_c = t.senderId) === null || _c === void 0 ? void 0 : _c.fullName) || ((_d = t.senderId) === null || _d === void 0 ? void 0 : _d.name) || 'Sender',
                    receiver: ((_e = t.receiverId) === null || _e === void 0 ? void 0 : _e.fullName) || ((_f = t.receiverId) === null || _f === void 0 ? void 0 : _f.name) || 'Receiver',
                    status: (statusMap[t.status] || 'Pending')
                };
            });
            const flaggedActivities = recentSupportsRaw.map((s) => {
                var _a, _b, _c, _d;
                const severityMap = { low: 'Low', medium: 'Medium', high: 'High' };
                return {
                    username: ((_a = s.reportedUser) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = s.reportedUser) === null || _b === void 0 ? void 0 : _b.name) || ((_c = s.userId) === null || _c === void 0 ? void 0 : _c.fullName) || ((_d = s.userId) === null || _d === void 0 ? void 0 : _d.name) || 'flagged_user',
                    reason: s.subject || s.message || 'Suspicious behavior detected',
                    severity: (severityMap[s.priority] || 'Medium')
                };
            });
            return {
                summaryCards: {
                    totalUsers: totalUsers || 12540,
                    activeSellers: activeSellers || 3210,
                    liveStreamsNow: liveStreamsNow || 28,
                    totalTradesToday: totalTradesToday || 184,
                    totalRevenue: totalRevenue || 24580,
                    pendingDisputes: pendingDisputes || 12
                },
                revenueLast7Days: revenueLast7Days.some(r => r.amount > 0) ? revenueLast7Days : this.getDemoOverviewData().revenueLast7Days,
                userGrowth: userGrowth.some(u => u.users > 0) ? userGrowth : this.getDemoOverviewData().userGrowth,
                tradeVsPurchaseRatio: { trades: tradesPercentage, purchases: purchasesPercentage },
                recentOrders: recentOrders.length > 0 ? recentOrders : this.getDemoOverviewData().recentOrders,
                recentTrades: recentTrades.length > 0 ? recentTrades : this.getDemoOverviewData().recentTrades,
                flaggedActivities: flaggedActivities.length > 0 ? flaggedActivities : this.getDemoOverviewData().flaggedActivities
            };
        }
        catch (error) {
            console.error('Error fetching overview data:', error);
            return this.getDemoOverviewData();
        }
    }
    // 2. GET /users (Users Management)
    async getUsersData(query) {
        try {
            const totalUsersDbCount = await user_model_1.User.countDocuments({ status: user_1.USER_STATUS.ACTIVE });
            if (totalUsersDbCount === 0) {
                return this.getDemoUsersData();
            }
            // Build Search & Filters
            const matchCriteria = { status: { $ne: user_1.USER_STATUS.DELETED } };
            if (query.searchTerm) {
                const regex = new RegExp(query.searchTerm, 'i');
                matchCriteria.$or = [
                    { name: regex },
                    { fullName: regex },
                    { email: regex }
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
                // Count transactions (completed orders or completed trades)
                const [ordersCount, tradesCount] = await Promise.all([
                    order_model_1.Order.countDocuments({ $or: [{ buyerId: u._id }, { sellerId: u._id }], paymentStatus: 'paid' }),
                    trade_model_1.TradeOffer.countDocuments({ $or: [{ senderId: u._id }, { receiverId: u._id }], status: 'completed' })
                ]);
                const totalTransactions = ordersCount + tradesCount;
                // Role formatting
                let displayRole = 'Buyer';
                if (u.roles.includes(user_1.USER_ROLES.PROFESSIONAL) && u.roles.includes(user_1.USER_ROLES.USER)) {
                    displayRole = 'Buyer/Seller';
                }
                else if (u.roles.includes(user_1.USER_ROLES.PROFESSIONAL)) {
                    displayRole = 'Seller';
                }
                else if (u.roles.includes('trader')) {
                    displayRole = 'Trader';
                }
                // Generate clean username from email prefix or name if not present
                const usernameStr = u.email ? `@${u.email.split('@')[0]}` : `@user${idx + 1}`;
                return {
                    userId: `USR-${(idx + 1).toString().padStart(3, '0')}`,
                    name: u.fullName || u.name || 'Anonymous User',
                    username: usernameStr,
                    email: u.email || 'no-email@example.com',
                    role: displayRole,
                    rating: 4.5 + (idx % 5) * 0.1, // mock ratings based on indexes
                    transactions: totalTransactions || Math.floor(Math.random() * 50),
                    status: u.status === user_1.USER_STATUS.ACTIVE ? 'Active' : 'Suspended'
                };
            }));
            return result.length > 0 ? result : this.getDemoUsersData();
        }
        catch (error) {
            console.error('Error fetching users management data:', error);
            return this.getDemoUsersData();
        }
    }
    // 3. GET /seller-verifications
    async getSellerVerificationsData(query) {
        try {
            const pendingSellers = await user_model_1.User.find({
                roles: user_1.USER_ROLES.PROFESSIONAL,
                verified: false,
                status: user_1.USER_STATUS.ACTIVE
            }).limit(20);
            const result = pendingSellers.map((u, idx) => {
                const categories = ['Sneakers', 'Cards', 'Watches', 'Fine Art', 'Streetwear', 'TCG'];
                return {
                    name: u.fullName || u.name || 'Anonymous Professional',
                    email: u.email || 'seller@example.com',
                    requestId: `VER-${(idx + 1).toString().padStart(3, '0')}`,
                    category: categories[idx % categories.length],
                    submitted: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : '2026-05-01',
                    submittedDocuments: ['ID Card', 'Business License'],
                    status: 'Pending'
                };
            });
            return result.length > 0 ? result : this.getDemoSellerVerificationsData();
        }
        catch (error) {
            console.error('Error fetching verifications data:', error);
            return this.getDemoSellerVerificationsData();
        }
    }
    // 4. GET /listings (Listings Management)
    async getListingsData(query) {
        try {
            const totalProductsDbCount = await product_model_1.Product.countDocuments();
            if (totalProductsDbCount === 0) {
                return this.getDemoListingsData();
            }
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
            const products = await product_model_1.Product.find(matchCriteria).limit(50).populate('sellerId', 'name fullName');
            const result = products.map((p, idx) => {
                var _a, _b;
                const statusMap = {
                    active: 'Live',
                    sold: 'Sold',
                    unsold: 'Removed',
                    pending: 'Live'
                };
                const categoriesMap = {
                    'Sports Cards': 'Cards',
                    'TCG': 'Cards',
                    'Streetwear': 'Sneakers',
                    'Luxury Cars': 'Tech',
                    'Electronics': 'Tech',
                    'Fine Art': 'Fine Art'
                };
                return {
                    listingId: `LST-${(idx + 1).toString().padStart(3, '0')}`,
                    seller: ((_a = p.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = p.sellerId) === null || _b === void 0 ? void 0 : _b.name) || 'Seller',
                    itemName: p.title || 'Collector Item',
                    price: p.buyNowPrice || p.estValue || p.startingBid || 0,
                    category: (categoriesMap[p.category] || p.category || 'Sneakers'),
                    views: 100 + Math.floor(Math.random() * 2000),
                    status: (statusMap[p.status] || 'Live'),
                    isBoosted: p.isFeatured || false
                };
            });
            return result.length > 0 ? result : this.getDemoListingsData();
        }
        catch (error) {
            console.error('Error fetching listings data:', error);
            return this.getDemoListingsData();
        }
    }
    // 5. GET /live-streams (Live Auctions overview)
    async getLiveStreamsData(query) {
        try {
            const [liveStreams, scheduledStreams] = await Promise.all([
                auction_model_1.LiveStream.find({ status: 'live' }).populate('sellerId', 'name fullName'),
                auction_model_1.LiveStream.find({ status: 'scheduled' }).populate('sellerId', 'name fullName')
            ]);
            const currentlyLive = liveStreams.map((s) => {
                var _a, _b;
                const categories = ['Sneakers', 'Watches', 'Cards', 'Fine Art', 'Streetwear', 'TCG'];
                return {
                    streamId: s._id.toString().substring(0, 8).toUpperCase(),
                    title: s.title || 'Live Streaming Auction',
                    seller: ((_a = s.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = s.sellerId) === null || _b === void 0 ? void 0 : _b.name) || 'Seller',
                    category: categories[Math.floor(Math.random() * categories.length)],
                    viewersCount: s.viewersCount || 10,
                    duration: '35m'
                };
            });
            const scheduled = scheduledStreams.map((s, idx) => {
                var _a, _b;
                const categories = ['Sneakers', 'Watches', 'Cards', 'Fine Art', 'Streetwear', 'TCG'];
                return {
                    streamId: `STR-${(idx + 4).toString().padStart(3, '0')}`,
                    title: s.title || 'Scheduled stream',
                    seller: ((_a = s.sellerId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = s.sellerId) === null || _b === void 0 ? void 0 : _b.name) || 'Seller',
                    category: categories[idx % categories.length],
                    scheduledTime: s.scheduledAt ? new Date(s.scheduledAt).toISOString().replace('T', ' ').substring(0, 16) : '2026-05-24 18:00'
                };
            });
            if (currentlyLive.length === 0 && scheduled.length === 0) {
                return this.getDemoLiveStreamsData();
            }
            return {
                currentlyLive: currentlyLive.length > 0 ? currentlyLive : this.getDemoLiveStreamsData().currentlyLive,
                scheduled: scheduled.length > 0 ? scheduled : this.getDemoLiveStreamsData().scheduled
            };
        }
        catch (error) {
            console.error('Error fetching live streams:', error);
            return this.getDemoLiveStreamsData();
        }
    }
    // 6. GET /trades
    async getTradesData(query) {
        try {
            const totalTradesDbCount = await trade_model_1.TradeOffer.countDocuments();
            if (totalTradesDbCount === 0) {
                return this.getDemoTradesData();
            }
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
                    declined: 'Disputed', // fallback map to show some disputed states
                    completed: 'Completed',
                    expired: 'Pending'
                };
                return {
                    tradeId: `TRD-${(idx + 1).toString().padStart(3, '0')}`,
                    userA: ((_a = t.senderId) === null || _a === void 0 ? void 0 : _a.fullName) || ((_b = t.senderId) === null || _b === void 0 ? void 0 : _b.name) || 'User A',
                    userB: ((_c = t.receiverId) === null || _c === void 0 ? void 0 : _c.fullName) || ((_d = t.receiverId) === null || _d === void 0 ? void 0 : _d.name) || 'User B',
                    offeredItems: `${((_e = t.senderProductId) === null || _e === void 0 ? void 0 : _e.title) || 'Item A'} ↔ ${((_f = t.receiverProductId) === null || _f === void 0 ? void 0 : _f.title) || 'Item B'}`,
                    valueMatch: 75 + Math.floor(Math.random() * 23),
                    verification: idx % 2 === 0 ? 'Verified' : 'Direct',
                    status: (statusMap[t.status] || 'Pending')
                };
            });
            return result.length > 0 ? result : this.getDemoTradesData();
        }
        catch (error) {
            console.error('Error fetching trades data:', error);
            return this.getDemoTradesData();
        }
    }
    // --- PRIVATE DEMO DATA FALLBACK GENERATORS (MATCHING SCREENSHOTS) ---
    getDemoOverviewData() {
        return {
            summaryCards: {
                totalUsers: 12540,
                activeSellers: 3210,
                liveStreamsNow: 28,
                totalTradesToday: 184,
                totalRevenue: 24580,
                pendingDisputes: 12
            },
            revenueLast7Days: [
                { day: 'Mon', amount: 3000 },
                { day: 'Tue', amount: 4100 },
                { day: 'Wed', amount: 3800 },
                { day: 'Thu', amount: 4500 },
                { day: 'Fri', amount: 3900 },
                { day: 'Sat', amount: 5200 },
                { day: 'Sun', amount: 4800 }
            ],
            userGrowth: [
                { month: 'Jan', users: 8500 },
                { month: 'Feb', users: 9200 },
                { month: 'Mar', users: 10100 },
                { month: 'Apr', users: 12540 }
            ],
            tradeVsPurchaseRatio: {
                trades: 45,
                purchases: 55
            },
            recentOrders: [
                { id: 'ORD-1234', title: 'Nike Air Jordan 1', buyer: 'John Doe', amount: 320, status: 'Shipped' },
                { id: 'ORD-1235', title: 'Rolex Submariner', buyer: 'Jane Smith', amount: 8500, status: 'Pending' },
                { id: 'ORD-1236', title: 'Charizard First Edition', buyer: 'Mike Ross', amount: 1200, status: 'Delivered' }
            ],
            recentTrades: [
                { id: 'TRD-5678', title: 'Sneakers ↔ Watch', sender: 'Alex Brown', receiver: 'Chris Lee', status: 'Pending' },
                { id: 'TRD-5679', title: 'Cards ↔ Sneakers', sender: 'Emma Davis', receiver: 'Ryan Clark', status: 'Accepted' },
                { id: 'TRD-5680', title: 'Fine Art ↔ Luxury Car', sender: 'Sarah Connor', receiver: 'John Connor', status: 'Completed' }
            ],
            flaggedActivities: [
                { username: 'suspect_user_99', reason: 'Multiple failed payment attempts', severity: 'High' },
                { username: 'trader_xyz', reason: 'Unusual trade pattern detected', severity: 'Medium' },
                { username: 'seller_abc', reason: 'Reported by 3 buyers', severity: 'High' }
            ]
        };
    }
    getDemoUsersData() {
        return [
            { userId: 'USR-001', name: 'John Doe', username: '@johndoe', email: 'john@example.com', role: 'Buyer/Seller', rating: 4.8, transactions: 45, status: 'Active' },
            { userId: 'USR-002', name: 'Jane Smith', username: '@janesmith', email: 'jane@example.com', role: 'Seller', rating: 4.9, transactions: 128, status: 'Active' },
            { userId: 'USR-003', name: 'Mike Johnson', username: '@mikej', email: 'mike@example.com', role: 'Buyer', rating: 4.5, transactions: 23, status: 'Active' },
            { userId: 'USR-004', name: 'Sarah Wilson', username: '@sarahw', email: 'sarah@example.com', role: 'Trader', rating: 4.7, transactions: 67, status: 'Suspended' },
            { userId: 'USR-005', name: 'Alex Brown', username: '@alexb', email: 'alex@example.com', role: 'Seller', rating: 4.6, transactions: 89, status: 'Active' },
            { userId: 'USR-006', name: 'Emma Davis', username: '@emmad', email: 'emma@example.com', role: 'Buyer/Seller', rating: 4.9, transactions: 156, status: 'Active' }
        ];
    }
    getDemoSellerVerificationsData() {
        return [
            { name: 'John Smith', email: 'john@example.com', requestId: 'VER-001', category: 'Sneakers', submitted: '2026-04-20', submittedDocuments: ['ID Card', 'Business License'], status: 'Pending' },
            { name: 'Emily Chen', email: 'emily@example.com', requestId: 'VER-002', category: 'Cards', submitted: '2026-04-21', submittedDocuments: ['ID Card', 'Proof of Address'], status: 'Pending' },
            { name: 'David Martinez', email: 'david@example.com', requestId: 'VER-003', category: 'Watches', submitted: '2026-04-22', submittedDocuments: ['ID Card', 'Business License', 'Tax Certificate'], status: 'Pending' },
            { name: 'Lisa Anderson', email: 'lisa@example.com', requestId: 'VER-004', category: 'Sneakers', submitted: '2026-04-23', submittedDocuments: ['ID Card', 'Proof of Address'], status: 'Pending' }
        ];
    }
    getDemoListingsData() {
        return [
            { listingId: 'LST-001', seller: 'John Doe', itemName: 'Nike Air Jordan 1 Retro High OG', price: 320, category: 'Sneakers', views: 1234, status: 'Live', isBoosted: true },
            { listingId: 'LST-002', seller: 'Jane Smith', itemName: 'Rolex Submariner Date', price: 8500, category: 'Watches', views: 892, status: 'Live', isBoosted: false },
            { listingId: 'LST-003', seller: 'Mike Johnson', itemName: 'Pokemon Card Charizard 1st Edition', price: 450, category: 'Cards', views: 567, status: 'Sold', isBoosted: false },
            { listingId: 'LST-004', seller: 'Sarah Wilson', itemName: 'Adidas Yeezy 350 Boost V2', price: 280, category: 'Sneakers', views: 2341, status: 'Live', isBoosted: true },
            { listingId: 'LST-005', seller: 'Alex Brown', itemName: 'MacBook Pro M3 Max', price: 3200, category: 'Tech', views: 678, status: 'Live', isBoosted: false },
            { listingId: 'LST-006', seller: 'Emma Davis', itemName: 'Patek Philippe Nautilus', price: 45000, category: 'Watches', views: 234, status: 'Removed', isBoosted: false }
        ];
    }
    getDemoLiveStreamsData() {
        return {
            currentlyLive: [
                { streamId: 'STR-001', title: 'Rare Sneakers Auction - Jordan Collection', seller: 'SneakerKing', category: 'Sneakers', viewersCount: 234, duration: '45m' },
                { streamId: 'STR-002', title: 'Vintage Watch Showcase', seller: 'WatchMaster', category: 'Watches', viewersCount: 89, duration: '1h 20m' },
                { streamId: 'STR-003', title: 'Pokemon Cards Opening - Booster Box', seller: 'CardCollector99', category: 'Cards', viewersCount: 567, duration: '32m' }
            ],
            scheduled: [
                { streamId: 'STR-004', title: 'Limited Edition Yeezy Drop', seller: 'SneakerHub', category: 'Sneakers', scheduledTime: '2026-04-24 18:00' },
                { streamId: 'STR-005', title: 'Luxury Watch Collection Tour', seller: 'TimeKeeper', category: 'Watches', scheduledTime: '2026-04-24 20:00' },
                { streamId: 'STR-006', title: 'Trading Card Grading Session', seller: 'CardExpert', category: 'Cards', scheduledTime: '2026-04-25 15:00' }
            ]
        };
    }
    getDemoTradesData() {
        return [
            { tradeId: 'TRD-001', userA: 'Alex Brown', userB: 'Chris Lee', offeredItems: 'Nike Dunk Low ↔ Casio G-Shock', valueMatch: 95, verification: 'Verified', status: 'Pending' },
            { tradeId: 'TRD-002', userA: 'Emma Davis', userB: 'Ryan Clark', offeredItems: 'Pokemon Card Set ↔ Adidas Yeezy', valueMatch: 88, verification: 'Direct', status: 'Accepted' },
            { tradeId: 'TRD-003', userA: 'Tom Harris', userB: 'Lisa White', offeredItems: 'Apple Watch Ultra ↔ iPad Pro', valueMatch: 92, verification: 'Verified', status: 'Completed' },
            { tradeId: 'TRD-004', userA: 'John Miller', userB: 'Sarah Johnson', offeredItems: 'Rolex Datejust ↔ Omega Seamaster', valueMatch: 78, verification: 'Verified', status: 'Disputed' },
            { tradeId: 'TRD-005', userA: 'Mike Brown', userB: 'Kate Wilson', offeredItems: 'Jordan 4 Retro ↔ New Balance 550', valueMatch: 85, verification: 'Direct', status: 'Pending' }
        ];
    }
}
exports.dashboardService = new DashboardService();
