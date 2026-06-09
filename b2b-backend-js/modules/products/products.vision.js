import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const autoAnalyzeProductImage = async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Please upload a clear product image." });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || "image/jpeg"
      }
    };

    //We train the prompt to only use the categories allowed by your Prisma schema
    const prompt = `You are an automated wholesale inventory ingestion system. 
    Analyze this crop or product photo and extract structural details for our database.
    
    CRITICAL CATEGORY RULE: The category field MUST be exactly one of these strings: "GRAINS", "VEGETABLES", or "FMCG".
    
    Return EXACTLY this JSON structure:
    {
      "suggestedName": "string (e.g., Sharbati Wheat, Desi Tomatoes)",
      "category": "GRAINS" | "VEGETABLES" | "FMCG",
      "estimatedShelfLifeDays": number (integer representing safe storage days left)
    }`;

    const result = await model.generateContent([prompt, imagePart]);
    const aiAnalysis = JSON.parse(result.response.text());

    res.status(200).json({
      status: "success",
      analysis: aiAnalysis
    });

  } catch (error) {
    console.error("AI Auto-Ingestion Error:", error);
    res.status(500).json({ error: "Failed to parse product image details automatically." });
  }
};