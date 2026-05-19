"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportController = void 0;
const support_service_1 = require("./support.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const pick_1 = __importDefault(require("../../../shared/pick"));
const support_constants_1 = require("./support.constants");
const pagination_1 = require("../../../interfaces/pagination");
const createSupport = (0, catchAsync_1.default)(async (req, res) => {
    const supportData = req.body;
    const result = await support_service_1.SupportServices.createSupport(req.user, supportData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Support created successfully',
        data: result,
    });
});
const updateSupport = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const supportData = req.body;
    const result = await support_service_1.SupportServices.updateSupport(id, supportData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Support updated successfully',
        data: result,
    });
});
const getSingleSupport = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await support_service_1.SupportServices.getSingleSupport(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Support retrieved successfully',
        data: result,
    });
});
const getAllSupports = (0, catchAsync_1.default)(async (req, res) => {
    const filterables = (0, pick_1.default)(req.query, support_constants_1.supportFilterables);
    const pagination = (0, pick_1.default)(req.query, pagination_1.paginationFields);
    const result = await support_service_1.SupportServices.getAllSupports(req.user, filterables, pagination);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Supports retrieved successfully',
        data: result,
    });
});
const deleteSupport = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await support_service_1.SupportServices.deleteSupport(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Support deleted successfully',
        data: result,
    });
});
exports.SupportController = {
    createSupport,
    updateSupport,
    getSingleSupport,
    getAllSupports,
    deleteSupport,
};
