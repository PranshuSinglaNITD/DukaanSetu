import prisma from '../../utils/db.js';

// ==========================================
// 1. SETUP DISPATCH (Sellers Only: Farmers & Wholesalers)
// ==========================================
export const setupDispatch = async (req, res) => {
  try {
    const { negotiationId, shipmentId, quantity, transportCost, driverName, driverPhone, vehicleNumber } = req.body;
    const sellerId = req.user.userId;
    const userRole = req.user.role; // 🚨 Extracted from JWT

    // 🛡️ STRICT ROLE CHECK: Retailers cannot dispatch trucks
    if (userRole === 'RETAILER') {
      return res.status(403).json({ error: "Access Denied: Retailers cannot dispatch shipments." });
    }

    // 🚨 SCENARIO A: Direct Buy (Updating an existing pending shipment)
    if (shipmentId) {
      const updatedShipment = await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          transportCost: transportCost ? parseFloat(transportCost) : 0,
          driverName,
          driverPhone,
          vehicleNumber,
          status: "IN_TRANSIT" // Automatically moves it to transit!
        }
      });
      return res.status(200).json({ status: "success", message: "Truck Dispatched successfully!", data: updatedShipment });
    }

    // 🚨 SCENARIO B: Negotiated Deal (Creating a new freight quote)
    if (!negotiationId) return res.status(400).json({ error: "Missing negotiation or shipment ID" });

    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId }
    });

    if (!negotiation) return res.status(404).json({ error: "Deal not found." });
    if (negotiation.sellerId !== sellerId) return res.status(403).json({ error: "Unauthorized." });

    const shipment = await prisma.shipment.create({
      data: {
        productId: negotiation.productId,
        negotiationId: negotiation.id,
        buyerId: negotiation.buyerId,
        sellerId: negotiation.sellerId,
        quantity: parseFloat(quantity),
        transportCost: transportCost ? parseFloat(transportCost) : 0,
        driverName,
        driverPhone,
        vehicleNumber,
        status: "PENDING" // Stays pending until the buyer pays for it
      }
    });

    res.status(201).json({ status: "success", message: "Transport quote generated! Waiting for buyer payment.", data: shipment });

  } catch (error) {
    console.error("Dispatch Setup Error:", error);
    res.status(500).json({ error: "Failed to setup dispatch details." });
  }
};

// ==========================================
// 2. GET MY SALES (Sellers Only: Farmers & Wholesalers)
// ==========================================
export const getMySales = async (req, res) => {
  try {
    if (req.user.role === 'RETAILER') {
      return res.status(403).json({ error: "Access Denied: Retailers do not have outgoing sales." });
    }

    const shipments = await prisma.shipment.findMany({
      where: { sellerId: req.user.userId },
      include: { product: true, buyer: { select: { name: true, phone: true } } },
      orderBy: { lastUpdated: 'desc' }
    });
    res.status(200).json({ status: "success", data: shipments });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sales." });
  }
};

// ==========================================
// 3. GET MY ORDERS (Buyers Only: Retailers & Wholesalers)
// ==========================================
export const getMyOrders = async (req, res) => {
  try {
    if (req.user.role === 'FARMER') {
      return res.status(403).json({ error: "Access Denied: Farmers only supply goods, they do not track incoming purchases." });
    }

    const shipments = await prisma.shipment.findMany({
      where: { buyerId: req.user.userId },
      include: { product: true, seller: { select: { name: true, businessName: true } } },
      orderBy: { lastUpdated: 'desc' }
    });
    res.status(200).json({ status: "success", data: shipments });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders." });
  }
};

// ==========================================
// 4. MARK DELIVERED (Buyers Only: Retailers & Wholesalers)
// ==========================================
export const markDelivered = async (req, res) => {
  try {
    if (req.user.role === 'FARMER') {
      return res.status(403).json({ error: "Access Denied: Farmers do not receive deliveries." });
    }

    const { shipmentId } = req.body;
    const buyerId = req.user.userId;

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    
    if (!shipment) return res.status(404).json({ error: "Shipment not found." });
    if (shipment.buyerId !== buyerId) return res.status(403).json({ error: "Only the buyer can confirm delivery." });

    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: "DELIVERED" }
    });

    res.status(200).json({ status: "success", message: "Delivery confirmed!", data: updatedShipment });
  } catch (error) {
    console.error("Delivery Error:", error);
    res.status(500).json({ error: "Failed to update delivery status." });
  }
};