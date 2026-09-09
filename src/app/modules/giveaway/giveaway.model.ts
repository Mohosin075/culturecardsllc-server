import { Schema, model } from 'mongoose'
import { IGiveawayParticipant, IGiveawayConfig } from './giveaway.interface'

const GiveawayParticipantSchema = new Schema<IGiveawayParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'won', 'expired'],
      default: 'active',
      index: true,
    },
    enteredAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    wonStreamId: {
      type: Schema.Types.ObjectId,
      ref: 'LiveStream',
      default: null,
    },
    wonAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

GiveawayParticipantSchema.index({ status: 1, expiresAt: 1 })

const GiveawayConfigSchema = new Schema<IGiveawayConfig>(
  {
    title: {
      type: String,
      required: true,
      default: 'Welcome Giveaway',
    },
    durationDays: {
      type: Number,
      default: 14, // Default 2 weeks duration
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: 'No Purchase Necessary - All newly registered users are automatically entered.',
    },
  },
  {
    timestamps: true,
  },
)

export const GiveawayParticipant = model<IGiveawayParticipant>(
  'GiveawayParticipant',
  GiveawayParticipantSchema,
)

export const GiveawayConfig = model<IGiveawayConfig>(
  'GiveawayConfig',
  GiveawayConfigSchema,
)
