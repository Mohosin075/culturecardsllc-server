import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { ChatService } from './chat.service'
import { Message } from '../message/message.model'
import { JwtPayload } from 'jsonwebtoken'

const createChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const otherUser = req.params.id

  const participants = [user?.userId, otherUser]
  const chat = await ChatService.createChatToDB(participants)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Create Chat Successfully',
    data: chat,
  })
})

const createAdminChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const chat = await ChatService.createAdminChat(user?.userId)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat with Admin created successfully',
    data: chat,
  })
})

const getChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const search = req.query.search as string
  const chatList = await ChatService.getChatFromDB(user, search)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat Retrieve Successfully',
    data: chatList,
  })
})

const markChatAsRead = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const chatId = req.params.id || req.body?.chatId
  if (chatId) {
    await Message.updateMany(
      { chatId, sender: { $ne: user.userId }, seen: false },
      { $set: { seen: true } },
    )
    const io = (global as any).io
    if (io) {
      io.emit(`updateChatList::${user.userId}`)
    }
  }

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Chat marked as read',
    data: null,
  })
})

export const ChatController = { createChat, getChat, createAdminChat, markChatAsRead }
