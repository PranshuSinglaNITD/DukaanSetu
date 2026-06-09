//basically this is cron file in this we keep the function that we need to run at particular time intervals
import cron from 'node-cron';
import prisma from '../utils/db.js';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { searchMarketTrends } from '../modules/ai/marketKnowledge.js';
import { getLiveWeather } from '../utils/weatherService.js'; // Import the client

export const startNightlyRiskAssessment = () => {
  // Runs every day at 02:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log("🔍 Running Nightly Context-Aware Risk Assessment...");

    const llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1, 
    });

    try {
      // Fetch users with active inventory and include their registered city
      const users = await prisma.user.findMany({
        where: { inventories: { some: { quantity: { gt: 0 } } } },
        include: { inventories: true }
      });

      const generalMarketContext = await searchMarketTrends("market crash, price drops, wholesale changes");

      for (const user of users) {
        // Fetch specific weather data using the user's DB location
        let localWeatherData = null;
        if (user.city) {
          localWeatherData = await getLiveWeather(user.city);
        }

        const prompt = `
          You are an automated risk-assessment AI for a commodities store. 
          
          User Location: ${user.city || "Unknown"}
          User Inventory List: ${JSON.stringify(user.inventories)}
          Local Weather Forecast & Alerts: ${JSON.stringify(localWeatherData)}
          Macro Market News: ${generalMarketContext}
          Current Date: ${new Date().toISOString()}

          CRITICAL EVALUATION CRITERIA:
          - High Humidity (>80%) + Grains (Wheat/Rice) = Fungal/Spoilage Risk.
          - High Rain Chance (>60%) + Open Storage = Rotting Risk.
          - Extreme Heat (>40°C) + Fresh Produce (Tomatoes/Greens) = Rapid Spoiling.

          Task: Determine if the local weather poses an immediate threat to the specific crops they have in stock.
          
          If there is no danger, reply exactly with: SAFE
          If there is an environmental risk, reply exactly in this format:
          TITLE: [Clear 3-4 word warning, e.g., "High Moisture Alert"]
          MESSAGE: [A highly actionable instruction advising how to protect their specific stock from the oncoming weather in their city]
        `;

        const response = await llm.invoke(prompt);
        const aiVerdict = response.content.trim();

        if (aiVerdict !== "SAFE" && aiVerdict.includes("TITLE:") && aiVerdict.includes("MESSAGE:")) {
          const lines = aiVerdict.split('\n');
          const title = lines.find(l => l.startsWith('TITLE:')).replace('TITLE:', '').trim();
          const message = lines.find(l => l.startsWith('MESSAGE:')).replace('MESSAGE:', '').trim();

          // Write directly to the In-App Notification system
          await prisma.notification.create({
            data: {
              userId: user.id,
              title: title,
              message: message,
              type: "WEATHER_RISK"
            }
          });
          
          console.log(`✉️ Localized weather warning dispatched for User ${user.id} in ${user.city}`);
        }
      }
    } catch (error) {
      console.error(`Nightly Risk Assessment execution error:`, error);
    }
  });
};