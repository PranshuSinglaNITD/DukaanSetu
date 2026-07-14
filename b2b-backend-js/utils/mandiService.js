import prisma from './db.js'; // Ensure this points correctly to your Prisma instance

/**
 * Generates real-time market price benchmarks by aggregating active listings 
 * on the platform from OTHER users.
 * * @param {string} state - The current user's state (e.g., "Delhi", "Punjab")
 * @param {string} commodity - The item name (e.g., "Premium Basmati", "Hybrid Tomato")
 * @param {string} excludeUserId - The current logged-in user's ID to prevent self-matching
 */
export const getLiveMandiPrices = async (state, commodity, excludeUserId) => {
  try {
    console.log(`📊 Generating live marketplace metrics for: "${commodity}" in region: "${state}"`);

    // 1. Fetch matching products from other sellers within the same state
    let listings = await prisma.product.findMany({
      where: {
        name: { contains: commodity, mode: 'insensitive' },
        sellerId: { not: excludeUserId },
        stock: { gt: 0 },
        seller: {
          state: { contains: state, mode: 'insensitive' }
        }
      },
      include: {
        seller: {
          select: { name: true, city: true, state: true }
        }
      }
    });

    // 2. Fallback: If no listings exist in their exact state, expand search nationwide
    let isNationwide = false;
    if (!listings || listings.length === 0) {
      isNationwide = true;
      listings = await prisma.product.findMany({
        where: {
          name: { contains: commodity, mode: 'insensitive' },
          sellerId: { not: excludeUserId },
          stock: { gt: 0 }
        },
        include: {
          seller: {
            select: { name: true, city: true, state: true }
          }
        }
      });
    }

    if (!listings || listings.length === 0) {
      return `No active platform listings or competitive market data found for "${commodity}" on the network right now.`;
    }

    // 3. Compute Statistical Benchmarks dynamically
    const priceArray = listings.map(item => item.price);
    const minPrice = Math.min(...priceArray);
    const maxPrice = Math.max(...priceArray);
    const totalSum = priceArray.reduce((sum, price) => sum + price, 0);
    const averagePrice = Math.round(totalSum / priceArray.length);
    const totalAvailableStock = listings.reduce((sum, item) => sum + item.stock, 0);
    const unitType = listings[0].unit || 'Quintal';

    // 4. Format the aggregated report for LangGraph's consumption
    const regionLabel = isNationwide ? "Nationwide Platform Average" : `${state} Region`;
    
    let report = `LIVE PLATFORM BENCHMARK FOR "${commodity.toUpperCase()}" (${regionLabel}):\n`;
    report += `- Total Active Competitor Listings: ${listings.length}\n`;
    report += `- Lowest Available Price: ₹${minPrice}/${unitType}\n`;
    report += `- Highest Asking Price: ₹${maxPrice}/${unitType}\n`;
    report += `- Average Market Price (Modal): ₹${averagePrice}/${unitType}\n`;
    report += `- Total Circulating Platform Stock: ${totalAvailableStock} ${unitType}\n\n`;
    report += `Top 3 Best Sourcing Options Currently Available:\n`;

    // Extract top 3 lowest-priced listings to share with the AI
    listings
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
      .forEach((item, index) => {
        report += `${index + 1}. Seller: ${item.seller?.name || 'Verified Trader'} located in ${item.seller?.city || 'Unknown City'}, ${item.seller?.state || ''}
   * Price: ₹${item.price}/${item.unit || 'Quintal'}
   * Stock Remaining: ${item.stock} ${item.unit || 'Quintal'}\n`;
      });

    return report;

  } catch (error) {
    console.error("Internal Market Service Error:", error.message);
    return "Unable to aggregate database market data due to an internal system error.";
  }
};