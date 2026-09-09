import { Schema, Document } from 'mongoose'

export type IGiveawayParticipant = {
  userId: Schema.Types.ObjectId
  name: string
  email: string
  status: 'active' | 'won' | 'expired'
  enteredAt: Date
  expiresAt: Date
  wonStreamId?: Schema.Types.ObjectId
  wonAt?: Date
  createdAt: Date
  updatedAt: Date
} & Document

export type IGiveawayConfig = {
  title: string
  durationDays: number
  isActive: boolean
  description?: string
  createdAt: Date
  updatedAt: Date
} & Document
