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
        allowTrade: req.query.allowTrade ? req.query.allowTrade === 'true' : undefined,
        status: req.query.status,
        sellerId: req.query.sellerId,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    };
    const result = await product_service_1.ProductServices.getAllProducts(filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Products fetched successfully.',
        data: result,
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
exports.ProductControllers = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
};
