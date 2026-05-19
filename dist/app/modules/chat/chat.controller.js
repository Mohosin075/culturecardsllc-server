"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_codes_1 = require("http-status-codes");
const chat_service_1 = require("./chat.service");
const createChat = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const otherUser = req.params.id;
    const participants = [user === null || user === void 0 ? void 0 : user.userId, otherUser];
    const chat = await chat_service_1.ChatService.createChatToDB(participants);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Create Chat Successfully',
        data: chat,
    });
});
const createAdminChat = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const chat = await chat_service_1.ChatService.createAdminChat(user === null || user === void 0 ? void 0 : user.userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Chat with Admin created successfully',
        data: chat,
    });
});
const getChat = (0, catchAsync_1.default)(async (req, res) => {
    const user = req.user;
    const search = req.query.search;
    const chatList = await chat_service_1.ChatService.getChatFromDB(user, search);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Chat Retrieve Successfully',
        data: chatList,
    });
});
exports.ChatController = { createChat, getChat, createAdminChat };
