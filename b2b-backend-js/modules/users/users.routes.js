import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { protect } from '../../middlewares/auth.middleware.js';
import { 
  getProfile, 
  updateProfile, 
  uploadProfileImage, 
  switchBusinessType, 
  getBusinessStats 
} from './users.controller.js';

// Ensure the "uploads" directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure Multer for local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

// Apply the 'protect' middleware to ALL routes in this file
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/business-type', switchBusinessType);
router.get('/business-stats', getBusinessStats);

// 'profileImage' is the field name Postman will look for
router.post('/upload-image', upload.single('profileImage'), uploadProfileImage);

export default router;