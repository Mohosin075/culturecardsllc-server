import express from 'express';
import { AuctionControllers } from './auction.controller';

const router = express.Router();

router.get('/token', AuctionControllers.generateAgoraToken);
router.post('/stream', AuctionControllers.createLiveStream);
router.get('/streams', AuctionControllers.getLiveStreams);
router.post('/item', AuctionControllers.createAuctionItem);
router.post('/bid', AuctionControllers.placeBidSecure);

export const AuctionRoutes = router;
export default AuctionRoutes;
