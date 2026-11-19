import { StatusCodes } from 'http-status-codes'
import { JwtPayload } from 'jsonwebtoken'
import { Types } from 'mongoose'
import ApiError from '../../../errors/ApiError'
import config from '../../../config'
import { USER_ROLES } from '../../../enum/user'
import { User } from '../user/user.model'
import { SellerApplication } from './seller.model'
import {
  ISellerApplication,
  ISellerOnboardingState,
  ISellerStripeState,
} from './seller.interface'
import { StripeConnectService } from './stripeConnect.service'

const EMPTY_STRIPE_STATE: ISellerStripeState = {
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  currentlyDue: [],
  pastDue: [],
}

/**
 * Stripe reports requirements as dotted keys (`individual.verification.document`).
 * Turn them into something a seller can read.
 */
const humanizeRequirement = (requirement: string): string => {
  const map: Record<string, string> = {
    'individual.verification.document': 'Government ID photo',
    'individual.verification.additional_document': 'Additional ID document',
    'individual.id_number': 'Social Security Number',
    'individual.ssn_last_4': 'Last 4 digits of your SSN',
    'individual.dob.day': 'Date of birth',
    'individual.dob.month': 'Date of birth',
    'individual.dob.year': 'Date of birth',
    'individual.address.line1': 'Home address',
    'individual.first_name': 'First name',
    'individual.last_name': 'Last name',
    'individual.email': 'Email address',
    'individual.phone': 'Phone number',
    external_account: 'Bank account for payouts',
    'business_profile.url': 'Business website',
    'business_profile.mcc': 'Business category',
    'company.tax_id': 'Business tax ID (EIN)',
    'tos_acceptance.date': 'Stripe terms of service',
    'tos_acceptance.ip': 'Stripe terms of service',
  }
  if (map[requirement]) return map[requirement]
  // Fall back to a readable version of the raw key.
  return requirement
    .split('.')
    .pop()!
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
}

const dedupe = (values: string[]): string[] => Array.from(new Set(values))

/** Collapse an application document into the state the clients consume. */
const buildOnboardingState = (
  application: ISellerApplication | null,
): ISellerOnboardingState => {
  if (!application) {
    return {
      hasApplied: false,
      status: 'not_started',
      applicationComplete: false,
      stripeOnboardingComplete: false,
      stripePayoutReady: false,
      adminApproved: false,
      canSell: false,
      stripe: { ...EMPTY_STRIPE_STATE },
      outstandingRequirements: [],
    }
  }

  const stripe = application.stripe || { ...EMPTY_STRIPE_STATE }
  const stripePayoutReady =
    Boolean(stripe.chargesEnabled) && Boolean(stripe.payoutsEnabled)
  const adminApproved = application.status === 'approved'

  return {
    hasApplied: true,
    status: application.status,
    whatTheySell: application.whatTheySell,
    applicationComplete: true,
    stripeOnboardingComplete: Boolean(stripe.detailsSubmitted),
    stripePayoutReady,
    adminApproved,
    canSell:
      adminApproved &&
      (config.seller.requireStripeOnboarding ? stripePayoutReady : true),
    stripe,
    rejectionReason: application.rejectionReason,
    outstandingRequirements: dedupe([
      ...(stripe.pastDue || []),
      ...(stripe.currentlyDue || []),
    ]).map(humanizeRequirement),
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
  }
}

/**
 * Pull the live account state from Stripe and persist it. Also advances the
 * application from `stripe_pending` to `pending_approval` the moment Stripe
 * says the seller finished the hosted form — step 3 of the client's flow.
 */
