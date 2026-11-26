"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerServices = void 0;
const server_1 = require("../../../server");
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enum/user");
const user_model_1 = require("../user/user.model");
const auction_model_1 = require("../auction/auction.model");
const product_model_1 = require("../product/product.model");
const seller_model_1 = require("./seller.model");
const stripeConnect_service_1 = require("./stripeConnect.service");
const EMPTY_STRIPE_STATE = {
    detailsSubmitted: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    currentlyDue: [],
    pastDue: [],
};
/**
 * Stripe reports requirements as dotted keys (`individual.verification.document`).
 * Turn them into something a seller can read.
 */
const humanizeRequirement = (requirement) => {
    const map = {
        'individual.verification.document': 'Government ID photo',
        'individual.verification.additional_document': 'Additional ID document',
        'individual.id_number': 'Social Security Number',
        'individual.ssn_last_4': 'Last 4 digits of your SSN',
        'individual.dob.day': 'Date of birth',
        'individual.dob.month': 'Date of birth',
        'individual.dob.year': 'Date of birth',
        'individual.address.line1': 'Home address',
        'individual.first_name': 'First name',
        'individual.last_name': 'Last name',
        'individual.email': 'Email address',
        'individual.phone': 'Phone number',
        external_account: 'Bank account for payouts',
        'business_profile.url': 'Business website',
        'business_profile.mcc': 'Business category',
        'company.tax_id': 'Business tax ID (EIN)',
        'tos_acceptance.date': 'Stripe terms of service',
        'tos_acceptance.ip': 'Stripe terms of service',
    };
    if (map[requirement])
        return map[requirement];
    // Fall back to a readable version of the raw key.
    return requirement
        .split('.')
        .pop()
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
};
const dedupe = (values) => Array.from(new Set(values));
/** Collapse an application document into the state the clients consume. */
const buildOnboardingState = (application) => {
    if (!application) {
        return {
            hasApplied: false,
            status: 'not_started',
            applicationComplete: false,
            stripeOnboardingComplete: false,
            stripePayoutReady: false,
            adminApproved: false,
            canSell: false,
            stripe: { ...EMPTY_STRIPE_STATE },
            outstandingRequirements: [],
        };
    }
    const stripe = application.stripe || { ...EMPTY_STRIPE_STATE };
    const stripePayoutReady = Boolean(stripe.chargesEnabled) && Boolean(stripe.payoutsEnabled);
    const adminApproved = application.status === 'approved';
    return {
        hasApplied: true,
        status: application.status,
        whatTheySell: application.whatTheySell,
        applicationComplete: true,
        stripeOnboardingComplete: Boolean(stripe.detailsSubmitted),
        stripePayoutReady,
        adminApproved,
        canSell: adminApproved &&
            (!config_1.default.seller.requireStripeOnboarding ||
                (Boolean(stripe.detailsSubmitted) && stripePayoutReady)),
        stripe,
        rejectionReason: application.rejectionReason,
        outstandingRequirements: dedupe([
            ...(stripe.pastDue || []),
            ...(stripe.currentlyDue || []),
        ]).map(humanizeRequirement),
        submittedAt: application.submittedAt,
        reviewedAt: application.reviewedAt,
        accessRevokedAt: application.accessRevokedAt,
    };
};
/**
 * Pull the live account state from Stripe and persist it. Also advances the
 * application from `stripe_pending` to `pending_approval` the moment Stripe
 * says the seller finished the hosted form — step 3 of the client's flow.
 */
