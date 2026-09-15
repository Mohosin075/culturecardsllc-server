import { Schema, model } from 'mongoose'
import { IGiveawayParticipant, IGiveawayConfig } from './giveaway.interface'

const GiveawayParticipantSchema = new Schema<IGiveawayParticipant>(
  {
    giveawaySlug: {
      type: String,
      default: 'michael-vick-jersey-2026',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      enum: ['active', 'won', 'expired', 'shortlisted'],
      default: 'active',
      index: true,
    },
    enteredAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
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

GiveawayParticipantSchema.index({ giveawaySlug: 1, userId: 1 }, { unique: true })
GiveawayParticipantSchema.index({ status: 1, expiresAt: 1 })

const GiveawayConfigSchema = new Schema<IGiveawayConfig>(
  {
    slug: {
      type: String,
      required: true,
      default: 'michael-vick-jersey-2026',
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: 'Michael Vick Jersey Giveaway',
    },
    prizeTitle: {
      type: String,
      default: 'Official Signed Michael Vick Jersey',
    },
    prizeImage: {
      type: String,
      default: '',
    },
    drawDate: {
      type: Date,
      default: () => new Date('2026-09-25T23:59:59.999Z'),
    },
    durationDays: {
      type: Number,
      default: 14,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default:
        'Enter for a chance to win the Michael Vick Jersey! Winner will be drawn on September 25th.',
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

