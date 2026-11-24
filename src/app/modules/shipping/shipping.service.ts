import { StatusCodes } from 'http-status-codes'
import { Types } from 'mongoose'
import { JwtPayload } from 'jsonwebtoken'
import ApiError from '../../../errors/ApiError'
import { USER_ROLES } from '../../../enum/user'
import { User } from '../user/user.model'
import { Product } from '../product/product.model'
import { Order } from '../order/order.model'
import { OrderServices } from '../order/order.service'
import { IDeliveryStatus, IJourneyUpdate } from '../order/order.interface'
import { IShipFromAddress } from '../user/user.interface'
import { getShippingProvider } from './providers'
import {
  CUSTOM_PACKAGE,
  DEFAULT_PACKAGE,
  DEFAULT_WEIGHT_LB,
  PACKAGE_PRESETS,
} from './shipping.constants'
import {
  Parcel,
  ShippingAddress,
  TrackingStatus,
  TrackingUpdate,
} from './shipping.interface'

const isAdmin = (user: JwtPayload) =>
  user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPER_ADMIN

// ── Packages ────────────────────────────────────────────────────────────────

const getPackagePresets = () => PACKAGE_PRESETS

/**
 * The parcel a product ships in. Listings made before presets existed have
 * no package and often no weight, so they fall back to a small bubble mailer
 * of cards rather than failing to quote.
 */
const parcelForProduct = (product: {
  packageType?: string
  packageDimensions?: { lengthIn: number; widthIn: number; heightIn: number }
  shippingWeight?: number
}): Parcel => {
  const weightLb =
    product.shippingWeight && product.shippingWeight > 0
      ? product.shippingWeight
      : DEFAULT_WEIGHT_LB
  const weightOz = Math.max(1, Math.round(weightLb * 16 * 10) / 10)

  if (product.packageType === CUSTOM_PACKAGE && product.packageDimensions) {
    const d = product.packageDimensions
    return { lengthIn: d.lengthIn, widthIn: d.widthIn, heightIn: d.heightIn, weightOz }
  }

  const preset =
    PACKAGE_PRESETS.find(p => p.id === product.packageType) ??
    PACKAGE_PRESETS.find(p => p.id === DEFAULT_PACKAGE)!
  return {
    lengthIn: preset.lengthIn,
    widthIn: preset.widthIn,
    heightIn: preset.heightIn,
    weightOz,
  }
}

// ── Addresses ───────────────────────────────────────────────────────────────

const shipFromToAddress = (a: IShipFromAddress): ShippingAddress => ({
  name: a.name,
  street1: a.street1,
  street2: a.street2,
  city: a.city,
  state: a.state,
  zip: a.zip,
  country: a.country,
  phone: a.phone,
})

const getShipFromAddress = async (userId: string) => {
  const user = await User.findById(userId).select('shipFromAddress').lean()
  return (user as any)?.shipFromAddress?.street1
    ? ((user as any).shipFromAddress as IShipFromAddress)
    : null
}

/** Saves the address a seller ships from, after the carrier accepts it. */
const setShipFromAddress = async (
  userId: string,
  input: Omit<IShipFromAddress, 'verifiedAt'>,
): Promise<IShipFromAddress> => {
  const verification = await getShippingProvider().verifyAddress(
    shipFromToAddress(input as IShipFromAddress),
  )
  if (!verification.valid || !verification.address) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      verification.errors.join(' ') || 'This address could not be verified.',
    )
  }

  const a = verification.address
  const shipFromAddress: IShipFromAddress = {
    name: input.name,
    street1: a.street1,
    street2: a.street2,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country,
    phone: input.phone,
    verifiedAt: new Date(),
  }
  await User.updateOne({ _id: userId }, { $set: { shipFromAddress } })
  return shipFromAddress
}

/** Orders store the buyer's address in the older street/postalCode shape. */
const orderAddressToShippingAddress = (
  a: any,
  name?: string,
): ShippingAddress | null => {
  if (!a?.street || a.street === 'N/A' || !a.postalCode || a.postalCode === '00000') {
    return null
  }
  return {
    name,
    street1: a.street,
    city: a.city,
    state: a.state,
    zip: a.postalCode,
    country: a.country || 'US',
  }
}

// ── Rates ───────────────────────────────────────────────────────────────────

