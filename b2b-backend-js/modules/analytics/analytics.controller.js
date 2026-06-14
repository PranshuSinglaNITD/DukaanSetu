import prisma from '../../utils/db.js';

export const getBusinessAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Fetch total money spent on inventory (Cash Outflow)
    const purchases = await prisma.inventory.findMany({
      where: { userId: userId },
      select: { buyPrice: true, quantity: true, createdAt: true }
    });

    // 2. 🚨 FIXED THE PRISMA CRASH: Filter through the inventory relation!
    const sales = await prisma.sale.findMany({
      where: {
        inventory: { userId: userId } // Queries sales where the linked inventory belongs to this user
      },
      select: {
        sellPrice: true,
        quantity: true,
        profit: true, // We will use your exact database profit now!
        soldAt: true,
        inventory: {
          select: { name: true } // Fetch crop name
        }
      },
      orderBy: { soldAt: 'desc' }
    });

    // ==========================================
    // PARSE FINANCIAL KPIS
    // ==========================================
    const totalExpenses = purchases.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0);
    
    // 🚨 FIXED PROFIT LOGIC: Use exact database values
    let totalRevenue = 0;
    let netProfitOrLoss = 0;

    sales.forEach(sale => {
      totalRevenue += (sale.sellPrice * sale.quantity);
      netProfitOrLoss += sale.profit; // Sums up your auto-calculated profit column directly!
    });

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

    // Map Revenue & Profit into Months
    sales.forEach(sale => {
      if (!sale.soldAt) return;
      const mName = monthNames[new Date(sale.soldAt).getMonth()];
      
      if (monthlyData[mName]) {
        monthlyData[mName].revenue += (sale.sellPrice * sale.quantity);
        monthlyData[mName].profit += sale.profit; // Real profit per month!
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
      const cropName = sale.inventory?.name || "Other Commodities";
      if (!cropDistribution[cropName]) cropDistribution[cropName] = 0;
      cropDistribution[cropName] += sale.quantity;
    });

    const colors = ['#1B4D3E', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107'];
    const pieChartData = Object.keys(cropDistribution).map((crop, index) => ({
      name: crop,
      volume: cropDistribution[crop],
      color: colors[index % colors.length],
      legendFontColor: '#4A5568',
      legendFontSize: 12
    })).sort((a, b) => b.volume - a.volume).slice(0, 4);

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