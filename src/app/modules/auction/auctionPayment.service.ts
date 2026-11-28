import { Types } from 'mongoose'
import stripe from '../../../config/stripe'
import { Payment } from '../payment/payment.model'
import { WebhookService } from '../payment/webhook.service'
import { Product } from '../product/product.model'
import { User } from '../user/user.model'
import { AuctionItem } from './auction.model'

/**
 * Auction wins that still need paying.
 *
 * A winner without a saved card is sent a Stripe Checkout link instead of
 * being charged. These helpers let the buyer find and pay that link later, and
 * let the seller see who still owes. Each link is checked with Stripe first:
 * one that was paid becomes an order (as the webhook would do), and one that
 * expired (24 hours) releases the item, so neither side waits on a missed
 * webhook.
 */

export type UnpaidWin = {
  paymentId: string
  auctionItemId: string
  productId: string
  productTitle: string
  productImage: string
  amount: number
  sellerId: string
  sellerName: string
  winnerId: string
  winnerName: string
  checkoutUrl: string
  expiresAt: string | null
  /** True when Stripe has the money but the order is still being created. */
  confirming: boolean
  wonAt: string
}

type Reconciled =
  | { state: 'open'; url: string; expiresAt: Date | null }
  | { state: 'paid' }
  | { state: 'confirming' } // paid on Stripe, order not created yet (retried on next load)
  | { state: 'expired' }
  | { state: 'unknown' }

/** Looks the checkout up on the seller's Stripe account and settles it if it is done. */
const reconcile = async (payment: any): Promise<Reconciled> => {
  const sessionId = payment.metadata?.checkoutSessionId
  const account = payment.metadata?.stripeAccountId
  if (!sessionId) return { state: 'unknown' }
  try {
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      account ? { stripeAccount: account } : undefined,
    )
    if (session.payment_status === 'paid' || session.status === 'complete') {
      try {
        await WebhookService.handleCheckoutSessionCompleted({ id: session.id } as any, account)
        return { state: 'paid' }
      } catch (err: any) {
        // The buyer has paid; never offer the link again. Keep the row so they
        // can see it is being confirmed, and retry on the next load.
        console.error(`[UnpaidWins] Paid but order not created yet for ${sessionId}:`, err?.message)
        return { state: 'confirming' }
      }
    }
    if (session.status === 'expired') {
      await WebhookService.handleCheckoutSessionExpired({ id: session.id } as any)
      return { state: 'expired' }
    }
    return {
      state: 'open',
      url: session.url || '',
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    }
  } catch (err: any) {
    console.error(`[UnpaidWins] Could not check ${sessionId}:`, err?.message)
    return { state: 'unknown' }
  }
}

const toRows = async (payments: any[]): Promise<UnpaidWin[]> => {
  const rows: UnpaidWin[] = []
  const productIds = payments.map(p => p.metadata?.productId).filter(Boolean)
  const userIds = payments.flatMap(p => [p.metadata?.sellerId, p.metadata?.winnerId]).filter(Boolean)
  const [products, users] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('title images').lean(),
    User.find({ _id: { $in: userIds } }).select('fullName name').lean(),
  ])
  const productById = new Map(products.map((p: any) => [p._id.toString(), p]))
  const nameById = new Map(users.map((u: any) => [u._id.toString(), u.fullName || u.name || '']))

  for (const payment of payments) {
    const result = await reconcile(payment)
    if (result.state !== 'open' && result.state !== 'confirming') continue
    const open = result.state === 'open' ? result : null
    const meta = payment.metadata || {}
    const product: any = productById.get(String(meta.productId)) || {}
    rows.push({
      paymentId: payment._id.toString(),
      auctionItemId: String(meta.auctionItemId || ''),
      productId: String(meta.productId || ''),
      productTitle: product.title || 'Auction item',
      productImage: product.images?.[0] || '',
      amount: payment.amount,
      sellerId: String(meta.sellerId || ''),
      sellerName: nameById.get(String(meta.sellerId)) || '',
      winnerId: String(meta.winnerId || ''),
      winnerName: nameById.get(String(meta.winnerId)) || '',
      checkoutUrl: open?.url || '',
      expiresAt: open?.expiresAt ? open.expiresAt.toISOString() : null,
      confirming: result.state === 'confirming',
      wonAt: payment.createdAt?.toISOString?.() || '',
    })
  }
  return rows
}

/** The buyer's auction wins that still need paying, newest first. */
const getMyUnpaidWins = async (userId: string): Promise<UnpaidWin[]> => {
  const payments = await Payment.find({
    userId: new Types.ObjectId(userId),
    status: 'pending',
    'metadata.purchaseType': 'auction_win',
  })
    .sort({ createdAt: -1 })
    .lean()
  return toRows(payments)
}

/** Wins in one show that the seller is still waiting to be paid for. */
const getShowUnpaidWins = async (streamId: string, sellerId: string): Promise<UnpaidWin[]> => {
  const items = await AuctionItem.find({ streamId: new Types.ObjectId(streamId) }).select('_id').lean()
  const ids = items.map(i => i._id.toString())
  if (!ids.length) return []
  const payments = await Payment.find({
    status: 'pending',
    'metadata.purchaseType': 'auction_win',
    'metadata.sellerId': sellerId,
    'metadata.auctionItemId': { $in: ids },
  })
    .sort({ createdAt: 1 })
    .lean()
  return toRows(payments)
}

/** Settles one checkout right after Stripe sends the buyer back. */
const settleCheckout = async (sessionId: string): Promise<void> => {
  const payment = await Payment.findOne({ 'metadata.checkoutSessionId': sessionId }).lean()
  if (payment && (payment as any).status === 'pending') await reconcile(payment)
}

export const AuctionPaymentServices = { getMyUnpaidWins, getShowUnpaidWins, settleCheckout }
