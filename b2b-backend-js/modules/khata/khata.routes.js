import express from 'express'
import { protect } from '../../middlewares/auth.middleware.js'
import { getKhataSummary,recordInstallment } from './khata.controller.js'
const router=express.Router()
router.use(protect)
router.get('/summary', protect, getKhataSummary);
router.post('/installment', protect, recordInstallment);

export default router