import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { 
  addToInventory, 
  sellInventoryItem, 
  getMyInventory, 
  getAnalytics, 
  getSmartPrice
} from './inventory.controller.js';

const router = express.Router();

router.use(protect);

router.get('/', getMyInventory);
router.get('/analytics', getAnalytics);
router.post('/buy', addToInventory);
router.post('/sell', sellInventoryItem);
router.post('/smart-price',getSmartPrice);

export default router;