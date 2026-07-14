import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from '../../utils/db.js';
import { getLiveWeather } from "../../utils/weatherService.js";
import { getLiveMandiPrices } from "../../utils/mandiService.js"; 

const memory = new MemorySaver();

export const handleAIChat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // ─── 1. FETCH LIVE USER PROFILE FROM DB ─────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, city: true, name: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const { role, city, name } = user;

    // ─── 2. DEFINE SECURE, ROLE-AWARE TOOLS ────────────────────────────────────
    
    // Check Inventory (Works for everyone, but context shifts dynamically)
    const checkInventoryTool = tool(
      async () => {
        const inventory = await prisma.inventory.findMany({
          where: { userId: userId, quantity: { gt: 0 } },
          select: { name: true, quantity: true, unit: true, buyPrice: true, expiryDate: true }
        });
        return JSON.stringify(inventory.length ? inventory : { message: "Inventory is currently empty." });
      },
      {
        name: "check_inventory",
        description: "Fetches the user's live stock levels, buying prices, and expiration data.",
        schema: z.object({}), 
      }
    );

    // Check Finished Shipments to calculate historical margins
    const checkSalesTool = tool(
      async () => {
        const isBuyerSide = role === 'RETAILER';
        const queryCondition = isBuyerSide ? { buyerId: userId } : { sellerId: userId };

        const transactions = await prisma.shipment.findMany({
          where: { ...queryCondition, status: "DELIVERED" },
          select: { 
            quantity: true, 
            transportCost: true, 
            product: { select: { name: true, price: true } } 
          },
          take: 10,
          orderBy: { lastUpdated: 'desc' }
        });
        return JSON.stringify(transactions.length ? transactions : { message: "No completed orders found." });
      },
      {
        name: "check_recent_transactions",
        description: "Fetches recent completed orders/sales to track transaction history, pricing patterns, and transport costs.",
        schema: z.object({}),
      }
    );

    // Fetch Live Local Weather Forecast and Alerts
    const localWeatherTool = tool(
      async () => {
        if (!city) {
          return JSON.stringify({ error: "User has not configured a city in their profile settings." });
        }
        const weatherData = await getLiveWeather(city);
        return JSON.stringify(weatherData ? weatherData : { error: "Failed to fetch live weather data." });
      },
      {
        name: "get_local_weather_forecast",
        description: "Fetches live weather, rainfall probability, humidity, and active government safety or crop alerts for the user's specific district.",
        schema: z.object({}),
      }
    );

    // 🚨 NEW: Fetch Live Market Mandi Prices
    const mandiPricesTool = tool(
      async (args) => {
        const targetCity = args.city || city; // Use queried city or custom specified city
        if (!targetCity) {
          return JSON.stringify({ error: "No location provided for market analysis." });
        }
        const prices = await getLiveMandiPrices(targetCity, args.commodity);
        return JSON.stringify(prices ? prices : { message: `No active market listings found for ${targetCity}.` });
      },
      {
        name: "get_current_mandi_prices",
        description: "Fetches live daily commodity prices (min, max, average per quintal) from local agricultural markets/mandis.",
        schema: z.object({
          city: z.string().optional().description("Specific city or district name to lookup prices for."),
          commodity: z.string().optional().description("Crop name like 'Wheat', 'Rice', 'Potato'.")
        }),
      }
    );

    // ─── 3. CONSTRUCT ROLE-SPECIFIC SYSTEM PROMPTS ───────────────────────────
    let roleSpecificPrompt = "";

    if (role === 'FARMER') {
      roleSpecificPrompt = `You are a world-class AI Agronomist, Financial Advisor, and Farmer Partner.
      Your goal is to maximize crop profitability, optimize harvest selling timings, and mitigate environmental risks.
      
      TACTICAL EXECUTION RULES:
      - Treat the user as a producer. They face high risks from weather and variable market pricing.
      - Before advising on when or at what price to sell, ALWAYS run 'get_current_mandi_prices' to review surrounding market realities.
      - If they ask about storage risks or harvesting windows, check 'get_local_weather_forecast'. Warn them about humidity spikes causing fungal spoilage or unexpected rainfall damaging post-harvest yield.
      - Help them calculate fair asking prices factoring in input costs (seed, fertilizer) and local transport expenses.`;
    } 
    
    else if (role === 'WHOLESALER') {
      roleSpecificPrompt = `You are an expert AI Supply Chain Strategist, B2B Inventory Auditor, and Arbitrage Consultant.
      Your goal is to optimize bulk procurement margins, maximize warehouse utilization, tracking multi-ton operations, and manage risk.
      
      TACTICAL EXECUTION RULES:
      - Wholesalers operate on volume and low margins. Focus heavily on logistics overhead, supply matching, and cold-chain/warehouse integrity.
      - Use 'check_inventory' to track bulk stock ages. If commodities are near expiration, suggest liquidation discounts to corporate retailers to protect capital.
      - Leverage 'get_current_mandi_prices' to help them identify geographical arbitrage opportunities (e.g., buying low from a rural production hub and selling high to an urban center).
      - Advise on bulk logistics cost management when reviewing transportation records.`;
    } 
    
    else if (role === 'RETAILER') {
      roleSpecificPrompt = `You are an elite B2B AI Chief Procurement Officer and Retail Operations Manager.
      Your goal is to minimize sourcing costs, prevent stockouts, maximize inventory turnover speeds, and monitor quality control.
      
      TACTICAL EXECUTION RULES:
      - Treat the user as a buyer supplying direct consumers or smaller retail outlets. Their focus is procurement consistency and high quality.
      - Use 'check_inventory' to review current stock alerts. If stock levels drop below reorder thresholds, cross-reference 'get_current_mandi_prices' to locate the most competitive wholesale hubs for restocking.
      - Remind them to deploy their integrated automated quality inspection tool to prevent accepting sub-standard bulk shipments upon delivery.`;
    }

    // Combine into a master core directive
    const systemPrompt = `You are an advanced business AI integrated directly inside the DukaanSetu B2B platform.
    The current user is named "${name}", based in "${city || 'Unconfigured Location'}", and holds the user role of: "${role}".

    ${roleSpecificPrompt}

    GLOBAL SYSTEM CONSTRAINTS:
    1. ALWAYS pull live data via tools ('check_inventory', 'get_current_mandi_prices', etc.) before providing strategic financial estimates.
    2. Maintain an authoritative, professional, and practical business tone. Avoid boilerplate corporate fluff or overly dramatic phrasing.
    3. All currency representations must strictly use Indian Rupees (INR, ₹).
    4. Account for authentic local operational logic (units like Quintals/Tons, regional mandis, truck freight variables).`;

    // ─── 4. INITIALIZE THE COMPUTE GRAPH ──────────────────────────────────────
    const llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.15, // Low temperature ensuring crisp constraint execution
    });

    const agent = createReactAgent({
      llm,
      tools: [checkInventoryTool, checkSalesTool, localWeatherTool, mandiPricesTool],
      checkpointSaver: memory,
      stateModifier: systemPrompt,
    });

    // ─── 5. INVOCATION & STATE RETURN ─────────────────────────────────────────
    const config = { configurable: { thread_id: userId } };

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
    console.error("Dynamic LangGraph Agent Execution Failure:", error);
    res.status(500).json({ error: "Failed to communicate with your AI Business Partner." });
  }
};