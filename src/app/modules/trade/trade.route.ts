import express from 'express';
import { TradeControllers } from './trade.controller';
import validateRequest from '../../middleware/validateRequest';
import { TradeValidations } from './trade.validation';

const router = express.Router();

router.post('/offer', validateRequest(TradeValidations.createTradeOfferSchema), TradeControllers.createTradeOffer);
router.get('/offers', TradeControllers.getTradeOffers);
router.post('/accept/:id', TradeControllers.acceptTradeOffer);
router.post('/decline/:id', TradeControllers.declineTradeOffer);

export const TradeRoutes = router;
export default TradeRoutes;
