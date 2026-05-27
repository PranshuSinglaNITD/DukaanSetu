import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { protect } from '../../middlewares/auth.middleware.js';
import { 
  createProduct, 
  getAllProducts, 
  updateProduct, 
  deleteProduct,
  comparePrices,
  purchaseProduct
} from './products.controller.js';
import { payForOrder } from './trade.controller.js';

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // 🚨 FIXED: Changed prefix from 'property-' to 'product-'
    cb(null, 'product-' + uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({ storage: storage });
const router = express.Router();

router.use(protect);
router.get('/', getAllProducts);
router.get('/compare', comparePrices); // Must go before /:id
router.post('/create', upload.array('images', 5), createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/buy',purchaseProduct);
router.post('/pay-order',payForOrder);

export default router;