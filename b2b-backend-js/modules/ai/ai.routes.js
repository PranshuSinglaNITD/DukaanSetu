import express from 'express';
import { handleAIChat } from './ai.controller.js';
import { searchMarketTrends } from './marketKnowledge.js';
import { protect } from '../../middlewares/auth.middleware.js'; // Use your primary auth middleware

const router = express.Router();

// Apply auth protection globally to all AI operations
router.use(protect);

// 1. Chat with MandiBrain Agent
router.post('/', handleAIChat);

// 2. Dedicated endpoint to manually search raw vector intelligence
router.post('/market-trends', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query parameters are required." });
    }
    const trends = await searchMarketTrends(query);
    return res.status(200).json({ status: "success", data: trends });
  } catch (error) {
    console.error("Market trends route error:", error);
    return res.status(500).json({ error: "Failed to retrieve market trends." });
  }
});

export default router;