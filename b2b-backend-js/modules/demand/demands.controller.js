import prisma from '../../utils/db.js';
import redisClient from '../../utils/redis.js';
import { z } from 'zod';

// Inline Zod Schema
export const createDemandSchema = z.object({
  cropName: z.string().min(2, "Crop name must be at least 2 characters").max(100),
  isCustomCrop: z.boolean().default(false)
});

// ==========================================
// 1. CREATE DEMAND (Restricted to Buyers)
// ==========================================
export const createDemand = async (req, res) => {
  try {
    const buyerId = req.user.userId; 
    const userRole = req.user.role; // 🚨 Extract role from JWT
    
    // 🛡️ STRICT ROLE CHECK: Farmers cannot create market demands
    if (userRole === 'FARMER') {
      return res.status(403).json({ 
        error: "Access Denied: Farmers operate on the supply side and can only view market demands." 
      });
    }

    const validatedData = createDemandSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { id: buyerId },
      select: { city: true }
    });
    
    const userCity = existingUser?.city || "Unknown";

    const newDemand = await prisma.buyerDemand.create({
      data: {
        buyerId,
        cropName: validatedData.cropName,
        isCustomCrop: validatedData.isCustomCrop,
        region: userCity,
        status: 'ACTIVE'
      }
    });

    // Invalidate Docker Redis caches instantly
    await redisClient.del(['demands:active:all', 'mandi_pulse_dashboard']);

    return res.status(201).json({
      status: 'success',
      message: "Market demand posted successfully.",
      data: newDemand
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request data',
        errors: error.errors.map(err => ({ field: err.path.join('.'), issue: err.message }))
      });
    }
    console.error("Create Demand Error:", error);
    res.status(500).json({ error: "Failed to post market demand." });
  }
};

// ==========================================
// 2. GET MARKET PULSE (Open to Everyone)
// ==========================================
export const getMarketPulse = async (req, res) => {
  try {
    const CACHE_KEY = 'mandi_pulse_dashboard';

    const cachedPulse = await redisClient.get(CACHE_KEY);
    if (cachedPulse) {
      return res.status(200).json(JSON.parse(cachedPulse));
    }

    const pulseAnalytics = await prisma.buyerDemand.groupBy({
      by: ['cropName'],
      where: { status: 'ACTIVE' },
      _count: { id: true, buyerId: true },
      orderBy: { _count: { id: 'desc' } }
    });

    const summaryList = pulseAnalytics.map(item => ({
      cropName: item.cropName,
      totalDemands: item._count.id || 0,
      activeBuyersCount: item._count.buyerId || 0
    }));

    const colors = ['#208AEF', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0'];
    const pieChartData = summaryList.map((item, index) => ({
      name: item.cropName,
      volume: item.totalDemands,
      color: colors[index % colors.length],
      legendFontColor: '#4A5568',
      legendFontSize: 12
    }));

    const responsePayload = {
      status: 'success',
      summary: summaryList,
      charts: { demandPieChart: pieChartData }
    };

    await redisClient.setEx(CACHE_KEY, 300, JSON.stringify(responsePayload));
    return res.status(200).json(responsePayload);

  } catch (error) { 
    console.error("Market Pulse Calculation Error:", error);
    res.status(500).json({ error: "Failed to generate market pulse analytics." });
  }
};

// ==========================================
// 3. CLOSE DEMAND (Restricted by Ownership)
// ==========================================
export const closeDemand = async (req, res) => {
  try {
    const { id } = req.params; 
    const buyerId = req.user.userId;

    const demand = await prisma.buyerDemand.findUnique({ where: { id } });

    if (!demand) return res.status(404).json({ error: "Demand not found." });
    if (demand.buyerId !== buyerId) return res.status(403).json({ error: "Unauthorized. You can only close your own demands." });
    if (demand.status === 'CLOSED') return res.status(400).json({ error: "This demand is already closed." });

    const updatedDemand = await prisma.buyerDemand.update({
      where: { id },
      data: { status: 'CLOSED' }
    });
    
    // 🚨 Remember to invalidate cache when a demand is closed so the pie chart updates!
    await redisClient.del(['demands:active:all', 'mandi_pulse_dashboard']);

    return res.status(200).json({ 
      status: 'success', 
      message: "Demand closed and removed from the active market pulse.",
      data: updatedDemand 
    });

  } catch (error) {
    console.error("Close Demand Error:", error);
    res.status(500).json({ error: "Failed to close demand." });
  }
};

export const getAllActiveDemands = async (req, res) => {
  try {
    // Fetch all active demands and include the user's details
    const demands = await prisma.buyerDemand.findMany({
      where: { status: 'ACTIVE' },
      include: {
        buyer: {
          select: {
            name: true,
            businessName: true,
            role: true, // 🚨 Pulls 'WHOLESALER' or 'RETAILER'
            phone: true // Optional: so farmers can contact them
          }
        }
      },
      orderBy: { createdAt: 'desc' } // Newest demands first
    });

    return res.status(200).json({
      status: 'success',
      results: demands.length,
      data: demands
    });

  } catch (error) {
    console.error("Fetch Demands List Error:", error);
    res.status(500).json({ error: "Failed to fetch detailed demands list." });
  }
};