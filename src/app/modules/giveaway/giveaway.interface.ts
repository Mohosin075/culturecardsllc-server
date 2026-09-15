import { Schema, Document, Types } from 'mongoose'

export type IGiveawayParticipant = {
  giveawaySlug?: string
  userId: Types.ObjectId
  name: string
  email: string
  status: 'active' | 'won' | 'expired' | 'shortlisted'
  enteredAt: Date
  expiresAt?: Date
  wonStreamId?: Types.ObjectId
  wonAt?: Date
  createdAt: Date
  updatedAt: Date
} & Document

export type IGiveawayConfig = {
  slug: string
  title: string
  prizeTitle?: string
  prizeImage?: string
  drawDate?: Date
  durationDays: number
  isActive: boolean
  description?: string
  createdAt: Date
  updatedAt: Date
} & Document
