import { Model, Types } from 'mongoose'
import { InterestCategory, USER_ROLES, USER_STATUS } from '../../../enum/user'

export type IUserFilterables = {
  searchTerm?: string
  date?: Date
  role?: USER_ROLES
  name?: string
  email?: string
}

// ------------------ SUB-TYPES ------------------
export type IAuthentication = {
  restrictionLeftAt: Date | null
  resetPassword: boolean
  wrongLoginAttempts: number
  passwordChangedAt?: Date
  oneTimeCode: string
  latestRequestAt: Date
  expiresAt?: Date
  requestCount?: number
  authType?: 'createAccount' | 'resetPassword'
}

export type IAddress = {
  city?: string
  postalCode?: string
  country?: string
  permanentAddress?: string
  presentAddress?: string
}

export type Point = {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
  address?: string[]
}

// ------------------ USER TYPE ------------------
export type IUser = {
  _id: Types.ObjectId
  name?: string
  fullName?: string
  username?: string
  email?: string
  profile?: string
  coverPhoto?: string
  phone?: string
  description?: string
  interest?: InterestCategory[]

  status: USER_STATUS // standardize statuses
  verified: boolean
  sellerVerified: boolean
  address?: IAddress
  location: Point
  password: string
  roles: USER_ROLES[]
  activeRole: USER_ROLES
  appId?: string
  provider?: string
  deviceToken?: string
  timezone: string
  subscribe: boolean
  isOnboardingComplete: boolean
  stripeCustomerId?: string
  stripeConnectedAccountId?: string
  isStripeConnected?: boolean
  subscriptionStatus?: string
  subscriptionTier?: string
  trialUsed?: boolean
  subscriptionExpiresAt?: Date
  isOnline: boolean
  lastActive: Date
  // membership: Membership

  settings?: {
    pushNotification?: boolean
    emailNotification?: boolean
    locationService?: boolean
    profileStatus: 'public' | 'private'
  }

  authentication: IAuthentication
  blockedUsers?: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

// ------------------ MODEL ------------------
export type UserModel = Model<IUser> & {
  isPasswordMatched(
    givenPassword: string,
    savedPassword: string,
  ): Promise<boolean>
}
