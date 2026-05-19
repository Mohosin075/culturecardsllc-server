import { Model, Types } from 'mongoose'

export type IChat = {
  participants: [Types.ObjectId]
  status: boolean
}

export type ChatModel = Model<IChat, Record<string, unknown>>
