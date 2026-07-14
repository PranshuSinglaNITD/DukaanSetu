import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { protect } from '../../middlewares/auth.middleware.js';
import { restrictTo } from '../../middlewares/role.middleware.js';
import { 
  createProduct, 
  getAllProducts, 
  updateProduct, 
  deleteProduct,
  comparePrices,
  purchaseProduct
} from './products.controller.js';
import { payForOrder } from './trade.controller.js';
import { autoAnalyzeProductImage } from './products.vision.js';

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

// 1. ALL routes in this file require the user to be logged in
router.use(protect);

// ==========================================
// UNIVERSAL ROUTES (Filters handled in controller)
// ==========================================
router.get('/', getAllProducts);
router.get('/compare', comparePrices); // Must go before /:id

// ==========================================
// SUPPLY SIDE (Farmers & Wholesalers)
// ==========================================
// Only sellers can create, update, or delete physical inventory
router.post('/create', restrictTo('FARMER', 'WHOLESALER'), upload.array('images', 5), createProduct);
router.put('/:id', restrictTo('FARMER', 'WHOLESALER'), updateProduct);
router.delete('/:id', restrictTo('FARMER', 'WHOLESALER'), deleteProduct);

// ==========================================
// DEMAND SIDE (Retailers & Wholesalers)
// ==========================================
// Only buyers can execute purchases, pay for orders, or run quality scans on incoming shipments
router.post('/buy', restrictTo('RETAILER', 'WHOLESALER'), purchaseProduct);
router.post('/pay-order', restrictTo('RETAILER', 'WHOLESALER'), payForOrder);
router.post('/analyze-image', restrictTo('RETAILER', 'WHOLESALER'), autoAnalyzeProductImage);

export default router;