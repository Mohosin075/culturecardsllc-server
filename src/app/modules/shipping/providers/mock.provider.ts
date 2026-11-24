import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { generateMockShippingLabel } from '../../../../helpers/shippingHelper'
import { SHIPPING_CARRIER } from '../shipping.constants'
import {
  AddressVerification,
  BuyLabelInput,
  Parcel,
  PurchasedLabel,
  RateQuote,
  ShippingAddress,
  ShippingProvider,
  ShippingRate,
} from '../shipping.interface'

/**
 * Stand-in for EasyPost while we wait for API keys.
 *
 * Rates follow the shape of real USPS pricing — they grow with distance
 * (zone) and billable weight, and large boxes are charged by dimensional
 * weight — so the app and the money flow can be built and tested end to end.
 * The numbers are realistic, not real. Labels are PDFs marked as samples and
 * tracking numbers start with MOCK, so nothing here can be mistaken for real
 * postage.
 */

/** USPS bills a box over one cubic foot by size when that beats its weight. */
const DIM_DIVISOR = 166
const CUBIC_FOOT = 1728

const billableWeightLb = (parcel: Parcel): number => {
  const actualLb = parcel.weightOz / 16
  const volume = parcel.lengthIn * parcel.widthIn * parcel.heightIn
  const dimLb = volume > CUBIC_FOOT ? volume / DIM_DIVISOR : 0
  return Math.max(actualLb, dimLb, 1 / 16)
}

/** Zones 1–8 from how far apart the first three ZIP digits are. */
const zoneBetween = (fromZip: string, toZip: string): number => {
  const a = parseInt(String(fromZip).slice(0, 3), 10)
  const b = parseInt(String(toZip).slice(0, 3), 10)
  if (Number.isNaN(a) || Number.isNaN(b)) return 5
  return Math.min(8, Math.max(1, 1 + Math.floor(Math.abs(a - b) / 110)))
}

const SERVICES = [
  { service: 'GroundAdvantage', base: 4.25, perZone: 0.4, perLb: 1.6, days: (z: number) => 2 + Math.ceil(z / 2) },
  { service: 'Priority', base: 8.1, perZone: 0.85, perLb: 2.1, days: (z: number) => 1 + Math.ceil(z / 3) },
  { service: 'Express', base: 28.75, perZone: 1.9, perLb: 3, days: () => 1 },
] as const

const money = (n: number) => Math.round(n * 100) / 100
const randomId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(8).toString('hex')}`

const oneLine = (a: ShippingAddress) =>
  [a.street1, a.street2, `${a.city}, ${a.state} ${a.zip}`]
    .filter(Boolean)
    .join(', ')

const US_ZIP = /^\d{5}(-\d{4})?$/
const US_STATE = /^[A-Z]{2}$/

const isUS = (country: string) =>
  ['US', 'USA', 'UNITED STATES'].includes(String(country).trim().toUpperCase())

export const mockShippingProvider: ShippingProvider = {
  name: 'mock',

  async verifyAddress(address: ShippingAddress): Promise<AddressVerification> {
    const errors: string[] = []
    const normalised: ShippingAddress = {
      ...address,
      street1: address.street1?.trim(),
      street2: address.street2?.trim() || undefined,
      city: address.city?.trim(),
      state: address.state?.trim().toUpperCase(),
      zip: address.zip?.trim(),
      country: isUS(address.country) ? 'US' : address.country?.trim(),
    }

    if (!normalised.street1) errors.push('Street address is required.')
    if (!normalised.city) errors.push('City is required.')
    if (normalised.country !== 'US') {
      errors.push('We can only ship within the United States for now.')
    } else {
      if (!US_STATE.test(normalised.state || '')) {
        errors.push('Use the two-letter state code, for example FL.')
      }
      if (!US_ZIP.test(normalised.zip || '')) {
        errors.push('Enter a 5-digit ZIP code.')
      }
    }

    return errors.length
      ? { valid: false, errors }
      : { valid: true, address: normalised, errors: [] }
  },

  async getRates(from, to, parcel): Promise<RateQuote> {
    const shipmentId = randomId('mock_shp')
    const zone = zoneBetween(from.zip, to.zip)
    const weightLb = billableWeightLb(parcel)

    const rates: ShippingRate[] = SERVICES.map(s => ({
      id: `${shipmentId}:${s.service}`,
      shipmentId,
      carrier: SHIPPING_CARRIER,
      service: s.service,
      amount: money(s.base + s.perZone * zone + s.perLb * Math.ceil(weightLb)),
      currency: 'USD',
      deliveryDays: s.days(zone),
    }))

    return { shipmentId, rates }
  },

  async buyLabel(input: BuyLabelInput): Promise<PurchasedLabel> {
    // The rate id carries the service, so the label matches what was quoted.
    const service = input.rateId.split(':')[1] || 'GroundAdvantage'
    const quote = await this.getRates(input.from, input.to, input.parcel)
    const rate =
      quote.rates.find(r => r.service === service) ?? quote.rates[0]

    const trackingCode = `MOCK9400${Math.floor(
      1e13 + Math.random() * 9e13,
    )}`

    const pdf = await generateMockShippingLabel({
      carrier: `${SHIPPING_CARRIER} (SAMPLE LABEL)`,
      trackingNumber: trackingCode,
      fromName: input.from.name || input.from.company || 'Sender',
      fromAddress: oneLine(input.from),
      toName: input.to.name || 'Recipient',
      toAddress: oneLine(input.to),
      weight: Number((input.parcel.weightOz / 16).toFixed(2)),
    })

    const dir = path.join(process.cwd(), 'uploads', 'labels')
    fs.mkdirSync(dir, { recursive: true })
    const fileName = `label-${trackingCode}.pdf`
    fs.writeFileSync(path.join(dir, fileName), pdf)

    return {
      shipmentId: input.shipmentId,
      rateId: input.rateId,
      carrier: SHIPPING_CARRIER,
      service: rate.service,
      trackingCode,
      labelUrl: `/uploads/labels/${fileName}`,
      cost: rate.amount,
    }
  },

  async refundLabel(): Promise<void> {
    // Nothing was paid for, so there is nothing to give back.
  },

  parseTrackingWebhook() {
    // The mock has no carrier calling back; tracking is advanced by hand
    // through ShippingServices.simulateTrackingStep.
    return null
  },
}
