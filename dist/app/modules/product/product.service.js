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
const user_model_1 = require("../user/user.model");
const payment_model_1 = require("../payment/payment.model");
const category_model_1 = require("../category/category.model");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const user_1 = require("../../../enum/user");
const seller_service_1 = require("../seller/seller.service");
/** A trade-only listing that is not a giveaway — no money changes hands. */
const isTradeOnlyListing = (p) => p.isTradeOnly === true && p.isGiveaway !== true;
const SALE_FIELDS = [
    'buyNowPrice',
    'startingBid',
    'reservePrice',
    'allowOffers',
    'minOfferAmount',
];
const stripSaleFields = (p) => {
    for (const field of SALE_FIELDS)
        delete p[field];
    p.allowTrade = true;
};
const createProduct = async (payload) => {
    const seller = await user_model_1.User.findById(payload.sellerId);
    if (!seller) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Seller not found');
    }
    if (isTradeOnlyListing(payload)) {
        // Client spec, section 6: anyone can list an item for trade without
        // seller approval. A trade-only item is never for sale, so any price
        // fields are dropped — otherwise it could be bought outright by someone
        // who was never approved to take money.
        stripSaleFields(payload);
    }
    else {
        // Seller activation (client spec, section 5): ARIES approval *and*
        // Stripe payout eligibility are both required before anything is listed
        // for sale.
        await seller_service_1.SellerServices.assertSellerCanSell(seller._id);
    }
    const result = await product_model_1.Product.create(payload);
    return result;
};
const populateCategoriesSafely = async (products) => {
    if (!products || products.length === 0)
        return [];
    const categoryValues = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    if (categoryValues.length === 0)
        return products;
    const validObjectIds = categoryValues.filter(c => mongoose_1.Types.ObjectId.isValid(c));
    const stringNames = categoryValues.filter(c => !mongoose_1.Types.ObjectId.isValid(c));
    const searchConditions = [];
    if (validObjectIds.length > 0) {
        searchConditions.push({ _id: { $in: validObjectIds } });
    }
    if (stringNames.length > 0) {
        searchConditions.push({ name: { $in: stringNames } });
    }
    const categories = searchConditions.length > 0
        ? await category_model_1.Category.find({ $or: searchConditions })
            .select('name image icon theme parent type')
            .lean()
        : [];
    const categoryMap = new Map();
    categories.forEach(cat => {
        categoryMap.set(cat._id.toString(), cat);
        categoryMap.set(cat.name.toLowerCase(), cat);
    });
    return products.map(p => {
        if (!p.category)
            return p;
        if (typeof p.category === 'object' && p.category._id)
            return p;
        const catKey = p.category.toString();
        const foundCategory = categoryMap.get(catKey) || categoryMap.get(catKey.toLowerCase());
        return {
            ...p,
            category: foundCategory || { name: catKey },
        };
    });
};
const getAllProducts = async (filters, paginationOptions = {}) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    const { searchTerm, category, condition, allowTrade, status, sellerId, minPrice, maxPrice, includePrivate, } = filters;
    const query = {};
    if (searchTerm) {
        const safe = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
            { title: { $regex: safe, $options: 'i' } },
            { description: { $regex: safe, $options: 'i' } },
        ];
    }
    if (category) {
        if (mongoose_1.Types.ObjectId.isValid(category)) {
            query.category = category;
        }
        else {
            const categoryDoc = await category_model_1.Category.findOne({
                name: { $regex: `^${category}$`, $options: 'i' },
            }).select('_id');
            if (categoryDoc) {
                query.category = categoryDoc._id;
            }
            else {
                query.category = category;
            }
        }
    }
    if (condition)
        query.condition = condition;
    if (allowTrade !== undefined)
        query.allowTrade = allowTrade;
    // Private inventory (saved, not listed for trade) is only visible to its
    // owner via /products/my. Public lists never show it.
    if (!includePrivate && allowTrade === undefined)
        query.allowTrade = { $ne: false };
    // Exclude trade-only counter items from public marketplace listings
    if (!includePrivate)
        query.isTradeOnly = { $ne: true };
    if (status)
        query.status = status;
    if (sellerId && mongoose_1.Types.ObjectId.isValid(sellerId)) {
        query.sellerId = new mongoose_1.Types.ObjectId(sellerId);
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
        query.estValue = {};
        if (minPrice !== undefined)
            query.estValue.$gte = Number(minPrice);
        if (maxPrice !== undefined)
            query.estValue.$lte = Number(maxPrice);
    }
    const sortConditions = {};
    if (sortBy) {
        sortConditions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }
    else {
        sortConditions.createdAt = -1;
    }
    const [rawProducts, total] = await Promise.all([
        product_model_1.Product.find(query)
            .populate('sellerId', 'name fullName email image photo')
            .sort(sortConditions)
            .skip(skip)
            .limit(limit)
            .lean(),
        product_model_1.Product.countDocuments(query),
    ]);
    const result = await populateCategoriesSafely(rawProducts);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: result,
    };
};
const getProductById = async (id) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const rawProduct = await product_model_1.Product.findById(id)
        .populate('sellerId', 'name fullName email image photo stripeCustomerId')
        .lean();
    if (!rawProduct) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    const [result] = await populateCategoriesSafely([rawProduct]);
    return result;
};
const updateProduct = async (id, payload, userId, userRole) => {
    var _a, _b;
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const product = await product_model_1.Product.findById(id);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    if (userId && userRole !== user_1.USER_ROLES.ADMIN && userRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        if (product.sellerId.toString() !== userId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only edit your own listings');
        }
        // Sellers can't self-feature, change ownership or reset a sold/reserved item
        const p = payload;
        delete p.isFeatured;
        delete p.boostedUntil;
        delete p.sellerId;
        delete p.views;
        delete p.shareCount;
        if (p.status !== undefined) {
            const locked = product.status === 'sold' || product.status === 'pending';
            if (locked || !['active', 'unsold'].includes(p.status)) {
                delete p.status;
            }
        }
        // Trade-only listings skip seller approval, so they must stay unsellable:
        // a trade item keeps no price, and turning one into a sale needs the
        // same approval as listing a sale item in the first place.
        const after = {
            isTradeOnly: (_a = p.isTradeOnly) !== null && _a !== void 0 ? _a : product.isTradeOnly,
            isGiveaway: (_b = p.isGiveaway) !== null && _b !== void 0 ? _b : product.isGiveaway,
        };
        if (isTradeOnlyListing(after)) {
            stripSaleFields(p);
        }
        else if (product.isTradeOnly) {
            await seller_service_1.SellerServices.assertSellerCanSell(product.sellerId.toString());
        }
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
const deleteProduct = async (id, userId, userRole) => {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const product = await product_model_1.Product.findById(id);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    if (userId && userRole !== user_1.USER_ROLES.ADMIN && userRole !== user_1.USER_ROLES.SUPER_ADMIN) {
        if (product.sellerId.toString() !== userId) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, 'You can only delete your own listings');
        }
    }
    const result = await product_model_1.Product.findByIdAndDelete(id);
    return result;
};
const clearAllProducts = async (userId, userRole) => {
    // Only a super admin may wipe the whole catalogue; everyone else can only
    // clear their own inventory.
    const filter = userRole === user_1.USER_ROLES.SUPER_ADMIN
        ? {}
        : { sellerId: new mongoose_1.Types.ObjectId(userId) };
    const result = await product_model_1.Product.deleteMany(filter);
    return { deletedCount: result.deletedCount || 0 };
};
const boostProduct = async (productId, userId, boostDurationDays = 7) => {
    if (!mongoose_1.Types.ObjectId.isValid(productId)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Product ID');
    }
    const product = await product_model_1.Product.findById(productId);
    if (!product) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
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
    // Create Payment record for tracking & webhook safety
    await payment_model_1.Payment.create({
        userId: userId,
        userEmail: user.email,
        amount: totalAmount,
        currency: 'usd',
        paymentMethod: 'stripe',
        paymentIntentId: session.id,
        status: 'pending',
        metadata: {
            purchaseType: 'product_boost',
            productId: productId,
            boostDurationDays: boostDurationDays.toString(),
            checkoutSessionId: session.id,
        },
    });
    return {
        sessionId: session.id,
        url: session.url,
    };
};
const incrementShareCount = async (id) => {
    const result = await product_model_1.Product.findByIdAndUpdate(id, { $inc: { shareCount: 1 } }, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Product not found');
    }
    return result;
};
exports.ProductServices = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    clearAllProducts,
    boostProduct,
    incrementShareCount,
};
