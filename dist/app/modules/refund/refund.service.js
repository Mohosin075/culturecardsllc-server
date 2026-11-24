"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const order_model_1 = require("../order/order.model");
const marketplaceCharge_1 = require("../payment/marketplaceCharge");
const payment_model_1 = require("../payment/payment.model");
const product_model_1 = require("../product/product.model");
const refund_model_1 = require("./refund.model");
/** Stripe only accepts its own small set of reason codes. */
const toStripeReason = (reason) => {
    switch (reason) {
        case 'other':
            return 'requested_by_customer';
        default:
            return 'requested_by_customer';
    }
};
// ────────────────────────────────────────────────────────────────────────────
// Buyer side
// ────────────────────────────────────────────────────────────────────────────
const createRefundRequest = async (user, payload) => {
    var _a, _b;
    if (!mongoose_1.Types.ObjectId.isValid(payload.orderId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid order id.');
    }
    const order = await order_model_1.Order.findById(payload.orderId);
    if (!order) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Order not found.');
    }
    if (order.buyerId.toString() !== user.userId.toString()) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only request a refund for your own order.');
    }
    if (order.paymentStatus !== 'paid') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, order.paymentStatus === 'refunded'
            ? 'This order has already been refunded.'
            : 'This order has not been paid, so there is nothing to refund.');
    }
    const existing = await refund_model_1.RefundRequest.findOne({
        orderId: order._id,
        status: 'pending',
    });
    if (existing) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'A refund request for this order is already being reviewed.');
    }
    const orderTotal = Number(((_a = order.amountDetails) === null || _a === void 0 ? void 0 : _a.totalPaid) || 0);
    const requested = Number((_b = payload.requestedAmount) !== null && _b !== void 0 ? _b : orderTotal);
    if (requested <= 0 || requested > orderTotal + 0.005) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Refund amount must be between $0 and the order total of $${orderTotal.toFixed(2)}.`);
    }
    return refund_model_1.RefundRequest.create({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        reason: payload.reason,
        details: payload.details,
        evidenceUrls: payload.evidenceUrls || [],
        requestedAmount: requested,
        status: 'pending',
    });
};
/** The buyer's own requests, newest first. */
const getMyRefundRequests = async (user) => refund_model_1.RefundRequest.find({ buyerId: user.userId })
    .populate('orderId', 'amountDetails deliveryStatus productId')
    .sort({ createdAt: -1 });
/** A seller sees refunds raised against their own sales. */
const getRefundRequestsForSeller = async (user) => refund_model_1.RefundRequest.find({ sellerId: user.userId })
    .populate('orderId', 'amountDetails deliveryStatus productId')
    .populate('buyerId', 'name fullName email profile')
    .sort({ createdAt: -1 });
// ────────────────────────────────────────────────────────────────────────────
// Admin side
// ────────────────────────────────────────────────────────────────────────────
const listRefundRequestsForAdmin = async (query) => {
    const filter = {};
    if (query.status)
        filter.status = query.status;
    const requests = await refund_model_1.RefundRequest.find(filter)
        .populate('buyerId', 'name fullName email profile')
        .populate('sellerId', 'name fullName email profile')
        .populate('orderId', 'amountDetails deliveryStatus paymentIntentId')
        .sort({ createdAt: -1 })
        .limit(Number(query.limit) || 100);
    return requests.map((r) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        return ({
            id: r._id.toString(),
            orderId: ((_b = (_a = r.orderId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = r.orderId) === null || _c === void 0 ? void 0 : _c.toString()),
            buyer: {
                id: (_e = (_d = r.buyerId) === null || _d === void 0 ? void 0 : _d._id) === null || _e === void 0 ? void 0 : _e.toString(),
                name: ((_f = r.buyerId) === null || _f === void 0 ? void 0 : _f.fullName) || ((_g = r.buyerId) === null || _g === void 0 ? void 0 : _g.name) || 'Buyer',
                email: (_h = r.buyerId) === null || _h === void 0 ? void 0 : _h.email,
            },
            seller: {
                id: (_k = (_j = r.sellerId) === null || _j === void 0 ? void 0 : _j._id) === null || _k === void 0 ? void 0 : _k.toString(),
                name: ((_l = r.sellerId) === null || _l === void 0 ? void 0 : _l.fullName) || ((_m = r.sellerId) === null || _m === void 0 ? void 0 : _m.name) || 'Seller',
                email: (_o = r.sellerId) === null || _o === void 0 ? void 0 : _o.email,
            },
            reason: r.reason,
            details: r.details,
            evidenceUrls: r.evidenceUrls || [],
            requestedAmount: r.requestedAmount,
            orderTotal: (_r = (_q = (_p = r.orderId) === null || _p === void 0 ? void 0 : _p.amountDetails) === null || _q === void 0 ? void 0 : _q.totalPaid) !== null && _r !== void 0 ? _r : null,
            deliveryStatus: (_t = (_s = r.orderId) === null || _s === void 0 ? void 0 : _s.deliveryStatus) !== null && _t !== void 0 ? _t : null,
            status: r.status,
            decisionNote: r.decisionNote,
            refundedAmount: r.refundedAmount,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
        });
    });
};
/**
 * Approve a refund: reverse the charge on whichever account it was made on.
 *
 * On a marketplace sale that is the seller's connected account, so the money
 * comes out of the seller's balance — exactly what the spec asks. ARIES's
 * application fee is handed back too on a full refund, so a reversed sale
 * earns the platform nothing; on a partial refund the fee is kept, since the
 * sale did partly happen.
 */
const approveRefundRequest = async (requestId, adminId, options = {}) => {
    var _a, _b, _c, _d, _e;
    const request = await refund_model_1.RefundRequest.findById(requestId);
    if (!request) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Refund request not found.');
    }
    if (request.status !== 'pending') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `This request has already been ${request.status}.`);
    }
    const order = await order_model_1.Order.findById(request.orderId);
    if (!(order === null || order === void 0 ? void 0 : order.paymentIntentId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'This order has no payment on record, so it cannot be refunded.');
    }
    const orderTotal = Number(((_a = order.amountDetails) === null || _a === void 0 ? void 0 : _a.totalPaid) || 0);
    const amount = Number((_b = options.amount) !== null && _b !== void 0 ? _b : request.requestedAmount);
    if (amount <= 0 || amount > orderTotal + 0.005) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Refund amount must be between $0 and the order total of $${orderTotal.toFixed(2)}.`);
    }
    const isFullRefund = amount >= orderTotal - 0.005;
    let stripeAccountId = null;
    try {
        stripeAccountId = await marketplaceCharge_1.MarketplaceCharge.findChargeAccount({
            paymentIntentId: order.paymentIntentId,
            recordedAccountId: order.stripeAccountId,
            sellerId: (_c = order.sellerId) === null || _c === void 0 ? void 0 : _c.toString(),
        });
        const refund = await marketplaceCharge_1.MarketplaceCharge.refundMarketplacePayment({
            paymentIntentId: order.paymentIntentId,
            stripeAccountId,
            amount,
            reason: toStripeReason(request.reason),
            refundApplicationFee: isFullRefund,
        });
        request.refundId = refund.id;
        request.refundedAmount = amount;
        request.stripeAccountId = stripeAccountId || undefined;
        request.status = 'approved';
    }
    catch (error) {
        // Record the failure instead of leaving the request stuck as pending,
        // so an admin can see why and retry.
        request.status = 'failed';
        request.decisionNote = `Stripe refused the refund: ${(error === null || error === void 0 ? void 0 : error.message) || 'unknown error'}`;
        request.reviewedBy = new mongoose_1.Types.ObjectId(adminId);
        request.reviewedAt = new Date();
        await request.save();
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_GATEWAY, `Could not refund this order: ${error === null || error === void 0 ? void 0 : error.message}. The request has been marked failed.`);
    }
    if (options.note)
        request.decisionNote = options.note;
    request.reviewedBy = new mongoose_1.Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    await request.save();
    // Keep the order and the payment record in step with the money.
    order.paymentStatus = isFullRefund ? 'refunded' : order.paymentStatus;
    if (isFullRefund && order.deliveryStatus !== 'delivered') {
        order.deliveryStatus = 'cancelled';
        order.cancelReason = 'Refunded by ARIES';
    }
    await order.save();
    await payment_model_1.Payment.updateOne({ paymentIntentId: order.paymentIntentId }, {
        $set: {
            status: isFullRefund ? 'refunded' : 'succeeded',
            refundAmount: amount,
            refundReason: request.reason,
        },
    });
    // A fully refunded item goes back on sale.
    if (isFullRefund && order.productId) {
        await product_model_1.Product.updateOne({ _id: (_e = (_d = order.productId) === null || _d === void 0 ? void 0 : _d._id) !== null && _e !== void 0 ? _e : order.productId }, { $inc: { stock: 1 }, $set: { status: 'active' } }).catch(() => undefined);
    }
    return request;
};
const rejectRefundRequest = async (requestId, adminId, note) => {
    const request = await refund_model_1.RefundRequest.findById(requestId);
    if (!request) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Refund request not found.');
    }
    if (request.status !== 'pending') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `This request has already been ${request.status}.`);
    }
    request.status = 'rejected';
    request.decisionNote = note;
    request.reviewedBy = new mongoose_1.Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    await request.save();
    return request;
};
// ────────────────────────────────────────────────────────────────────────────
// Disputes (chargebacks)
// ────────────────────────────────────────────────────────────────────────────
/**
 * Mirror a Stripe dispute locally.
 *
 * On direct charges the dispute is raised against the seller's connected
 * account and Stripe takes the money from their balance, so ARIES is
 * recording rather than paying. `stripeAccountId` comes from the webhook
 * event's `account` field.
 */
