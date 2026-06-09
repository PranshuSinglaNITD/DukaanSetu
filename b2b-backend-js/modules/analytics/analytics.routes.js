import { Router } from 'express';
import { getBusinessAnalytics } from './analytics.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();
router.get('/', protect, getBusinessAnalytics);
export default router;