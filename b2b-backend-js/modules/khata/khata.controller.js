import prisma from '../../utils/db.js';

// ==========================================
// 1. GET KHATA SUMMARY DASHBOARD
// ==========================================
export const getKhataSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Money you need to RECEIVE (From Sales)
    const pendingSales = await prisma.sale.aggregate({
      where: { inventory: { userId: userId }, amountDue: { gt: 0 } },
      _sum: { amountDue: true }
    });

    // 2. Money you need to PAY (From Purchases)
    const pendingPurchases = await prisma.purchase.aggregate({
      where: { userId: userId, amountDue: { gt: 0 } },
      _sum: { amountDue: true }
    });

    // 3. List of Debtors (People who owe the user)
    const debtors = await prisma.sale.findMany({
      where: { inventory: { userId: userId }, amountDue: { gt: 0 } },
      select: { id: true, buyerName: true, buyerPhone: true, amountDue: true, soldAt: true },
      orderBy: { soldAt: 'desc' }
    });

    // 4. List of Creditors (People the user owes)
    const creditors = await prisma.purchase.findMany({
      where: { userId: userId, amountDue: { gt: 0 } },
      select: { id: true, name: true, amountDue: true, createdAt: true,sellerId:true },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      status: 'success',
      data: {
        toReceive: pendingSales._sum.amountDue || 0,
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
    const { transactionId, type, paymentAmount, method, targetSellerId } = req.body; 
    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: "Invalid payment amount." });

    // ─── SCENARIO A: A CUSTOMER IS PAYING YOU ─────────────────────────────────
    if (type === "SALE") {
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

      return res.status(200).json({ status: "success", message: "Collection recorded in Khata." });
    }

    // ─── SCENARIO B: YOU ARE PAYING A SUPPLIER ────────────────────────────────
    if (type === "PURCHASE") {
      const purchase = await prisma.purchase.findUnique({ where: { id: transactionId } });
      
      if (!purchase) return res.status(404).json({ error: "Purchase record not found." });
      if (purchase.userId !== userId) return res.status(403).json({ error: "Unauthorized access to ledger." });
      if (purchase.amountDue < amount) return res.status(400).json({ error: "Payment exceeds the due amount!" });

      if (!targetSellerId) {
        return res.status(400).json({ error: "targetSellerId is required to log a B2B platform payment." });
      }

      const newDue = purchase.amountDue - amount;
      const newPaid = purchase.amountPaid + amount;
      const newStatus = newDue === 0 ? "PAID" : "PARTIAL";

      // Update Purchase AND create the official Payment trail
      await prisma.$transaction([
        prisma.purchase.update({
          where: { id: transactionId },
          data: { amountPaid: newPaid, amountDue: newDue, paymentStatus: newStatus }
        }),
        prisma.payment.create({
          data: {
            amount: amount,
            method: method || "UPI",
            buyerId: userId,
            sellerId: targetSellerId,
            purchaseId: transactionId
          }
        })
      ]);

      return res.status(200).json({ status: "success", message: "Supplier payment recorded." });
    }

    return res.status(400).json({ error: "Invalid transaction type specified." });
  } catch (error) {
    console.error("Installment Error:", error);
    res.status(500).json({ error: "Failed to process installment payment." });
  }
};