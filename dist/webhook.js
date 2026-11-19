"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = __importDefault(require("./config"));
const stripe_1 = __importDefault(require("./config/stripe"));
const webhook_service_1 = require("./app/modules/payment/webhook.service");
const webhook_service_2 = require("./app/modules/subscription/webhook.service");
const seller_service_1 = require("./app/modules/seller/seller.service");
const tradeSettlement_service_1 = require("./app/modules/trade/tradeSettlement.service");
const trade_service_1 = require("./app/modules/trade/trade.service");
const refund_service_1 = require("./app/modules/refund/refund.service");
const webhookApp = (0, express_1.default)();
webhookApp.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    var _a;
    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            res.status(400).json({ error: 'No Stripe signature' });
            return;
        }
        if (!config_1.default.stripe.webhookSecret) {
            res.status(500).json({ error: 'Webhook secret not configured' });
            return;
        }
        const rawBody = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(req.body, 'utf8');
        const cleanSecret = config_1.default.stripe.webhookSecret.trim();
        let event;
        console.log('🚀 Webhook hit! Signature:', sig);
        try {
            event = stripe_1.default.webhooks.constructEvent(rawBody, sig, cleanSecret);
            console.log('✅ Webhook Event Constructed:', event.type);
        }
        catch (err) {
            console.error('❌ Webhook Construction Error:', err.message);
            res.status(400).json({ error: `Webhook Error: ${err.message}` });
            return;
        }
        // Connect account lifecycle — keeps each seller's verification and
        // payout eligibility in step with Stripe without the app having to poll.
        if (event.type === 'account.updated' ||
            event.type === 'account.application.deauthorized') {
            const account = event.data.object;
            if (account === null || account === void 0 ? void 0 : account.id) {
                await seller_service_1.SellerServices.syncByAccountId(account.id).catch(err => console.error('[SellerConnect] account.updated sync failed:', err));
            }
        }
        // Chargebacks. On direct charges the dispute belongs to the seller's
        // connected account and Stripe takes the money from their balance, so
        // ARIES is recording what happened rather than paying for it.
        // `event.account` is the connected account the dispute was raised on.
        if (event.type.startsWith('charge.dispute.')) {
            try {
                await refund_service_1.RefundServices.recordDisputeFromWebhook(event.data.object, event.account);
            }
            catch (err) {
                console.error('[Dispute] Failed to record dispute:', err);
            }
        }
        // Trade settlement: a trade only swaps once both sides have paid, and
        // the second payment can land long after the first, so the swap is
        // driven from here rather than from the request that started it.
        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object;
            if (((_a = intent === null || intent === void 0 ? void 0 : intent.metadata) === null || _a === void 0 ? void 0 : _a.purchaseType) === 'trade_settlement' && intent.id) {
                try {
                    const outcome = await tradeSettlement_service_1.TradeSettlementServices.markPartyPaidByIntent(intent.id);
                    if (outcome === null || outcome === void 0 ? void 0 : outcome.settled) {
                        await trade_service_1.TradeServices.finalizeTradeSwap(outcome.tradeOfferId);
                    }
                }
                catch (err) {
                    console.error('[TradeSettlement] webhook handling failed:', err);
                }
            }
        }
        await Promise.allSettled([
            webhook_service_1.WebhookService.handleWebhook({
                body: rawBody,
                headers: {
                    'stripe-signature': sig,
                },
            }),
            webhook_service_2.webhookService.processWebhookEvent(event),
        ]);
        res.status(200).json({
            received: true,
            event: event.type,
            message: 'Webhook processed successfully',
        });
    }
    catch (error) {
        res.status(500).json({
            error: error.message,
            event: 'unknown',
        });
    }
});
exports.default = webhookApp;
