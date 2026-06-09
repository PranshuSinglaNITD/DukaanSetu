import express from 'express';
import { handleAIChat } from './chat.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();
router.use(protect);
router.post('/chat', verifyToken, handleAIChat);

export default router;