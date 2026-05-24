import prisma from '../../utils/db.js';
import { z } from 'zod';

// 1. Start a New Negotiation
export const startNegotiation = async (req, res) => {
  try {
    const { sellerId, productId, offerPrice, message } = req.body;
    const buyerId = req.user.userId;

    if (sellerId === buyerId) {
      return res.status(400).json({ error: "You cannot negotiate with yourself." });
    }

    // Check if an active negotiation already exists between these users for this product
    const existingNegotiation = await prisma.negotiation.findFirst({
      where: { buyerId, sellerId, productId, status: 'ACTIVE' }
    });

    if (existingNegotiation) {
      return res.status(400).json({ 
        error: "An active negotiation already exists.", 
        negotiationId: existingNegotiation.id 
      });
    }

    // Create the Thread and the First Offer simultaneously
    const negotiation = await prisma.negotiation.create({
      data: {
        buyerId,
        sellerId,
        productId,
        offers: {
          create: {
            senderId: buyerId,
            price: Number(offerPrice),
            message
          }
        }
      },
      include: { offers: true }
    });

    res.status(201).json({ status: 'success', data: negotiation });
  } catch (error) {
    console.error("Start Negotiation Error:", error);
    res.status(500).json({ error: 'Failed to start negotiation' });
  }
};

// 2. Send a Counter-Offer
export const sendOffer = async (req, res) => {
  try {
    const { negotiationId, price, message } = req.body;
    const senderId = req.user.userId;

    // Verify the negotiation exists and the user is part of it
    const negotiation = await prisma.negotiation.findUnique({ where: { id: negotiationId } });
    
    if (!negotiation) return res.status(404).json({ error: "Negotiation not found." });
    if (negotiation.status !== 'ACTIVE') return res.status(400).json({ error: "This negotiation is closed." });
    if (negotiation.buyerId !== senderId && negotiation.sellerId !== senderId) {
      return res.status(403).json({ error: "Unauthorized to participate in this negotiation." });
    }

    const newOffer = await prisma.offer.create({
      data: {
        negotiationId,
        senderId,
        price: Number(price),
        message
      }
    });

    // Update the parent thread's updatedAt timestamp
    await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { updatedAt: new Date() }
    });

    res.status(201).json({ status: 'success', data: newOffer });
  } catch (error) {
    console.error("Send Offer Error:", error);
    res.status(500).json({ error: 'Failed to send offer' });
  }
};

// 3. Get User's Negotiations (Inbox)
export const getMyNegotiations = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch negotiations where the user is EITHER the buyer OR the seller
    const negotiations = await prisma.negotiation.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }]
      },
      include: {
        buyer: { select: { name: true, businessName: true } },
        seller: { select: { name: true, businessName: true } },
        product: { select: { name: true, price: true } },
        offers: { 
          orderBy: { createdAt: 'desc' },
          take: 1 // Only get the latest offer to show in the inbox list
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({ status: 'success', data: negotiations });
  } catch (error) {
    console.error("Get Negotiations Error:", error);
    res.status(500).json({ error: 'Failed to fetch negotiations' });
  }
};

export const resolveNegotiation = async (req, res) => {
  try {
    const { negotiationId, action } = req.body; // action should be 'ACCEPTED' or 'REJECTED'
    const userId = req.user.userId;

    const negotiation = await prisma.negotiation.findUnique({ where: { id: negotiationId } });
    
    if (!negotiation) return res.status(404).json({ error: "Negotiation not found" });
    if (negotiation.buyerId !== userId && negotiation.sellerId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (negotiation.status !== 'ACTIVE') {
      return res.status(400).json({ error: `Negotiation is already ${negotiation.status}` });
    }

    // Update the status
    const updatedNegotiation = await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { status: action.toUpperCase() } // 'ACCEPTED' or 'REJECTED'
    });

    // If accepted, you could trigger an Order creation here in the future!

    res.status(200).json({ status: 'success', data: updatedNegotiation });
  } catch (error) {
    console.error("Resolve Negotiation Error:", error);
    res.status(500).json({ error: 'Failed to resolve negotiation' });
  }
};

