import crypto from 'crypto'
import { StatusCodes } from 'http-status-codes'
import ApiError from '../../../../errors/ApiError'
import config from '../../../../config'
import { SHIPPING_CARRIER } from '../shipping.constants'
import {
  AddressVerification,
  BuyLabelInput,
  Parcel,
  PurchasedLabel,
  RateQuote,
  ShippingAddress,
  ShippingProvider,
  TrackingStatus,
  TrackingUpdate,
} from '../shipping.interface'

/**
 * EasyPost over its REST API (https://docs.easypost.com).
 *
 * Plain fetch instead of the SDK keeps the dependency list as it is; we only
 * use five endpoints. Written ahead of the API key, so it has not run against
 * EasyPost yet — test it with the test key (EZTK…) before going live.
 */

const BASE_URL = 'https://api.easypost.com/v2'

const apiKey = (): string => {
  const key = config.shipping.easypostApiKey
  if (!key) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'Shipping is not configured yet. Please try again later.',
    )
  }
  return key
}

const request = async <T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey()}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      json?.error?.message || `EasyPost request failed (${res.status}).`
    console.error('[EasyPost]', method, path, res.status, json?.error)
    throw new ApiError(
      res.status >= 500 ? StatusCodes.BAD_GATEWAY : StatusCodes.BAD_REQUEST,
      message,
    )
  }
  return json as T
}

const toEasyPostAddress = (a: ShippingAddress) => ({
  name: a.name,
  company: a.company,
  street1: a.street1,
  street2: a.street2,
  city: a.city,
  state: a.state,
  zip: a.zip,
  country: a.country,
  phone: a.phone,
  email: a.email,
})

const fromEasyPostAddress = (a: any): ShippingAddress => ({
  name: a.name || undefined,
  company: a.company || undefined,
  street1: a.street1,
  street2: a.street2 || undefined,
  city: a.city,
  state: a.state,
  zip: a.zip,
  country: a.country,
  phone: a.phone || undefined,
  email: a.email || undefined,
})

const toEasyPostParcel = (p: Parcel) => ({
  length: p.lengthIn,
  width: p.widthIn,
  height: p.heightIn,
  weight: p.weightOz,
})

const TRACKING_STATUSES: TrackingStatus[] = [
  'pre_transit',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'return_to_sender',
  'failure',
]

const toTrackingStatus = (s: string): TrackingStatus =>
  (TRACKING_STATUSES as string[]).includes(s) ? (s as TrackingStatus) : 'unknown'

/**
 * EasyPost signs webhooks with HMAC-SHA256 over the raw body, keyed with the
 * webhook secret (NFKD-normalised), and sends it as
 * `X-Hmac-Signature: hmac-sha256-hex=<hex>`.
 */
const signatureIsValid = (
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
): boolean => {
  if (!header) return false
  const expected = crypto
    .createHmac('sha256', secret.normalize('NFKD'))
    .update(rawBody)
    .digest('hex')
  const given = header.replace(/^hmac-sha256-hex=/, '')
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const easypostShippingProvider: ShippingProvider = {
  name: 'easypost',

  async verifyAddress(address): Promise<AddressVerification> {
    const result = await request<any>('POST', '/addresses', {
      address: toEasyPostAddress(address),
      verify: ['delivery'],
    })
    const delivery = result?.verifications?.delivery
    if (delivery?.success) {
      return { valid: true, address: fromEasyPostAddress(result), errors: [] }
    }
    return {
      valid: false,
      errors: (delivery?.errors || []).map((e: any) => e.message),
    }
  },

  async getRates(from, to, parcel): Promise<RateQuote> {
    const shipment = await request<any>('POST', '/shipments', {
      shipment: {
        from_address: toEasyPostAddress(from),
        to_address: toEasyPostAddress(to),
        parcel: toEasyPostParcel(parcel),
      },
    })

    const rates = (shipment.rates || [])
      .filter((r: any) => r.carrier === SHIPPING_CARRIER)
      .map((r: any) => ({
        id: r.id,
        shipmentId: shipment.id,
        carrier: r.carrier,
        service: r.service,
        amount: Number(r.rate),
        currency: r.currency || 'USD',
        deliveryDays: r.delivery_days ?? null,
      }))

    if (!rates.length) {
      const messages = (shipment.messages || [])
        .map((m: any) => m.message)
        .join(' ')
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        messages || 'USPS returned no rates for this package.',
      )
    }

    return { shipmentId: shipment.id, rates }
  },

  async buyLabel(input: BuyLabelInput): Promise<PurchasedLabel> {
    const shipment = await request<any>(
      'POST',
      `/shipments/${input.shipmentId}/buy`,
      { rate: { id: input.rateId } },
    )
    return {
      shipmentId: shipment.id,
      rateId: shipment.selected_rate?.id ?? input.rateId,
      carrier: shipment.selected_rate?.carrier ?? SHIPPING_CARRIER,
      service: shipment.selected_rate?.service ?? '',
      trackingCode: shipment.tracking_code,
      labelUrl: shipment.postage_label?.label_url,
      cost: Number(shipment.selected_rate?.rate ?? 0),
      trackerId: shipment.tracker?.id,
    }
  },

  async refundLabel(shipmentId: string): Promise<void> {
    await request('POST', `/shipments/${shipmentId}/refund`)
  },

  parseTrackingWebhook(rawBody, headers): TrackingUpdate | null {
    const secret = config.shipping.easypostWebhookSecret
    if (!secret) {
      throw new ApiError(
        StatusCodes.SERVICE_UNAVAILABLE,
        'EasyPost webhook secret is not configured.',
      )
    }
    const header = headers['x-hmac-signature']
    if (!signatureIsValid(rawBody, Array.isArray(header) ? header[0] : header, secret)) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid webhook signature.')
    }

    const event = JSON.parse(rawBody.toString('utf8'))
    if (!String(event?.description || '').startsWith('tracker.')) return null

    const tracker = event.result || {}
    return {
      trackingCode: tracker.tracking_code,
      status: toTrackingStatus(tracker.status),
      estimatedDelivery: tracker.est_delivery_date
        ? new Date(tracker.est_delivery_date)
        : undefined,
      events: (tracker.tracking_details || []).map((d: any) => ({
        status: toTrackingStatus(d.status),
        message: d.message || d.status,
        location: [d.tracking_location?.city, d.tracking_location?.state]
          .filter(Boolean)
          .join(', ') || undefined,
        datetime: new Date(d.datetime),
      })),
    }
  },
}
