import prisma from '../../utils/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 1. GET SMART PRICE (Role-Aware Prompting)
// ==========================================
export const getSmartPrice = async (req, res) => {
  const userId = req.user.userId;
  const userRole = req.user.role; // 🚨 Extracted from JWT
  
  try {
    const { name, category, buyPrice, unit } = req.body;

    if (!name || !buyPrice) {
      return res.status(400).json({ error: "Product name and base price/cost are required." });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { address: true, city: true }
    });
    
    const exactLocation = user?.city || user?.address || "local Indian B2B agricultural market";
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // 🚨 ROLE-AWARE PROMPT LOGIC
    let financialContext = "";
    if (userRole === 'FARMER') {
      financialContext = `A farmer located in ${exactLocation} harvested ${name} (${category}) with an estimated production cost of ₹${buyPrice} per ${unit}. Suggest a profitable B2B selling price to Wholesalers.`;
    } else {
      financialContext = `A ${userRole.toLowerCase()} located in ${exactLocation} bought ${name} (${category}) for ₹${buyPrice} per ${unit}. Suggest a profitable selling price for their buyers.`;
    }

    const prompt = `
      You are 'MandiBrain', an expert AI pricing assistant for an Indian B2B agricultural marketplace. 
      ${financialContext}
      
      Ensure it guarantees a good profit margin (usually 10-25%) while remaining attractive to local buyers.
      Respond ONLY with a valid JSON object using this exact schema:
      {"suggestedPrice": 45, "profitMarginPercent": 15, "reasoning": "string"}
    `;

    const result = await model.generateContent(prompt);
    
    try {
      const aiSuggestion = JSON.parse(result.response.text());
      res.status(200).json({ status: 'success', data: aiSuggestion });
    } catch (parseError) {
      res.status(500).json({ error: 'AI generated invalid pricing data format.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate AI price suggestion' });
  }
};

// ==========================================
// 2. ADD TO INVENTORY (The Ledger Fix)
// ==========================================
export const addToInventory = async (req, res) => {
  try {
    const { name, category, buyPrice, quantity, unit } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role; // 🚨 Check who is adding inventory

    const parsedPrice = parseFloat(buyPrice);
    const parsedQty = parseInt(quantity, 10);
    const finalUnit = unit || 'KG';

    if (isNaN(parsedPrice) || isNaN(parsedQty)) {
      return res.status(400).json({error: "Cost and quantity must be valid numbers."});
    }

    // 🛡️ THE FIX: Farmers Harvest, Buyers Purchase.
    if (userRole === 'FARMER') {
      // 1. Farmer Logic: Just add to inventory. They didn't buy it, so NO purchase record.
      const newItem = await prisma.inventory.create({
        data: {
          userId, name, category: category || 'General',
          buyPrice: parsedPrice, // Treated conceptually as "Production Cost"
          quantity: parsedQty, unit: finalUnit
        }
      });
      return res.status(201).json({ status: 'success', message: 'Harvest added to inventory.', data: { newItem } });
    } 
    else {
      // 2. Retailer/Wholesaler Logic: Add to inventory AND log the offline expense in the ledger.
      const [newItem, newPurchase] = await prisma.$transaction([
        prisma.inventory.create({
          data: {
            userId, name, category: category || 'General',
            buyPrice: parsedPrice, quantity: parsedQty, unit: finalUnit
          }
        }),
        prisma.purchase.create({
          data: {
            userId, name, unit: finalUnit, buyPrice: parsedPrice,
            quantity: parsedQty, total: parsedPrice * parsedQty
          }
        })
      ]);
      return res.status(201).json({ status: 'success', message: 'Added to stock and permanent ledger', data: { newItem, newPurchase } });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to inventory and ledger.' });
  }
};

// ==========================================
// 3. SELL OFFLINE INVENTORY (Unchanged - Works Great)
// ==========================================
export const sellInventoryItem = async (req, res) => {
  try {
    const { inventoryId, quantitySold, sellPrice, amountPaid, buyerName, buyerPhone } = req.body;
    const sellQty = parseInt(quantitySold, 10);
    const price = parseFloat(sellPrice);

    if (isNaN(sellQty) || isNaN(price) || sellQty <= 0) return res.status(400).json({ error: 'Invalid sale parameters.' });

    const item = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });
    if (item.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });
    if (item.quantity < sellQty) return res.status(400).json({ error: `Not enough stock. You only have ${item.quantity} ${item.unit} left.` });

    const totalRevenue = price * sellQty;
    const totalProfit = (price - item.buyPrice) * sellQty;

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
      prisma.sale.create({
        data: {
          inventoryId, sellPrice: price, quantity: sellQty, profit: totalProfit,
          buyerName: buyerName || "Walk-in Customer", buyerPhone: buyerPhone || null,
          paymentStatus: pStatus, amountPaid: paid, amountDue: due
        }
      })
    ]);

    res.status(200).json({ status: 'success', message: 'Offline Sale recorded in Khata', data: transaction[1] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process sale' });
  }
};

// ==========================================
// 4. GET MY INVENTORY 
// ==========================================
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

// ==========================================
// 5. GET ANALYTICS (Upgraded for B2B & B2C)
// ==========================================
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Get OFFLINE sales (from the code above)
    const offlineSales = await prisma.sale.aggregate({
      where: { inventory: { userId: userId } },
      _sum: { profit: true, quantity: true }
    });

    const offlineRecords = await prisma.sale.findMany({
      where: { inventory: { userId: userId } },
      select: { sellPrice: true, quantity: true }
    });
    const offlineRevenue = offlineRecords.reduce((acc, sale) => acc + (sale.sellPrice * sale.quantity), 0);

    // 2. Get ONLINE B2B sales (where this user was the seller in the platform)
    // Assuming your Shipment or Purchase table links to sellerId
    const onlineSales = await prisma.purchase.findMany({
      where: { sellerId: userId },
      select: { buyPrice: true, quantity: true }
    });
    
    const onlineRevenue = onlineSales.reduce((acc, sale) => acc + (sale.buyPrice * sale.quantity), 0);
    const onlineQuantity = onlineSales.reduce((acc, sale) => acc + sale.quantity, 0);

    // Combine them for the true dashboard metric
    res.status(200).json({ 
      status: 'success', 
      data: {
        totalRevenue: offlineRevenue + onlineRevenue,
        totalItemsSold: (offlineSales._sum.quantity || 0) + onlineQuantity,
        offlineProfitOnly: offlineSales._sum.profit || 0
      } 
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};