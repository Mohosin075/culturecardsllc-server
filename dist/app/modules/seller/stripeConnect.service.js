"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeConnectService = exports.getAccountEarnings = exports.createLoginLink = exports.createOnboardingLink = exports.retrieveAccount = exports.createConnectedAccount = exports.mapAccountToState = void 0;
const http_status_codes_1 = require("http-status-codes");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const config_1 = __importDefault(require("../../../config"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
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
/** Shape Stripe's account object into the subset we persist. */
const mapAccountToState = (account) => {
    var _a, _b, _c;
    const requirements = account.requirements;
    return {
        accountId: account.id,
        detailsSubmitted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        disabledReason: (_a = requirements === null || requirements === void 0 ? void 0 : requirements.disabled_reason) !== null && _a !== void 0 ? _a : undefined,
        currentlyDue: (_b = requirements === null || requirements === void 0 ? void 0 : requirements.currently_due) !== null && _b !== void 0 ? _b : [],
        pastDue: (_c = requirements === null || requirements === void 0 ? void 0 : requirements.past_due) !== null && _c !== void 0 ? _c : [],
        lastSyncedAt: new Date(),
    };
};
exports.mapAccountToState = mapAccountToState;
const createConnectedAccount = async (params) => {
    requireStripe();
    return stripe_1.default.accounts.create({
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
            name: params.businessName || undefined,
            product_description: params.whatTheySell || undefined,
        },
        metadata: {
            areisUserId: params.userId,
            platform: 'ARIES',
        },
    });
};
exports.createConnectedAccount = createConnectedAccount;
const retrieveAccount = async (accountId) => {
    requireStripe();
    return stripe_1.default.accounts.retrieve(accountId);
};
exports.retrieveAccount = retrieveAccount;
/**
 * A one-time URL into Stripe's hosted onboarding. Links expire within minutes,
 * so a fresh one is minted every time the seller taps "continue".
 */
const createOnboardingLink = async (accountId) => {
    requireStripe();
    const accountLink = await stripe_1.default.accountLinks.create({
        account: accountId,
        refresh_url: config_1.default.seller.stripeRefreshUrl,
        return_url: config_1.default.seller.stripeReturnUrl,
        type: 'account_onboarding',
        collection_options: {
            // Collect everything Stripe will eventually need, so the seller is not
            // interrupted again the first time they hit a payout threshold.
            fields: 'eventually_due',
        },
    });
    return accountLink.url;
};
exports.createOnboardingLink = createOnboardingLink;
/**
 * Express dashboard link — lets an already-onboarded seller update their bank
 * details or see their payouts without us building any of those screens.
 */
const createLoginLink = async (accountId) => {
    requireStripe();
    const loginLink = await stripe_1.default.accounts.createLoginLink(accountId);
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
    const [balance, payouts] = await Promise.all([
        stripe_1.default.balance.retrieve({ stripeAccount: accountId }),
        stripe_1.default.payouts.list({ limit: 10 }, { stripeAccount: accountId }),
    ]);
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
