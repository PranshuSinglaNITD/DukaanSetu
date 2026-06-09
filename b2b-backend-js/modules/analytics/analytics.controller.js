import prisma from '../../utils/db.js';

export const getBusinessAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Fetch all goods bought (Expenses)
    const purchases = await prisma.inventory.findMany({
      where: { userId: userId },
      select: { buyPrice: true, quantity: true, createdAt: true, name: true }
    });

    // 2. Fetch all completed sales (Revenue)
    const sales = await prisma.shipment.findMany({
      where: { sellerId: userId, status: 'DELIVERED' },
      include: { product: { select: { name: true, price: true } } }
    });

    // ==========================================
    // PARSE FINANCIAL KPIS
    // ==========================================
    let totalExpenses = purchases.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0);
    
    let totalRevenue = sales.reduce((sum, item) => {
      const itemPrice = item.product?.price || 0;
      return sum + (item.quantity * itemPrice);
    }, 0);

    const netProfitOrLoss = totalRevenue - totalExpenses;

    // ==========================================
    // AGGREGATE MONTHLY TRENDS (For Line Graph)
    // ==========================================
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = {};

    // Initialize past 6 months structure with 0s
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthlyData[monthNames[d.getMonth()]] = { revenue: 0, profit: 0 };
    }

    // Map Revenue into Months
    sales.forEach(sale => {
      const mName = monthNames[new Date(sale.lastUpdated).getMonth()];
      if (monthlyData[mName]) {
        const value = sale.quantity * (sale.product?.price || 0);
        monthlyData[mName].revenue += value;
        monthlyData[mName].profit += value; // Base profit derivation accumulation
      }
    });

    // Deduct Expenses from corresponding Months
    purchases.forEach(purch => {
      const mName = monthNames[new Date(purch.createdAt).getMonth()];
      if (monthlyData[mName]) {
        const cost = purch.quantity * purch.buyPrice;
        monthlyData[mName].profit -= cost;
      }
    });

    const graphLabels = Object.keys(monthlyData);
    const graphRevenue = graphLabels.map(m => monthlyData[m].revenue);
    const graphProfit = graphLabels.map(m => monthlyData[m].profit);

    // ==========================================
    // COMMODITY VOLUME DISTRIBUTION (For Pie Chart)
    // ==========================================
    const cropDistribution = {};
    sales.forEach(sale => {
      const cropName = sale.product?.name || "Other";
      if (!cropDistribution[cropName]) cropDistribution[cropName] = 0;
      cropDistribution[cropName] += sale.quantity;
    });

    // Map into React Native Chart Kit format with distinct agricultural colors
    const colors = ['#1B4D3E', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107'];
    const pieChartData = Object.keys(cropDistribution).map((crop, index) => ({
      name: crop,
      volume: cropDistribution[crop],
      color: colors[index % colors.length],
      legendFontColor: '#4A5568',
      legendFontSize: 12
    })).sort((a, b) => b.volume - a.volume).slice(0, 4); // Top 4 crops

    // Return the response payloads
    return res.status(200).json({
      status: 'success',
      summary: {
        totalRevenue,
        totalExpenses,
        netProfitOrLoss,
        profitMargin: totalRevenue > 0 ? ((netProfitOrLoss / totalRevenue) * 100).toFixed(1) : 0
      },
      charts: {
        lineChart: { labels: graphLabels, revenue: graphRevenue, profit: graphProfit },
        pieChart: pieChartData
      }
    });

  } catch (error) {
    console.error("Analytics Calculation Error:", error);
    res.status(500).json({ error: "Failed to generate business analytical intelligence parameters." });
  }
};