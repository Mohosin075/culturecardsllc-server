import { Schema, model, Document } from 'mongoose'
import { IPlatformSettings } from './dashboard.interface'

export interface ISystemSettingsDocument extends IPlatformSettings, Document {}

const systemSettingsSchema = new Schema<ISystemSettingsDocument>(
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

export const SystemSettings = model<ISystemSettingsDocument>(
  'SystemSettings',
  systemSettingsSchema,
)
export default SystemSettings
