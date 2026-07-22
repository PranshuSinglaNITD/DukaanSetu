import express from 'express';
import { 
  initializeRoom, 
  getRoomMessages, 
  createOfferMessage, 
  respondToOffer 
} from '../controllers/chat.controller.js';
import { protect } from '../../middlewares/auth.middleware.js'; 

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// Room initialization and fetching
router.post('/room', initializeRoom);
router.get('/room/:roomId/messages', getRoomMessages);

// Actionable commerce logic
router.post('/offer', createOfferMessage);
router.put('/offer/:negotiationId/respond', respondToOffer);

export default router;