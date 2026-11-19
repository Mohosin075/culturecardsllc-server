"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const partner_model_1 = require("./partner.model");
const user_model_1 = require("../user/user.model");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../../../config"));
const mongoose_1 = require("mongoose");
const emailHelper_1 = require("../../../helpers/emailHelper");
// Helper: Mask sensitive banking data for security compliance
const maskAccountNumber = (accountNumber) => {
    if (!accountNumber)
        return '';
    const trimmed = accountNumber.trim();
    if (trimmed.length <= 4)
        return trimmed;
    return '•'.repeat(trimmed.length - 4) + trimmed.slice(-4);
};
// Helper: Round monetary figures to exactly 2 decimal places
const roundCurrency = (amount) => {
    return Math.round(amount * 100) / 100;
};
const createPartnerByAdmin = async (payload) => {
    var _a;
    const email = payload.email.toLowerCase().trim();
    const promoCode = payload.promoCode.toUpperCase().trim();
    const existingPartner = await partner_model_1.Partner.findOne({
        $or: [{ email }, { promoCode }],
    }).select('email promoCode');
    if (existingPartner) {
        if (existingPartner.email === email) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'A partner with this email address already exists.');
        }
        if (existingPartner.promoCode === promoCode) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, `Promo code '${promoCode}' is already taken by another partner.`);
        }
    }
    // 64-character cryptographically secure token
    const accessToken = crypto_1.default.randomBytes(32).toString('hex');
    const partner = await partner_model_1.Partner.create({
        name: payload.name.trim(),
        email,
        promoCode,
        revenueSharePercentage: (_a = payload.revenueSharePercentage) !== null && _a !== void 0 ? _a : 50,
        accessToken,
        bankDetails: {
            accountNumber: '',
            routingNumber: '',
            bankName: '',
            accountHolderName: '',
        },
        totalEarnings: 0,
    });
    const clientUrl = config_1.default.clientUrl || 'http://localhost:3000';
    const dashboardUrl = `${clientUrl}/partner/dashboard?token=${accessToken}`;
    // Non-blocking auto email notification to partner
    sendMagicLinkEmailToPartner(partner._id.toString()).catch(err => console.error('Failed to send magic link email on partner creation:', err));
    return { partner, dashboardUrl };
};
const getAllPartners = async () => {
    const partners = await partner_model_1.Partner.find()
        .sort({ createdAt: -1 })
        .lean();
    const partnerIds = partners.map(p => p._id);
    // Fast aggregation pipeline to count referred users per partner in a single query
    const referralCounts = await user_model_1.User.aggregate([
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
    ]);
    const countMap = new Map();
    referralCounts.forEach(r => countMap.set(r._id.toString(), r.count));
    return partners.map(partner => {
        var _a;
        return ({
            ...partner,
            totalReferredUsers: countMap.get(partner._id.toString()) || 0,
            bankDetails: {
                ...partner.bankDetails,
                accountNumber: maskAccountNumber((_a = partner.bankDetails) === null || _a === void 0 ? void 0 : _a.accountNumber),
            },
        });
    });
};
const maskEmail = (email) => {
    if (!email || !email.includes('@'))
        return email;
    const [name, domain] = email.split('@');
    if (name.length <= 2)
        return `${name.charAt(0)}*@${domain}`;
    return `${name.charAt(0)}***${name.charAt(name.length - 1)}@${domain}`;
};
const requestPartnerOTP = async (accessToken) => {
    if (!accessToken || typeof accessToken !== 'string') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'A valid partner access token is required.');
    }
    const partner = await partner_model_1.Partner.findOne({ accessToken });
    if (!partner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Invalid or expired partner access token.');
    }
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    partner.otpCode = otpCode;
    partner.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await partner.save();
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #111827; margin-bottom: 8px;">Partner Portal Security Code</h2>
      <p style="color: #4b5563; font-size: 14px;">Hello ${partner.name},</p>
      <p style="color: #4b5563; font-size: 14px;">Your 6-digit Security Verification Code to access your Culture Cards Partner Portal is:</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #155dfc;">${otpCode}</span>
      </div>
      <p style="color: #6b7280; font-size: 12px;">This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
    </div>
  `;
    await emailHelper_1.emailHelper.sendEmail({
        to: partner.email,
        subject: `Your Partner Portal Security Code: ${otpCode}`,
        html: htmlContent,
    });
    return {
        success: true,
        emailMasked: maskEmail(partner.email),
        message: 'OTP verification code sent to partner email.',
    };
};
const verifyPartnerOTP = async (accessToken, otp) => {
    if (!accessToken || typeof accessToken !== 'string') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'A valid partner access token is required.');
    }
    if (!otp || typeof otp !== 'string') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'OTP code is required.');
    }
    const partner = await partner_model_1.Partner.findOne({ accessToken });
    if (!partner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Invalid or expired partner access token.');
    }
    if (!partner.otpCode || partner.otpCode !== otp.trim()) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid OTP code. Please check your email and try again.');
    }
    if (!partner.otpExpiresAt || new Date() > new Date(partner.otpExpiresAt)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'OTP code has expired. Please request a new code.');
    }
    const otpSessionToken = crypto_1.default.randomBytes(32).toString('hex');
    partner.otpSessionToken = otpSessionToken;
    partner.otpCode = undefined;
    partner.otpExpiresAt = undefined;
    await partner.save();
    return {
        success: true,
        message: 'OTP verified successfully.',
        otpToken: otpSessionToken,
    };
};
const getPartnerDashboardByToken = async (accessToken, otpToken, skipOtpCheck = false) => {
    var _a, _b, _c, _d, _e;
    if (!accessToken || typeof accessToken !== 'string') {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'A valid partner access token is required.');
    }
    const partner = await partner_model_1.Partner.findOne({ accessToken });
    if (!partner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Invalid or expired partner access token.');
    }
    // OTP Verification Requirement Check
    if (!skipOtpCheck && (!otpToken || partner.otpSessionToken !== otpToken)) {
        return {
            otpRequired: true,
            emailMasked: maskEmail(partner.email),
            message: 'Security verification required. Please enter the OTP sent to your email.',
        };
    }
    const partnerObjectId = new mongoose_1.Types.ObjectId(partner._id);
    // Concurrent Execution: Count referred users, fetch referred users list, and aggregate earnings in parallel
    const [totalReferredUsers, referredUsersList, [aggregationResult]] = await Promise.all([
        user_model_1.User.countDocuments({
            $or: [{ referredByPartnerId: partnerObjectId }, { promoCode: partner.promoCode }],
        }),
        user_model_1.User.find({
            $or: [{ referredByPartnerId: partnerObjectId }, { promoCode: partner.promoCode }],
        })
            .select('name email createdAt profileImage')
            .sort({ createdAt: -1 })
            .limit(100),
        partner_model_1.PartnerEarning.aggregate([
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
    ]);
    const summary = ((_a = aggregationResult === null || aggregationResult === void 0 ? void 0 : aggregationResult.summary) === null || _a === void 0 ? void 0 : _a[0]) || {
        totalTransactions: 0,
        totalPlatformFees: 0,
        partnerShareTotal: 0,
        ownerShareTotal: 0,
    };
    const realtimeGraphData = (aggregationResult === null || aggregationResult === void 0 ? void 0 : aggregationResult.dailyTimeSeries) || [];
    return {
        partnerInfo: {
            _id: partner._id,
            name: partner.name,
            email: partner.email,
            promoCode: partner.promoCode,
            revenueSharePercentage: partner.revenueSharePercentage,
            bankDetails: {
                accountNumber: maskAccountNumber((_b = partner.bankDetails) === null || _b === void 0 ? void 0 : _b.accountNumber),
                routingNumber: ((_c = partner.bankDetails) === null || _c === void 0 ? void 0 : _c.routingNumber) || '',
                bankName: ((_d = partner.bankDetails) === null || _d === void 0 ? void 0 : _d.bankName) || '',
                accountHolderName: ((_e = partner.bankDetails) === null || _e === void 0 ? void 0 : _e.accountHolderName) || '',
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
    };
};
const updatePartnerBankDetails = async (accessToken, bankDetails) => {
    var _a, _b, _c, _d, _e;
    if (!accessToken) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Access token is required.');
    }
    const partner = await partner_model_1.Partner.findOne({ accessToken });
    if (!partner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Partner record not found.');
    }
    const rawAccount = bankDetails.accountNumber ? bankDetails.accountNumber.trim() : '';
    const isMasked = rawAccount.includes('•');
    partner.bankDetails = {
        accountNumber: isMasked
            ? (((_a = partner.bankDetails) === null || _a === void 0 ? void 0 : _a.accountNumber) || '')
            : (rawAccount || ((_b = partner.bankDetails) === null || _b === void 0 ? void 0 : _b.accountNumber) || ''),
        routingNumber: bankDetails.routingNumber ? bankDetails.routingNumber.trim() : ((_c = partner.bankDetails) === null || _c === void 0 ? void 0 : _c.routingNumber) || '',
        bankName: bankDetails.bankName ? bankDetails.bankName.trim() : ((_d = partner.bankDetails) === null || _d === void 0 ? void 0 : _d.bankName) || '',
        accountHolderName: bankDetails.accountHolderName ? bankDetails.accountHolderName.trim() : ((_e = partner.bankDetails) === null || _e === void 0 ? void 0 : _e.accountHolderName) || '',
    };
    await partner.save();
    return {
        success: true,
        message: 'Bank details saved securely.',
        bankDetails: {
            ...partner.bankDetails,
            accountNumber: maskAccountNumber(partner.bankDetails.accountNumber),
        },
    };
};
// ── Idempotent & Atomic Commission Recorder Hook ───────────────────────────────
const recordCommissionForOrder = async (payload) => {
    var _a;
    try {
        if (!payload.transactionAmount || payload.transactionAmount <= 0)
            return;
        // Idempotency check: Don't duplicate commission if already recorded
        if (payload.orderId) {
            const existing = await partner_model_1.PartnerEarning.findOne({ orderId: new mongoose_1.Types.ObjectId(payload.orderId) });
            if (existing)
                return;
        }
        if (payload.tradeOfferId) {
            const existing = await partner_model_1.PartnerEarning.findOne({ tradeOfferId: new mongoose_1.Types.ObjectId(payload.tradeOfferId) });
            if (existing)
                return;
        }
        const buyer = await user_model_1.User.findById(payload.buyerId).select('referredByPartnerId promoCode');
        if (!buyer)
            return;
        let partnerId = buyer.referredByPartnerId;
        if (!partnerId && buyer.promoCode) {
            const partnerByCode = await partner_model_1.Partner.findOne({ promoCode: buyer.promoCode.toUpperCase() }).select('_id');
            if (partnerByCode)
                partnerId = partnerByCode._id;
        }
        if (!partnerId)
            return;
        const partner = await partner_model_1.Partner.findById(partnerId);
        if (!partner)
            return;
        // Fee Policy Implementation:
        // Sales: 7% platform seller fee
        // Trades: 3% + 3% = 6% total fee across both participants' card values
        const platformFeeRate = payload.isTrade ? 0.06 : 0.07;
        const platformFee = roundCurrency(payload.transactionAmount * platformFeeRate);
        const sharePercentage = (_a = partner.revenueSharePercentage) !== null && _a !== void 0 ? _a : 50;
        const partnerShare = roundCurrency(platformFee * (sharePercentage / 100));
        const ownerShare = roundCurrency(platformFee - partnerShare);
        // 1. Audit Entry in PartnerEarning
        await partner_model_1.PartnerEarning.create({
            partnerId: partner._id,
            orderId: payload.orderId ? new mongoose_1.Types.ObjectId(payload.orderId) : undefined,
            tradeOfferId: payload.tradeOfferId ? new mongoose_1.Types.ObjectId(payload.tradeOfferId) : undefined,
            buyerId: buyer._id,
            transactionAmount: roundCurrency(payload.transactionAmount),
            platformFee,
            partnerShare,
            ownerShare,
            description: payload.isTrade ? `Trade commission (6% fee)` : `Sales commission (7% fee)`,
        });
        // 2. Atomic increment of Partner totalEarnings (concurrency-safe)
        await partner_model_1.Partner.findByIdAndUpdate(partner._id, {
            $inc: { totalEarnings: partnerShare },
        });
    }
    catch (error) {
        console.error('[PartnerCommission] Error recording commission:', error);
    }
};
const sendMagicLinkEmailToPartner = async (partnerId, customOrigin) => {
    const partner = await partner_model_1.Partner.findById(partnerId);
    if (!partner) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Partner not found');
    }
    const baseUrl = customOrigin || config_1.default.clientUrl || 'http://localhost:3000';
    const magicLink = `${baseUrl}/partner/dashboard?token=${partner.accessToken}`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111111; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #222222;">
      <h2 style="color: #155DFC; margin-top: 0;">CultureCards Partner Portal & Promo Code</h2>
      <p style="color: #cccccc; font-size: 14px;">Hi <strong>${partner.name}</strong>,</p>
      <p style="color: #cccccc; font-size: 14px; line-height: 1.6;">
        Here is your private access link and promo code for your CultureCards Affiliate Program. You earn <strong>${partner.revenueSharePercentage}% revenue share</strong> on all transaction fees generated by your referred collectors!
      </p>
      
      <div style="background: #18181b; border: 1px solid #27272a; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #888888; font-size: 11px; text-transform: uppercase; font-weight: bold;">Your Exclusive Promo Code</p>
        <p style="margin: 0; font-family: monospace; font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 3px;">${partner.promoCode}</p>
      </div>

      <div style="margin: 32px 0; text-align: center;">
        <a href="${magicLink}" target="_blank" style="background-color: #155DFC; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
          Open Private Partner Portal 🚀
        </a>
      </div>

      <p style="color: #71717a; font-size: 12px; line-height: 1.5; border-top: 1px solid #222222; padding-top: 16px;">
        📌 <strong>Quick Access Tip:</strong> Bookmark your portal link (<code style="color: #10b981;">Ctrl + D</code> or save to your phone browser home screen) to access your live revenue earnings anytime without requiring a password!
      </p>
    </div>
  `;
    await emailHelper_1.emailHelper.sendEmail({
        to: partner.email,
        subject: `Your CultureCards Partner Portal Link & Promo Code (${partner.promoCode})`,
        html,
    });
    return { success: true, message: `Magic portal link sent to ${partner.email}` };
};
const validatePromoCode = async (code) => {
    if (!code) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Promo code query parameter is required.');
    }
    const cleanCode = code.trim().toUpperCase();
    const partner = await partner_model_1.Partner.findOne({ promoCode: cleanCode }).select('name promoCode');
    if (!partner) {
        return { valid: false, promoCode: cleanCode };
    }
    return {
        valid: true,
        promoCode: partner.promoCode,
        partnerName: partner.name,
    };
};
exports.PartnerService = {
    requestPartnerOTP,
    verifyPartnerOTP,
    createPartnerByAdmin,
    getAllPartners,
    getPartnerDashboardByToken,
    updatePartnerBankDetails,
    recordCommissionForOrder,
    sendMagicLinkEmailToPartner,
    validatePromoCode,
};
