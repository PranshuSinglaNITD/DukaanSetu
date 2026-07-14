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
  estimatedShelfLifeDays: z.coerce.number().min(0,"this cannot be left empty")
});

// ==========================================
// 1. CREATE PRODUCT
// ==========================================
export const createProduct = async (req, res) => {
  try {
    const validatedData = productSchema.parse(req.body);
    const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    if (imageUrls.length === 0) {
      return res.status(400).json({ error: "At least one product image is required." });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(validatedData.estimatedShelfLifeDays, 10));

    const newProduct = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        mandiName: validatedData.mandiName,
        price: validatedData.price,
        unit: validatedData.unit,
        stock: validatedData.stock,
        expiryDate: expiryDate,
        sellerId: req.user.userId,
        images: imageUrls, 
      },
      include: { seller: { select: { city: true } } }
    });

    const locationStr = newProduct.seller.city ? `in ${newProduct.seller.city}` : `at ${newProduct.mandiName}`;
    const intelligenceSentence = `SUPPLY ALERT: A new wholesale listing of ${newProduct.stock} ${newProduct.unit} of ${newProduct.name} was just posted ${locationStr} with an asking price of ₹${newProduct.price}/${newProduct.unit}.`;
    
    // Fire and forget AI data ingestion
    ingestNewMarketData(intelligenceSentence, { source: "internal_listing", crop: newProduct.name })
      .catch(err => console.error("AI Ingestion skipped:", err));
      
    res.status(201).json({ status: 'success', data: newProduct });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// ==========================================
