import prisma from '../../utils/db.js';
import { z } from 'zod';

// Validation Schema
const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  category: z.string().min(2, "Category is required"),
  mandiName: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  unit: z.string().optional().default("KG"),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
});

// 1. CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    // 1. Validate incoming text/numeric fields (Zod coercion will handle strings from form-data)
    const validatedData = productSchema.parse(req.body);

    // 2. Handle uploaded product images (Multer stores them in req.files)
    const imageUrls = req.files 
      ? req.files.map(file => `/uploads/${file.filename}`) 
      : [];

    // Optional: Ensure at least one product photo is uploaded
    if (imageUrls.length === 0) {
      return res.status(400).json({ error: "At least one product image is required." });
    }

    // 3. Save the product with images to PostgreSQL
    const newProduct = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        mandiName: validatedData.mandiName,
        price: validatedData.price,
        unit: validatedData.unit,
        stock: validatedData.stock,
        sellerId: req.user.userId,
        images: imageUrls, // Save array of image paths
      }
    });

    res.status(201).json({ status: 'success', data: newProduct });
  } catch (error) {
    console.error("Create Product Error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// 2. GET ALL PRODUCTS (With optional filters for Mandi or Category)
export const getAllProducts = async (req, res) => {
  try {
    const currUserId=req.user.userId;
    const { category, mandi, search }  = req.query;
    
    const filter = { isAvailable: true, sellerId:{not:currUserId} };
    if (category) filter.category = category.toUpperCase();
    if (mandi) filter.mandiName = { contains: mandi, mode: 'insensitive' };
    if (search) filter.name = { contains: search, mode: 'insensitive' };

    const products = await prisma.product.findMany({
      where: filter,
      include: { seller: { select: { name: true, businessName: true, phone: true } } },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({ status: 'success', results: products.length, data: products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// 3. UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // In a real app, validate this partial data too

    // Ensure the product belongs to the user trying to update it
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

// 4. DELETE PRODUCT
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

export const comparePrices = async (req, res) => {
  try {
    // We expect the frontend to pass the product name and the user's city
    // Example: /api/products/compare?name=Wheat&city=Delhi
    const { name, city } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required for comparison.' });
    }

    // 1. Fetch all available products matching the name
    // We order by price ascending, so the first result is guaranteed to be the cheapest
    const products = await prisma.product.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        isAvailable: true
      },
      include: {
        seller: {
          select: { name: true, businessName: true, phone: true, address: true }
        }
      },
      orderBy: { price: 'asc' } 
    });

    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found for comparison.' });
    }

    // 2. Extract the Cheapest Seller
    const cheapestSeller = products[0];

    // 3. Find Nearby Sellers
    // Filter the fetched products to see if the seller's address contains the requested city
    let nearbySellers = [];
    if (city) {
      nearbySellers = products.filter(p => 
        p.seller.address && 
        p.seller.address.toLowerCase().includes(city.toLowerCase())
      );
    }

    // 4. Generate Historical Pricing (MandiBrain MVP Mock)
    // We create a realistic 6-day trend based on the current cheapest price
    const basePrice = cheapestSeller.price;
    const historicalPricing = [
      { day: '5 Days Ago', price: Math.round(basePrice * 1.08) }, // 8% higher
      { day: '4 Days Ago', price: Math.round(basePrice * 1.05) },
      { day: '3 Days Ago', price: Math.round(basePrice * 0.98) }, // Dropped below current
      { day: '2 Days Ago', price: Math.round(basePrice * 0.96) },
      { day: 'Yesterday', price: Math.round(basePrice * 0.99) },
      { day: 'Today', price: basePrice }
    ];

    res.status(200).json({
      status: 'success',
      data: {
        query: name,
        cheapestSeller,
        nearbySellers,
        historicalPricing,
        totalSellersFound: products.length
      }
    });

  } catch (error) {
    console.error("Compare Prices Error:", error);
    res.status(500).json({ error: 'Failed to generate price comparison.' });
  }
};

//for buying
export const purchaseProduct = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const buyerId = req.user.userId; 
    const buyQty = parseInt(quantity);

    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.sellerId === buyerId) return res.status(400).json({ error: "You cannot buy your own product" });
    if (product.stock < buyQty) return res.status(400).json({ error: "Insufficient stock available" });

    const totalPrice = product.price * buyQty;

    // Execute atomic transaction: Deduct stock, log the formal order, and add to buyer's warehouse inventory
    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { 
          stock: product.stock - buyQty,
          isAvailable: product.stock - buyQty > 0
        }
      }),
      prisma.inventory.create({
        data: {
          userId: buyerId,
          name: product.name,
          category: product.category,
          buyPrice: product.price,
          quantity: buyQty,
          unit: product.unit || 'KG'
        }
      })
    ]);

    res.status(201).json({ status: 'success', message: 'Purchase finalized and stock added to inventory', data: result[1] });
  } catch (error) {
    console.error("Purchase Error:", error);
    res.status(500).json({ error: 'Failed to process purchase transaction' });
  }
};