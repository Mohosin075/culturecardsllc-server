"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const http_status_codes_1 = require("http-status-codes");
const payment_service_1 = require("./payment.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const pick_1 = __importDefault(require("../../../shared/pick"));
const payment_constants_1 = require("./payment.constants");
const pagination_1 = require("../../../interfaces/pagination");
const createCheckoutSession = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await payment_service_1.PaymentServices.createCheckoutSession(user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Checkout session created successfully',
        data: result,
    });
});
const verifyCheckoutSession = (0, catchAsync_1.default)(async (req, res) => {
    const { sessionId } = req.params;
    const result = await payment_service_1.PaymentServices.verifyCheckoutSession(sessionId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payment verified successfully',
        data: result,
    });
});
const handleWebhook = (0, catchAsync_1.default)(async (req, res) => {
    await payment_service_1.PaymentServices.handleWebhook({
        body: req.body,
        headers: req.headers,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Webhook processed successfully',
        data: null,
    });
});
const getAllPayments = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const filters = (0, pick_1.default)(req.query, payment_constants_1.paymentFilterableFields);
    const paginationOptions = (0, pick_1.default)(req.query, pagination_1.paginationFields);
    const result = await payment_service_1.PaymentServices.getAllPayments(user, filters, paginationOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payments retrieved successfully',
        meta: result.meta,
        data: result.data,
    });
});
const getSinglePayment = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await payment_service_1.PaymentServices.getSinglePayment(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payment retrieved successfully',
        data: result,
    });
});
const updatePayment = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await payment_service_1.PaymentServices.updatePayment(id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payment updated successfully',
        data: result,
    });
});
const refundPayment = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await payment_service_1.PaymentServices.refundPayment(id, reason);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payment refunded successfully',
        data: result,
    });
});
// ============================================
// FLUTTER STRIPE CONTROLLERS
// ============================================
const createPaymentIntent = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await payment_service_1.PaymentServices.createPaymentIntent(user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Payment Intent created successfully',
        data: result,
    });
});
const createEphemeralKey = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const { apiVersion } = req.body;
    const result = await payment_service_1.PaymentServices.createEphemeralKey(user, apiVersion);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Ephemeral key created successfully',
        data: result,
    });
});
// ============================================
// EXISTING CONTROLLERS
// ============================================
const getMyPayments = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const paginationOptions = (0, pick_1.default)(req.query, pagination_1.paginationFields);
    const result = await payment_service_1.PaymentServices.getMyPayments(user, paginationOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'My payments retrieved successfully',
        meta: result.meta,
        data: result.data,
    });
});
const generateInvoice = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await payment_service_1.PaymentServices.generateInvoice(id);
    if (Buffer.isBuffer(result)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${id.substring(0, 8)}.pdf`);
        res.status(http_status_codes_1.StatusCodes.OK).send(result);
        return;
    }
    if (typeof result === 'string' && result.startsWith('http')) {
        (0, sendResponse_1.default)(res, {
            statusCode: http_status_codes_1.StatusCodes.OK,
            success: true,
            message: 'Invoice URL retrieved successfully',
            data: { url: result },
        });
        return;
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Invoice generated successfully',
        data: result,
    });
});
const createSetupIntent = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await payment_service_1.PaymentServices.createSetupIntent(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Setup intent created successfully',
        data: result,
    });
});
const getMyPaymentMethods = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await payment_service_1.PaymentServices.getMyPaymentMethods(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payment methods retrieved successfully',
        data: result,
    });
});
const deletePaymentMethod = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const result = await payment_service_1.PaymentServices.deletePaymentMethod(user, id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Payment method deleted successfully',
        data: result,
    });
});
const setDefaultPaymentMethod = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const result = await payment_service_1.PaymentServices.setDefaultPaymentMethod(user, id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Default payment method updated successfully',
        data: result,
    });
});
exports.PaymentController = {
    handleWebhook,
    getAllPayments,
    getSinglePayment,
    updatePayment,
    refundPayment,
    getMyPayments,
    createCheckoutSession,
    verifyCheckoutSession,
    // Flutter Stripe controllers
    createPaymentIntent,
    createEphemeralKey,
    generateInvoice,
    createSetupIntent,
    getMyPaymentMethods,
    deletePaymentMethod,
    setDefaultPaymentMethod,
};
