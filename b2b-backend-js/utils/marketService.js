import prisma from "./db.js";

export const fetchMarketplaceMetrics = async (commodity = "", region = "", excludeUserId = null) => {
  try {
    const whereClause = {
      stock: { gt: 0 } 
    };

    if (commodity) {
      whereClause.name = { contains: commodity, mode: "insensitive" };
    }

    if (excludeUserId) {
      whereClause.sellerId = { not: excludeUserId };
    }

    if (region) {
      whereClause.seller = {
        is: {
          city: { contains: region, mode: "insensitive" }
        }
      };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        seller: {
          select: {
            name: true,
            city: true
          }
        }
      },
      orderBy: {
        price: 'asc'
      },
      take: 10 
    });

    return products;
  } catch (error) {
    console.error("Internal Market Service Error (Products):", error);
    throw new Error("Failed to fetch internal marketplace metrics.");
  }
};

export const fetchBuyerDemandsMetrics = async (commodity = "", userCity = "", excludeUserId = null) => {
  try {
    const whereClause = {};

    if (commodity) {
      whereClause.commodity = { contains: commodity, mode: "insensitive" };
    }

    if (excludeUserId) {
      whereClause.buyerId = { not: excludeUserId };
    }

    const demands = await prisma.buyerDemand.findMany({
      where: whereClause,
      include: {
        buyer: {
          select: {
            name: true,
            city: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!demands || demands.length === 0) return [];

    const sortedDemands = demands.sort((a, b) => {
      const aCity = a.buyer?.city?.trim().toLowerCase();
      const bCity = b.buyer?.city?.trim().toLowerCase();
      const targetCity = userCity?.trim().toLowerCase();

      const aCityMatch = aCity === targetCity;
      const bCityMatch = bCity === targetCity;
      
      if (aCityMatch && !bCityMatch) return -1;
      if (!aCityMatch && bCityMatch) return 1;

      return 0;
    });

    return sortedDemands.slice(0, 10);
  } catch (error) {
    console.error("Internal Market Service Error (Demands):", error);
    throw new Error("Failed to fetch categorized buyer demands.");
  }
};