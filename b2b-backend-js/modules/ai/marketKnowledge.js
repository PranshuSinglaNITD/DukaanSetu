import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "@langchain/core/documents";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", 
  apiKey: process.env.GEMINI_API_KEY,
});

let vectorStore = null;

// 1. INITIALIZATION: Run once on server start to seed the AI's brain
export const initializeMarketData = async () => {
  const baseKnowledge = [
    new Document({ pageContent: "WEATHER BASELINE: Punjab region is currently entering the pre-monsoon phase. Farmers should prepare for sudden humidity spikes." }),
    new Document({ pageContent: "MARKET BASELINE: Azadpur Mandi is operating at normal capacity. Wheat and Rice are showing stable historical trends." })
  ];

  vectorStore = await MemoryVectorStore.fromDocuments(baseKnowledge, embeddings);
  console.log("📈 MandiBrain RAG Vector Store Initialized.");
};

// 2. 🚨 NEW: THE INGESTION PIPELINE
// Call this whenever a new weather alert, news article, or price drop happens!
export const ingestNewMarketData = async (contentString, metadata = {}) => {
  if (!vectorStore) {
    console.error("Cannot ingest data: Vector Store not initialized yet.");
    return false;
  }

  try {
    const newDoc = new Document({ 
      pageContent: contentString,
      metadata: { dateAdded: new Date().toISOString(), ...metadata }
    });

    // Adds the new document to the AI's memory instantly
    await vectorStore.addDocuments([newDoc]);
    console.log(`🧠 MandiBrain learned something new: "${contentString.substring(0, 40)}..."`);
    return true;
  } catch (error) {
    console.error("Failed to ingest new market data:", error);
    return false;
  }
};

// 3. RETRIEVAL: What the LangGraph Agent uses to answer questions
export const searchMarketTrends = async (query) => {
  if (!vectorStore) return "Market intelligence is currently offline.";
  
  // Retrieve the top 3 most relevant news items to give the AI good context
  const results = await vectorStore.similaritySearch(query, 3);
  
  // Combine the results into a single string for the prompt
  return results.map(r => r.pageContent).join("\n\n");
};