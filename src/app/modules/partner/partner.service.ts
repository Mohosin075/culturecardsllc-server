import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../errors/ApiError'
import { Partner, PartnerEarning } from './partner.model'
import { IBankDetails, IPartner } from './partner.interface'
import { User } from '../user/user.model'
import crypto from 'crypto'
import config from '../../../config'
import { Types } from 'mongoose'

// Helper: Mask sensitive banking data for security compliance
const maskAccountNumber = (accountNumber?: string): string => {
  if (!accountNumber) return ''
  const trimmed = accountNumber.trim()
  if (trimmed.length <= 4) return trimmed
  return '•'.repeat(trimmed.length - 4) + trimmed.slice(-4)
}

// Helper: Round monetary figures to exactly 2 decimal places
const roundCurrency = (amount: number): number => {
  return Math.round(amount * 100) / 100
}

const createPartnerByAdmin = async (payload: {
  name: string
  email: string
  promoCode: string
  revenueSharePercentage?: number
}): Promise<{ partner: IPartner; dashboardUrl: string }> => {
  const email = payload.email.toLowerCase().trim()
  const promoCode = payload.promoCode.toUpperCase().trim()

  const existingPartner = await Partner.findOne({
    $or: [{ email }, { promoCode }],
  }).select('email promoCode')

  if (existingPartner) {
    if (existingPartner.email === email) {
      throw new ApiError(StatusCodes.CONFLICT, 'A partner with this email address already exists.')
    }
    if (existingPartner.promoCode === promoCode) {
      throw new ApiError(StatusCodes.CONFLICT, `Promo code '${promoCode}' is already taken by another partner.`)
    }
  }

  // 64-character cryptographically secure token
  const accessToken = crypto.randomBytes(32).toString('hex')

  const partner = await Partner.create({
    name: payload.name.trim(),
    email,
    promoCode,
    revenueSharePercentage: payload.revenueSharePercentage ?? 50,
    accessToken,
    bankDetails: {
      accountNumber: '',
      routingNumber: '',
      bankName: '',
      accountHolderName: '',
    },
    totalEarnings: 0,
  })

  const clientUrl = config.clientUrl || 'https://culturecards.com'
  const dashboardUrl = `${clientUrl}/partner/dashboard?token=${accessToken}`

  return { partner, dashboardUrl }
}

const getAllPartners = async () => {
  const partners = await Partner.find()
    .sort({ createdAt: -1 })
    .lean()

  const partnerIds = partners.map(p => p._id)

  // Fast aggregation pipeline to count referred users per partner in a single query
  const referralCounts = await User.aggregate([
    {
      $match: {
        referredByPartnerId: { $in: partnerIds },
      },
    },
    {
      $group: {
        _id: '$referredByPartnerId',
        count: { $sum: 1 },
      },
    },
  ])

  const countMap = new Map<string, number>()
  referralCounts.forEach(r => countMap.set(r._id.toString(), r.count))

  return partners.map(partner => ({
    ...partner,
    totalReferredUsers: countMap.get(partner._id.toString()) || 0,
    bankDetails: {
      ...partner.bankDetails,
      accountNumber: maskAccountNumber(partner.bankDetails?.accountNumber),
    },
  }))
}

const getPartnerDashboardByToken = async (accessToken: string) => {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'A valid partner access token is required.')
  }

  const partner = await Partner.findOne({ accessToken })
  if (!partner) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Invalid or expired partner access token.')
  }

  const partnerObjectId = new Types.ObjectId(partner._id)

  // Concurrent Execution: Count referred users and aggregate earnings in parallel
  const [totalReferredUsers, [aggregationResult]] = await Promise.all([
    User.countDocuments({
      $or: [{ referredByPartnerId: partnerObjectId }, { promoCode: partner.promoCode }],
    }),
    PartnerEarning.aggregate([
      {
        $match: { partnerId: partnerObjectId },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: '$transactionAmount' },
                totalPlatformFees: { $sum: '$platformFee' },
                partnerShareTotal: { $sum: '$partnerShare' },
                ownerShareTotal: { $sum: '$ownerShare' },
              },
            },
          ],
          dailyTimeSeries: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                partnerEarnings: { $sum: '$partnerShare' },
                ownerEarnings: { $sum: '$ownerShare' },
                volume: { $sum: '$transactionAmount' },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: '$_id',
                partnerEarnings: { $round: ['$partnerEarnings', 2] },
                ownerEarnings: { $round: ['$ownerEarnings', 2] },
                volume: { $round: ['$volume', 2] },
              },
            },
          ],
        },
      },
    ]),
  ])

  const summary = aggregationResult?.summary?.[0] || {
    totalTransactions: 0,
    totalPlatformFees: 0,
    partnerShareTotal: 0,
    ownerShareTotal: 0,
  }

  const realtimeGraphData = aggregationResult?.dailyTimeSeries || []

  return {
    partnerInfo: {
      _id: partner._id,
      name: partner.name,
      email: partner.email,
      promoCode: partner.promoCode,
      revenueSharePercentage: partner.revenueSharePercentage,
      bankDetails: {
        accountNumber: maskAccountNumber(partner.bankDetails?.accountNumber),
        routingNumber: partner.bankDetails?.routingNumber || '',
        bankName: partner.bankDetails?.bankName || '',
        accountHolderName: partner.bankDetails?.accountHolderName || '',
      },
      totalEarnings: roundCurrency(summary.partnerShareTotal),
    },
    metrics: {
      totalReferredUsers,
      totalTransactions: roundCurrency(summary.totalTransactions),
      totalPlatformFees: roundCurrency(summary.totalPlatformFees),
      partnerShareTotal: roundCurrency(summary.partnerShareTotal),
      ownerShareTotal: roundCurrency(summary.ownerShareTotal),
    },
    realtimeGraphData,
  }
}

