"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeConnectService = exports.getAccountEarnings = exports.createLoginLink = exports.createOnboardingLink = exports.retrieveAccount = exports.createConnectedAccount = exports.mapAccountToState = void 0;
const stripe_1 = __importDefault(require("stripe"));
const http_status_codes_1 = require("http-status-codes");
const stripe_2 = __importDefault(require("../../../config/stripe"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const logger_1 = require("../../../shared/logger");
/**
 * Everything that talks to Stripe Connect lives here.
 *
 * Account type: **Express**. Stripe hosts the identity / bank / tax form, which
 * is exactly what the client asked for ("Stripe handles identity verification,
 * banking information, required tax information and payment account setup").
 *
 * Both `card_payments` and `transfers` are requested so the platform can later
 * settle on either direct charges or destination charges — that decision is
 * still open with the client and this does not lock it in.
 */
const requireStripe = () => {
    if (!config_1.default.stripe.stripeSecretKey) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE, 'Stripe is not configured on this server.');
    }
};
const ONBOARDING_UNAVAILABLE = 'Seller onboarding is temporarily unavailable. Please try again later.';
/**
 * Run a Stripe call and turn any Stripe failure into an ApiError a seller can
 * read. Stripe's own message often describes *our* platform setup (for example
 * "You can only create new accounts if you've signed up for Connect"), which
 * means nothing to a seller, so the raw details go to the log only.
 */
const callStripe = async (action, request) => {
    var _a, _b, _c;
    try {
        return await request();
    }
    catch (error) {
        if (!(error instanceof stripe_1.default.errors.StripeError))
            throw error;
        logger_1.errorLogger.error(`[SellerConnect] Stripe ${action} failed: ${error.type} ` +
            `code=${(_a = error.code) !== null && _a !== void 0 ? _a : '-'} param=${(_b = error.param) !== null && _b !== void 0 ? _b : '-'} ` +
            `requestId=${(_c = error.requestId) !== null && _c !== void 0 ? _c : '-'} message=${error.message}`);
        switch (error.type) {
            // Stripe could not be reached or is struggling: worth a retry.
            case 'StripeRateLimitError':
            case 'StripeConnectionError':
            case 'StripeAPIError':
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE, 'Stripe is not responding right now. Please try again in a minute.');
            // A specific field was rejected (e.g. a malformed email). Stripe words
            // these for end users, so the seller can act on it.
            case 'StripeInvalidRequestError':
                if (error.param) {
                    throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, error.message);
                }
                // No field means the request itself is wrong for this platform —
                // Connect not enabled, wrong country, etc. Not the seller's fault.
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE, ONBOARDING_UNAVAILABLE);
            // Bad key, missing permission, and anything else: platform setup.
            default:
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.SERVICE_UNAVAILABLE, ONBOARDING_UNAVAILABLE);
        }
    }
};
/** Shape Stripe's account object into the subset we persist. */
const mapAccountToState = (account) => {
    var _a, _b, _c, _d;
    const requirements = account.requirements;
    return {
        accountId: account.id,
        detailsSubmitted: Boolean(account.details_submitted),
        pendingVerification: (_a = requirements === null || requirements === void 0 ? void 0 : requirements.pending_verification) !== null && _a !== void 0 ? _a : [],
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        disabledReason: (_b = requirements === null || requirements === void 0 ? void 0 : requirements.disabled_reason) !== null && _b !== void 0 ? _b : undefined,
        currentlyDue: (_c = requirements === null || requirements === void 0 ? void 0 : requirements.currently_due) !== null && _c !== void 0 ? _c : [],
        pastDue: (_d = requirements === null || requirements === void 0 ? void 0 : requirements.past_due) !== null && _d !== void 0 ? _d : [],
        lastSyncedAt: new Date(),
    };
};
exports.mapAccountToState = mapAccountToState;
const createConnectedAccount = async (params) => {
    requireStripe();
    return callStripe('account create', () => stripe_2.default.accounts.create({
        type: 'express',
        country: config_1.default.seller.connectCountry,
        email: params.email,
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
        business_profile: {
            // Collectibles / trading cards. 5945 = "Hobby, Toy and Game Shops".
            mcc: config_1.default.seller.connectMcc,
        },
        metadata: {
            areisUserId: params.userId,
            platform: 'ARIES',
        },
    }, { idempotencyKey: `seller-connect-${params.userId}` }));
};
exports.createConnectedAccount = createConnectedAccount;
const retrieveAccount = async (accountId) => {
    requireStripe();
    return callStripe('account retrieve', () => stripe_2.default.accounts.retrieve(accountId));
};
exports.retrieveAccount = retrieveAccount;
/**
 * A one-time URL into Stripe's hosted onboarding. Links expire within minutes,
 * so a fresh one is minted every time the seller taps "continue".
 */
const createOnboardingLink = async (accountId) => {
    requireStripe();
    const accountLink = await callStripe('onboarding link', () => stripe_2.default.accountLinks.create({
        account: accountId,
        refresh_url: config_1.default.seller.stripeRefreshUrl,
        return_url: config_1.default.seller.stripeReturnUrl,
        type: 'account_onboarding',
        collection_options: {
            // Collect everything Stripe will eventually need, so the seller is not
            // interrupted again the first time they hit a payout threshold.
            fields: 'eventually_due',
        },
    }));
    return accountLink.url;
};
exports.createOnboardingLink = createOnboardingLink;
/**
 * Express dashboard link — lets an already-onboarded seller update their bank
 * details or see their payouts without us building any of those screens.
 */
const createLoginLink = async (accountId) => {
    requireStripe();
    const loginLink = await callStripe('dashboard link', () => stripe_2.default.accounts.createLoginLink(accountId));
    return loginLink.url;
};
exports.createLoginLink = createLoginLink;
/**
 * A seller's real money, read from their connected account rather than
 * recomputed from orders — Stripe is the ledger, not the Order collection.
 */
const getAccountEarnings = async (accountId) => {
    var _a, _b, _c;
    requireStripe();
    const [balance, payouts] = await callStripe('earnings', () => Promise.all([
        stripe_2.default.balance.retrieve({ stripeAccount: accountId }),
        stripe_2.default.payouts.list({ limit: 10 }, { stripeAccount: accountId }),
    ]));
    const sum = (entries) => entries.reduce((total, entry) => total + entry.amount, 0) / 100;
    return {
        available: sum(balance.available || []),
        pending: sum(balance.pending || []),
        currency: ((_c = (_b = (_a = balance.available) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.currency) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || 'USD',
        recentPayouts: payouts.data.map(payout => ({
            id: payout.id,
            amount: payout.amount / 100,
            status: payout.status,
            arrivalDate: payout.arrival_date
                ? new Date(payout.arrival_date * 1000)
                : null,
        })),
    };
};
exports.getAccountEarnings = getAccountEarnings;
exports.StripeConnectService = {
    getAccountEarnings: exports.getAccountEarnings,
    mapAccountToState: exports.mapAccountToState,
    createConnectedAccount: exports.createConnectedAccount,
    retrieveAccount: exports.retrieveAccount,
    createOnboardingLink: exports.createOnboardingLink,
    createLoginLink: exports.createLoginLink,
};
