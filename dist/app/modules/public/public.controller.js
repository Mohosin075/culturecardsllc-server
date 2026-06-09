"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicController = void 0;
const public_service_1 = require("./public.service");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const createPublic = (0, catchAsync_1.default)(async (req, res) => {
    const publicData = req.body;
    const result = await public_service_1.PublicServices.createPublic(publicData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `${publicData === null || publicData === void 0 ? void 0 : publicData.type} updated successfully`,
        data: result,
    });
});
const getAllPublics = (0, catchAsync_1.default)(async (req, res) => {
    const result = await public_service_1.PublicServices.getAllPublics(req.params.type);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `${req.params.type} retrieved successfully`,
        data: result,
    });
});
const deletePublic = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await public_service_1.PublicServices.deletePublic(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `${result === null || result === void 0 ? void 0 : result.type} deleted successfully`,
        data: result,
    });
});
const createContact = (0, catchAsync_1.default)(async (req, res) => {
    const result = await public_service_1.PublicServices.createContact(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Thank you for contacting us. We will get back to you soon.',
        data: result,
    });
});
const createFaq = (0, catchAsync_1.default)(async (req, res) => {
    const faqData = req.body;
    const result = await public_service_1.PublicServices.createFaq(faqData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        success: true,
        message: 'Faq created successfully',
        data: result,
    });
});
const updateFaq = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const faqData = req.body;
    const result = await public_service_1.PublicServices.updateFaq(id, faqData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Faq updated successfully',
        data: result,
    });
});
const getSingleFaq = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await public_service_1.PublicServices.getSingleFaq(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Faq retrieved successfully',
        data: result,
    });
});
const getAllFaqs = (0, catchAsync_1.default)(async (req, res) => {
    const result = await public_service_1.PublicServices.getAllFaqs();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Faqs retrieved successfully',
        data: result,
    });
});
const deleteFaq = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const result = await public_service_1.PublicServices.deleteFaq(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Faq deleted successfully',
        data: result,
    });
});
const updatePublic = (0, catchAsync_1.default)(async (req, res) => {
    const { id } = req.params;
    const publicData = req.body;
    const result = await public_service_1.PublicServices.updatePublic(id, publicData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `${publicData === null || publicData === void 0 ? void 0 : publicData.type} updated successfully`,
        data: result,
    });
});
exports.PublicController = {
    createPublic,
    getAllPublics,
    deletePublic,
    createContact,
    createFaq,
    updateFaq,
    getSingleFaq,
    getAllFaqs,
    deleteFaq,
    updatePublic,
};
