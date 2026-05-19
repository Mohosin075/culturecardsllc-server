import express from 'express';
import { OrderControllers } from './order.controller';
import validateRequest from '../../middleware/validateRequest';
import { OrderValidations } from './order.validation';

const router = express.Router();

router.post('/', validateRequest(OrderValidations.createOrderSchema), OrderControllers.createOrder);
router.get('/user', OrderControllers.getOrdersForUser);
router.get('/:id', OrderControllers.getOrderById);
router.patch('/journey/:id', validateRequest(OrderValidations.updateOrderJourneySchema), OrderControllers.updateOrderJourney);

export const OrderRoutes = router;
export default OrderRoutes;
