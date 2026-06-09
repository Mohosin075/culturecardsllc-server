'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.SystemSettings = void 0
const mongoose_1 = require('mongoose')
const systemSettingsSchema = new mongoose_1.Schema(
  {
    commissionSettings: {
      purchaseCommission: { type: Number, default: 5 },
      tradeCommission: { type: Number, default: 2.5 },
    },
    paymentGateway: {
      primaryProcessor: { type: String, default: 'Stripe' },
      apiKey: { type: String, default: 'sk_live_*******************' },
      enableTestMode: { type: Boolean, default: false },
    },
    notificationSettings: {
      newOrderNotifications: { type: Boolean, default: true },
      disputeAlerts: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true },
    },
    securitySettings: {
      twoFactorAuthentication: { type: Boolean, default: true },
      ipWhitelist: { type: Boolean, default: false },
      sessionTimeout: { type: Number, default: 30 },
    },
  },
  {
    timestamps: true,
  },
)
exports.SystemSettings = (0, mongoose_1.model)(
  'SystemSettings',
  systemSettingsSchema,
)
exports.default = exports.SystemSettings
