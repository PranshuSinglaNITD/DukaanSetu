import prisma from '../../utils/db.js';

// ==========================================
// 1. GET KHATA SUMMARY DASHBOARD
// ==========================================
export const getKhataSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1A. Money to RECEIVE: Offline Walk-in Sales (from `Sale` table)
    const offlineSales = await prisma.sale.aggregate({
      where: { inventory: { userId: userId }, amountDue: { gt: 0 } },
      _sum: { amountDue: true }
    });

    // 1B. Money to RECEIVE: Online B2B Platform Sales (from `Purchase` table as seller)
    const onlineSales = await prisma.purchase.aggregate({
      where: { sellerId: userId, amountDue: { gt: 0 } },
      _sum: { amountDue: true }
    });

    const totalToReceive = (offlineSales._sum.amountDue || 0) + (onlineSales._sum.amountDue || 0);

    // 2. Money to PAY: Platform Purchases (from `Purchase` table as buyer)
    const pendingPurchases = await prisma.purchase.aggregate({
      where: { userId: userId, amountDue: { gt: 0 } },
      _sum: { amountDue: true }
    });

    // 3A. Fetch Offline Debtors
    const rawOfflineDebtors = await prisma.sale.findMany({
      where: { inventory: { userId: userId }, amountDue: { gt: 0 } },
      select: { id: true, buyerName: true, amountDue: true, soldAt: true },
      orderBy: { soldAt: 'desc' }
    });

    // 3B. Fetch Online B2B Debtors (Who bought from this user)
    const rawOnlineDebtors = await prisma.purchase.findMany({
      where: { sellerId: userId, amountDue: { gt: 0 } },
      select: { 
        id: true, amountDue: true, createdAt: true,
        user: { select: { name: true, phone: true } } // Fetch buyer details
      },
      orderBy: { createdAt: 'desc' }
    });

    // Normalize Debtors into a single array for the Frontend
    const debtors = [
      ...rawOfflineDebtors.map(d => ({
        id: d.id, name: d.buyerName || "Walk-in", amountDue: d.amountDue, date: d.soldAt, type: 'OFFLINE_SALE'
      })),
      ...rawOnlineDebtors.map(d => ({
        id: d.id, name: d.user?.name || "Platform Buyer", amountDue: d.amountDue, date: d.createdAt, type: 'B2B_TRANSACTION'
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort combined list by newest

    // 4. Fetch Creditors (Who this user owes money to)
    const rawCreditors = await prisma.purchase.findMany({
      where: { userId: userId, amountDue: { gt: 0 } },
      select: { 
        id: true, amountDue: true, createdAt: true, sellerId: true,
        seller: { select: { name: true } } // Fetch supplier details
      },
      orderBy: { createdAt: 'desc' }
    });

    const creditors = rawCreditors.map(c => ({
      id: c.id, name: c.seller?.name || "Platform Supplier", amountDue: c.amountDue, date: c.createdAt, targetSellerId: c.sellerId, type: 'B2B_TRANSACTION'
    }));

    res.status(200).json({
      status: 'success',
      data: {
        toReceive: totalToReceive,
        toPay: pendingPurchases._sum.amountDue || 0,
        debtors,
        creditors
      }
    });
  } catch (error) {
    console.error("Khata Summary Error:", error);
    res.status(500).json({ error: "Failed to load Khata summary." });
  }
};

// ==========================================
// 2. RECORD AN INSTALLMENT PAYMENT
// ==========================================
export const recordInstallment = async (req, res) => {
  try {
    const userId = req.user.userId;
    // 🚨 Changed 'type' expectations to match our new normalized types
    const { transactionId, type, paymentAmount, method, targetSellerId } = req.body; 
    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: "Invalid payment amount." });

    // ─── SCENARIO A: OFFLINE WALK-IN COLLECTION ──────────────────────────────
    if (type === "OFFLINE_SALE") {
      const sale = await prisma.sale.findUnique({ where: { id: transactionId }, include: { inventory: true } });
      
      if (!sale) return res.status(404).json({ error: "Sale record not found." });
      if (sale.inventory.userId !== userId) return res.status(403).json({ error: "Unauthorized access to ledger." });
      if (sale.amountDue < amount) return res.status(400).json({ error: "Payment exceeds the due amount!" });

      const newDue = sale.amountDue - amount;
      const newPaid = sale.amountPaid + amount;
      const newStatus = newDue === 0 ? "PAID" : "PARTIAL";

      await prisma.sale.update({
        where: { id: transactionId },
        data: { amountPaid: newPaid, amountDue: newDue, paymentStatus: newStatus }
      });

      return res.status(200).json({ status: "success", message: "Offline collection recorded." });
    }

    // ─── SCENARIO B: ONLINE B2B TRANSACTION (Can be paying OR receiving) ─────
    if (type === "B2B_TRANSACTION") {
      const purchase = await prisma.purchase.findUnique({ where: { id: transactionId } });
      
      if (!purchase) return res.status(404).json({ error: "B2B Transaction record not found." });
      
      // Verify the user is either the Buyer paying off debt, OR the Seller marking it as paid
      const isBuyer = purchase.userId === userId;
      const isSeller = purchase.sellerId === userId;
      
      if (!isBuyer && !isSeller) return res.status(403).json({ error: "Unauthorized access to ledger." });
      if (purchase.amountDue < amount) return res.status(400).json({ error: "Payment exceeds the due amount!" });

      const newDue = purchase.amountDue - amount;
      const newPaid = purchase.amountPaid + amount;
      const newStatus = newDue === 0 ? "PAID" : "PARTIAL";

      await prisma.$transaction([
        prisma.purchase.update({
          where: { id: transactionId },
          data: { amountPaid: newPaid, amountDue: newDue, paymentStatus: newStatus }
        }),
        // Only log an official Payment trail if it's the buyer making the payment
        ...(isBuyer && targetSellerId ? [
          prisma.payment.create({
            data: {
              amount: amount, method: method || "UPI",
              buyerId: userId, sellerId: targetSellerId, purchaseId: transactionId
            }
          })
        ] : [])
      ]);

      return res.status(200).json({ status: "success", message: "B2B payment recorded successfully." });
    }

    return res.status(400).json({ error: "Invalid transaction type specified." });
  } catch (error) {
    console.error("Installment Error:", error);
    res.status(500).json({ error: "Failed to process installment payment." });
  }
};