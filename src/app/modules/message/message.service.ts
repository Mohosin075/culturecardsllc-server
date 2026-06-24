import mongoose from 'mongoose'
// import { sendNotifications } from '../../../helpers/notificationsHelper';
import { IMessage } from './message.interface'
import { Message } from './message.model'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
import { User } from '../user/user.model'
import { Chat } from '../chat/chat.model'

const sendMessageToDB = async (
  userId: string,
  payload: any,
): Promise<IMessage> => {
  const chat = await Chat.findById(payload.chatId).populate('participants')
  if (!chat) throw new ApiError(StatusCodes.NOT_FOUND, 'Chat not found')

  // find the receiver (the participant that is NOT the sender)
  const receiver = chat.participants.find(
    (p: any) => p._id.toString() !== userId.toString(),
  )

  if (!receiver)
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No receiver found')

  const receiverId = (receiver as any)._id

  const data = {
    ...payload,
    image: payload?.images ? payload.images[0] : null,
    file: payload?.documents ? payload.documents[0] : null,
    sender: userId,
    receiver: receiverId,
  }

  if (!mongoose.Types.ObjectId.isValid(data.receiver)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Receiver ID')
  }

  const sender = await User.findById(data.sender).select('name')

  // save to DB
  const response = await Message.create(data)

  // Update Chat's updatedAt to bring it to the top
  await Chat.findByIdAndUpdate(data.chatId, {
    $set: { updatedAt: new Date() },
  })

  const io = (global as any).io
  if (io) {
    io.emit(`getMessage::${data?.chatId}`, response)
    io.emit(`updateChatList::${data?.sender}`)
    io.emit(`updateChatList::${data?.receiver}`)

    // const notificationData = {
    //   text: `${sender?.name} send you message.`,
    //   title: 'Received Message',
    //   link: data?.chatId,
    //   direction: 'message',
    //   receiver: data.receiver,
    // }
    // await sendNotifications(notificationData);
  }

  return response
}

const getMessageFromDB = async (
  chatId: string,
  user: any,
): Promise<IMessage[]> => {
  // Find messages that will be marked as seen to identify the sender
  const unreadMessages = await Message.find({
    chatId,
    sender: { $ne: user.userId },
    seen: false,
  })

  if (unreadMessages.length > 0) {
    // Mark messages as seen when chat is opened
    await Message.updateMany(
      { chatId, sender: { $ne: user.userId }, seen: false },
      { $set: { seen: true } },
    )

    // Notify the senders that their messages were seen
    const io = (global as any).io
    if (io) {
      // For each unique sender of the unread messages, notify them
      const senders = [...new Set(unreadMessages.map(m => m.sender.toString()))]
      senders.forEach(senderId => {
        io.emit(`updateChatList::${senderId}`)
      })
    }
  }

  const messages = await Message.find({ chatId }).sort({ createdAt: -1 }).lean()
  return messages as any
}

export const MessageService = { sendMessageToDB, getMessageFromDB }
