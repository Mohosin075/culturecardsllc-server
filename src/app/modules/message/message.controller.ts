import { Request, Response } from 'express'
import catchAsync from '../../../shared/catchAsync'
import sendResponse from '../../../shared/sendResponse'
import { StatusCodes } from 'http-status-codes'
import { MessageService } from './message.service'
import { JwtPayload } from 'jsonwebtoken'

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload

  const message = await MessageService.sendMessageToDB(user.userId, req.body)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Send Message Successfully',
    data: message,
  })
})

const getMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload
  const id = req.params.id
  console.log({ id }, 'chatId')
  const messages = await MessageService.getMessageFromDB(id, user)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Message Retrieve Successfully',
    data: messages,
  })
})

export const MessageController = { sendMessage, getMessage }
