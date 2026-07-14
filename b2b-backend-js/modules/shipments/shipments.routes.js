import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { restrictTo } from '../../middlewares/role.middleware.js';
import { 
  setupDispatch, 
  getMySales, 
  getMyOrders, 
  markDelivered 
} from './shipments.controller.js';
const router = express.Router();
router.use(protect); 
router.post('/dispatch', restrictTo('FARMER', 'WHOLESALER'), setupDispatch);
router.get('/sales', restrictTo('FARMER', 'WHOLESALER'), getMySales);
router.get('/orders', restrictTo('WHOLESALER', 'RETAILER'), getMyOrders);
router.post('/delivered', restrictTo('WHOLESALER', 'RETAILER'), markDelivered);
export default router;