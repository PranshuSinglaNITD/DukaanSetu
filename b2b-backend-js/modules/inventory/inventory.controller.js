import prisma from '../../utils/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const getSmartPrice = async (req, res) => {
    const userId=req.user.userId;
  try {
    const { name, category, buyPrice, unit } = req.body;

    if (!name || !buyPrice) {
      return res.status(400).json({ error: "Product name and buy price are required." });
    }

    const user=await prisma.user.findUnique({
        where:{id:userId},
        select:{city:true,state:true}
    })
    const exactLocation=(user?.city&&user?.state)?`${user.city}, ${user.state}`:"Local indian market";
    // Initialize the specific model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // The Prompt: Giving the AI a strict persona and output format
    const prompt = `
      YYou are 'MandiBrain', an expert AI pricing assistant for an Indian B2B agricultural marketplace. 
      A shopkeeper located in ${exactLocation} bought ${name} (${category}) for ₹${buyPrice} per ${unit}. 
      
      Suggest a highly competitive selling price specifically tailored for the local market in ${exactLocation}. 
      Ensure it guarantees a good profit margin (usually 10-25%) while remaining attractive to local buyers. Factor in the typical cost of living and purchasing power of ${exactLocation} if known.
      
      Respond ONLY with a valid JSON object in this exact format, with no markdown, no code blocks, and no extra text:
      {
        "suggestedPrice": 45,
        "profitMarginPercent": 15,
        "reasoning": "In ${exactLocation}, a 15% markup is standard for grains. ₹45 keeps you competitive locally while securing a solid ₹6 profit per KG."
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean up the response in case Gemini adds markdown formatting like ```json
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiSuggestion = JSON.parse(cleanJson);

    res.status(200).json({ status: 'success', data: aiSuggestion });
  } catch (error) {
    console.error("MandiBrain AI Error:", error);
    res.status(500).json({ error: 'Failed to generate AI price suggestion' });
  }
};
export const addToInventory = async (req, res) => {
  try {
    const { name, category, buyPrice, quantity, unit } = req.body;
    
    const newItem = await prisma.inventory.create({
      data: {
        userId: req.user.userId,
        name,
        category,
        buyPrice: parseFloat(buyPrice),
        quantity: parseInt(quantity),
        unit: unit || 'KG'
      }
    });

    res.status(201).json({ status: 'success', message: 'Added to inventory', data: newItem });
  } catch (error) {
    console.error("Add Inventory Error:", error);
    res.status(500).json({ error: 'Failed to add to inventory' });
  }
};

export const sellInventoryItem = async (req, res) => {
  try {
    const { inventoryId, quantitySold, sellPrice } = req.body;
    const sellQty = parseInt(quantitySold);
    const price = parseFloat(sellPrice);

    const item = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    if (item.quantity < sellQty) return res.status(400).json({ error: `Not enough stock. You only have ${item.quantity} ${item.unit} left.` });

    const profitPerUnit = price - item.buyPrice;
    const totalProfit = profitPerUnit * sellQty;

    const transaction = await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventoryId },
        data: { quantity: item.quantity - sellQty }
      }),
      prisma.sale.create({
        data: {
          inventoryId,
          sellPrice: price,
          quantity: sellQty,
          profit: totalProfit
        }
      })
    ]);

    res.status(200).json({ status: 'success', message: 'Sale recorded', data: transaction[1] });
  } catch (error) {
    console.error("Sell Inventory Error:", error);
    res.status(500).json({ error: 'Failed to process sale' });
  }
};

export const getMyInventory = async (req, res) => {
  try {
    const inventory = await prisma.inventory.findMany({
      where: { userId: req.user.userId, quantity: { gt: 0 } },
      orderBy: { updatedAt: 'desc' }
    });
    res.status(200).json({ status: 'success', data: inventory });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const userInventory = await prisma.inventory.findMany({
      where: { userId: req.user.userId },
      include: { sales: true }
    });

    let totalRevenue = 0;
    let totalProfit = 0;
    let itemsSold = 0;

    userInventory.forEach(item => {
      item.sales.forEach(sale => {
        totalRevenue += (sale.sellPrice * sale.quantity);
        totalProfit += sale.profit;
        itemsSold += sale.quantity;
      });
    });

    res.status(200).json({ 
      status: 'success', 
      data: {
        totalRevenue,
        totalProfit,
        totalItemsSold: itemsSold
      } 
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};