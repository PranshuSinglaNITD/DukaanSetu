import prisma from '../../utils/db.js';

// ==========================================
// 1. INITIALIZE OR FETCH CHAT ROOM
// ==========================================
export const initializeRoom = async (req, res) => {
  try {
    const { sellerId, productId } = req.body;
    const buyerId = req.user.userId;

    // Prevent users from chatting with themselves
    if (buyerId === sellerId) {
      return res.status(400).json({ error: "You cannot initiate a chat with yourself." });
    }

    // Check if a chat room already exists for this exact product and user pair
    let room = await prisma.chatRoom.findUnique({
      where: {
        buyerId_sellerId_productId: { 
          buyerId, 
          sellerId, 
          productId 
        }
      },
      include: {
        seller: { select: { name: true, businessName: true } },
        product: { select: { name: true, price: true } }
      }
    });

    // If no room exists, create a fresh one
    if (!room) {
      room = await prisma.chatRoom.create({
        data: { 
          buyerId, 
          sellerId, 
          productId 
        },
        include: {
          seller: { select: { name: true, businessName: true } },
          product: { select: { name: true, price: true } }
        }
      });
    }

    res.status(200).json({ status: 'success', data: room });
  } catch (error) {
    console.error("Room Initialization Error:", error);
    res.status(500).json({ error: "Failed to initialize chat room." });
  }
};

// ==========================================
// 2. FETCH CHAT HISTORY
// ==========================================
export const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Optional: You could add a quick check here to ensure req.user.userId 
    // is either the buyerId or sellerId of this room for extra security.

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      include: {
        // Prisma will safely return null for the sender if this is a SYSTEM message
        sender: { 
          select: { 
            name: true, 
            role: true 
          } 
        }
      },
      orderBy: { 
        createdAt: 'asc' // Oldest messages first, so they render top-to-bottom on the phone
      }
    });

    res.status(200).json({ status: 'success', data: messages });
  } catch (error) {
    console.error("Fetch Messages Error:", error);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
};

export const getUserInbox = async (req, res) => {
  try {
    const userId = req.user.userId;

    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }]
      },
      include: {
        // Fetch details of both users so the frontend can figure out who "the other guy" is
        buyer: { select: { id: true, name: true, businessName: true } },
        seller: { select: { id: true, name: true, businessName: true } },
        product: { select: { name: true } },
        // Grab only the single most recent message to display as a preview
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 
        }
      },
      orderBy: { updatedAt: 'desc' } // Sort by most recently active
    });

    res.status(200).json({ status: 'success', data: rooms });
  } catch (error) {
    console.error("Inbox Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch inbox." });
  }
};