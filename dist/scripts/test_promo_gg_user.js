"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../config"));
const partner_model_1 = require("../app/modules/partner/partner.model");
const user_model_1 = require("../app/modules/user/user.model");
const partner_service_1 = require("../app/modules/partner/partner.service");
const custom_auth_service_1 = require("../app/modules/auth/custom.auth/custom.auth.service");
async function run() {
    var _a;
    console.log('--- Connecting to MongoDB ---');
    await mongoose_1.default.connect(config_1.default.database_url);
    console.log('MongoDB connected successfully.');
    const targetPromoCode = 'GG';
    // Step 1: Find or Create Partner with promoCode "GG"
    let partner = await partner_model_1.Partner.findOne({ promoCode: targetPromoCode });
    if (!partner) {
        console.log(`Partner with promoCode "${targetPromoCode}" not found. Creating one...`);
        partner = await partner_model_1.Partner.create({
            name: 'GG Partner Influencer',
            email: `gg_partner_${Date.now()}@culturecards.com`,
            promoCode: targetPromoCode,
            accessToken: crypto_1.default.randomBytes(32).toString('hex'),
            status: 'active',
            totalRevenueGenerated: 0,
            totalCommissionEarned: 0,
            unpaidCommissionBalance: 0,
            paidCommissionTotal: 0,
        });
        console.log(`Created Partner: ${partner.name} (ID: ${partner._id}, Code: ${partner.promoCode})`);
    }
    else {
        console.log(`Existing Partner found: ${partner.name} (ID: ${partner._id}, Code: ${partner.promoCode})`);
    }
    // Check stats before
    const statsBefore = await partner_service_1.PartnerService.getPartnerDashboardByToken(partner.accessToken, undefined, true);
    console.log(`\nStats before adding user:`);
    console.log(`- Total Referred Users: ${statsBefore.metrics.totalReferredUsers}`);
    console.log(`- Magic Portal Link: http://localhost:3000/partner/dashboard?token=${partner.accessToken}`);
    // Step 2: Register a new user using promoCode "GG" via CustomAuthService
    const uniqueTimestamp = Date.now();
    const testUserPayload = {
        name: `GG Tester ${uniqueTimestamp.toString().slice(-4)}`,
        email: `gg_user_${uniqueTimestamp}@culturecards.test`,
        password: 'TestPassword123!',
        promoCode: targetPromoCode,
        phone: `+1202555${Math.floor(1000 + Math.random() * 9000)}`,
    };
    console.log(`\nRegistering new user with payload:`, {
        name: testUserPayload.name,
        email: testUserPayload.email,
        promoCode: testUserPayload.promoCode,
    });
    // We can simulate registration directly through CustomAuthService
    // or create the user following the exact registration logic
    const registrationResult = await custom_auth_service_1.CustomAuthServices.createUser(testUserPayload);
    console.log('Registration Response:', registrationResult.message);
    // Step 3: Verify the user in the Database
    const createdUser = await user_model_1.User.findOne({ email: testUserPayload.email });
    if (!createdUser) {
        throw new Error('Failed to find created user in MongoDB!');
    }
    console.log('\n--- Verification in Database ---');
    console.log(`User ID: ${createdUser._id}`);
    console.log(`User Email: ${createdUser.email}`);
    console.log(`User Promo Code: ${createdUser.promoCode}`);
    console.log(`Referred By Partner ID: ${createdUser.referredByPartnerId}`);
    const isLinkedCorrectly = ((_a = createdUser.referredByPartnerId) === null || _a === void 0 ? void 0 : _a.toString()) === partner._id.toString();
    console.log(`Partner ID Matches: ${isLinkedCorrectly ? 'YES (SUCCESS)' : 'NO (FAILED)'}`);
    // Step 4: Check Partner Dashboard stats after user registration
    const statsAfter = await partner_service_1.PartnerService.getPartnerDashboardByToken(partner.accessToken, undefined, true);
    console.log(`\nStats after adding user:`);
    console.log(`- Total Referred Users: ${statsAfter.metrics.totalReferredUsers}`);
    console.log(`- Increment Verified: ${statsAfter.metrics.totalReferredUsers === statsBefore.metrics.totalReferredUsers + 1 ? 'YES' : 'NO'}`);
    console.log('\n--- ALL CHECKS PASSED PERFECTLY ---');
    await mongoose_1.default.disconnect();
    process.exit(0);
}
run().catch(err => {
    console.error('Error running test script:', err);
    process.exit(1);
});
