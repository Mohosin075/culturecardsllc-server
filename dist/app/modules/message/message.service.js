"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const message_model_1 = require("./message.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const http_status_codes_1 = require("http-status-codes");
const user_model_1 = require("../user/user.model");
const chat_model_1 = require("../chat/chat.model");
const sendMessageToDB = async (userId, payload) => {
    const chat = await chat_model_1.Chat.findById(payload.chatId).populate('participants');
    if (!chat)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Chat not found');
    // find the receiver (the participant that is NOT the sender)
    const receiver = chat.participants.find((p) => p._id.toString() !== userId.toString());
    if (!receiver)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No receiver found');
    const receiverId = receiver._id;
    const data = {
        ...payload,
        image: (payload === null || payload === void 0 ? void 0 : payload.images) ? payload.images[0] : null,
        file: (payload === null || payload === void 0 ? void 0 : payload.documents) ? payload.documents[0] : null,
        sender: userId,
        receiver: receiverId,
    };
    if (!mongoose_1.default.Types.ObjectId.isValid(data.receiver)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid Receiver ID');
    }
    const sender = await user_model_1.User.findById(data.sender).select('name');
    // save to DB
    const response = await message_model_1.Message.create(data);
    // Update Chat's updatedAt to bring it to the top
    await chat_model_1.Chat.findByIdAndUpdate(data.chatId, {
        $set: { updatedAt: new Date() },
    });
    //@ts-ignore
    const io = global.io;
    if (io) {
        io.emit(`getMessage::${data === null || data === void 0 ? void 0 : data.chatId}`, response);
        io.emit(`updateChatList::${data === null || data === void 0 ? void 0 : data.sender}`);
        io.emit(`updateChatList::${data === null || data === void 0 ? void 0 : data.receiver}`);
        const notificationData = {
            text: `${sender === null || sender === void 0 ? void 0 : sender.name} send you message.`,
            title: 'Received Message',
            link: data === null || data === void 0 ? void 0 : data.chatId,
            direction: 'message',
            receiver: data.receiver,
        };
        // await sendNotifications(notificationData);
    }
    return response;
};
const getMessageFromDB = async (chatId, user) => {
    // Find messages that will be marked as seen to identify the sender
    const unreadMessages = await message_model_1.Message.find({
        chatId,
        sender: { $ne: user.userId },
        seen: false,
    });
    if (unreadMessages.length > 0) {
        // Mark messages as seen when chat is opened
        await message_model_1.Message.updateMany({ chatId, sender: { $ne: user.userId }, seen: false }, { $set: { seen: true } });
        // Notify the senders that their messages were seen
        //@ts-ignore
        const io = global.io;
        if (io) {
            // For each unique sender of the unread messages, notify them
            const senders = [...new Set(unreadMessages.map(m => m.sender.toString()))];
            senders.forEach(senderId => {
                io.emit(`updateChatList::${senderId}`);
            });
        }
    }
    const messages = await message_model_1.Message.find({ chatId }).sort({ createdAt: -1 }).lean();
    return messages;
};
exports.MessageService = { sendMessageToDB, getMessageFromDB };
