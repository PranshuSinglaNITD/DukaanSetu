import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from '../../utils/db.js';
import { getLiveWeather } from "../../utils/weatherService.js";
import { getLiveMandiPrices } from "../../utils/mandiService.js"; // 📡 Import your live API service

const memory = new MemorySaver();

export const handleAIChat = async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    const userId = req.user.userId; // Provided securely by your auth middleware

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // ==========================================
    // 1. DEFINE SECURE TOOLS
    // ==========================================
    
    // TOOL 1: Check current user's stock
    const checkInventoryTool = tool(
      async () => {
        const inventory = await prisma.inventory.findMany({
          where: { userId: userId, quantity: { gt: 0 } },
          select: { name: true, quantity: true, unit: true, buyPrice: true, expiryDate: true }
        });
        return JSON.stringify(inventory.length ? inventory : { message: "Inventory is completely empty. No stock available." });
      },
      {
        name: "check_inventory",
        description: "Fetches the logged-in user's live inventory levels, buying prices, and when items expire.",
        schema: z.object({}), 
      }
    );

    // TOOL 2: Check current user's sales history
    const checkSalesTool = tool(
      async () => {
        const sales = await prisma.shipment.findMany({
          where: { sellerId: userId, status: "DELIVERED" },
          select: { quantity: true, transportCost: true, product: { select: { name: true, price: true } } },
          take: 10,
          orderBy: { lastUpdated: 'desc' }
        });
        return JSON.stringify(sales.length ? sales : { message: "No completed sales found yet." });
      },
      {
        name: "check_recent_sales",
        description: "Fetches the logged-in user's most recent completed shipments to calculate profit and revenue.",
        schema: z.object({}),
      }
    );

    // TOOL 3: Local Weather
    const localWeatherTool = tool(
      async () => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { city: true }
        });

        if (!user || !user.city) {
          return JSON.stringify({ error: "User has not configured a city/location in their profile." });
        }
        
        const weatherData = await getLiveWeather(user.city);
        return JSON.stringify(weatherData ? weatherData : { error: `Failed to fetch live weather data for ${user.city}.` });
      },
      {
        name: "get_local_weather_forecast",
        description: "Fetches live weather, humidity, rain chances, and weather alerts for the shopkeeper's configured city.",
        schema: z.object({}),
      }
    );

    // 🚨 TOOL 4: INTERNAL MARKETPLACE SEARCH (Excludes current user)
    const searchMarketplaceTool = tool(
      async ({ commodity }) => {
        console.log(`🔎 Database scan for B2B listings of: ${commodity} (Excluding User: ${userId})`);
        
        const availableListings = await prisma.product.findMany({
          where: {
            name: { contains: commodity, mode: 'insensitive' }, // Case-insensitive search
            sellerId: { not: userId },                          // 🚨 CRITICAL: Excludes current user's own items
            stock: { gt: 0 }                                     // Only items actively available
          },
          select: {
            id: true,
            name: true,
            price: true,
            unit: true,
            stock: true,
            seller: {
              select: { name: true, city: true, state: true }
            }
          },
          orderBy: { price: 'asc' }, // Best deals first
          take: 5
        });

        if (!availableListings.length) {
          return JSON.stringify({ message: `No other users have listed ${commodity} on the platform right now.` });
        }

        return JSON.stringify({ alternativePlatformListings: availableListings });
      },
      {
        name: "search_platform_marketplace",
        description: "Queries the application database for active product listings posted by OTHER wholesalers, farmers, or competitors. Use this when the user wants to buy stock or see what others are charging.",
        schema: z.object({
          commodity: z.string().describe("The name of the crop or item to source from other platform users (e.g., 'Wheat', 'Tomato').")
        })
      }
    );

    // 🚨 TOOL 5: EXTERNAL LIVE GOVT MANDI PRICES
    const liveMandiTool = tool(
      async ({ commodity }) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { state: true }
        });

        const userState = user?.state || "Unknown State";

        // 🚨 PASSING userId HERE TO FILTER OUT THEIR OWN ENTRIES IN THE CALCULATIONS
        console.log(`📡 Calculating dynamic benchmarks for ${commodity} on behalf of User ${userId}`);
        const marketRates = await getLiveMandiPrices(userState, commodity, userId);
        
        return JSON.stringify({ externalMandiContext: marketRates });
      },
      {
        name: "check_live_mandi_prices",
        description: "Aggregates marketplace data across all other registered sellers to compute the min, max, and modal pricing benchmarks for any given crop.",
        schema: z.object({
          commodity: z.string().describe("The name of the agricultural commodity or product to run metrics on (e.g., 'Wheat', 'Garlic').")
        })
      }
    );

    // ==========================================
    // 2. INITIALIZE THE BRAIN WITH ALL TOOLS
    // ==========================================
    
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1, 
    });

    const systemPrompt = `You are MandiBrain, an elite AI CFO and B2B Broker built directly into the DukaanSetu marketplace application. Your job is to maximize user profitability, flag logistics opportunities, and source trading deals.

    CORE RUNTIME INSTRUCTIONS:
    1. For buying enquiries or sourcing requests, ALWAYS prioritize 'search_platform_marketplace' first. This allows you to find active matching listings from OTHER users running on our platform.
    2. If a user asks for baseline market trends or generalized market valuations, check external baselines via 'check_live_mandi_prices'.
    3. To understand what the current user physically owns or paid, rely strictly on 'check_inventory'.
    4. Actively spot arbitrage windows. If someone can buy an item from another seller on our platform for less than the official government Mandi valuation, guide them to that deal.
    5. Keep all communications professional, brief, and highly direct. All financial values use INR (₹).`;

    const agent = createReactAgent({
      llm,
      tools: [checkInventoryTool, checkSalesTool, localWeatherTool, searchMarketplaceTool, liveMandiTool], 
      checkpointSaver: memory,
      stateModifier: systemPrompt,
    });

    // ==========================================
    // 3. EXECUTION
    // ==========================================
  
    const activeThread = `${userId}=${sessionId}`;
    const config = { configurable: { thread_id: activeThread } };

    const result = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      config
    );

    const finalAiMessage = result.messages[result.messages.length - 1].content;

    res.status(200).json({ 
      status: "success", 
      reply: finalAiMessage 
    });

  } catch (error) {
    console.error("LangGraph Agent Error:", error);
    res.status(500).json({ error: "Failed to communicate with your AI Business Partner." });
  }
};