const syncApplicationWithStripe = async (application) => {
    var _a;
    if (!((_a = application.stripe) === null || _a === void 0 ? void 0 : _a.accountId))
        return application;
    try {
        const account = await stripeConnect_service_1.StripeConnectService.retrieveAccount(application.stripe.accountId);
        application.stripe = stripeConnect_service_1.StripeConnectService.mapAccountToState(account);
        // Stripe form finished -> hand over to the ARIES admin queue.
        if (application.stripe.detailsSubmitted &&
            application.status === 'stripe_pending') {
            application.status = 'pending_approval';
        }
        await application.save();
        await user_model_1.User.findByIdAndUpdate(application.userId, {
            $set: {
                stripeConnectedAccountId: application.stripe.accountId,
                isStripeConnected: Boolean(application.stripe.chargesEnabled && application.stripe.payoutsEnabled),
            },
        });
    }
    catch (error) {
        // A Stripe outage must not break the seller's status screen; serve the
        // last known state instead.
        console.error('[SellerConnect] Failed to sync Stripe account:', error);
    }
    return application;
};
// ────────────────────────────────────────────────────────────────────────────
// 1. Seller application  +  2. Stripe onboarding
// ────────────────────────────────────────────────────────────────────────────
const applyAsSeller = async (user, payload, ipAddress) => {
    var _a, _b, _c;
    const userData = await user_model_1.User.findById(user.userId);
    if (!userData) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    let application = await seller_model_1.SellerApplication.findOne({ userId: user.userId });
    if ((application === null || application === void 0 ? void 0 : application.status) === 'approved') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'You are already an approved seller.');
    }
    if (application === null || application === void 0 ? void 0 : application.accessRevokedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'ARIES can restore seller access using your existing application. Contact support for help.');
    }
    // Talk to Stripe before touching the database. If Stripe refuses (outage,
    // platform not set up for Connect, a bad field) nothing is saved, so the
    // admin queue never shows an application with no Stripe account behind it.
    // On a re-apply the existing connected account is reused.
    let stripeState = application === null || application === void 0 ? void 0 : application.stripe;
    if (!(stripeState === null || stripeState === void 0 ? void 0 : stripeState.accountId)) {
        const account = await stripeConnect_service_1.StripeConnectService.createConnectedAccount({
            userId: user.userId.toString(),
            email: userData.email,
        });
        stripeState = stripeConnect_service_1.StripeConnectService.mapAccountToState(account);
    }
    const acceptance = {
        sellerPolicy: true,
        termsAndConditions: true,
        marketplaceRules: true,
        acceptedAt: new Date(),
        ipAddress,
    };
    if (!application) {
        const userId = new mongoose_1.Types.ObjectId(user.userId);
        application = await seller_model_1.SellerApplication.findOneAndUpdate({ userId }, {
            $setOnInsert: {
                whatTheySell: payload.whatTheySell,
                categories: (_a = payload.categories) === null || _a === void 0 ? void 0 : _a.map(id => new mongoose_1.Types.ObjectId(id)),
                businessName: payload.businessName,
                policyAcceptance: acceptance,
                status: 'stripe_pending',
                stripe: stripeState,
                submittedAt: new Date(),
            },
        }, { upsert: true, new: true, runValidators: true });
    }
    else {
        // Re-applying after a rejection, or editing before Stripe is finished.
        application.whatTheySell = payload.whatTheySell;
        application.categories = (_b = payload.categories) === null || _b === void 0 ? void 0 : _b.map(id => new mongoose_1.Types.ObjectId(id));
        application.businessName = payload.businessName;
        application.policyAcceptance = acceptance;
        application.stripe = stripeState;
        application.submittedAt = new Date();
        if (application.status === 'rejected') {
            application.status = 'stripe_pending';
            application.rejectionReason = undefined;
            application.reviewedAt = undefined;
            application.accessRevokedAt = undefined;
            application.reviewedBy = undefined;
        }
        await application.save();
    }
    const accountId = (_c = application === null || application === void 0 ? void 0 : application.stripe) === null || _c === void 0 ? void 0 : _c.accountId;
    if (!accountId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Stripe account was not saved.');
    }
    if (userData.stripeConnectedAccountId !== accountId) {
        userData.stripeConnectedAccountId = accountId;
        await userData.save();
    }
    const onboardingUrl = await stripeConnect_service_1.StripeConnectService.createOnboardingLink(accountId);
    return {
        onboardingUrl,
        state: buildOnboardingState(application),
    };
};
/** Mint a fresh hosted-onboarding link (the previous one expires quickly). */
const getOnboardingLink = async (user) => {
    var _a;
    const application = await seller_model_1.SellerApplication.findOne({ userId: user.userId });
    if (!application) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Submit your seller application first.');
    }
    if (!((_a = application.stripe) === null || _a === void 0 ? void 0 : _a.accountId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No Stripe account is attached to this application yet.');
    }
    const onboardingUrl = await stripeConnect_service_1.StripeConnectService.createOnboardingLink(application.stripe.accountId);
    return { onboardingUrl };
};
/** Express dashboard, for a seller who wants to change bank details later. */
const getStripeDashboardLink = async (user) => {
    var _a;
    const application = await seller_model_1.SellerApplication.findOne({ userId: user.userId });
    if (!((_a = application === null || application === void 0 ? void 0 : application.stripe) === null || _a === void 0 ? void 0 : _a.accountId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'No Stripe account found.');
    }
    if (!application.stripe.detailsSubmitted) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Finish Stripe onboarding before opening the Stripe dashboard.');
    }
    const url = await stripeConnect_service_1.StripeConnectService.createLoginLink(application.stripe.accountId);
    return { url };
};
// ────────────────────────────────────────────────────────────────────────────
// 3. Return to ARIES — status for the app
// ────────────────────────────────────────────────────────────────────────────
const getMyOnboardingState = async (user, options = {}) => {
    let application = await seller_model_1.SellerApplication.findOne({ userId: user.userId });
    if (application && options.refresh !== false) {
        application = (await syncApplicationWithStripe(application));
    }
    return buildOnboardingState(application);
};
/** Called by the `account.updated` webhook. */
const syncByAccountId = async (accountId) => {
    const application = await seller_model_1.SellerApplication.findOne({
        'stripe.accountId': accountId,
    });
    if (!application)
        return;
    await syncApplicationWithStripe(application);
    server_1.io === null || server_1.io === void 0 ? void 0 : server_1.io.to(String(application.userId)).emit('seller-onboarding-updated');
};
/**
 * The seller's own earnings, straight from their Stripe balance. ARIES's 6.5%
 * has already been removed as the application fee and Stripe's processing fee
 * has already been deducted, so these are the figures the seller will
 * actually be paid.
 */
