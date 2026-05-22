"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = void 0;
const http_status_codes_1 = require("http-status-codes");
const dashboard_service_1 = require("./dashboard.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const getOverviewData = (0, catchAsync_1.default)(async (req, res) => {
    const result = await dashboard_service_1.dashboardService.getOverviewData();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Dashboard overview metrics retrieved successfully.',
        data: result,
    });
});
exports.dashboardController = {
    getOverviewData,
};
