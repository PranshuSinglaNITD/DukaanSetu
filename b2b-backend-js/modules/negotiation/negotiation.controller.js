import prisma from '../../utils/db.js';
import redisClient from '../../utils/redis.js'; // 🚨 NEW: Docker Redis Client
import { sendAppNotification } from '../../utils/NotificationService.js';

// Deletes the cached room AND the inboxes of both users simultaneously
const invalidateNegotiationCaches = async (negotiationId, buyerId, sellerId) => {
  const keysToDelete = [
    `negotiation:inbox:${buyerId}`,
    `negotiation:inbox:${sellerId}`
  ];
  if (negotiationId) keysToDelete.push(`negotiation:room:${negotiationId}`);
  
  await redisClient.del(keysToDelete);
  console.log(`Cache cleared for room ${negotiationId || 'New'} and user inboxes.`);
};

// ==========================================
// 1. Start a New Negotiation (Write -> Invalidate)
// ==========================================
export const startNegotiation = async (req, res) => {
  try {
    const { sellerId, productId, offerPrice, message } = req.body;
    const buyerId = req.user.userId;

    if (sellerId === buyerId) return res.status(400).json({ error: "You cannot negotiate with yourself." });

    const existingNegotiation = await prisma.negotiation.findFirst({
      where: { buyerId, sellerId, productId, status: 'ACTIVE' }
    });

    if (existingNegotiation) {
      return res.status(400).json({ error: "An active negotiation already exists.", negotiationId: existingNegotiation.id });
    }

    const negotiation = await prisma.negotiation.create({
      data: {
        buyerId,
        sellerId,
        productId,
        offers: {
          create: { senderId: buyerId, price: Number(offerPrice), message }
        }
      },
      include: { offers: true }
    });

    //Clear inboxes so the new thread appears instantly on their screens
    await invalidateNegotiationCaches(null, buyerId, sellerId);

    await sendAppNotification(
      sellerId, 
      "New Offer Received", 
      `A buyer just offered ₹${offerPrice} for your product.`, 
      "NEGOTIATION"
    );

    res.status(201).json({ status: 'success', data: negotiation });
  } catch (error) {
    console.error("Start Negotiation Error:", error);
    res.status(500).json({ error: 'Failed to start negotiation' });
  }
};

// ==========================================
// 2. Send a Counter-Offer (Write -> Invalidate)
// ==========================================
export const sendOffer = async (req, res) => {
  try {
    const { negotiationId, price, message } = req.body;
    const senderId = req.user.userId;

    const negotiation = await prisma.negotiation.findUnique({ where: { id: negotiationId } });
    
    if (!negotiation) return res.status(404).json({ error: "Negotiation not found." });
    if (negotiation.status !== 'ACTIVE') return res.status(400).json({ error: "This negotiation is closed." });
    if (negotiation.buyerId !== senderId && negotiation.sellerId !== senderId) {
      return res.status(403).json({ error: "Unauthorized." });
    }

    const newOffer = await prisma.offer.create({
      data: { negotiationId, senderId, price: Number(price), message }
    });

    await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { updatedAt: new Date() }
    });

    //Mutated data! Nuke the cached room and both inboxes.
    await invalidateNegotiationCaches(negotiationId, negotiation.buyerId, negotiation.sellerId);

    res.status(201).json({ status: 'success', data: newOffer });
  } catch (error) {
    console.error("Send Offer Error:", error);
    res.status(500).json({ error: 'Failed to send offer' });
  }
};

// ==========================================
// 3. Get User's Negotiations (Read -> Cache Aside)
// ==========================================
export const getMyNegotiations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const INBOX_CACHE_KEY = `negotiation:inbox:${userId}`;

    //Check Docker Redis First
    const cachedInbox = await redisClient.get(INBOX_CACHE_KEY);
    if (cachedInbox) {
      return res.status(200).json(JSON.parse(cachedInbox));
    }

    //Database Fallback
    const negotiations = await prisma.negotiation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        buyer: { select: { name: true, businessName: true } },
        seller: { select: { name: true, businessName: true } },
        product: { select: { name: true, price: true } },
        offers: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const responsePayload = { status: 'success', data: negotiations };

    //Save to Docker Redis (Expires in 5 minutes)
    await redisClient.setEx(INBOX_CACHE_KEY, 300, JSON.stringify(responsePayload));

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Get Negotiations Error:", error);
    res.status(500).json({ error: 'Failed to fetch negotiations' });
  }
};

// ==========================================
// 4. Resolve Negotiation (Write -> Invalidate)
// ==========================================
export const resolveNegotiation = async (req, res) => {
  try {
    const { negotiationId, action } = req.body; 
    const userId = req.user.userId;

    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: { offers: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    if (!negotiation) return res.status(404).json({ error: "Not found" });
    if (negotiation.buyerId !== userId && negotiation.sellerId !== userId) return res.status(403).json({ error: "Unauthorized" });
    if (negotiation.status !== 'ACTIVE') return res.status(400).json({ error: `Already ${negotiation.status}` });

    if (action === 'REJECTED') {
      const updated = await prisma.negotiation.update({ 
        where: { id: negotiationId }, data: { status: 'REJECTED' } 
      });
      await invalidateNegotiationCaches(negotiationId, negotiation.buyerId, negotiation.sellerId);
      return res.status(200).json({ status: 'success', data: updated });
    }

    if (action === 'ACCEPTED') {
      const winningOfferId = negotiation.offers[0].id;
      await prisma.$transaction([
        prisma.negotiation.update({ where: { id: negotiationId }, data: { status: 'ACCEPTED' } }),
        prisma.offer.update({ where: { id: winningOfferId }, data: { status: 'ACCEPTED' } })
      ]);
      
      await invalidateNegotiationCaches(negotiationId, negotiation.buyerId, negotiation.sellerId);

      return res.status(200).json({ status: 'success', message: 'Deal locked in! Awaiting buyer payment.' });
    }
  } catch (error) {
    console.error("Resolve Negotiation Error:", error);
    res.status(500).json({ error: 'Failed to resolve negotiation' });
  }
};

// ==========================================
// 5. Get Negotiation By ID (Read -> Cache Aside)
// ==========================================
export const getNegotiationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const ROOM_CACHE_KEY = `negotiation:room:${id}`;

    //Check Docker Redis First
    const cachedRoom = await redisClient.get(ROOM_CACHE_KEY);
    if (cachedRoom) {
      // Security Check: Even though it's cached, ensure the requesting user is allowed to see it
      const roomData = JSON.parse(cachedRoom);
      if (roomData.data.buyerId !== userId && roomData.data.sellerId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      return res.status(200).json(roomData);
    }

    //Database Fallback
    const negotiation = await prisma.negotiation.findUnique({
      where: { id },
      include: {
        buyer: { select: { name: true, businessName: true } },
        seller: { select: { name: true, businessName: true } },
        product: { include: { seller: true } }, 
        offers: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!negotiation) return res.status(404).json({ error: "Negotiation not found" });
    if (negotiation.buyerId !== userId && negotiation.sellerId !== userId) return res.status(403).json({ error: "Unauthorized" });

    const responsePayload = { status: 'success', data: negotiation };

    //save to docker
    await redisClient.setEx(ROOM_CACHE_KEY, 3600, JSON.stringify(responsePayload));

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Get Negotiation By ID Error:", error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
};