"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const category_model_1 = require("./category.model");
const paginationHelper_1 = require("../../../helpers/paginationHelper");
const createCategory = async (payload) => {
    const existingCategory = await category_model_1.Category.findOne({ name: payload.name });
    if (existingCategory) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Category with this name already exists');
    }
    // Map images field from upload middleware to image field
    if (payload.images) {
        payload.image = payload.images[0];
        delete payload.images;
    }
    const result = await category_model_1.Category.create(payload);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create category');
    }
    return result;
};
const getAllCategories = async (filters, paginationOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
    const { searchTerm, ...filterData } = filters;
    const andConditions = [];
    if (searchTerm) {
        andConditions.push({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
            ],
        });
    }
    if (Object.keys(filterData).length) {
        andConditions.push({
            $and: Object.entries(filterData).map(([field, value]) => ({
                [field]: value,
            })),
        });
    }
    const whereConditions = andConditions.length > 0 ? { $and: andConditions } : {};
    const [result, total] = await Promise.all([
        category_model_1.Category.find(whereConditions)
            .populate('parent')
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder }),
        category_model_1.Category.countDocuments(whereConditions),
    ]);
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
const getSingleCategory = async (id) => {
    const result = await category_model_1.Category.findById(id).populate('parent');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Category not found');
    }
    return result;
};
const getPopularCategories = async () => {
    const result = await category_model_1.Category.find({
        type: 'category',
        isPopular: true,
        isActive: true,
    })
        .select('name image icon description')
        .lean();
    return result;
};
const getTrendingSubcategories = async () => {
    const result = await category_model_1.Category.find({
        type: 'subcategory',
        isTrending: true,
        isActive: true,
    })
        .select('name image icon theme trendingBadge description')
        .populate('parent', 'name')
        .lean();
    return result;
};
const updateCategory = async (id, payload) => {
    const category = await category_model_1.Category.findById(id);
    if (!category) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Category not found');
    }
    if (payload.name && payload.name !== category.name) {
        const existingCategory = await category_model_1.Category.findOne({ name: payload.name });
        if (existingCategory) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Category with this name already exists');
        }
    }
    // Map images field from upload middleware to image field
    if (payload.images) {
        payload.image = payload.images[0];
        delete payload.images;
    }
    const result = await category_model_1.Category.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    return result;
};
const deleteCategory = async (id) => {
    const category = await category_model_1.Category.findById(id);
    if (!category) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Category not found');
    }
    // Delete associated subcategories if any
    await category_model_1.Category.deleteMany({ parent: id });
    const result = await category_model_1.Category.findByIdAndDelete(id);
    return result;
};
exports.CategoryServices = {
    createCategory,
    getAllCategories,
    getSingleCategory,
    getPopularCategories,
    getTrendingSubcategories,
    updateCategory,
    deleteCategory,
};
