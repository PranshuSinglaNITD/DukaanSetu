import { Router } from 'express';
import { getUserNotifications, markNotificationAsRead } from './notifications.controller.js';
import { authenticateToken } from '../../middlewares/auth.js'
import {protect} from '../../middlewares/auth.middleware.js'

const router = Router();
router.use(protect)
router.get('/', authenticateToken, getUserNotifications);
router.patch('/read', authenticateToken, markNotificationAsRead);

export default router;