const getMyEarnings = async (user) => {
    var _a;
    const application = await seller_model_1.SellerApplication.findOne({ userId: user.userId });
    if (!((_a = application === null || application === void 0 ? void 0 : application.stripe) === null || _a === void 0 ? void 0 : _a.accountId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Connect your Stripe account to see your earnings.');
    }
    const earnings = await stripeConnect_service_1.StripeConnectService.getAccountEarnings(application.stripe.accountId);
    return {
        ...earnings,
        payoutsEnabled: Boolean(application.stripe.payoutsEnabled),
    };
};
// ────────────────────────────────────────────────────────────────────────────
// 4. Admin review
// ────────────────────────────────────────────────────────────────────────────
const listApplicationsForAdmin = async (query) => {
    const filter = {};
    if (query.userId)
        filter.userId = query.userId;
    if (query.status) {
        filter.status = query.status;
    }
    else if (!query.userId) {
        // The review queue: everyone who is not already approved.
        filter.status = { $in: ['stripe_pending', 'pending_approval', 'rejected'] };
    }
    const applications = await seller_model_1.SellerApplication.find(filter)
        .populate('userId', 'name fullName email profile createdAt')
        .populate('categories', 'name')
        .sort({ submittedAt: -1 })
        .limit(Number(query.limit) || 50);
    return applications.map((app) => {
        var _a, _b;
        const seller = app.userId || {};
        const stripe = app.stripe || EMPTY_STRIPE_STATE;
        return {
            id: ((_a = seller._id) === null || _a === void 0 ? void 0 : _a.toString()) || '',
            applicationId: app._id.toString(),
            name: seller.fullName || seller.name || 'Unnamed seller',
            email: seller.email || '',
            profile: seller.profile,
            requestId: `VER-${app._id.toString().slice(-6).toUpperCase()}`,
            whatTheySell: app.whatTheySell,
            businessName: app.businessName,
            category: ((_b = app.categories) === null || _b === void 0 ? void 0 : _b.map((c) => c.name).join(', ')) || app.whatTheySell,
            submitted: app.submittedAt
                ? new Date(app.submittedAt).toISOString().split('T')[0]
                : '',
            status: app.status,
            policyAcceptance: app.policyAcceptance,
            stripe: {
                connected: Boolean(stripe.accountId),
                accountId: stripe.accountId,
                detailsSubmitted: stripe.detailsSubmitted,
                pendingVerification: dedupe(stripe.pendingVerification || []).map(humanizeRequirement),
                chargesEnabled: stripe.chargesEnabled,
                payoutsEnabled: stripe.payoutsEnabled,
                disabledReason: stripe.disabledReason,
                outstandingRequirements: dedupe([
                    ...(stripe.pastDue || []),
                    ...(stripe.currentlyDue || []),
                ]).map(humanizeRequirement),
                lastSyncedAt: stripe.lastSyncedAt,
            },
            payoutEligible: Boolean(stripe.chargesEnabled && stripe.payoutsEnabled),
            rejectionReason: app.rejectionReason,
            reviewedAt: app.reviewedAt,
            accessRevokedAt: app.accessRevokedAt,
        };
    });
};
const approveApplication = async (userId, adminId) => {
    var _a;
    const application = await seller_model_1.SellerApplication.findOne({ userId });
    if (!application) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'No seller application found for this user.');
    }
    const restoringAccess = Boolean(application.accessRevokedAt);
    const user = await user_model_1.User.findById(userId);
    if (!user)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    await syncApplicationWithStripe(application);
    if (!restoringAccess &&
        config_1.default.seller.requireStripeOnboarding &&
        !((_a = application.stripe) === null || _a === void 0 ? void 0 : _a.detailsSubmitted)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This seller has not finished Stripe onboarding yet, so they cannot be approved.');
    }
    application.status = 'approved';
    application.reviewedAt = new Date();
    application.reviewedBy = new mongoose_1.Types.ObjectId(adminId);
    application.rejectionReason = undefined;
    application.accessRevokedAt = undefined;
    await application.save();
    if (!user.roles.includes(user_1.USER_ROLES.SELLER)) {
        user.roles.push(user_1.USER_ROLES.SELLER);
    }
    user.sellerVerified = true;
    if (restoringAccess)
        user.activeRole = user_1.USER_ROLES.SELLER;
    await user.save();
    server_1.io === null || server_1.io === void 0 ? void 0 : server_1.io.to(userId).emit('seller-onboarding-updated');
    return buildOnboardingState(application);
};
const removeSellerAccess = async (userId, adminId, reason) => {
    if (!mongoose_1.Types.ObjectId.isValid(userId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid user ID.');
    }
    const user = await user_model_1.User.findById(userId);
    if (!user)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found.');
    if (user.roles.some(role => role === user_1.USER_ROLES.ADMIN || role === user_1.USER_ROLES.SUPER_ADMIN)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Admin accounts cannot be changed to buyer-only.');
    }
    await user_model_1.User.updateOne({ _id: userId }, { $set: { roles: [user_1.USER_ROLES.BUYER], activeRole: user_1.USER_ROLES.BUYER, sellerVerified: false } });
    const reviewedAt = new Date();
    await seller_model_1.SellerApplication.updateOne({ userId, status: { $ne: 'rejected' } }, { $set: { status: 'rejected', reviewedAt, reviewedBy: adminId, rejectionReason: reason, accessRevokedAt: reviewedAt } });
    await product_model_1.Product.updateMany({ sellerId: userId, status: 'active', isTradeOnly: { $ne: true } }, { $set: { status: 'pending' } });
    const streams = await auction_model_1.LiveStream.find({
        sellerId: userId,
        status: { $in: ['live', 'scheduled'] },
    }).select('_id');
    const streamIds = streams.map(stream => stream._id);
    await auction_model_1.LiveStream.updateMany({ _id: { $in: streamIds }, status: { $in: ['live', 'scheduled'] } }, { $set: { status: 'ended', endedAt: reviewedAt } });
    for (const streamId of streamIds) {
        server_1.io === null || server_1.io === void 0 ? void 0 : server_1.io.to(`stream:${streamId}`).to(userId).emit('stream-ended', {
            streamId: String(streamId),
            reason: 'seller_access_removed',
        });
    }
    server_1.io === null || server_1.io === void 0 ? void 0 : server_1.io.to(userId).emit('seller-onboarding-updated');
};
const rejectApplication = async (userId, adminId, reason) => {
    const application = await seller_model_1.SellerApplication.findOne({ userId });
    if (!application) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'No seller application found for this user.');
    }
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = new mongoose_1.Types.ObjectId(adminId);
    application.rejectionReason = reason;
    await application.save();
    const user = await user_model_1.User.findById(userId);
    if (user) {
        user.sellerVerified = false;
        user.roles = user.roles.filter(role => role !== user_1.USER_ROLES.SELLER);
        await user.save();
    }
    server_1.io === null || server_1.io === void 0 ? void 0 : server_1.io.to(userId).emit('seller-onboarding-updated');
    return buildOnboardingState(application);
};
// ────────────────────────────────────────────────────────────────────────────
// 5. Seller activation gate
// ────────────────────────────────────────────────────────────────────────────
/**
 * Section 5 of the client's spec. A seller may list products or go live only
 * when ARIES approved them **and** Stripe will let them take money.
 *
 * Throws a 403 describing the step that is still missing.
 */
