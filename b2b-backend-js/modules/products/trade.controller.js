import prisma from "../../utils/db.js"
import {z} from 'zod';
//paying for a negotiated folder
export const payForOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const buyerId = req.user.userId;

    // 1. Find the pending order drafted during the negotiation
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true }
    });

    if (!order) return res.status(404).json({ error: "Order invoice not found" });
    if (order.buyerId !== buyerId) return res.status(403).json({ error: "Unauthorized" });
    if (order.status !== 'PENDING_PAYMENT') return res.status(400).json({ error: "Order is already paid or cancelled" });
    
    // 2. Verify the seller still has enough stock
    if (order.product.stock < order.quantity) {
      return res.status(400).json({ error: "The seller no longer has enough stock to fulfill this deal." });
    }

    // 3. Finalize: Deduct stock, mark order as paid, and give buyer the inventory
    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id: order.productId },
        data: { stock: order.product.stock - order.quantity }
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: "COMPLETED" }
      }),
      prisma.inventory.create({
        data: {
          userId: buyerId,
          name: order.product.name,
          category: order.product.category,
          buyPrice: order.totalPrice / order.quantity, // Save their custom discounted unit price!
          quantity: order.quantity,
          unit: order.product.unit || 'KG'
        }
      })
    ]);

    res.status(200).json({ status: 'success', message: 'Payment successful! Items added to inventory.' });
  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};