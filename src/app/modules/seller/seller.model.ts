import { Schema, model } from 'mongoose'
import {
  ISellerApplication,
  SellerApplicationModel,
} from './seller.interface'

const SellerApplicationSchema = new Schema<ISellerApplication>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    whatTheySell: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    businessName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    policyAcceptance: {
      sellerPolicy: { type: Boolean, required: true, default: false },
      termsAndConditions: { type: Boolean, required: true, default: false },
      marketplaceRules: { type: Boolean, required: true, default: false },
      acceptedAt: { type: Date },
      documentVersions: [
        {
          _id: false,
          type: { type: String },
          version: { type: String },
        },
      ],
      ipAddress: { type: String },
    },
    status: {
      type: String,
      enum: ['stripe_pending', 'pending_approval', 'approved', 'rejected'],
      default: 'stripe_pending',
      index: true,
    },
    stripe: {
      accountId: { type: String, index: true },
      detailsSubmitted: { type: Boolean, default: false },
      pendingVerification: { type: [String], default: [] },
      chargesEnabled: { type: Boolean, default: false },
      payoutsEnabled: { type: Boolean, default: false },
      disabledReason: { type: String },
      currentlyDue: { type: [String], default: [] },
      pastDue: { type: [String], default: [] },
      lastSyncedAt: { type: Date },
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: { type: Date },
    accessRevokedAt: { type: Date },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

export const SellerApplication = model<
  ISellerApplication,
  SellerApplicationModel
>('SellerApplication', SellerApplicationSchema)

export default SellerApplication