const syncApplicationWithStripe = async (
  application: ISellerApplication & { save: () => Promise<any> },
): Promise<ISellerApplication> => {
  if (!application.stripe?.accountId) return application

  try {
    const account = await StripeConnectService.retrieveAccount(
      application.stripe.accountId,
    )
    application.stripe = StripeConnectService.mapAccountToState(account)

    // Stripe form finished -> hand over to the ARIES admin queue.
    if (
      application.stripe.detailsSubmitted &&
      application.status === 'stripe_pending'
    ) {
      application.status = 'pending_approval'
    }

    await application.save()

    await User.findByIdAndUpdate(application.userId, {
      $set: {
        stripeConnectedAccountId: application.stripe.accountId,
        isStripeConnected: Boolean(
          application.stripe.chargesEnabled && application.stripe.payoutsEnabled,
        ),
      },
    })
  } catch (error) {
    // A Stripe outage must not break the seller's status screen; serve the
    // last known state instead.
    console.error('[SellerConnect] Failed to sync Stripe account:', error)
  }

  return application
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Seller application  +  2. Stripe onboarding
// ────────────────────────────────────────────────────────────────────────────

const applyAsSeller = async (
  user: JwtPayload,
  payload: {
    whatTheySell: string
    categories?: string[]
    businessName?: string
  },
  ipAddress?: string,
): Promise<{ onboardingUrl: string; state: ISellerOnboardingState }> => {
  const userData = await User.findById(user.userId)
  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')
  }

  let application = await SellerApplication.findOne({ userId: user.userId })

  if (application?.status === 'approved') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'You are already an approved seller.',
    )
  }

  const acceptance = {
    sellerPolicy: true,
    termsAndConditions: true,
    marketplaceRules: true,
    acceptedAt: new Date(),
    ipAddress,
  }

  if (!application) {
    application = await SellerApplication.create({
      userId: new Types.ObjectId(user.userId),
      whatTheySell: payload.whatTheySell,
      categories: payload.categories?.map(id => new Types.ObjectId(id)),
      businessName: payload.businessName,
      policyAcceptance: acceptance,
      status: 'stripe_pending',
      stripe: { ...EMPTY_STRIPE_STATE },
      submittedAt: new Date(),
    })
  } else {
    // Re-applying after a rejection, or editing before Stripe is finished.
    application.whatTheySell = payload.whatTheySell
    application.categories = payload.categories?.map(
      id => new Types.ObjectId(id),
    )
    application.businessName = payload.businessName
    application.policyAcceptance = acceptance
    application.submittedAt = new Date()
    if (application.status === 'rejected') {
      application.status = 'stripe_pending'
      application.rejectionReason = undefined
      application.reviewedAt = undefined
      application.reviewedBy = undefined
    }
    await application.save()
  }

  // Create the connected account on first apply, reuse it afterwards.
  if (!application.stripe?.accountId) {
    const account = await StripeConnectService.createConnectedAccount({
      userId: user.userId.toString(),
      email: userData.email,
      businessName: payload.businessName,
      whatTheySell: payload.whatTheySell,
    })
    application.stripe = StripeConnectService.mapAccountToState(account)
    await application.save()

    userData.stripeConnectedAccountId = account.id
    await userData.save()
  }

  const onboardingUrl = await StripeConnectService.createOnboardingLink(
    application.stripe.accountId as string,
  )

  return {
    onboardingUrl,
    state: buildOnboardingState(application),
  }
}

/** Mint a fresh hosted-onboarding link (the previous one expires quickly). */
const getOnboardingLink = async (
  user: JwtPayload,
): Promise<{ onboardingUrl: string }> => {
  const application = await SellerApplication.findOne({ userId: user.userId })
  if (!application) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Submit your seller application first.',
    )
  }
  if (!application.stripe?.accountId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No Stripe account is attached to this application yet.',
    )
  }

  const onboardingUrl = await StripeConnectService.createOnboardingLink(
    application.stripe.accountId,
  )
  return { onboardingUrl }
}

/** Express dashboard, for a seller who wants to change bank details later. */
const getStripeDashboardLink = async (
  user: JwtPayload,
): Promise<{ url: string }> => {
  const application = await SellerApplication.findOne({ userId: user.userId })
  if (!application?.stripe?.accountId) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No Stripe account found.')
  }
  if (!application.stripe.detailsSubmitted) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Finish Stripe onboarding before opening the Stripe dashboard.',
    )
  }
  const url = await StripeConnectService.createLoginLink(
    application.stripe.accountId,
  )
  return { url }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Return to ARIES — status for the app
// ────────────────────────────────────────────────────────────────────────────

const getMyOnboardingState = async (
  user: JwtPayload,
  options: { refresh?: boolean } = {},
): Promise<ISellerOnboardingState> => {
  let application = await SellerApplication.findOne({ userId: user.userId })

  if (application && options.refresh !== false) {
    application = (await syncApplicationWithStripe(application as any)) as any
  }

  return buildOnboardingState(application)
}

/** Called by the `account.updated` webhook. */
const syncByAccountId = async (accountId: string): Promise<void> => {
  const application = await SellerApplication.findOne({
    'stripe.accountId': accountId,
  })
  if (!application) return
  await syncApplicationWithStripe(application as any)
}

/**
 * The seller's own earnings, straight from their Stripe balance. ARIES's 6.5%
 * has already been removed as the application fee and Stripe's processing fee
 * has already been deducted, so these are the figures the seller will
 * actually be paid.
 */
