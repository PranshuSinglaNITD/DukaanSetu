import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { 
  startNegotiation, 
  sendOffer, 
  getMyNegotiations, 
  resolveNegotiation,
  getNegotiationById
} from './negotiation.controller.js';

const router = express.Router();

// Guard all negotiation routes
router.use(protect);

router.get('/inbox', getMyNegotiations);
router.post('/start', startNegotiation);
router.post('/offer', sendOffer);
router.post('/resolve', resolveNegotiation);
router.get('/:id',getNegotiationById);

export default router;