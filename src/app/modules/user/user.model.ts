import { Schema, model } from 'mongoose'
import bcrypt from 'bcrypt'
import { IUser, UserModel } from './user.interface'
import { InterestCategory, USER_ROLES, USER_STATUS } from '../../../enum/user'

// ------------------ USER SCHEMA ------------------
const UserSchema = new Schema<IUser, UserModel>(
  {
    name: { type: String, trim: true },
    fullName: { type: String, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, unique: true, lowercase: true, required: true },
    profile: { type: String, default: '/images/1767048629458-l94gk7.jpg' },
    coverPhoto: { type: String, default: '' },
    phone: { type: String },
    description: { type: String },
    interest: { type: [String], enum: Object.values(InterestCategory) },

    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    verified: { type: Boolean, default: false },

    address: {
      city: String,
      postalCode: String,
      country: String,
      permanentAddress: String,
      presentAddress: String,
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0], // [longitude, latitude]
      },
    },
    subscribe: { type: Boolean, default: false },
    stripeCustomerId: { type: String },
    stripeConnectedAccountId: { type: String },
    isStripeConnected: { type: Boolean, default: false },
    subscriptionStatus: { type: String },
    subscriptionTier: { type: String },
    trialUsed: { type: Boolean, default: false },
    subscriptionExpiresAt: { type: Date },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },

    password: { type: String, minlength: 6 },
    roles: {
      type: [String],
      enum: Object.values(USER_ROLES),
      default: [USER_ROLES.USER],
    },
    activeRole: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    appId: { type: String },
    provider: { type: String },
    deviceToken: { type: String },
    timezone: { type: String, default: 'UTC' },
    isOnboardingComplete: { type: Boolean, default: false },

    settings: {
      pushNotification: { type: Boolean, default: true },
      emailNotification: { type: Boolean, default: true },
      locationService: { type: Boolean, default: true },
      profileStatus: { type: String, default: 'public' },
    },

    authentication: {
      restrictionLeftAt: { type: Date, default: null },
      resetPassword: { type: Boolean, default: false },
      wrongLoginAttempts: { type: Number, default: 0 },
      passwordChangedAt: { type: Date },
      oneTimeCode: { type: String },
      latestRequestAt: { type: Date, default: Date.now },
      expiresAt: { type: Date },
      requestCount: { type: Number, default: 0 },
      authType: { type: String, enum: ['createAccount', 'resetPassword'] },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// ------------------ INDEXES ------------------
UserSchema.index({ location: '2dsphere' }) // Geo queries support

// ------------------ PRE HOOKS ------------------
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

// ------------------ STATIC METHODS ------------------
UserSchema.statics.isPasswordMatched = async function (
  givenPassword: string,
  savedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(givenPassword, savedPassword)
}

// ------------------ MODEL ------------------
export const User = model<IUser, UserModel>('User', UserSchema)