/** Live rates for shipping one product to the buyer's address. */
const quoteRatesForProduct = async (input: {
  productId: string
  toAddress: ShippingAddress
}) => {
  if (!Types.ObjectId.isValid(input.productId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid product id.')
  }
  const product = await Product.findById(input.productId)
    .select('sellerId shippingWeight packageType packageDimensions isTradeOnly')
    .lean()
  if (!product) throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found.')

  const from = await getShipFromAddress(String(product.sellerId))
  if (!from) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'The seller has not set a shipping address yet, so shipping cannot be calculated.',
    )
  }

  const parcel = parcelForProduct(product as any)
  const quote = await getShippingProvider().getRates(
    shipFromToAddress(from),
    input.toAddress,
    parcel,
  )
  return {
    provider: getShippingProvider().name,
    shipmentId: quote.shipmentId,
    parcel,
    rates: [...quote.rates].sort((a, b) => a.amount - b.amount),
  }
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** Stops a double tap from buying two labels for one order. */
const labelsInFlight = new Set<string>()

/**
 * Buys the shipping label for a paid order. The seller (or an admin) calls
 * this when they are ready to ship. Buying again returns the label already
 * bought rather than paying twice.
 */
const buyLabelForOrder = async (
  user: JwtPayload,
  orderId: string,
  options: { service?: string } = {},
) => {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid order id.')
  }
  const order = await Order.findById(orderId)
  if (!order) throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.')

  if (String(order.sellerId) !== String(user.userId) && !isAdmin(user)) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Only the seller can buy the label for this order.',
    )
  }
  if (order.paymentStatus !== 'paid') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This order has not been paid, so no label can be bought.',
    )
  }
  if (order.deliveryStatus === 'cancelled') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This order was cancelled.')
  }
  if (order.shipment?.shipmentId && !order.shipment.refundedAt) {
    return order
  }

  if (labelsInFlight.has(orderId)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'The label for this order is already being created. Please wait a moment.',
    )
  }
  labelsInFlight.add(orderId)

  try {
    const [from, product, buyer] = await Promise.all([
      getShipFromAddress(String(order.sellerId)),
      Product.findById(order.productId)
        .select('shippingWeight packageType packageDimensions')
        .lean(),
      User.findById(order.buyerId).select('fullName name').lean(),
    ])

    if (!from) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Add your shipping address before buying a label.',
      )
    }
    const to = orderAddressToShippingAddress(
      order.shippingAddress,
      (buyer as any)?.fullName || (buyer as any)?.name,
    )
    if (!to) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "This order has no complete delivery address. Ask the buyer to update it before shipping.",
      )
    }

    const provider = getShippingProvider()
    const parcel = parcelForProduct((product as any) || {})
    const fromAddress = shipFromToAddress(from)
    const quote = await provider.getRates(fromAddress, to, parcel)
    const sorted = [...quote.rates].sort((a, b) => a.amount - b.amount)
    const rate =
      (options.service && sorted.find(r => r.service === options.service)) ||
      sorted[0]

    const label = await provider.buyLabel({
      shipmentId: quote.shipmentId,
      rateId: rate.id,
      from: fromAddress,
      to,
      parcel,
    })

    order.shipment = {
      provider: provider.name,
      shipmentId: label.shipmentId,
      rateId: label.rateId,
      carrier: label.carrier,
      service: label.service,
      labelCost: label.cost,
      trackerId: label.trackerId,
      trackingStatus: 'pre_transit',
      purchasedAt: new Date(),
    }
    order.shippingLabelUrl = label.labelUrl
    order.shippingWeight = Number((parcel.weightOz / 16).toFixed(2))
    if (!order.trackingDetails) {
      order.trackingDetails = { journeyUpdates: [] } as any
    }
    order.trackingDetails.carrier = label.carrier
    order.trackingDetails.trackingNumber = label.trackingCode
    order.trackingDetails.journeyUpdates.push({
      status: 'Label Created',
      description: `${label.carrier} ${label.service} label created. Waiting for the seller to drop it off.`,
      location: `${from.city}, ${from.state}`,
      timestamp: new Date(),
    })
    await order.save()
    return order
  } finally {
    labelsInFlight.delete(orderId)
  }
}

/** Voids an unused label so ARIES gets the postage back. */
const voidLabelForOrder = async (orderId: string) => {
  const order = await Order.findById(orderId)
  if (!order?.shipment?.shipmentId || order.shipment.refundedAt) return order
  if (order.shipment.trackingStatus && order.shipment.trackingStatus !== 'pre_transit') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This package is already with the carrier, so its label cannot be voided.',
    )
  }
  await getShippingProvider().refundLabel(order.shipment.shipmentId)
  order.shipment.refundedAt = new Date()
  await order.save()
  return order
}

