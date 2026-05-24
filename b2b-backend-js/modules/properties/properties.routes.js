import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { protect } from '../../middlewares/auth.middleware.js';
import { 
  addProperty, 
  getAllProperties, 
  getPropertyById, 
  toggleFavoriteProperty 
} from './properties.controller.js';

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'property-' + uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({ storage: storage });
const router = express.Router();

router.use(protect)
router.get('/', getAllProperties);

router.post('/create', protect, upload.array('images', 5), addProperty);
router.post('/favorite/:id', toggleFavoriteProperty);
router.get('/:id', getPropertyById);

export default router;