import express from 'express'
import { AuctionControllers } from './auction.controller'
import validateRequest from '../../middleware/validateRequest'
import { AuctionValidations } from './auction.validation'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = express.Router()

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

// GET /streams — List all live streams (public)
router.get('/streams', AuctionControllers.getLiveStreams)

// POST /item — Register a product as an auction item (seller only)
router.post(
  '/item',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.createAuctionItemSchema),
  AuctionControllers.createAuctionItem,
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

export const AuctionRoutes = router
export default AuctionRoutes