const recordDisputeFromWebhook = async (dispute, stripeAccountId) => {
    var _a, _b, _c;
    const paymentIntentId = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : (_a = dispute.payment_intent) === null || _a === void 0 ? void 0 : _a.id;
    const order = paymentIntentId
        ? await order_model_1.Order.findOne({ paymentIntentId })
        : null;
    const isClosed = ['won', 'lost', 'warning_closed'].includes(dispute.status);
    await refund_model_1.DisputeRecord.findOneAndUpdate({ stripeDisputeId: dispute.id }, {
        $set: {
            stripeChargeId: typeof dispute.charge === 'string'
                ? dispute.charge
                : (_b = dispute.charge) === null || _b === void 0 ? void 0 : _b.id,
            paymentIntentId,
            stripeAccountId,
            orderId: order === null || order === void 0 ? void 0 : order._id,
            sellerId: order === null || order === void 0 ? void 0 : order.sellerId,
            buyerId: order === null || order === void 0 ? void 0 : order.buyerId,
            amount: dispute.amount / 100,
            currency: dispute.currency,
            reason: dispute.reason,
            status: dispute.status,
            evidenceDueBy: ((_c = dispute.evidence_details) === null || _c === void 0 ? void 0 : _c.due_by)
                ? new Date(dispute.evidence_details.due_by * 1000)
                : undefined,
            closedAt: isClosed ? new Date() : undefined,
        },
    }, { upsert: true, new: true });
};
const listDisputesForAdmin = async (query) => {
    const filter = {};
    if (query.status)
        filter.status = query.status;
    const disputes = await refund_model_1.DisputeRecord.find(filter)
        .populate('sellerId', 'name fullName email')
        .populate('buyerId', 'name fullName email')
        .sort({ createdAt: -1 })
        .limit(Number(query.limit) || 100);
    return disputes.map((d) => {
        var _a, _b, _c;
        return ({
            id: d._id.toString(),
            stripeDisputeId: d.stripeDisputeId,
            orderId: (_a = d.orderId) === null || _a === void 0 ? void 0 : _a.toString(),
            seller: d.sellerId
                ? {
                    id: (_b = d.sellerId._id) === null || _b === void 0 ? void 0 : _b.toString(),
                    name: d.sellerId.fullName || d.sellerId.name,
                    email: d.sellerId.email,
                }
                : null,
            buyer: d.buyerId
                ? {
                    id: (_c = d.buyerId._id) === null || _c === void 0 ? void 0 : _c.toString(),
                    name: d.buyerId.fullName || d.buyerId.name,
                }
                : null,
            amount: d.amount,
            currency: (d.currency || 'usd').toUpperCase(),
            reason: d.reason,
            status: d.status,
            evidenceDueBy: d.evidenceDueBy,
            // On direct charges the seller's balance is hit, not the platform's.
            liability: d.stripeAccountId ? 'seller' : 'platform',
            createdAt: d.createdAt,
        });
    });
};
/** A seller's own chargebacks, for their dashboard. */
const getDisputesForSeller = async (user) => refund_model_1.DisputeRecord.find({ sellerId: user.userId }).sort({ createdAt: -1 });
exports.RefundServices = {
    createRefundRequest,
    getMyRefundRequests,
    getRefundRequestsForSeller,
    listRefundRequestsForAdmin,
    approveRefundRequest,
    rejectRefundRequest,
    recordDisputeFromWebhook,
    listDisputesForAdmin,
    getDisputesForSeller,
};