// 2. GET ALL PRODUCTS (Strict B2B Filtering)
// ==========================================
export const getAllProducts = async (req, res) => {
  try {
    const currUserId = req.user.userId;
    const userRole = req.user.role; // 🚨 Extracted from JWT token
    const { category, mandi, search } = req.query;
    
    let targetSellerRoles = [];
    if (userRole === 'RETAILER') targetSellerRoles = ['WHOLESALER'];
    else if (userRole === 'WHOLESALER') targetSellerRoles = ['FARMER', 'WHOLESALER'];
    else if (userRole === 'FARMER') targetSellerRoles = ['FARMER']; // Research only

    const filter = { 
      isAvailable: true, 
      sellerId: { not: currUserId },
      seller: { role: { in: targetSellerRoles } } 
    };

    if (category) filter.category = category.toUpperCase();
    if (mandi) filter.mandiName = { contains: mandi, mode: 'insensitive' };
    if (search) filter.name = { contains: search, mode: 'insensitive' };

    const products = await prisma.product.findMany({
      where: filter,
      include: { 
        seller: { 
          select: { name: true,phone: true, role: true} 
        } 
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({ status: 'success', results: products.length, data: products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// ==========================================
// 3. UPDATE PRODUCT
// ==========================================
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; 

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized to edit this product' });

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({ status: 'success', message: 'Product updated', data: updatedProduct });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// ==========================================
// 4. DELETE PRODUCT
// ==========================================
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized to delete this product' });

    await prisma.product.delete({ where: { id } });

    res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// ==========================================
// 5. COMPARE PRICES (Role-Aware)
// ==========================================
export const comparePrices = async (req, res) => {
  try {
    const { name, city } = req.query;
    const userRole = req.user.role;

    if (!name) return res.status(400).json({ error: 'Product name is required for comparison.' });

    // Ensure they only compare prices of goods they are legally allowed to buy
    let targetSellerRoles = [];
    if (userRole === 'RETAILER') targetSellerRoles = ['WHOLESALER'];
    else if (userRole === 'WHOLESALER') targetSellerRoles = ['FARMER', 'WHOLESALER'];
    else if (userRole === 'FARMER') targetSellerRoles = ['FARMER'];

    const products = await prisma.product.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        isAvailable: true,
        seller: { role: { in: targetSellerRoles } }
      },
      include: {
        seller: { select: { name: true, businessName: true, phone: true, address: true } }
      },
      orderBy: { price: 'asc' } 
    });

    if (products.length === 0) {
      return res.status(404).json({ error: 'No comparable products found in your supply chain tier.' });
    }

    const cheapestSeller = products[0];
    let nearbySellers = city ? products.filter(p => p.seller.address && p.seller.address.toLowerCase().includes(city.toLowerCase())) : [];

    const basePrice = cheapestSeller.price;
    const historicalPricing = [
      { day: '5 Days Ago', price: Math.round(basePrice * 1.08) }, 
      { day: '4 Days Ago', price: Math.round(basePrice * 1.05) },
      { day: '3 Days Ago', price: Math.round(basePrice * 0.98) }, 
      { day: '2 Days Ago', price: Math.round(basePrice * 0.96) },
      { day: 'Yesterday', price: Math.round(basePrice * 0.99) },
      { day: 'Today', price: basePrice }
    ];

    res.status(200).json({
      status: 'success',
      data: { query: name, cheapestSeller, nearbySellers, historicalPricing, totalSellersFound: products.length }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate price comparison.' });
  }
};

// ==========================================
// 6. PURCHASE PRODUCT
// ==========================================
export const purchaseProduct = async (req, res) => {
  try {
    const { productId, quantity, negotiationId, amountPaid, paymentMethod } = req.body;
    const buyerId = req.user.userId; 
    const buyerRole = req.user.role;
    
    // 🛡️ Farmers cannot procure goods
    if (buyerRole === 'FARMER') {
      return res.status(403).json({ error: "Access Denied: Farmers operate strictly on the supply side and cannot procure goods." });
    }

    const buyQty = parseInt(quantity, 10);
    if (isNaN(buyQty) || buyQty <= 0) return res.status(400).json({ error: "Invalid purchase quantity provided." });

    const product = await prisma.product.findUnique({ 
      where: { id: productId },
      include: { seller: { select: { role: true } } } 
    });

    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.sellerId === buyerId) return res.status(400).json({ error: "You cannot buy your own product" });
    if (product.stock === undefined || product.stock === null) return res.status(500).json({ error: "Product database record is missing stock data." });
    if (product.stock < buyQty) return res.status(400).json({ error: "Insufficient stock available" });

    // 🛡️ Strict Anti-Bypass Validation
    if (buyerRole === 'RETAILER' && product.seller.role === 'FARMER') {
      return res.status(403).json({ error: "Supply Chain Policy Violation: Retailers must procure goods through verified Wholesalers." });
    }

    let finalUnitPrice = product.price;

    if (negotiationId) {
      const negotiation = await prisma.negotiation.findUnique({
        where: { id: negotiationId },
        include: { offers: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });

      if (!negotiation) return res.status(404).json({ error: "Negotiation not found" });
      if (negotiation.status !== 'ACCEPTED') return res.status(400).json({ error: "This deal has not been accepted yet." });
      
      finalUnitPrice = negotiation.offers[0].price;
      
      await prisma.negotiation.update({
        where: { id: negotiationId },
        data: { status: 'COMPLETED' }
      });
    }

    const newStockLevel = product.stock - buyQty;
    const totalCost = finalUnitPrice * buyQty;

    // 🚨 KHATA MATH LOGIC
    const paid = amountPaid !== undefined ? parseFloat(amountPaid) : totalCost;
    const due = totalCost - paid;
    
    let pStatus = 'PAID';
    if (due > 0 && paid > 0) pStatus = 'PARTIAL';
    if (paid === 0) pStatus = 'UNPAID';

    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { stock: { decrement: buyQty }, isAvailable: newStockLevel > 0 }
      }),

      prisma.inventory.create({
        data: {
          userId: buyerId,
          name: product.name,
          category: product.category,
          buyPrice: finalUnitPrice, 
          quantity: buyQty,       
          unit: product.unit || 'KG',
          expiryDate: product.expiryDate 
        }
      }),

      prisma.purchase.create({
        data: {
          userId: buyerId,
          name: product.name,
          sellerId: product.sellerId,
          unit: product.unit || 'KG',
          buyPrice: finalUnitPrice,
          quantity: buyQty,
          total: totalCost,
          paymentStatus: pStatus,
          amountPaid: paid,
          amountDue: due,
          payments: paid > 0 ? {
            create: {
              amount: paid,
              method: paymentMethod || "PLATFORM",
              buyerId: buyerId,
              sellerId: product.sellerId
            }
          } : undefined
        }
      }),

      prisma.shipment.create({
        data: {
          productId: productId,
          negotiationId: negotiationId || null, 
          buyerId: buyerId,
          sellerId: product.sellerId,
          quantity: buyQty,
          transportCost: 0, 
          status: "PENDING"
        }
      })
    ]);

    res.status(201).json({ status: 'success', message: 'Purchase finalized and recorded in Ledger', data: result[2] });
  } catch (error) {
    console.error("Purchase Error:", error);
    res.status(500).json({ error: 'Failed to process purchase transaction' });
  }
};