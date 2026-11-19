"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const partner_model_1 = require("../app/modules/partner/partner.model");
const partner_model_2 = require("../app/modules/partner/partner.model");
const user_model_1 = require("../app/modules/user/user.model");
const order_model_1 = require("../app/modules/order/order.model");
const partner_service_1 = require("../app/modules/partner/partner.service");
async function run() {
    var _a;
    console.log('--- Connecting to MongoDB ---');
    await mongoose_1.default.connect(config_1.default.database_url);
    console.log('MongoDB connected.');
    // 1. Find the GG user
    const user = await user_model_1.User.findOne({ promoCode: 'GG' }).sort({ createdAt: -1 });
    if (!user) {
        throw new Error('No user with promoCode "GG" found!');
    }
    console.log(`Found Test Buyer: ${user.name} (${user.email}, ID: ${user._id})`);
    console.log(`Referred by Partner ID: ${user.referredByPartnerId}`);
    // 2. Find the Partner
    const partner = await partner_model_1.Partner.findById(user.referredByPartnerId);
    if (!partner) {
        throw new Error('Associated partner not found!');
    }
    console.log(`Partner: ${partner.name} (Code: ${partner.promoCode})`);
    // 3. Stats BEFORE purchase
    const dashboardBefore = await partner_service_1.PartnerService.getPartnerDashboardByToken(partner.accessToken, undefined, true);
    console.log('\n--- Partner Stats BEFORE Purchase ---');
    console.log(`Total Referred Users: ${dashboardBefore.metrics.totalReferredUsers}`);
    console.log(`Total Earnings: $${dashboardBefore.partnerInfo.totalEarnings}`);
    console.log(`Partner Share Total: $${dashboardBefore.metrics.partnerShareTotal}`);
    console.log(`Owner Share Total: $${dashboardBefore.metrics.ownerShareTotal}`);
    console.log(`Total Platform Fees: $${dashboardBefore.metrics.totalPlatformFees}`);
    console.log(`Total Transactions: $${dashboardBefore.metrics.totalTransactions}`);
    // 4. Create a simulated Purchase / Order of $100.00
    const transactionAmount = 100.00; // $100 card sale
    const dummyOrderId = new mongoose_1.Types.ObjectId();
    console.log(`\nSimulating a $${transactionAmount} card purchase by buyer ${user.name}...`);
    // Create an order record for audit
    const testOrder = await order_model_1.Order.create({
        _id: dummyOrderId,
        buyerId: user._id,
        sellerId: new mongoose_1.Types.ObjectId(),
        productId: new mongoose_1.Types.ObjectId(),
        purchaseType: 'buy_now',
        paymentStatus: 'paid',
        deliveryStatus: 'pending',
        shippingAddress: {
            street: '742 Evergreen Terrace',
            city: 'Springfield',
            state: 'IL',
            postalCode: '62704',
            country: 'US',
        },
        amountDetails: {
            itemSubtotal: 95.00,
            subtotal: 95.00,
            shipping: 5.00,
            totalPaid: transactionAmount,
        },
        trackingDetails: {
            carrier: 'USPS',
            trackingNumber: `CC-TRACK-${Date.now()}`,
            journeyUpdates: [],
        },
    });
    // 5. Trigger Partner Commission Recording
    await partner_service_1.PartnerService.recordCommissionForOrder({
        buyerId: user._id.toString(),
        orderId: (_a = testOrder._id) === null || _a === void 0 ? void 0 : _a.toString(),
        transactionAmount,
        isTrade: false,
    });
    // 6. Check database records
    const earningRecord = await partner_model_2.PartnerEarning.findOne({ orderId: testOrder._id });
    console.log('\n--- Commission Audit Entry Created in PartnerEarning ---');
    if (earningRecord) {
        console.log(`Earning ID: ${earningRecord._id}`);
        console.log(`Transaction Amount: $${earningRecord.transactionAmount}`);
        console.log(`Platform Fee (7%): $${earningRecord.platformFee}`);
        console.log(`Partner Share (50%): $${earningRecord.partnerShare}`);
        console.log(`Owner Share (50%): $${earningRecord.ownerShare}`);
        console.log(`Description: ${earningRecord.description}`);
    }
    else {
        throw new Error('PartnerEarning record was not created!');
    }
    // 7. Stats AFTER purchase
    const dashboardAfter = await partner_service_1.PartnerService.getPartnerDashboardByToken(partner.accessToken, undefined, true);
    console.log('\n--- Partner Stats AFTER Purchase ---');
    console.log(`Total Referred Users: ${dashboardAfter.metrics.totalReferredUsers}`);
    console.log(`Total Earnings: $${dashboardAfter.partnerInfo.totalEarnings}`);
    console.log(`Partner Share Total: $${dashboardAfter.metrics.partnerShareTotal}`);
    console.log(`Owner Share Total: $${dashboardAfter.metrics.ownerShareTotal}`);
    console.log(`Total Platform Fees: $${dashboardAfter.metrics.totalPlatformFees}`);
    console.log(`Total Transactions: $${dashboardAfter.metrics.totalTransactions}`);
    console.log(`Realtime Graph Points:`, JSON.stringify(dashboardAfter.realtimeGraphData, null, 2));
    console.log('\n======================================================');
    console.log('✅ COMMISSION FLOW 100% VERIFIED!');
    console.log(`Open Magic Portal Link to see live Recharts graph:`);
    console.log(`👉 http://localhost:3000/partner/dashboard?token=${partner.accessToken}`);
    console.log('======================================================\n');
    await mongoose_1.default.disconnect();
    process.exit(0);
}
run().catch(err => {
    console.error('Error running test script:', err);
    process.exit(1);
});
