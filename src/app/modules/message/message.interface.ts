import { Model, Types } from 'mongoose'

export type IMessage = {
  chatId: Types.ObjectId
  sender: Types.ObjectId
  text?: string
  image?: string
  file?: string
  seen: boolean
}

export type MessageModel = Model<IMessage, Record<string, unknown>>
