import express from 'express';
import { OrderControllers } from './order.controller';

const router = express.Router();

router.post('/', OrderControllers.createOrder);
router.get('/user', OrderControllers.getOrdersForUser);
router.get('/:id', OrderControllers.getOrderById);
router.patch('/journey/:id', OrderControllers.updateOrderJourney);

export const OrderRoutes = router;
export default OrderRoutes;
