import express from 'express';
import { handleAIChat } from './ai.controller.js';
import { searchMarketNews, ingestNewMarketData } from './marketKnowledge.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

// 1. Chat with MandiBrain Agent
router.post('/', handleAIChat);

// 2. Dedicated endpoint to manually search raw vector intelligence
router.post('/market-trends', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query parameter is required." });
    }
    
    const trends = await searchMarketNews(query);
    
    return res.status(200).json({ status: "success", data: trends });
  } catch (error) {
    console.error("Market trends route error:", error);
    return res.status(500).json({ error: "Failed to retrieve market trends." });
  }
});

// 3. Endpoint to ingest new market intelligence into the Vector Store
router.post('/ingest', async (req, res) => {
  try {
    const { content, metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content string is required to ingest data." });
    }

    const success = await ingestNewMarketData(content, metadata || {});
    
    if (success) {
      return res.status(200).json({ status: "success", message: "Market data successfully ingested into MandiBrain." });
    } else {
      return res.status(500).json({ error: "Failed to ingest data into the vector store." });
    }
  } catch (error) {
    console.error("Ingestion route error:", error);
    return res.status(500).json({ error: "Internal server error during data ingestion." });
  }
});

export default router;