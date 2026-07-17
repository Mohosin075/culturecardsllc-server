"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const product_model_1 = require("./product.model");
const mongoose_1 = require("mongoose");
const stripe_1 = __importDefault(require("../../../config/stripe"));
const config_1 = __importDefault(require("../../../config"));
const createProduct = async (payload) => {
    const result = await product_model_1.Product.create(payload);
    return result;
};
const getAllProducts = async (filters) => {
    const { searchTerm, category, condition, allowTrade, status, sellerId, minPrice, maxPrice, } = filters;
    const query = {};
    if (searchTerm) {
        query.$or = [
            { title: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
        ];
    }
    if (category)
        query.category = category;
    if (condition)
        query.condition = condition;
    if (allowTrade !== undefined)
        query.allowTrade = allowTrade;
    if (status)
        query.status = status;
    if (sellerId)
        query.sellerId = new mongoose_1.Types.ObjectId(sellerId);
    if (minPrice !== undefined || maxPrice !== undefined) {
        query.estValue = {};
        if (minPrice !== undefined)
            query.estValue.$gte = Number(minPrice);
        if (maxPrice !== undefined)
            query.estValue.$lte = Number(maxPrice);
    }
    return await product_model_1.Product.find(query).populate('sellerId', 'name fullName email image photo');
};
const getProductById = async (id) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const result = await product_model_1.Product.findById(id).populate('sellerId', 'name fullName email image photo stripeCustomerId');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    return result;
};
const updateProduct = async (id, payload) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const result = await product_model_1.Product.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    return result;
};
const deleteProduct = async (id) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const result = await product_model_1.Product.findByIdAndDelete(id);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    return result;
};
const boostProduct = async (productId, userId, boostDurationDays = 7) => {
    if (!mongoose_1.Types.ObjectId.isValid(productId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const product = await product_model_1.Product.findById(productId);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    if (product.sellerId.toString() !== userId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You are not authorized to boost this product');
    }
    // Cost calculation: e.g., $5 per day
    const amountPerDay = 5;
    const totalAmount = amountPerDay * boostDurationDays;
    const session = await stripe_1.default.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Boost Listing: ${product.title}`,
                        description: `Boost item listing for ${boostDurationDays} days`,
                    },
                    unit_amount: Math.round(totalAmount * 100),
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${config_1.default.clientUrl}?boost_success=true&productId=${productId}`,
        cancel_url: `${config_1.default.clientUrl}/product/cancel`,
        metadata: {
            purchaseType: 'product_boost',
            productId: productId,
            boostDurationDays: boostDurationDays.toString(),
        },
    });
    return {
        sessionId: session.id,
        url: session.url,
    };
};
exports.ProductServices = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    boostProduct,
};
