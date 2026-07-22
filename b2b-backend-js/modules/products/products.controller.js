import prisma from '../../utils/db.js';
import { z } from 'zod';
import { ingestNewMarketData } from '../ai/marketKnowledge.js';

const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  category: z.string().min(2, "Category is required"),
  mandiName: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  unit: z.string().optional().default("KG"),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  estimatedShelfLifeDays: z.coerce.number().min(0, "Cannot be empty")
});

// 1. CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    // Security: Block retailers from creating bulk supply
    if (req.user.role === 'RETAILER') {
      return res.status(403).json({ error: "Access Denied: Retailers cannot create wholesale listings." });
    }

    const validatedData = productSchema.parse(req.body);
    const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    if (imageUrls.length === 0) return res.status(400).json({ error: "Product image is required." });

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(validatedData.estimatedShelfLifeDays, 10));

    const newProduct = await prisma.product.create({
      data: {
        name: validatedData.name, description: validatedData.description,
        category: validatedData.category, mandiName: validatedData.mandiName,
        price: validatedData.price, unit: validatedData.unit, stock: validatedData.stock,
        expiryDate: expiryDate, sellerId: req.user.userId, images: imageUrls,
      },
      include: { seller: { select: { city: true } } }
    });

    const locationStr = newProduct.seller.city ? `in ${newProduct.seller.city}` : `at ${newProduct.mandiName}`;
    const intelligenceSentence = `SUPPLY ALERT: A new wholesale listing of ${newProduct.stock} ${newProduct.unit} of ${newProduct.name} was just posted ${locationStr} with an asking price of ₹${newProduct.price}/${newProduct.unit}.`;
    
    ingestNewMarketData(intelligenceSentence, { source: "internal_listing", crop: newProduct.name })
      .catch(err => console.error("AI Ingestion skipped:", err));
      
    res.status(201).json({ status: 'success', data: newProduct });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// 2. GET ALL PRODUCTS (With Market Analysis Injection)
