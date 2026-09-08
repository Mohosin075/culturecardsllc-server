"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductControllers = void 0;
const http_status_codes_1 = require("http-status-codes");
const product_service_1 = require("./product.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const createProduct = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.ProductServices.createProduct(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Product created successfully.',
        data: result,
    });
});
const getAllProducts = (0, catchAsync_1.default)(async (req, res) => {
    const filters = {
        searchTerm: req.query.searchTerm,
        category: req.query.category,
        condition: req.query.condition,
        allowTrade: req.query.allowTrade
            ? req.query.allowTrade === 'true'
            : undefined,
        status: req.query.status,
        sellerId: req.query.sellerId,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    };
    const paginationOptions = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
    };
    const result = await product_service_1.ProductServices.getAllProducts(filters, paginationOptions);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Products fetched successfully.',
        meta: result.meta,
        data: result.data,
    });
});
const getProductById = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.ProductServices.getProductById(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Product fetched successfully.',
        data: result,
    });
});
const updateProduct = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.ProductServices.updateProduct(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Product updated successfully.',
        data: result,
    });
});
const deleteProduct = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.ProductServices.deleteProduct(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Product deleted successfully.',
        data: result,
    });
});
const boostProduct = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const boostDurationDays = req.body.boostDurationDays ? Number(req.body.boostDurationDays) : 7;
    const result = await product_service_1.ProductServices.boostProduct(req.params.id, user.userId, boostDurationDays);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Boost Checkout session created successfully.',
        data: result,
    });
});
const incrementShareCount = (0, catchAsync_1.default)(async (req, res) => {
    const result = await product_service_1.ProductServices.incrementShareCount(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Product share count updated successfully.',
        data: result,
    });
});
exports.ProductControllers = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    boostProduct,
    incrementShareCount,
};
