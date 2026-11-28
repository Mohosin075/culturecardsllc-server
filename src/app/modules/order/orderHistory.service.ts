import { Types } from 'mongoose'
import { Order } from './order.model'
import { Payment } from '../payment/payment.model'
import { MarketplaceCharge } from '../payment/marketplaceCharge'
import { TradeSettlement } from '../trade/tradeSettlement.model'
import { TradeOffer } from '../trade/trade.model'
import { SellerApplication } from '../seller/seller.model'
import { StripeConnectService } from '../seller/stripeConnect.service'

/**
 * Sales and purchase history.
 *
 * Every number here is worked out on the server from what was stored when the
 * money moved: the order's `amountDetails` and the ARIES fee recorded on the
 * Payment (`metadata.platformFeeCents`). When an older order has no fee on
 * record, the fee is recomputed from the item price at the current sale rate,
 * which is what Stripe was told to take at the time unless an admin has since
 * changed the rate.
 */

export type HistoryRole = 'seller' | 'buyer'
export type HistoryPeriod = '7d' | '30d' | 'all'
export type HistoryStatus = 'paid' | 'shipped' | 'delivered' | 'refunded'
export type HistoryKind = 'buy_now' | 'auction_win' | 'giveaway' | 'trade_cash'

export type HistoryRow = {
  id: string
  kind: HistoryKind
  /** Order id for sales and purchases; trade offer id for trade cash. */
  orderId?: string
  tradeOfferId?: string
  tradeCode?: string
  title: string
  image: string
  date: Date
  counterparty: { id: string; name: string; image: string }
  status: HistoryStatus
  itemPrice: number
  shipping: number
  taxes: number
  /** What the buyer paid in total. */
  totalPaid: number
  /** Seller rows only: ARIES's cut. */
  ariesFee?: number
  /** Seller rows only: what the seller keeps (0 once refunded). */
  net?: number
  /** Unshipped orders: the date the seller must ship by. */
  shipByDate?: Date
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const periodStart = (period: HistoryPeriod): Date | null => {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

const startOfMonth = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

const displayName = (user: any): string =>
  user?.userName || user?.fullName || user?.name || 'ARIES user'

const firstImage = (product: any): string => {
  const images = product?.images
  if (Array.isArray(images) && images.length) return String(images[0])
  return typeof product?.image === 'string' ? product.image : ''
}

const orderStatus = (order: any): HistoryStatus => {
  if (order.paymentStatus === 'refunded' || order.deliveryStatus === 'cancelled') {
    return 'refunded'
  }
  if (order.deliveryStatus === 'delivered') return 'delivered'
  if (order.deliveryStatus === 'shipped') return 'shipped'
  return 'paid'
}

/** ARIES fee in dollars for each order, keyed by order id. */
const feesForOrders = async (orders: any[]): Promise<Map<string, number>> => {
  const intentIds = orders.map(o => o.paymentIntentId).filter(Boolean)
  const orderIds = orders.map(o => o._id)
  const payments = await Payment.find({
    $or: [{ paymentIntentId: { $in: intentIds } }, { orderId: { $in: orderIds } }],
  })
    .select('paymentIntentId orderId metadata')
    .lean()

  const byIntent = new Map<string, any>()
  const byOrder = new Map<string, any>()
  for (const p of payments) {
    if (p.paymentIntentId) byIntent.set(String(p.paymentIntentId), p)
    if (p.orderId) byOrder.set(String(p.orderId), p)
  }

  const feeSettings = await MarketplaceCharge.getFeeSettings()
  const fees = new Map<string, number>()
  for (const order of orders) {
    const payment =
      (order.paymentIntentId && byIntent.get(String(order.paymentIntentId))) ||
      byOrder.get(String(order._id))
    const stored = Number((payment?.metadata as any)?.platformFeeCents)
    const item = Number(order.amountDetails?.itemSubtotal || 0)
    const totalCents = Math.round(Number(order.amountDetails?.totalPaid || 0) * 100)
    const cents = Number.isFinite(stored) && stored >= 0
      ? stored
      : Math.min(MarketplaceCharge.calculateSaleFee(item, feeSettings), totalCents)
    fees.set(String(order._id), cents / 100)
  }
  return fees
}

const orderRows = async (userId: Types.ObjectId, role: HistoryRole): Promise<HistoryRow[]> => {
  const orders = await Order.find({
    [role === 'seller' ? 'sellerId' : 'buyerId']: userId,
    purchaseType: { $in: ['buy_now', 'auction_win'] },
    // Pending and failed checkouts never took money; they are not history.
    paymentStatus: { $in: ['paid', 'refunded'] },
  })
    .select(
      'buyerId sellerId productId purchaseType isGiveaway amountDetails paymentStatus deliveryStatus paymentIntentId shipByDate createdAt',
    )
    .populate('productId', 'title images')
    .populate(role === 'seller' ? 'buyerId' : 'sellerId', 'userName fullName name image photo')
    .lean()

  const fees = role === 'seller' ? await feesForOrders(orders) : null

  return orders.map((order: any) => {
    const a = order.amountDetails || {}
    const status = orderStatus(order)
    const other = role === 'seller' ? order.buyerId : order.sellerId
    const itemPrice = Number(a.itemSubtotal || 0)
    const taxes = Number(a.taxes || 0)
    const totalPaid = Number(a.totalPaid || 0)
    // Only the shipping that was actually charged. Auction wins get a
    // shipping quote stored on the order but were charged the bid alone.
    const shipping = Math.max(0, Math.min(Number(a.shipping || 0), totalPaid - itemPrice - taxes))
    const row: HistoryRow = {
      id: String(order._id),
      // Giveaway wins stay in the list (they still ship) but carry no money.
      kind: order.isGiveaway ? 'giveaway' : order.purchaseType,
      orderId: String(order._id),
      title: order.productId?.title || 'Item',
      image: firstImage(order.productId),
      date: order.createdAt,
      counterparty: {
        id: String(other?._id ?? other ?? ''),
        name: displayName(other),
        image: other?.image || other?.photo || '',
      },
      status,
      itemPrice: round2(itemPrice),
      shipping: round2(shipping),
      taxes: round2(taxes),
      totalPaid: round2(totalPaid),
    }
    if (status === 'paid' && order.shipByDate) row.shipByDate = order.shipByDate
    if (fees) {
      const fee = fees.get(String(order._id)) || 0
      // Shipping reaches the seller untouched; tax is collected for the
      // authorities and is not the seller's income. A refund (with
      // refund_application_fee) takes the whole sale back.
      row.ariesFee = status === 'refunded' ? 0 : round2(fee)
      row.net = status === 'refunded' ? 0 : round2(itemPrice + shipping - fee)
    }
    return row
  })
}

/** Cash differences this user received on completed trades. */
const tradeCashRows = async (userId: Types.ObjectId): Promise<HistoryRow[]> => {
  const settlements = await TradeSettlement.find({
    status: 'settled',
    'parties.userId': userId,
  }).lean()

  const rows: HistoryRow[] = []
  const offerIds: Types.ObjectId[] = []
  const pending: { payer: any; settlement: any }[] = []
  for (const s of settlements) {
    for (const payer of s.parties) {
      if (String(payer.userId) === String(userId)) continue
      if (!payer.cashNet || payer.cashNet <= 0) continue
      if (payer.payoutStatus !== 'paid' && payer.payoutStatus !== 'manual') continue
      pending.push({ payer, settlement: s })
      offerIds.push(s.tradeOfferId)
    }
  }
  if (!pending.length) return rows

  const offers = await TradeOffer.find({ _id: { $in: offerIds } })
    .select('tradeCode senderId receiverId senderProductIds receiverProductIds completedAt')
    .populate('senderId receiverId', 'userName fullName name image photo')
    .populate('senderProductIds receiverProductIds', 'title images')
    .lean()
  const offerById = new Map(offers.map((o: any) => [String(o._id), o]))

  for (const { payer, settlement } of pending) {
    const offer: any = offerById.get(String(settlement.tradeOfferId))
    if (!offer) continue
    const iAmSender = String(offer.senderId?._id ?? offer.senderId) === String(userId)
    const other = iAmSender ? offer.receiverId : offer.senderId
    // Show what this user gave up, the item the cash paid for.
    const myItems: any[] = (iAmSender ? offer.senderProductIds : offer.receiverProductIds) || []
    const cash = round2(Number(payer.cashNet))
    rows.push({
      id: `trade-${settlement._id}-${payer.role}`,
      kind: 'trade_cash',
      tradeOfferId: String(offer._id),
      tradeCode: offer.tradeCode,
      title: myItems.length
        ? myItems.length > 1
          ? `${myItems[0]?.title || 'Item'} + ${myItems.length - 1} more`
          : myItems[0]?.title || 'Trade'
        : 'Trade',
      image: firstImage(myItems[0]),
      date: offer.completedAt || settlement.settledAt || settlement.updatedAt,
      counterparty: {
        id: String(other?._id ?? ''),
        name: displayName(other),
        image: other?.image || other?.photo || '',
      },
      status: 'delivered',
      itemPrice: cash,
      shipping: 0,
      taxes: 0,
      totalPaid: cash,
      // Each side already paid its own 4% at settlement; the cash passes
      // through whole.
      ariesFee: 0,
      net: cash,
    })
  }
  return rows
}

/**
 * The seller's Stripe balance. Best effort: a seller without a connected
 * account, or a Stripe outage, still gets their history.
 */
const payoutSummary = async (userId: Types.ObjectId) => {
  try {
    const application = await SellerApplication.findOne({ userId }).lean()
    const accountId = (application as any)?.stripe?.accountId
    if (!accountId) return null
    const earnings = await StripeConnectService.getAccountEarnings(accountId)
    const paidOut = earnings.recentPayouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0)
    return {
      pending: round2(earnings.available + earnings.pending),
      paidOut: round2(paidOut),
      currency: earnings.currency,
    }
  } catch {
    return null
  }
}

export const getOrderHistory = async (params: {
  userId: string
  role: HistoryRole
  period: HistoryPeriod
  status?: HistoryStatus
  page: number
  limit: number
}) => {
  const userId = new Types.ObjectId(params.userId)
  const [orders, trades, payout] = await Promise.all([
    orderRows(userId, params.role),
    params.role === 'seller' ? tradeCashRows(userId) : Promise.resolve([]),
    params.role === 'seller' ? payoutSummary(userId) : Promise.resolve(null),
  ])

  const all = [...orders, ...trades].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  const since = periodStart(params.period)
  const inPeriod = since ? all.filter(r => new Date(r.date) >= since) : all
  const filtered = params.status ? inPeriod.filter(r => r.status === params.status) : inPeriod

  const monthStart = startOfMonth()
  const live = (r: HistoryRow) => r.status !== 'refunded'
  const amount = (r: HistoryRow) => (params.role === 'seller' ? r.net || 0 : r.totalPaid)
  const sum = (rows: HistoryRow[]) => round2(rows.filter(live).reduce((s, r) => s + amount(r), 0))

  const summary =
    params.role === 'seller'
      ? {
          totalEarned: sum(all),
          thisMonth: sum(all.filter(r => new Date(r.date) >= monthStart)),
          periodEarned: sum(inPeriod),
          // Money from orders still on their way; the buyer can still be
          // refunded until delivery.
          inProgress: sum(all.filter(r => r.status === 'paid' || r.status === 'shipped')),
          completed: sum(all.filter(r => r.status === 'delivered')),
          salesCount: all.filter(r => live(r) && r.kind !== 'giveaway').length,
          payout,
        }
      : {
          totalSpent: sum(all),
          thisMonth: sum(all.filter(r => new Date(r.date) >= monthStart)),
          periodSpent: sum(inPeriod),
          refunded: round2(
            all.filter(r => r.status === 'refunded').reduce((s, r) => s + r.totalPaid, 0),
          ),
          purchaseCount: all.filter(r => live(r) && r.kind !== 'giveaway').length,
        }

  const start = (params.page - 1) * params.limit
  return {
    role: params.role,
    period: params.period,
    status: params.status || null,
    summary,
    rows: filtered.slice(start, start + params.limit),
    meta: {
      page: params.page,
      limit: params.limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / params.limit)),
    },
  }
}

export const OrderHistoryService = { getOrderHistory }
