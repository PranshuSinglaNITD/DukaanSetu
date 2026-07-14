import express from 'express'
import { protect } from '../../middlewares/auth.middleware.js'
import { processVoice } from './voice.controller.js'
const router=express.Router()
router.post('/process',protect,processVoice)
export default router   
