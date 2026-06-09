import express from 'express';
import { setupDispatch, getMySales, getMyOrders,markDelivered } from './shipments.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
const router = express.Router();
router.use(protect);
router.post('/setup', setupDispatch);

router.get('/my-sales', getMySales);

router.get('/my-orders', getMyOrders);
router.post('/delivered',markDelivered);

export default router;