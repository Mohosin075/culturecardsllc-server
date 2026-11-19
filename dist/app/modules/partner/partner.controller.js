"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const partner_service_1 = require("./partner.service");
const createPartnerByAdmin = (0, catchAsync_1.default)(async (req, res) => {
    const result = await partner_service_1.PartnerService.createPartnerByAdmin(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Partner created successfully!',
        data: result,
    });
});
const getAllPartners = (0, catchAsync_1.default)(async (req, res) => {
    const result = await partner_service_1.PartnerService.getAllPartners();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Partners retrieved successfully!',
        data: result,
    });
});
const requestPartnerOTP = (0, catchAsync_1.default)(async (req, res) => {
    const token = req.body.token || req.query.token || req.headers['x-partner-token'];
    const result = await partner_service_1.PartnerService.requestPartnerOTP(token);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
});
const verifyPartnerOTP = (0, catchAsync_1.default)(async (req, res) => {
    const token = req.body.token || req.query.token || req.headers['x-partner-token'];
    const { otp } = req.body;
    const result = await partner_service_1.PartnerService.verifyPartnerOTP(token, otp);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
});
const getPartnerDashboardByToken = (0, catchAsync_1.default)(async (req, res) => {
    const token = req.query.token || req.headers['x-partner-token'];
    const otpToken = req.query.otpToken || req.headers['x-partner-otp-token'];
    const result = await partner_service_1.PartnerService.getPartnerDashboardByToken(token, otpToken);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Partner dashboard data retrieved successfully!',
        data: result,
    });
});
const updatePartnerBankDetails = (0, catchAsync_1.default)(async (req, res) => {
    const token = req.query.token || req.headers['x-partner-token'];
    const result = await partner_service_1.PartnerService.updatePartnerBankDetails(token, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Bank details updated successfully!',
        data: result,
    });
});
const sendMagicLinkEmailToPartner = (0, catchAsync_1.default)(async (req, res) => {
    const { partnerId } = req.params;
    const origin = req.get('origin') || req.get('referer');
    const result = await partner_service_1.PartnerService.sendMagicLinkEmailToPartner(partnerId, origin);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.message,
        data: result,
    });
});
const validatePromoCode = (0, catchAsync_1.default)(async (req, res) => {
    const code = req.query.code;
    const result = await partner_service_1.PartnerService.validatePromoCode(code);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: result.valid ? 'Promo code is valid' : 'Invalid promo code',
        data: result,
    });
});
exports.PartnerController = {
    requestPartnerOTP,
    verifyPartnerOTP,
    createPartnerByAdmin,
    getAllPartners,
    getPartnerDashboardByToken,
    updatePartnerBankDetails,
    sendMagicLinkEmailToPartner,
    validatePromoCode,
};