const updatePartnerBankDetails = async (
  accessToken: string,
  bankDetails: IBankDetails,
) => {
  if (!accessToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Access token is required.')
  }

  const partner = await Partner.findOne({ accessToken })
  if (!partner) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Partner record not found.')
  }

  const rawAccount = bankDetails.accountNumber ? bankDetails.accountNumber.trim() : ''
  const isMasked = rawAccount.includes('•')

  partner.bankDetails = {
    accountNumber: isMasked
      ? (partner.bankDetails?.accountNumber || '')
      : (rawAccount || partner.bankDetails?.accountNumber || ''),
    routingNumber: bankDetails.routingNumber ? bankDetails.routingNumber.trim() : partner.bankDetails?.routingNumber || '',
    bankName: bankDetails.bankName ? bankDetails.bankName.trim() : partner.bankDetails?.bankName || '',
    accountHolderName: bankDetails.accountHolderName ? bankDetails.accountHolderName.trim() : partner.bankDetails?.accountHolderName || '',
  }

  await partner.save()

  return {
    success: true,
    message: 'Bank details saved securely.',
    bankDetails: {
      ...partner.bankDetails,
      accountNumber: maskAccountNumber(partner.bankDetails.accountNumber),
    },
  }
}

// ── Idempotent & Atomic Commission Recorder Hook ───────────────────────────────
const recordCommissionForOrder = async (payload: {
  buyerId: string
  orderId?: string
  tradeOfferId?: string
  transactionAmount: number
  isTrade?: boolean
}): Promise<void> => {
  try {
    if (!payload.transactionAmount || payload.transactionAmount <= 0) return

    // Idempotency check: Don't duplicate commission if already recorded
    if (payload.orderId) {
      const existing = await PartnerEarning.findOne({ orderId: new Types.ObjectId(payload.orderId) })
      if (existing) return
    }
    if (payload.tradeOfferId) {
      const existing = await PartnerEarning.findOne({ tradeOfferId: new Types.ObjectId(payload.tradeOfferId) })
      if (existing) return
    }

    const buyer = await User.findById(payload.buyerId).select('referredByPartnerId promoCode')
    if (!buyer) return

    let partnerId = buyer.referredByPartnerId
    if (!partnerId && buyer.promoCode) {
      const partnerByCode = await Partner.findOne({ promoCode: buyer.promoCode.toUpperCase() }).select('_id')
      if (partnerByCode) partnerId = partnerByCode._id as any
    }

    if (!partnerId) return

    const partner = await Partner.findById(partnerId)
    if (!partner) return

    // Fee Policy Implementation:
    // Sales: 7% platform seller fee
    // Trades: 3% + 3% = 6% total fee across both participants' card values
    const platformFeeRate = payload.isTrade ? 0.06 : 0.07
    const platformFee = roundCurrency(payload.transactionAmount * platformFeeRate)

    const sharePercentage = partner.revenueSharePercentage ?? 50
    const partnerShare = roundCurrency(platformFee * (sharePercentage / 100))
    const ownerShare = roundCurrency(platformFee - partnerShare)

    // 1. Audit Entry in PartnerEarning
    await PartnerEarning.create({
      partnerId: partner._id,
      orderId: payload.orderId ? new Types.ObjectId(payload.orderId) : undefined,
      tradeOfferId: payload.tradeOfferId ? new Types.ObjectId(payload.tradeOfferId) : undefined,
      buyerId: buyer._id,
      transactionAmount: roundCurrency(payload.transactionAmount),
      platformFee,
      partnerShare,
      ownerShare,
      description: payload.isTrade ? `Trade commission (6% fee)` : `Sales commission (7% fee)`,
    })

    // 2. Atomic increment of Partner totalEarnings (concurrency-safe)
    await Partner.findByIdAndUpdate(partner._id, {
      $inc: { totalEarnings: partnerShare },
    })
  } catch (error) {
    console.error('[PartnerCommission] Error recording commission:', error)
  }
}

export const PartnerService = {
  createPartnerByAdmin,
  getAllPartners,
  getPartnerDashboardByToken,
  updatePartnerBankDetails,
  recordCommissionForOrder,
}