const assertSellerCanSell = async (userId) => {
    var _a;
    const user = await user_model_1.User.findById(userId).select('sellerVerified');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Seller not found');
    }
    if (!user.sellerVerified) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Your seller application is still under review by ARIES.');
    }
    if (!config_1.default.seller.requireStripeOnboarding)
        return;
    const application = await seller_model_1.SellerApplication.findOne({ userId });
    // Grandfathering. Sellers approved before Connect existed have no
    // application at all, and blocking them the moment this ships would take
    // every existing seller off the platform. They keep working until they are
    // migrated; anyone who has started an application is held to the full rule.
    if (!application)
        return;
    if (!((_a = application.stripe) === null || _a === void 0 ? void 0 : _a.accountId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Connect your Stripe account before listing items or going live.');
    }
    if (!application.stripe.detailsSubmitted) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'Finish your Stripe verification before listing items or going live.');
    }
    if (!application.stripe.chargesEnabled || !application.stripe.payoutsEnabled) {
        const missing = dedupe([
            ...(application.stripe.pastDue || []),
            ...(application.stripe.currentlyDue || []),
        ])
            .map(humanizeRequirement)
            .slice(0, 3);
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, missing.length
            ? `Stripe still needs: ${missing.join(', ')}. Finish verification to start selling.`
            : 'Stripe has not cleared your account for payments yet.');
    }
};
exports.SellerServices = {
    applyAsSeller,
    getOnboardingLink,
    getStripeDashboardLink,
    getMyOnboardingState,
    getMyEarnings,
    syncByAccountId,
    listApplicationsForAdmin,
    approveApplication,
    rejectApplication,
    removeSellerAccess,
    assertSellerCanSell,
    buildOnboardingState,
};
