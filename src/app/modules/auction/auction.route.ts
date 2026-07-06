import express from 'express'
import { AuctionControllers } from './auction.controller'
import validateRequest from '../../middleware/validateRequest'
import { AuctionValidations } from './auction.validation'
import auth from '../../middleware/auth'
import { USER_ROLES } from '../../../enum/user'

const router = Router()

function Router() {
  return express.Router()
}

router.get('/token', AuctionControllers.generateAgoraToken)
router.post(
  '/stream',
  validateRequest(AuctionValidations.createLiveStreamSchema),
  AuctionControllers.createLiveStream,
)
router.get('/streams', AuctionControllers.getLiveStreams)
router.post(
  '/item',
  validateRequest(AuctionValidations.createAuctionItemSchema),
  AuctionControllers.createAuctionItem,
)
router.post(
  '/bid',
  validateRequest(AuctionValidations.placeBidSchema),
  AuctionControllers.placeBidSecure,
)
router.patch(
  '/stream/:streamId/status',
  auth(USER_ROLES.SELLER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateRequest(AuctionValidations.updateLiveStreamStatusSchema),
  AuctionControllers.updateLiveStreamStatus,
)

export const AuctionRoutes = router
export default AuctionRoutes
