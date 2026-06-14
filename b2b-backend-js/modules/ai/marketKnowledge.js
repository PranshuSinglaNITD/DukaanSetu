import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "@langchain/core/documents";

let vectorStore = null;
let initPromise = null;

const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  if (!initPromise) {
    initPromise = (async () => {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "text-embedding-001", 
        apiKey: process.env.GEMINI_API_KEY,
      });

      const baseNewsAlerts = [
        new Document({ pageContent: "LOGISTICS ALERT: Highway transport from Punjab to Delhi is experiencing 12-hour delays due to toll plaza strikes.", metadata: { category: "logistics" } }),
        new Document({ pageContent: "GOVT POLICY: The central agriculture ministry temporarily restricted the export of non-basmati rice to stabilize domestic prices.", metadata: { category: "policy" } }),
        new Document({ pageContent: "MARKET SENTIMENT: Azadpur Mandi traders report a severe shortage of high-grade garlic, driving auction prices up.", metadata: { category: "sentiment" } })
      ];

      vectorStore = await MemoryVectorStore.fromDocuments(baseNewsAlerts, embeddings);
      return vectorStore;
    })();
  }

  return initPromise;
};

export const ingestNewMarketData = async (contentString, metadata = {}) => {
  try {
    const store = await getVectorStore();
    const newDoc = new Document({ 
      pageContent: contentString,
      metadata: { dateAdded: new Date().toISOString(), ...metadata }
    });

    await store.addDocuments([newDoc]);
    return true;
  } catch (error) {
    console.error("Failed to ingest new market data:", error);
    return false;
  }
};

export const searchMarketNews = async (query) => {
  try {
    const store = await getVectorStore();
    const results = await store.similaritySearch(query, 2);
    
    if (!results || results.length === 0) {
      return "No specific news alerts found for this query.";
    }

    return results.map(r => r.pageContent).join("\n\n");
  } catch (error) {
    console.error("Vector Search Error:", error);
    return "Market news intelligence is currently offline.";
  }
};