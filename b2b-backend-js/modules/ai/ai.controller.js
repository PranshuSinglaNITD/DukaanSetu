import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import prisma from '../../utils/db.js';
import { getLiveWeather } from "../../utils/weatherService.js";
import { getLiveMandiPrices } from "../../utils/mandiService.js"; 
import { fetchMarketplaceMetrics,fetchBuyerDemandsMetrics } from "../../utils/marketService.js"; 

const memory = new MemorySaver();

export const handleAIChat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, city: true, name: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const { role, city, name } = user;

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
        description: "Fetches recent completed orders to track transaction history and transport costs.",
        schema: z.object({}),
      }
    );

    const checkBuyerDemandsTool = tool(
      async (args) => {
        try {
          const demands = await fetchBuyerDemandsMetrics(
            args.commodity, 
            user.city, 
            userId
          );

          if (!demands || demands.length === 0) {
            return JSON.stringify({ message: `No active buyer demands found for ${args.commodity || 'any crops'} right now.` });
          }

          const formattedDemands = demands.map(d => ({
            buyerName: d.buyer?.name || "Unknown Buyer",
            location: d.buyer?.city || 'Unknown City',
            commodityRequested: d.commodity,
            quantityNeeded: d.quantity,
            targetPrice: d.targetPrice ? `₹${d.targetPrice}` : "Negotiable",
            proximityStatus: d.buyer?.city?.toLowerCase() === user.city?.toLowerCase() ? "Local (Same City)" : "Outstation"
          }));

          return JSON.stringify(formattedDemands);
        } catch (error) {
          console.error("Buyer Demand Tool Crash:", error);
          return JSON.stringify({ error: "Failed to fetch buyer demands due to database error." });
        }
      },
      {
        name: "check_buyer_demands",
        description: "Searches the database for active procurement requests from buyers, sorted automatically from closest location to farthest.",
        schema: z.object({
          commodity: z.string().optional().describe("The name of the crop to check demand for (e.g., 'Wheat').")
        }),
      }
    );

    const localWeatherTool = tool(
      async () => {
        if (!city) return JSON.stringify({ error: "User city not configured." });
        const weatherData = await getLiveWeather(city);
        return JSON.stringify(weatherData ? weatherData : { error: "Failed to fetch live weather data." });
      },
      {
        name: "get_local_weather_forecast",
        description: "Fetches live weather and active alerts for the user's specific district.",
        schema: z.object({}),
      }
    );

    const mandiPricesTool = tool(
      async (args) => {
        const targetCity = args.city || city;
        if (!targetCity) return JSON.stringify({ error: "No location provided." });
        const prices = await getLiveMandiPrices(targetCity, args.commodity);
        return JSON.stringify(prices ? prices : { message: `No active market listings found for ${targetCity}.` });
      },
      {
        name: "get_current_mandi_prices",
        description: "Fetches live daily commodity prices from local agricultural markets.",
        schema: z.object({
          city: z.string().optional().describe("Specific city or district name."),
          commodity: z.string().optional().describe("Crop name like 'Wheat', 'Rice'.")
        }),
      }
    );

    const internalMarketTool = tool(
      async (args) => {
        const targetCity = args.city || city;
        const products = await fetchMarketplaceMetrics(args.commodity, targetCity, userId);
        
        if (!products || products.length === 0) {
          return JSON.stringify({ message: `No internal platform listings found for ${args.commodity || 'items'} in ${targetCity}.` });
        }
        
        const formattedListings = products.map(p => ({
          productName: p.name,
          askingPrice: p.price,
          availableStock: p.stock,
          sellerName: p.seller.name,
          location: `${p.seller.city}`
        }));

        return JSON.stringify(formattedListings);
      },
      {
        name: "search_internal_marketplace",
        description: "Searches the internal B2B database to see what sellers are currently listing, available stock, and asking prices.",
        schema: z.object({
          city: z.string().optional().describe("Specific city or district name to search within."),
          commodity: z.string().optional().describe("Crop or product name.")
        }),
      }
    );

    let roleSpecificPrompt = "";

    if (role === 'FARMER') {
      roleSpecificPrompt = `You are an elite AI Agronomist and Farmer Partner.
      TACTICAL RULES:
      1. ALWAYS run 'get_current_mandi_prices' before advising on selling crops.
      2. ALWAYS run 'search_agricultural_documents' when asked about farming techniques.
      3. When asked about market demand, what buyers want, or current requests, ALWAYS run 'check_buyer_demands'.`;
    } else if (role === 'WHOLESALER') {
      roleSpecificPrompt = `You are an expert AI Supply Chain Strategist.
      TACTICAL RULES:
      1. Use 'check_inventory' to track bulk stock ages.
      2. When asked about demands or buyer requests, ALWAYS run 'check_buyer_demands' to find clients to sell your inventory to.
      3. Use 'get_current_mandi_prices' to check official market rates, then use 'search_internal_marketplace' to find arbitrage margins.`;
    } else if (role === 'RETAILER') {
      roleSpecificPrompt = `You are an elite B2B AI Chief Procurement Officer.
      TACTICAL RULES:
      1. Use 'check_inventory' to review stock alerts.
      2. When checking local demands, run 'check_buyer_demands' to see what competitors are requesting.
      3. Use 'search_internal_marketplace' to find sellers near the user's city with the lowest asking prices.`;
    }

    const systemPrompt = `You are a business AI integrated inside the DukaanSetu B2B platform.
    User Name: "${name}" | Location: "${city || 'Unconfigured'}" | Role: "${role}"
    ${roleSpecificPrompt}
    CRITICAL GROUNDING & EXECUTION RULES:
    1. LIVE DATA LOCKDOWN: You are strictly FORBIDDEN from inventing, guessing, or fabricating live marketplace metrics, daily commodity prices, local weather forecasts, or inventory counts. You must pull these exclusively from tools. If tool data is missing, explicitly say you do not have that real-time data.
    2. AGRONOMIC KNOWLEDGE BALANCING: When a farmer asks general agricultural questions (e.g., how to increase crop yield, general composting, crop rotation best practices):
       - FIRST, check 'search_agricultural_documents' to see if there are specific user-uploaded guidelines.
       - IF the document search returns no local matches or is empty, you MAY utilize your foundational AI knowledge to provide standard, scientifically verified agricultural best practices. 
       - Explicitly state whether the recommendations are gathered from their uploaded records or represent baseline global agronomic practices.
    3. Keep your tone authoritative, clear, and highly practical. Use INR (₹) for currency variables.`;

    const tools = [checkInventoryTool, checkSalesTool, localWeatherTool, mandiPricesTool, internalMarketTool];
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("CRITICAL ERROR: GEMINI_API_KEY is missing.");
      return res.status(500).json({ error: "Server Configuration Error: AI is currently offline." });
    }
    
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1, 
    });

    const agent = createReactAgent({
      llm,
      tools: tools,
      checkpointSaver: memory,
      stateModifier: systemPrompt,
    });

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