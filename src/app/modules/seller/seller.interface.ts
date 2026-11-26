import { Model, Types } from 'mongoose'

/**
 * Where the seller is in the application pipeline.
 *
 * The client's flow (Areis/Stripe doc, sections 1-5):
 *   1. apply            -> `stripe_pending`
 *   2. Stripe onboarding
 *   3. back to ARIES    -> `pending_approval`
 *   4. admin reviews    -> `approved` | `rejected`
 *   5. activation needs `approved` AND Stripe payout eligibility
 */
export type ISellerApplicationStatus =
  | 'stripe_pending'
  | 'pending_approval'
  | 'approved'
  | 'rejected'

/** Mirror of the connected account's state, refreshed from Stripe. */
export type ISellerStripeState = {
  accountId?: string
  /** Seller finished Stripe's hosted onboarding form. */
  detailsSubmitted: boolean
  pendingVerification?: string[]
  /** Stripe will let this account take payments. */
  chargesEnabled: boolean
  /** Stripe will pay this account out to its bank. */
  payoutsEnabled: boolean
  /** Set by Stripe when an account is blocked (e.g. `requirements.past_due`). */
  disabledReason?: string
  /** Outstanding requirements, surfaced to the seller and to admins. */
  currentlyDue: string[]
  pastDue: string[]
  lastSyncedAt?: Date
}

export type IPolicyAcceptance = {
  sellerPolicy: boolean
  termsAndConditions: boolean
  marketplaceRules: boolean
  acceptedAt?: Date
  /** Kept for audit: which revision of the documents the seller agreed to. */
  documentVersions?: { type: string; version: string }[]
  ipAddress?: string
}

export type ISellerApplication = {
  _id: Types.ObjectId
  userId: Types.ObjectId
  /** The client only insists on this one question: "what do they want to sell". */
  whatTheySell: string
  categories?: Types.ObjectId[]
  businessName?: string
  policyAcceptance: IPolicyAcceptance
  status: ISellerApplicationStatus
  stripe: ISellerStripeState
  submittedAt: Date
  reviewedAt?: Date
  accessRevokedAt?: Date
  reviewedBy?: Types.ObjectId
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
}

export type SellerApplicationModel = Model<ISellerApplication>

/** What the app needs to render the seller's onboarding screen. */
export type ISellerOnboardingState = {
  hasApplied: boolean
  status: ISellerApplicationStatus | 'not_started'
  whatTheySell?: string
  /** Step 1 — application submitted and policies accepted. */
  applicationComplete: boolean
  /** Step 2 — Stripe identity/bank/tax onboarding finished. */
  stripeOnboardingComplete: boolean
  /** Step 2b — Stripe will actually let the seller charge and be paid out. */
  stripePayoutReady: boolean
  /** Step 3 — an ARIES admin approved the application. */
  adminApproved: boolean
  /** Step 4 — both gates are open, the seller may list and go live. */
  canSell: boolean
  stripe: ISellerStripeState
  rejectionReason?: string
  /** Anything Stripe still wants from the seller. */
  outstandingRequirements: string[]
  submittedAt?: Date
  reviewedAt?: Date
  accessRevokedAt?: Date
}
