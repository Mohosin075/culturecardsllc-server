import express from 'express';
import { TradeControllers } from './trade.controller';

const router = express.Router();

router.post('/offer', TradeControllers.createTradeOffer);
router.get('/offers', TradeControllers.getTradeOffers);
router.post('/accept/:id', TradeControllers.acceptTradeOffer);
router.post('/decline/:id', TradeControllers.declineTradeOffer);

export const TradeRoutes = router;
export default TradeRoutes;
