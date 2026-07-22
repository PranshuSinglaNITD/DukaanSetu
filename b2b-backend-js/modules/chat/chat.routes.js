import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js'; 
import { 
  initializeRoom, 
  getRoomMessages,getUserInbox
} from './chat.controller.js';

const router = express.Router();
router.use(protect);
router.post('/room', initializeRoom);
router.get('/room/:roomId/messages', getRoomMessages);
router.get('/inbox', getUserInbox);
export default router;