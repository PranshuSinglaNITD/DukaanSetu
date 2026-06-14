import prisma from '../../utils/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getSmartPrice = async (req, res) => {
  const userId = req.user.userId;
  try {
    const { name, category, buyPrice, unit } = req.body;

    if (!name || !buyPrice) {
      return res.status(400).json({ error: "Product name and buy price are required." });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { address: true, city: true }
    });
    
    // Better fallback mapping
    const exactLocation = user?.city || user?.address || "local Indian B2B agricultural market";
    
    // 🚨 Upgrade: Force the model to return raw, strict JSON natively
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are 'MandiBrain', an expert AI pricing assistant for an Indian B2B agricultural marketplace. 
      A shopkeeper located in ${exactLocation} bought ${name} (${category}) for ₹${buyPrice} per ${unit}. 
      
      Suggest a highly competitive selling price specifically tailored for the local market in ${exactLocation}. 
      Ensure it guarantees a good profit margin (usually 10-25%) while remaining attractive to local buyers.
      
      Respond ONLY with a valid JSON object using this exact schema:
      {"suggestedPrice": 45, "profitMarginPercent": 15, "reasoning": "string"}
    `;

    const result = await model.generateContent(prompt);
    
    try {
      // Safely parse the response (won't crash the server if AI glitches)
      const aiSuggestion = JSON.parse(result.response.text());
      res.status(200).json({ status: 'success', data: aiSuggestion });
    } catch (parseError) {
      console.error("AI JSON Parsing Failed:", result.response.text());
      res.status(500).json({ error: 'AI generated invalid pricing data format.' });
    }

  } catch (error) {
    console.error("MandiBrain AI Error:", error);
    res.status(500).json({ error: 'Failed to generate AI price suggestion' });
  }
};

export const addToInventory = async (req, res) => {
  try {
    const { name, category, buyPrice, quantity, unit } = req.body;
    const userId = req.user.userId;

    const parsedPrice = parseFloat(buyPrice);
    const parsedQty = parseInt(quantity, 10);
    const finalUnit = unit || 'KG';

    if (isNaN(parsedPrice) || isNaN(parsedQty)) {
      return res.status(400).json({error: "Price and quantity must be valid numbers."});
    }

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found. Authentication failed.' });
    }

    console.log("📦 Adding Inventory - UserId:", userId, "Name:", name, "Qty:", parsedQty);

    const [newItem, newPurchase] = await prisma.$transaction([
      prisma.inventory.create({
        data: {
          userId: userId,
          name: name,
          category: category || 'General',
          buyPrice: parsedPrice,
          quantity: parsedQty,
          unit: finalUnit
        }
      }),
      prisma.purchase.create({
        data: {
          userId: userId,
          name: name,
          unit: finalUnit,
          buyPrice: parsedPrice,
          quantity: parsedQty,
          total: parsedPrice * parsedQty
        }
      })
    ]);

    console.log("Transaction Success - Inventory ID:", newItem.id, "Purchase ID:", newPurchase.id);
    res.status(201).json({ status: 'success', message: 'Added to stock and permanent ledger', data: { newItem, newPurchase } });
  } catch (error) {
    console.error("Add Inventory Transaction Error:", error.message);
    console.error("Full Error:", error);
    res.status(500).json({ error: 'Failed to add to inventory and ledger.', details: error.message });
  }
};

export const sellInventoryItem = async (req, res) => {
  try {
    // 🚨 NEW: Added Khata fields for offline customers
    const { inventoryId, quantitySold, sellPrice, amountPaid, buyerName, buyerPhone } = req.body;
    const sellQty = parseInt(quantitySold, 10);
    const price = parseFloat(sellPrice);

    if (isNaN(sellQty) || isNaN(price) || sellQty <= 0) {
      return res.status(400).json({ error: 'Invalid sale parameters.' });
    }

    const item = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    if (item.quantity < sellQty) return res.status(400).json({ error: `Not enough stock. You only have ${item.quantity} ${item.unit} left.` });

    const totalRevenue = price * sellQty;
    const profitPerUnit = price - item.buyPrice;
    const totalProfit = profitPerUnit * sellQty;

    // 🚨 KHATA MATH LOGIC
    const paid = amountPaid !== undefined ? parseFloat(amountPaid) : totalRevenue;
    const due = totalRevenue - paid;
    
    let pStatus = 'PAID';
    if (due > 0 && paid > 0) pStatus = 'PARTIAL';
    if (paid === 0) pStatus = 'UNPAID';

    const transaction = await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventoryId },
        data: { quantity: { decrement: sellQty } }
      }),
      
      // 🚨 KHATA INTEGRATION: Tracks offline credit directly on the Sale record
      prisma.sale.create({
        data: {
          inventoryId,
          sellPrice: price,
          quantity: sellQty,
          profit: totalProfit,
          buyerName: buyerName || "Walk-in Customer",
          buyerPhone: buyerPhone || null,
          paymentStatus: pStatus,
          amountPaid: paid,
          amountDue: due
        }
      })
    ]);

    res.status(200).json({ status: 'success', message: 'Sale recorded in Khata', data: transaction[1] });
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
    //Let the database do the math rather than pulling everything into Node memory
    const salesAggregations = await prisma.sale.aggregate({
      where: { inventory: { userId: req.user.userId } },
      _sum: {
        profit: true,
        quantity: true
      }
    });

    // Since totalRevenue = sellPrice * quantity (which varies per row), 
    // the safest way to get revenue without a complex raw SQL query is to fetch just those two columns
    const allSales = await prisma.sale.findMany({
      where: { inventory: { userId: req.user.userId } },
      select: { sellPrice: true, quantity: true }
    });

    const totalRevenue = allSales.reduce((acc, sale) => acc + (sale.sellPrice * sale.quantity), 0);

    res.status(200).json({ 
      status: 'success', 
      data: {
        totalRevenue: totalRevenue || 0,
        totalProfit: salesAggregations._sum.profit || 0,
        totalItemsSold: salesAggregations._sum.quantity || 0
      } 
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};