const getMyEarnings = async (user: JwtPayload): Promise<any> => {
  const application = await SellerApplication.findOne({ userId: user.userId })

  if (!application?.stripe?.accountId) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Connect your Stripe account to see your earnings.',
    )
  }

  const earnings = await StripeConnectService.getAccountEarnings(
    application.stripe.accountId,
  )

  return {
    ...earnings,
    payoutsEnabled: Boolean(application.stripe.payoutsEnabled),
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Admin review
// ────────────────────────────────────────────────────────────────────────────

const listApplicationsForAdmin = async (
  query: Record<string, any>,
): Promise<any[]> => {
  const filter: Record<string, any> = {}

  if (query.status) {
    filter.status = query.status
  } else {
    // The review queue: everyone who is not already approved.
    filter.status = { $in: ['stripe_pending', 'pending_approval', 'rejected'] }
  }

  const applications = await SellerApplication.find(filter)
    .populate('userId', 'name fullName email profile createdAt')
    .populate('categories', 'name')
    .sort({ submittedAt: -1 })
    .limit(Number(query.limit) || 50)

  return applications.map((app: any) => {
    const seller = app.userId || {}
    const stripe = app.stripe || EMPTY_STRIPE_STATE
    return {
      id: seller._id?.toString() || '',
      applicationId: app._id.toString(),
      name: seller.fullName || seller.name || 'Unnamed seller',
      email: seller.email || '',
      profile: seller.profile,
      requestId: `VER-${app._id.toString().slice(-6).toUpperCase()}`,
      whatTheySell: app.whatTheySell,
      businessName: app.businessName,
      category:
        app.categories?.map((c: any) => c.name).join(', ') || app.whatTheySell,
      submitted: app.submittedAt
        ? new Date(app.submittedAt).toISOString().split('T')[0]
        : '',
      status: app.status,
      policyAcceptance: app.policyAcceptance,
      stripe: {
        connected: Boolean(stripe.accountId),
        accountId: stripe.accountId,
        detailsSubmitted: stripe.detailsSubmitted,
        chargesEnabled: stripe.chargesEnabled,
        payoutsEnabled: stripe.payoutsEnabled,
        disabledReason: stripe.disabledReason,
        outstandingRequirements: dedupe([
          ...(stripe.pastDue || []),
          ...(stripe.currentlyDue || []),
        ]).map(humanizeRequirement),
        lastSyncedAt: stripe.lastSyncedAt,
      },
      payoutEligible: Boolean(stripe.chargesEnabled && stripe.payoutsEnabled),
      rejectionReason: app.rejectionReason,
      reviewedAt: app.reviewedAt,
    }
  })
}

const approveApplication = async (
  userId: string,
  adminId: string,
): Promise<any> => {
  const application = await SellerApplication.findOne({ userId })
  if (!application) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'No seller application found for this user.',
    )
  }

  // Make the decision against fresh Stripe data rather than a stale mirror.
  await syncApplicationWithStripe(application as any)

  if (
    config.seller.requireStripeOnboarding &&
    !application.stripe?.detailsSubmitted
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This seller has not finished Stripe onboarding yet, so they cannot be approved.',
    )
  }

  application.status = 'approved'
  application.reviewedAt = new Date()
  application.reviewedBy = new Types.ObjectId(adminId)
  application.rejectionReason = undefined
  await application.save()

  const user = await User.findById(userId)
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found')

  if (!user.roles.includes(USER_ROLES.SELLER)) {
    user.roles.push(USER_ROLES.SELLER)
  }
  user.sellerVerified = true
  await user.save()

  return buildOnboardingState(application)
}

const rejectApplication = async (
  userId: string,
  adminId: string,
  reason?: string,
): Promise<any> => {
  const application = await SellerApplication.findOne({ userId })
  if (!application) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'No seller application found for this user.',
    )
  }

  application.status = 'rejected'
  application.reviewedAt = new Date()
  application.reviewedBy = new Types.ObjectId(adminId)
  application.rejectionReason = reason
  await application.save()

  const user = await User.findById(userId)
  if (user) {
    user.sellerVerified = false
    user.roles = user.roles.filter(role => role !== USER_ROLES.SELLER)
    await user.save()
  }

  return buildOnboardingState(application)
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Seller activation gate
// ────────────────────────────────────────────────────────────────────────────

/**
 * Section 5 of the client's spec. A seller may list products or go live only
 * when ARIES approved them **and** Stripe will let them take money.
 *
 * Throws a 403 describing the step that is still missing.
 */
const assertSellerCanSell = async (userId: string | Types.ObjectId): Promise<void> => {
  const user = await User.findById(userId).select('sellerVerified')
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Seller not found')
  }

  if (!user.sellerVerified) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Your seller application is still under review by ARIES.',
    )
  }

  if (!config.seller.requireStripeOnboarding) return

  const application = await SellerApplication.findOne({ userId })

  if (!application?.stripe?.accountId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Connect your Stripe account before listing items or going live.',
    )
  }

  if (!application.stripe.detailsSubmitted) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Finish your Stripe verification before listing items or going live.',
    )
  }

  if (!application.stripe.chargesEnabled || !application.stripe.payoutsEnabled) {
    const missing = dedupe([
      ...(application.stripe.pastDue || []),
      ...(application.stripe.currentlyDue || []),
    ])
      .map(humanizeRequirement)
      .slice(0, 3)

    throw new ApiError(
      StatusCodes.FORBIDDEN,
      missing.length
        ? `Stripe still needs: ${missing.join(', ')}. Finish verification to start selling.`
        : 'Stripe has not cleared your account for payments yet.',
    )
  }
}

export const SellerServices = {
  applyAsSeller,
  getOnboardingLink,
  getStripeDashboardLink,
  getMyOnboardingState,
  getMyEarnings,
  syncByAccountId,
  listApplicationsForAdmin,
  approveApplication,
  rejectApplication,
  assertSellerCanSell,
  buildOnboardingState,
}