export const getAllProducts = async (req, res) => {
  try {
    const currUserId = req.user.userId;
    const userRole = req.user.role; 
    const { category, mandi, search } = req.query;
    
    let targetSellerRoles = [];
    if (userRole === 'RETAILER') targetSellerRoles = ['WHOLESALER'];
    else if (userRole === 'WHOLESALER') targetSellerRoles = ['FARMER', 'WHOLESALER'];
    else if (userRole === 'FARMER') targetSellerRoles = ['FARMER']; 

    const filter = { 
      isAvailable: true, sellerId: { not: currUserId },
      seller: { role: { in: targetSellerRoles } } 
    };

    if (category && category !== 'All') filter.category = category.toUpperCase();
    if (mandi) filter.mandiName = { contains: mandi, mode: 'insensitive' };
    if (search) filter.name = { contains: search, mode: 'insensitive' };

    const products = await prisma.product.findMany({
      where: filter,
      include: { seller: { select: { name: true, phone: true, role: true, averageRating: true, totalReviews: true } } },
      orderBy: { updatedAt: 'desc' }
    });

    if (products.length === 0) return res.status(200).json({ status: 'success', results: 0, data: [] });

    // Group prices by commodity to calculate local market consensus (mode)
    const priceFrequency = {};
    products.forEach(p => {
      const cropName = p.name.toLowerCase();
      const price = parseFloat(p.price);
      if (!priceFrequency[cropName]) priceFrequency[cropName] = {};
      priceFrequency[cropName][price] = (priceFrequency[cropName][price] || 0) + 1;
    });

    const majorityPrices = {};
    for (const crop in priceFrequency) {
      let maxCount = 0, majorityPrice = 0;
      for (const [price, count] of Object.entries(priceFrequency[crop])) {
        if (count > maxCount) { maxCount = count; majorityPrice = parseFloat(price); }
      }
      majorityPrices[crop] = majorityPrice;
    }

    // Attach processed market data directly to product objects for the UI
    const enrichedProducts = products.map(p => {
      const difference = parseFloat(p.price) - majorityPrices[p.name.toLowerCase()];
      return {
        ...p,
        marketAnalysis: {
          majorityPrice: majorityPrices[p.name.toLowerCase()],
          priceDifference: difference,
          isExpensive: difference > 0,
          displayMessage: difference > 0 ? `₹${difference} Above Avg` : difference < 0 ? `₹${Math.abs(difference)} Below Avg` : "Matches Average"
        }
      };
    });

    res.status(200).json({ status: 'success', results: enrichedProducts.length, data: enrichedProducts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// 3. UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized to edit' });

    // Security: Zod partial() safely ignores malicious injected fields
    const safeUpdateData = productSchema.partial().parse(req.body);

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: safeUpdateData
    });

    res.status(200).json({ status: 'success', data: updatedProduct });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// 4. DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized to delete' });

    await prisma.product.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// 5. PURCHASE PRODUCT
export const purchaseProduct = async (req, res) => {
  try {
    const { productId, quantity, negotiationId, amountPaid, paymentMethod } = req.body;
    const buyerId = req.user.userId; 
    const buyerRole = req.user.role;
    
    if (buyerRole === 'FARMER') return res.status(403).json({ error: "Farmers operate strictly on the supply side." });

    const buyQty = parseInt(quantity, 10);
    if (isNaN(buyQty) || buyQty <= 0) return res.status(400).json({ error: "Invalid purchase quantity." });

    const product = await prisma.product.findUnique({ 
      where: { id: productId }, include: { seller: { select: { role: true } } } 
    });

    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.sellerId === buyerId) return res.status(400).json({ error: "Cannot buy own product" });
    if (product.stock < buyQty) return res.status(400).json({ error: "Insufficient stock" });
    if (buyerRole === 'RETAILER' && product.seller.role === 'FARMER') {
      return res.status(403).json({ error: "Retailers must procure through Wholesalers." });
    }

    let finalUnitPrice = product.price;

    if (negotiationId) {
      const negotiation = await prisma.negotiation.findUnique({
        where: { id: negotiationId },
        include: { offers: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
      if (!negotiation || negotiation.status !== 'ACCEPTED') return res.status(400).json({ error: "Deal not accepted." });
      
      finalUnitPrice = negotiation.offers[0].price;
      await prisma.negotiation.update({ where: { id: negotiationId }, data: { status: 'COMPLETED' } });
    }

    const newStockLevel = product.stock - buyQty;
    const totalCost = finalUnitPrice * buyQty;
    const paid = amountPaid !== undefined ? parseFloat(amountPaid) : totalCost;
    const due = totalCost - paid;
    
    let pStatus = paid === 0 ? 'UNPAID' : (due > 0 ? 'PARTIAL' : 'PAID');

    // Security: Prisma checks stock inside the transaction to prevent race conditions
    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId, stock: { gte: buyQty } }, 
        data: { stock: { decrement: buyQty }, isAvailable: newStockLevel > 0 }
      }),
      prisma.inventory.create({
        data: {
          userId: buyerId, name: product.name, category: product.category,
          buyPrice: finalUnitPrice, quantity: buyQty, unit: product.unit || 'KG',
          expiryDate: product.expiryDate 
        }
      }),
      prisma.purchase.create({
        data: {
          userId: buyerId, name: product.name, sellerId: product.sellerId, unit: product.unit || 'KG',
          buyPrice: finalUnitPrice, quantity: buyQty, total: totalCost, paymentStatus: pStatus,
          amountPaid: paid, amountDue: due,
          payments: paid > 0 ? {
            create: { amount: paid, method: paymentMethod || "PLATFORM", buyerId: buyerId, sellerId: product.sellerId }
          } : undefined
        }
      }),
      prisma.shipment.create({
        data: {
          productId: productId, negotiationId: negotiationId || null, buyerId: buyerId, 
          sellerId: product.sellerId, quantity: buyQty, transportCost: 0, status: "PENDING"
        }
      })
    ]);

    res.status(201).json({ status: 'success', data: result[2] });
  } catch (error) {
    console.error("Purchase Error:", error);
    res.status(500).json({ error: 'Failed to process transaction' });
  }
};