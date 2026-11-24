/**
 * Package presets a seller (or trade participant) picks when listing an item.
 *
 * A carrier cannot quote a real rate without box dimensions, and most sellers
 * do not measure their mailers, so they choose the closest preset instead.
 * "custom" lets them enter their own dimensions.
 *
 * Dimensions are inches. Weight is never part of a preset: the seller always
 * enters it, because a mailer with one card and one with ten weigh differently.
 *
 * These are a proposal waiting on the client's approval
 * (docs/CLIENT_FOLLOWUP_TRADE_MANAGEMENT.md, #3).
 */
export type PackagePresetId =
  | 'plain_envelope'
  | 'small_bubble_mailer'
  | 'large_bubble_mailer'
  | 'small_box'
  | 'medium_box'
  | 'large_box'

export const CUSTOM_PACKAGE = 'custom' as const

export type PackageType = PackagePresetId | typeof CUSTOM_PACKAGE

export type PackagePreset = {
  id: PackagePresetId
  name: string
  description: string
  lengthIn: number
  widthIn: number
  heightIn: number
}

export const PACKAGE_PRESETS: readonly PackagePreset[] = [
  {
    id: 'plain_envelope',
    name: 'Plain envelope',
    description: 'A single raw card',
    lengthIn: 6,
    widthIn: 4,
    heightIn: 0.25,
  },
  {
    id: 'small_bubble_mailer',
    name: 'Small bubble mailer',
    description: '1–3 cards in toploaders',
    lengthIn: 7.25,
    widthIn: 6,
    heightIn: 0.5,
  },
  {
    id: 'large_bubble_mailer',
    name: 'Large bubble mailer',
    description: 'A graded slab or a small lot',
    lengthIn: 10.5,
    widthIn: 6.5,
    heightIn: 1,
  },
  {
    id: 'small_box',
    name: 'Small box',
    description: '1–2 graded slabs',
    lengthIn: 8.6,
    widthIn: 5.4,
    heightIn: 1.6,
  },
  {
    id: 'medium_box',
    name: 'Medium box',
    description: 'Several slabs or a sealed box',
    lengthIn: 11,
    widthIn: 8.5,
    heightIn: 5.5,
  },
  {
    id: 'large_box',
    name: 'Large box',
    description: 'Large lots',
    lengthIn: 12,
    widthIn: 12,
    heightIn: 6,
  },
] as const

export const PACKAGE_TYPES: readonly PackageType[] = [
  ...PACKAGE_PRESETS.map(p => p.id),
  CUSTOM_PACKAGE,
]

/** Used when an older listing has no package at all. */
export const DEFAULT_PACKAGE: PackagePresetId = 'small_bubble_mailer'

/** Used when an older listing has no weight. 4 oz covers a mailer of cards. */
export const DEFAULT_WEIGHT_LB = 0.25

/** We ship with USPS only (client decision, #1). */
export const SHIPPING_CARRIER = 'USPS'
