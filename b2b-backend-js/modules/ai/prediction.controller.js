import prisma from '../../utils/db.js';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export const analyzeUserFraud = async (userId) => {
  try {
    // =========================================================
    // 1. FETCH RAW DATA FROM POSTGRESQL (Real Data Only)
    // =========================================================
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        negotiations: {
          include: { offers: true } // Assuming you track messages/offers in chats
        },
        products: true,
        demands: true
      }
    });

    if (!user) throw new Error("User not found");

    // =========================================================
    // 2. CALCULATE THE 8 FEATURES FOR XGBOOST
    // =========================================================

    // Feature 1: Account Age in Days
    const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
    const account_age_days = Math.max(0.1, accountAgeMs / (1000 * 60 * 60 * 24));

    // Feature 2: Daily Negotiation Count
    const totalNegotiations = user.negotiations.length;
    const daily_negotiation_count = totalNegotiations / account_age_days;

    // Feature 3: Messages per Negotiation
    let totalMessages = 0;
    user.negotiations.forEach(neg => { totalMessages += neg.offers.length; });
    const messages_per_negotiation = totalNegotiations > 0 ? (totalMessages / totalNegotiations) : 0;

    // Feature 4: Cancellation Rate %
    // Assuming you have a 'status' field on negotiations like 'COMPLETED' or 'CANCELLED'
    const cancelledDeals = user.negotiations.filter(n => n.status === 'CANCELLED').length;
    const cancellation_rate_pct = totalNegotiations > 0 ? (cancelledDeals / totalNegotiations) * 100 : 0;

    // Feature 5: Historical Success Count
    const historical_success_count = user.negotiations.filter(n => n.status === 'COMPLETED').length;

    // Feature 6: Price Deviation % (Bait Pricing Check)
    // Compare their active product prices to the market average
    let price_deviation_pct = 0;
    if (user.products.length > 0) {
      // Find the average price of similar crops in the market right now
      const marketAvg = await prisma.product.aggregate({
        where: { category: user.products[0].category },
        _avg: { price: true }
      });
      const avgMarketPrice = marketAvg._avg.price || 1;
      const userAvgPrice = user.products.reduce((acc, p) => acc + p.price, 0) / user.products.length;
      
      // Calculate how far below market average they are (e.g., 40% cheaper)
      price_deviation_pct = Math.max(0, ((avgMarketPrice - userAvgPrice) / avgMarketPrice) * 100);
    }

    // Feature 7 & 8: Defaults / Simplified for MVP
    // Time to first offer (requires complex timestamp math between chat creation and first message)
    const time_to_first_offer_mins = 5.0; // Placeholder until timestamp tracking is added
    // IP Mismatch (requires GeoIP tracking on login vs profile state)
    const ip_location_mismatch = 0; 

    // =========================================================
    // 3. COMPILE PAYLOAD & CALL XGBOOST
    // =========================================================
    const mlPayload = {
      account_age_days: Number(account_age_days.toFixed(2)),
      daily_negotiation_count: Number(daily_negotiation_count.toFixed(2)),
      messages_per_negotiation: Number(messages_per_negotiation.toFixed(2)),
      time_to_first_offer_mins: Number(time_to_first_offer_mins),
      cancellation_rate_pct: Number(cancellation_rate_pct.toFixed(2)),
      price_deviation_pct: Number(price_deviation_pct.toFixed(2)),
      ip_location_mismatch: ip_location_mismatch,
      historical_success_count: historical_success_count
    };

    console.log(`Sending Real Data to XGBoost for User ${userId}:`, mlPayload);

    const response = await fetch(`${FASTAPI_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });

    if (!response.ok) throw new Error("FastAPI XGBoost service is unreachable.");
    
    const aiDecision = await response.json();

    // =========================================================
    // 4. UPDATE DATABASE WITH REAL AI DECISION
    // =========================================================
    await prisma.user.update({
      where: { id: userId },
      data: { 
        fraudProbability: aiDecision.fraud_probability,
        isFraudFlagged: aiDecision.is_fraud,
        status: aiDecision.recommended_action === 'SUSPEND_ACCOUNT' ? 'SUSPENDED' : 'ACTIVE'
      }
    });

    return aiDecision;

  } catch (error) {
    console.error(`XGBoost Pipeline Error for user ${userId}:`, error.message);
    throw error;
  }
};