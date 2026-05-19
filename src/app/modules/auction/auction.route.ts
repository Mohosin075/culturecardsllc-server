import express from 'express';
import { AuctionControllers } from './auction.controller';
import validateRequest from '../../middleware/validateRequest';
import { AuctionValidations } from './auction.validation';

const router = Router();

function Router() {
  return express.Router();
}

router.get('/token', AuctionControllers.generateAgoraToken);
router.post('/stream', validateRequest(AuctionValidations.createLiveStreamSchema), AuctionControllers.createLiveStream);
router.get('/streams', AuctionControllers.getLiveStreams);
router.post('/item', validateRequest(AuctionValidations.createAuctionItemSchema), AuctionControllers.createAuctionItem);
router.post('/bid', validateRequest(AuctionValidations.placeBidSchema), AuctionControllers.placeBidSecure);

export const AuctionRoutes = router;
export default AuctionRoutes;
