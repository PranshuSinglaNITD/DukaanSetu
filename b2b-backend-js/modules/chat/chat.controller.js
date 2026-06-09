import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from '../../utils/db.js';
import { getLiveWeather } from "../../utils/weatherService.js";

// Global memory for the agent (In production, you'd use a Redis/Postgres saver)
const memory = new MemorySaver();

export const handleAIChat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // ==========================================
    // 1. DEFINE SECURE TOOLS
    // ==========================================
    
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
        description: "Fetches the user's live inventory levels, buying prices, and when items expire.",
        schema: z.object({}), 
      }
    );

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
        description: "Fetches the user's most recent completed shipments to calculate profit and revenue.",
        schema: z.object({}),
      }
    );

    const localWeatherTool = tool(
      async () => {
        if (!userProfile?.city) {
          return JSON.stringify({ error: "User has not configured a city/location in their profile." });
        }
        
        const weatherData = await getLiveWeather(userProfile.city);
        return JSON.stringify(weatherData ? weatherData : { error: "Failed to fetch live weather data." });
      },
      {
        name: "get_local_weather_forecast",
        description: "Fetches live weather, humidity, rain chances, and government weather alerts for the shopkeeper's exact city.",
        schema: z.object({}), // No inputs needed from the LLM; it automatically uses the DB location!
      }
    );

    // ==========================================
    // 2. INITIALIZE THE BRAIN
    // ==========================================
    
    const llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1, // Strict, factual temperature
    });

    //The upgraded System Prompt tailored to your exact app
    const systemPrompt = `You are a world-class AI CFO and Business Partner integrated into a B2B wholesale and agricultural marketplace app. 
    Your goal is to help the shopkeeper, farmer, or wholesaler maximize their profit, reduce waste, and track logistics.
    
    CRITICAL RULES:
    1. ALWAYS use your tools to check their actual inventory or sales before giving financial advice.
    2. Speak concisely and professionally. Do not use overly enthusiastic or robotic language.
    3. If stock is expiring soon, explicitly warn them to run a discount or liquidate.
    4. Calculate actual profit margins when discussing sales (Revenue - Freight Cost - Buy Price).
    5. Understand the context of Indian agricultural and wholesale markets (Mandi trends, bulk transport, crop shelf-life).
    6. Currency is in INR (₹).
    7. You have access to the user's local weather data tool. 
      If a user asks about risks, inventory safety, or weather impact, ALWAYS trigger 'get_local_weather_forecast' to see if environmental conditions like extreme heat or heavy rain threaten their storage setup.`;

    const agent = createReactAgent({
      llm,
      tools: [checkInventoryTool, checkSalesTool,localWeatherTool],
      checkpointSaver: memory,
      stateModifier: systemPrompt,
    });

    // ==========================================
    // 3. EXECUTION
    // ==========================================
    
    // Links the conversation strictly to this user's auth ID
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
    console.error("LangGraph Agent Error:", error);
    res.status(500).json({ error: "Failed to communicate with your AI Business Partner." });
  }
};