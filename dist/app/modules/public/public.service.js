"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicServices = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const public_model_1 = require("./public.model");
const user_model_1 = require("../user/user.model");
const emailHelper_1 = require("../../../helpers/emailHelper");
const createPublic = async (payload) => {
    const isExist = await public_model_1.Public.findOne({
        type: payload.type,
    });
    if (isExist) {
        await public_model_1.Public.findByIdAndUpdate(isExist._id, {
            $set: {
                content: payload.content,
            },
        }, {
            new: true,
        });
    }
    else {
        const result = await public_model_1.Public.create(payload);
        if (!result)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create Public');
    }
    return `${payload.type} created successfully}`;
};
const getAllPublics = async (type) => {
    const result = await public_model_1.Public.findOne({ type: type }).lean();
    return result || null;
};
const deletePublic = async (id) => {
    const result = await public_model_1.Public.findByIdAndDelete(id);
    return result;
};
const createContact = async (payload) => {
    try {
        // Find admin user to send notification
        const admin = await user_model_1.User.findOne({ role: 'admin' });
        if (!admin || !admin.email) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Admin user not found');
        }
        // Send email notification to admin
        const emailData = {
            to: admin.email,
            subject: 'New Contact Form Submission',
            html: `
        <h1>New Contact Form Submission</h1>
        <p>You have received a new message from the contact form:</p>
        <ul>
          <li><strong>Name:</strong> ${payload.name}</li>
          <li><strong>Email:</strong> ${payload.email}</li>
          <li><strong>Phone:</strong> ${payload.phone}</li>
          <li><strong>Country:</strong> ${payload.country}</li>
        </ul>
        <h2>Message:</h2>
        <p>${payload.message}</p>
        <p>You can respond directly to the sender by replying to: ${payload.email}</p>
      `,
        };
        await emailHelper_1.emailHelper.sendEmail(emailData);
        const userEmailData = {
            to: payload.email,
            subject: 'Thank you for contacting us',
            html: `
        <h1>Thank You for Contacting Us</h1>
        <p>Dear ${payload.name},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p>Here's a copy of your message:</p>
        <p><em>${payload.message}</em></p>
        <p>Best regards,<br>The Healthcare and Financial Consultants Team</p>
      `,
        };
        await emailHelper_1.emailHelper.sendEmail(userEmailData);
        return {
            message: 'Contact form submitted successfully',
        };
    }
    catch (error) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to submit contact form');
    }
};
const createFaq = async (payload) => {
    const result = await public_model_1.Faq.create(payload);
    if (!result)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create Faq');
    // redisClient.del(`public:${RedisKeys.FAQ}`)
    return result;
};
const getAllFaqs = async () => {
    const result = await public_model_1.Faq.find({});
    return result || [];
};
const getSingleFaq = async (id) => {
    const result = await public_model_1.Faq.findById(id);
    return result || null;
};
const updateFaq = async (id, payload) => {
    const result = await public_model_1.Faq.findByIdAndUpdate(id, { $set: payload }, {
        new: true,
    });
    return result;
};
const deleteFaq = async (id) => {
    const result = await public_model_1.Faq.findByIdAndDelete(id);
    return result;
};
const updatePublic = async (id, payload) => {
    const data = await public_model_1.Public.findById(id);
    if (!data) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Public document not found');
    }
    // Filter payload to only allow 'content' field update
    const updateData = {
        content: payload.content,
    };
    const result = await public_model_1.Public.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    return result;
};
exports.PublicServices = {
    createPublic,
    getAllPublics,
    deletePublic,
    createContact,
    createFaq,
    getAllFaqs,
    getSingleFaq,
    updateFaq,
    deleteFaq,
    updatePublic,
};
