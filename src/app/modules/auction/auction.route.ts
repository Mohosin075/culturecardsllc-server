import express from 'express'
import { AuctionControllers } from './auction.controller'
import validateRequest from '../../middleware/validateRequest'
import { AuctionValidations } from './auction.validation'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

// Public: Stripe's browser redirect after checkout (no app token available).
router.get('/checkout/return', AuctionControllers.checkoutReturn)
router.get('/checkout/cancel', AuctionControllers.checkoutCancel)
router.get('/wins/unpaid', auth(USER_ROLES.SELLER, USER_ROLES.BUYER), AuctionControllers.getMyUnpaidWins)
// In-app (PaymentSheet) payment for a win: start, then confirm.
router.post('/wins/:paymentId/intent', auth(USER_ROLES.SELLER, USER_ROLES.BUYER), AuctionControllers.createWinIntent)
router.post('/wins/:paymentId/confirm', auth(USER_ROLES.SELLER, USER_ROLES.BUYER), AuctionControllers.confirmWinIntent)
router.get('/shipping/shows', auth(USER_ROLES.SELLER, USER_ROLES.BUYER), AuctionControllers.getCompletedShowsForShipping)
router.get('/shipping/shows/:streamId', auth(USER_ROLES.SELLER, USER_ROLES.BUYER), AuctionControllers.getShowShipments)

// GET /token — Generate Agora RTC token (authenticated users only)
router.get(
  '/token',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.generateAgoraToken,
)

// POST /stream — Create live stream session (seller only)
router.post(
  '/stream',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.createLiveStreamSchema),
  AuctionControllers.createLiveStream,
)

// POST /stream/start-scheduled/:streamId — Start a scheduled stream (seller only)
router.post(
  '/stream/start-scheduled/:streamId',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.startScheduledStream,
)

// POST /stream/:streamId/bookmark — Toggle bookmark for upcoming stream (buyer/seller)
router.post(
  '/stream/:streamId/bookmark',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.toggleBookmarkSchema),
  AuctionControllers.toggleBookmarkShow,
)

// GET /saved-shows — Get user's saved/bookmarked upcoming shows
router.get(
  '/saved-shows',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.getSavedShows,
)

// GET /streams — List all live streams (public)
router.get('/streams', AuctionControllers.getLiveStreams)

// GET /admin/stream/:streamId/overview — Per-show inventory, giveaways, spins and tips (admin only)
router.get(
  '/admin/stream/:streamId/overview',
  auth(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.getStreamAdminOverview,
)

// PATCH /stream/:streamId/inventory — Update inventory products attached to a live stream (seller only)
router.patch(
  '/stream/:streamId/inventory',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.updateStreamInventorySchema),
  AuctionControllers.updateStreamInventory,
)

// GET /stream/:streamId/inventory — Get inventory products attached to a live stream (public/auth)
router.get(
  '/stream/:streamId/inventory',
  AuctionControllers.getStreamInventory,
)

// POST /stream/:streamId/inventory/add — Add new or existing item to live stream inventory (seller only)
router.post(
  '/stream/:streamId/inventory/add',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.addStreamInventoryItem,
)

// POST /stream/:streamId/attach-spin-prize — Attach spin wheel prize to buyer's order (seller only)
router.post(
  '/stream/:streamId/attach-spin-prize',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.attachSpinWheelPrize,
)

// POST /stream/:streamId/giveaway-item — Run item as giveaway and draw winner (seller only)
router.post(
  '/stream/:streamId/giveaway-item',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.runStreamGiveawayItem,
)

// POST /item — Register a product as an auction item (seller only)
router.post(
  '/item',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.createAuctionItemSchema),
  AuctionControllers.createAuctionItem,
)

// POST /item/quick-start — 1-Click quick launch active auction from stream inventory (seller only)
router.post(
  '/item/quick-start',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.quickStartAuctionSchema),
  AuctionControllers.quickStartAuctionItem,
)

// POST /bid — Place a bid on an auction item (authenticated users)
router.post(
  '/bid',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER),
  validateRequest(AuctionValidations.placeBidSchema),
  AuctionControllers.placeBidSecure,
)

// GET /stream/:streamId/items — Get auction items for a stream (authenticated users)
router.get(
  '/stream/:streamId/items',
  auth(USER_ROLES.BUYER, USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.getAuctionItemsByStream,
)

// PATCH /stream/:streamId/status — Update stream status (seller/admin)
router.patch(
  '/stream/:streamId/status',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.updateLiveStreamStatusSchema),
  AuctionControllers.updateLiveStreamStatus,
)

// POST /item/:id/complete — Complete auction, trigger winner payment (seller only)
router.post(
  '/item/:id/complete',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.completeAuction,
)

// POST /stream/:streamId/spin-wheel — Authoritative server spin wheel (seller only, max 4 items)
router.post(
  '/stream/:streamId/spin-wheel',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.spinWheel,
)

// GET /stream/:streamId/sales — Real-time live show sales view for host (seller only)
router.get(
  '/stream/:streamId/sales',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.getStreamSales,
)

// GET /stream/:streamId/summary — Post-show metrics, sold orders & shipping labels (seller only)
router.get(
  '/stream/:streamId/summary',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  AuctionControllers.getStreamSummary,
)

export const AuctionRoutes = router
export default AuctionRoutes
