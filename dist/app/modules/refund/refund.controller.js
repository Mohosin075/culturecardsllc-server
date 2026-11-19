"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const refund_service_1 = require("./refund.service");
const createRefundRequest = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await refund_service_1.RefundServices.createRefundRequest(user, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Refund request submitted. ARIES will review it and let you know the outcome.',
        data: result,
    });
});
const getMyRefundRequests = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await refund_service_1.RefundServices.getMyRefundRequests(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Refund requests retrieved successfully.',
        data: result,
    });
});
const getSellerRefundRequests = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await refund_service_1.RefundServices.getRefundRequestsForSeller(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Refund requests retrieved successfully.',
        data: result,
    });
});
const getSellerDisputes = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const result = await refund_service_1.RefundServices.getDisputesForSeller(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Disputes retrieved successfully.',
        data: result,
    });
});
// ── Admin ──────────────────────────────────────────────────────────────────
const listRefundRequests = (0, catchAsync_1.default)(async (req, res) => {
    const result = await refund_service_1.RefundServices.listRefundRequestsForAdmin(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Refund requests retrieved successfully.',
        data: result,
    });
});
const approveRefundRequest = (0, catchAsync_1.default)(async (req, res) => {
    var _a, _b;
    const admin = req.user;
    const result = await refund_service_1.RefundServices.approveRefundRequest(req.params.id, admin.userId, { amount: (_a = req.body) === null || _a === void 0 ? void 0 : _a.amount, note: (_b = req.body) === null || _b === void 0 ? void 0 : _b.note });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Refund approved. Stripe has reversed the charge from the seller’s balance.',
        data: result,
    });
});
const rejectRefundRequest = (0, catchAsync_1.default)(async (req, res) => {
    var _a;
    const admin = req.user;
    const result = await refund_service_1.RefundServices.rejectRefundRequest(req.params.id, admin.userId, (_a = req.body) === null || _a === void 0 ? void 0 : _a.note);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Refund request rejected.',
        data: result,
    });
});
const listDisputes = (0, catchAsync_1.default)(async (req, res) => {
    const result = await refund_service_1.RefundServices.listDisputesForAdmin(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Disputes retrieved successfully.',
        data: result,
    });
});
exports.RefundControllers = {
    createRefundRequest,
    getMyRefundRequests,
    getSellerRefundRequests,
    getSellerDisputes,
    listRefundRequests,
    approveRefundRequest,
    rejectRefundRequest,
    listDisputes,
};
