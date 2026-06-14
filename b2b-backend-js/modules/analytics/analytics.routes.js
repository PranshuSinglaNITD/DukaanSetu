import { Router } from 'express';
import { getBusinessAnalytics } from './analytics.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { exportFullLedgerPDF,getLedgerData} from './export.controller.js';

const router = Router();
router.get('/', protect, getBusinessAnalytics);
router.get('/export/ledger-pdf', protect, exportFullLedgerPDF);
router.get('/export/ledger-data', protect, getLedgerData);
export default router;