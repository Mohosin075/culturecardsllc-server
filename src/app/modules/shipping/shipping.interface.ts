/**
 * Provider-neutral shipping types. The rest of the backend only ever sees
 * these, so switching from the mock provider to EasyPost changes nothing
 * outside `providers/`.
 */

export type ShippingAddress = {
  name?: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  email?: string
}

/** Inches and ounces, the units carriers quote in. */
export type Parcel = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightOz: number
}

export type ShippingRate = {
  id: string
  shipmentId: string
  carrier: string
  service: string
  /** Dollars. */
  amount: number
  currency: string
  deliveryDays: number | null
}

export type RateQuote = {
  shipmentId: string
  rates: ShippingRate[]
}

export type PurchasedLabel = {
  shipmentId: string
  rateId: string
  carrier: string
  service: string
  trackingCode: string
  labelUrl: string
  /** Dollars actually paid for the label. */
  cost: number
  trackerId?: string
}

export type TrackingStatus =
  | 'pre_transit'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'return_to_sender'
  | 'failure'
  | 'unknown'

export type TrackingEvent = {
  status: TrackingStatus
  message: string
  location?: string
  datetime: Date
}

export type TrackingUpdate = {
  trackingCode: string
  status: TrackingStatus
  estimatedDelivery?: Date
  events: TrackingEvent[]
}

export type AddressVerification = {
  valid: boolean
  /** The carrier-normalised address when valid. */
  address?: ShippingAddress
  errors: string[]
}

export type BuyLabelInput = {
  shipmentId: string
  rateId: string
  /**
   * The mock provider keeps no state between quoting and buying, so it needs
   * the shipment again to draw the label. EasyPost ignores these.
   */
  from: ShippingAddress
  to: ShippingAddress
  parcel: Parcel
}

export interface ShippingProvider {
  readonly name: 'mock' | 'easypost'
  verifyAddress(address: ShippingAddress): Promise<AddressVerification>
  getRates(
    from: ShippingAddress,
    to: ShippingAddress,
    parcel: Parcel,
  ): Promise<RateQuote>
  buyLabel(input: BuyLabelInput): Promise<PurchasedLabel>
  /** Voids an unused label so the money comes back. */
  refundLabel(shipmentId: string): Promise<void>
  /**
   * Checks a webhook's signature and turns it into a tracking update.
   * Returns null for events we do not care about.
   */
  parseTrackingWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): TrackingUpdate | null
}
