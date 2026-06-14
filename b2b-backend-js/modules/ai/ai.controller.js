import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from '../../utils/db.js';
import { getLiveWeather } from "../../utils/weatherService.js";
import { searchMarketNews } from "./marketKnowledge.js";

const memory = new MemorySaver();

export const handleAIChat = async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const checkInventoryTool = tool(
      async () => {
        const inventory = await prisma.inventory.findMany({
          where: { userId: userId, quantity: { gt: 0 } },
          select: { name: true, quantity: true, unit: true, buyPrice: true, expiryDate: true }
        });
        return JSON.stringify(inventory.length ? inventory : { message: "Inventory is empty." });
      },
      {
        name: "check_inventory",
        description: "Fetches user's current stock levels and expiry information.",
        schema: z.object({}),
      }
    );

    const salesAnalyzerTool = tool(
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentSales = await prisma.sale.findMany({
          where: { 
            inventory: { userId: userId },
            soldAt: { gte: thirtyDaysAgo }
          },
          select: { sellPrice: true, quantity: true, profit: true, inventory: { select: { name: true } } }
        });

        if (recentSales.length === 0) return "No sales recorded in the last 30 days.";

        let totalRevenue = 0;
        let totalProfit = 0;
        let bestSellingItem = {};

        recentSales.forEach(sale => {
          totalRevenue += (sale.sellPrice * sale.quantity);
          totalProfit += sale.profit;
          const itemName = sale.inventory?.name || "Unknown";
          bestSellingItem[itemName] = (bestSellingItem[itemName] || 0) + sale.quantity;
        });

        const topItem = Object.keys(bestSellingItem).length 
          ? Object.keys(bestSellingItem).reduce((a, b) => bestSellingItem[a] > bestSellingItem[b] ? a : b) 
          : "None";

        return JSON.stringify({
          totalRevenue: `₹${totalRevenue}`,
          netProfit: `₹${totalProfit}`,
          topMovingCommodity: topItem,
          rawSalesData: recentSales.slice(0, 5)
        });
      },
      {
        name: "analyze_my_sales",
        description: "Calculates total revenue, pure profit, and best-selling items over the last 30 days.",
        schema: z.object({}),
      }
    );

    const weatherAnalyzerTool = tool(
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { city: true }
        });
        
        if (!user?.city) return "User location city not set in profile.";

        const weatherData = await getLiveWeather(user.city);
        return JSON.stringify({ location: user.city, forecast: weatherData || "Unavailable" });
      },
      {
        name: "analyze_weather_only",
        description: "Fetches meteorology parameters, rain warnings, and climate reports for the local city.",
        schema: z.object({}),
      }
    );

    const predictiveMandiAnalyzerTool = tool(
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { city: true }
        });

        const weatherData = await getLiveWeather(user?.city || "Delhi");
        const weatherString = JSON.stringify(weatherData).toLowerCase();

        const marketOpportunities = await prisma.product.findMany({
          where: { sellerId: { not: userId }, stock: { gt: 0 } },
          select: { name: true, price: true, unit: true, stock: true, seller: { select: { city: true } } },
          orderBy: { price: 'asc' },
          take: 5
        });

        const newsAlerts = await searchMarketNews("logistics strikes weather damage crop supply demand bans");

        return JSON.stringify({
          environmentalContext: {
            location: user?.state || "Unknown",
            weatherRisks: weatherString.includes("rain") || weatherString.includes("shower") ? "High Spoilage Risk for open-air stock" : "Stable conditions",
          },
          newsAndLogisticsContext: newsAlerts,
          currentMarketOpportunities: marketOpportunities
        });
      },
      {
        name: "predict_best_products_to_buy",
        description: "Correlates weather forecasts, news trends, and market listings to find optimal procurement deals.",
        schema: z.object({}),
      }
    );

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1,
    });

    const systemPrompt = `You are MandiBrain, an expert B2B agriculture market agent.
    
    ROUTING CRITERIA:
    1. Financial health, sales queries, revenue or profit checks -> Call 'analyze_my_sales'.
    2. Weather conditions, rain forecasts -> Call 'analyze_weather_only'.
    3. Buy recommendations, optimization vectors, or inventory forecasting -> Call 'predict_best_products_to_buy'.
    4. Personal current stock volumes -> Call 'check_inventory'.

    Formulate highly quantitative responses using Indian Rupees (₹). Correlate weather alerts with specific shelf-life metrics when advising purchases.`;

    const agent = createReactAgent({
      llm,
      tools: [checkInventoryTool, salesAnalyzerTool, weatherAnalyzerTool, predictiveMandiAnalyzerTool],
      checkpointSaver: memory,
      stateModifier: systemPrompt,
    });

    const activeThread = `${userId}=${sessionId}`;
    const config = { configurable: { thread_id: activeThread } };

    const result = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      config
    );

    const finalAiMessage = result.messages[result.messages.length - 1].content;

    return res.status(200).json({
      status: "success",
      reply: finalAiMessage
    });

  } catch (error) {
    console.error("LangGraph Agent Error:", error);
    return res.status(500).json({ error: "Internal agent communication failure." });
  }
};