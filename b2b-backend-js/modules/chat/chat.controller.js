import prisma from '../../utils/db.js';

// ==========================================
// 1. GET OR CREATE CHAT ROOM
// ==========================================
export const initializeRoom = async (req, res) => {
  try {
    const { sellerId, productId } = req.body;
    const buyerId = req.user.userId;

    if (buyerId === sellerId) {
      return res.status(400).json({ error: "You cannot chat with yourself." });
    }

    // Check if room already exists for this exact product and user pair
    let room = await prisma.chatRoom.findUnique({
      where: {
        buyerId_sellerId_productId: { buyerId, sellerId, productId }
      }
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: { buyerId, sellerId, productId }
      });
    }

    res.status(200).json({ status: 'success', data: room });
  } catch (error) {
    console.error("Room Init Error:", error);
    res.status(500).json({ error: "Failed to initialize chat room." });
  }
};

// ==========================================
// 2. GET CHAT HISTORY
// ==========================================
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      include: {
        sender: { select: { name: true, role: true } },
        negotiation: true // Includes the offer details if this bubble is an OFFER type
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({ status: 'success', data: messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages." });
  }
};

// ==========================================
// 3. CREATE ACTIONABLE OFFER (Seller Only)
// ==========================================
export const createOfferMessage = async (req, res) => {
  try {
    const { roomId, productId, proposedPrice, quantity } = req.body;
    const senderId = req.user.userId;

    // 1. Create the official Negotiation record
    const newOffer = await prisma.negotiation.create({
      data: {
        productId,
        buyerId: req.body.buyerId, // Passed from frontend context
        sellerId: senderId,
        status: 'PENDING',
        offers: {
          create: {
            price: parseFloat(proposedPrice),
            quantity: parseInt(quantity, 10),
            offeredById: senderId
          }
        }
      }
    });

    // 2. Create the Chat Bubble to display the offer in the thread
    const offerMessage = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        type: 'OFFER',
        text: `Custom Offer: ₹${proposedPrice} for ${quantity} units.`,
        negotiationId: newOffer.id
      },
      include: { negotiation: true }
    });

    res.status(201).json({ status: 'success', data: offerMessage });
  } catch (error) {
    console.error("Offer Creation Error:", error);
    res.status(500).json({ error: "Failed to create offer." });
  }
};

// ==========================================
// 4. RESPOND TO OFFER (Buyer Only)
// ==========================================
export const respondToOffer = async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { response, roomId } = req.body; // response = 'ACCEPTED' or 'REJECTED'
    const buyerId = req.user.userId;

    // We use a transaction so the negotiation state and the chat update happen simultaneously
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Update the official negotiation state
      const updatedNegotiation = await prisma.negotiation.update({
        where: { id: negotiationId },
        data: { status: response }
      });

      // 2. Drop a system message into the chat confirming the action
      const systemMessage = await prisma.chatMessage.create({
        data: {
          roomId,
          senderId: buyerId,
          type: 'TEXT',
          text: `Offer has been ${response.toLowerCase()} by the buyer.`
        }
      });

      return { updatedNegotiation, systemMessage };
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to process offer response." });
  }
};