// ── Tracking ────────────────────────────────────────────────────────────────

const STATUS_TITLES: Record<TrackingStatus, string> = {
  pre_transit: 'Label Created',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  return_to_sender: 'Returning to Sender',
  failure: 'Delivery Problem',
  unknown: 'Shipment Update',
}

const deliveryStatusFor = (
  status: TrackingStatus,
): IDeliveryStatus | null => {
  if (status === 'in_transit' || status === 'out_for_delivery') return 'shipped'
  if (status === 'delivered') return 'delivered'
  return null
}

/**
 * Records what the carrier reported. New events are added to the order's
 * journey; when the package moves to a new stage (shipped, delivered) the
 * last event goes through OrderServices.updateOrderJourney so the buyer gets
 * the usual chat message and push notification.
 */
const applyTrackingUpdate = async (update: TrackingUpdate) => {
  if (!update.trackingCode) return null
  const order = await Order.findOne({
    'trackingDetails.trackingNumber': update.trackingCode,
  })
  if (!order) return null

  const seen = new Set(
    (order.trackingDetails?.journeyUpdates || []).map(
      j => `${new Date(j.timestamp).getTime()}|${j.description}`,
    ),
  )
  const fresh: IJourneyUpdate[] = [...update.events]
    .sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
    .map(e => ({
      status: STATUS_TITLES[e.status],
      description: e.message,
      location: e.location,
      timestamp: e.datetime,
    }))
    .filter(j => !seen.has(`${j.timestamp.getTime()}|${j.description}`))

  const nextDelivery = deliveryStatusFor(update.status)
  const stageChanged =
    nextDelivery !== null &&
    nextDelivery !== order.deliveryStatus &&
    order.deliveryStatus !== 'cancelled' &&
    // Never move a delivered order back to shipped on a late event.
    !(order.deliveryStatus === 'delivered' && nextDelivery === 'shipped')

  const announce = stageChanged ? fresh.pop() : undefined

  order.trackingDetails.journeyUpdates.push(...fresh)
  if (update.estimatedDelivery) {
    order.trackingDetails.estimatedDelivery = update.estimatedDelivery
  }
  if (order.shipment) order.shipment.trackingStatus = update.status
  await order.save()

  if (stageChanged && nextDelivery) {
    await OrderServices.updateOrderJourney(
      String(order._id),
      announce ?? {
        status: STATUS_TITLES[update.status],
        description: STATUS_TITLES[update.status],
        timestamp: new Date(),
      },
      nextDelivery,
    )
  }
  return Order.findById(order._id)
}

const handleEasyPostWebhook = async (
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
) => {
  const update = getShippingProvider().parseTrackingWebhook(rawBody, headers)
  if (update) await applyTrackingUpdate(update)
}

const MOCK_STEPS: { status: TrackingStatus; message: string }[] = [
  { status: 'in_transit', message: 'Accepted at USPS origin facility' },
  { status: 'in_transit', message: 'Arrived at USPS regional facility' },
  { status: 'out_for_delivery', message: 'Out for delivery' },
  { status: 'delivered', message: 'Delivered, in/at mailbox' },
]

/**
 * Mock provider only: moves an order's package one step along, standing in
 * for the carrier's tracking webhook so the app's tracking screen can be
 * tested.
 */
const simulateTrackingStep = async (orderId: string) => {
  if (getShippingProvider().name !== 'mock') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Tracking can only be simulated with the mock shipping provider.',
    )
  }
  const order = await Order.findById(orderId)
  const code = order?.trackingDetails?.trackingNumber
  if (!order?.shipment?.shipmentId || !code) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Buy a label for this order first.')
  }
  const done = (order.trackingDetails.journeyUpdates || []).filter(j =>
    MOCK_STEPS.some(s => s.message === j.description),
  ).length
  const step = MOCK_STEPS[done]
  if (!step) return order

  const to = order.shippingAddress as any
  return applyTrackingUpdate({
    trackingCode: code,
    status: step.status,
    events: [
      {
        status: step.status,
        message: step.message,
        location:
          step.status === 'in_transit' && done === 0
            ? undefined
            : [to?.city, to?.state].filter(Boolean).join(', ') || undefined,
        datetime: new Date(),
      },
    ],
  })
}

export const ShippingServices = {
  getPackagePresets,
  parcelForProduct,
  getShipFromAddress,
  setShipFromAddress,
  quoteRatesForProduct,
  buyLabelForOrder,
  voidLabelForOrder,
  applyTrackingUpdate,
  handleEasyPostWebhook,
  simulateTrackingStep,
}
