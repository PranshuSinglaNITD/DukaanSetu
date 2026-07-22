import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'

// Import Route Modules
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import propertyRoutes from './modules/properties/properties.routes.js';
import productRoutes from './modules/products/products.routes.js';
import negotiationRoutes from './modules/negotiation/negotiation.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import logisticsRoutes from './modules/logistics/logistics.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import shipmentRoutes from './modules/shipments/shipments.routes.js';
import khataRoutes from './modules/khata/khata.routes.js'
import voiceROutes from './modules/voice/voice.routes.js'
import demandRoutes from './modules/demand/demands.routes.js'
import { startDemandWorkers } from './cron/demand.worker.js';
import reviewRoutes from './modules/review/review.routes.js';
import documentRoutes from './modules/document/document.routes.js'
import chatRoutes from './modules/chat/chat.routes.js'

dotenv.config();

const app = express();
app.use(helmet()) //helmet automatically sets various HTTP headers to protect against well-known web vulnerabilities (like XSS, clickjacking, etc.)
const PORT = process.env.PORT || 3000;
const httpServer=createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*' },
  methods: ["GET", "POST"]
});

io.on('connection', (socket) => {
  console.log(`User connected to live tracking: ${socket.id}`);

  //buyer join the specific room for live tracking
  socket.on('join_tracking', (shipmentId) => {
    socket.join(shipmentId);
    console.log(`User joined tracking room: ${shipmentId}`);
  });

  //driver phone send new gps coordiante
  socket.on('driver_location_update', async (data) => {
    const { shipmentId, lat, lng } = data;

    try {
      // 1. Save the latest coordinate to the database (in case they disconnect)
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { currentLat: lat, currentLng: lng, lastUpdated: new Date() }
      });

      // 2. INSTANTLY broadcast the new coordinates to the buyer watching the map!
      io.to(shipmentId).emit('location_changed', { lat, lng });
    } catch (error) {
      console.log("Error updating driver location", error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from tracking');
  });
});

const limiter=rateLimit({
  windowMs:15*60*1000,  //this means 15 minutes
  max:100,
  message:{status:'error',error:'too many request from this IP'},
  standardHeaders:true,
  legacyHeaders:true
})
// app.use(limiter);

//specially for login
const loginLimiter=rateLimit({
  windowMs:60*60*1000,
  max:5,
  message:{status:'error',error:'too many login attempts from this IP'}
})
// Global Middlewares
app.use(cors());
//as images are of large size
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads',express.static(path.join(process.cwd(),'uploads')));

// API Base Routes Mounting
app.use('/api/auth/login',loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/products', productRoutes);
app.use('/api/negotiation', negotiationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/khata',khataRoutes);
app.use('/api/voice',voiceROutes);
app.use('/api/demands',demandRoutes);
app.use('/api/reviews',reviewRoutes);
app.use('/api/docs',documentRoutes);
app.use('/api/chat',chatRoutes);
  
startDemandWorkers();
console.log("⚙️ Background workers initialized.");

app.use((req, res, next) => {
  console.log(`404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

app.use((req, res, next) => {
  console.log(`404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
app.use((req, res, next) => {
  console.log(`404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  
  if (!token) return next(new Error("Authentication failed: Token missing"));
  
  try {
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    socket.user = decoded; 
    next();
  } catch (err) {
    next(new Error("Authentication failed: Invalid or expired token"));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 User Connected: ${socket.user.userId}`);

  // When a user opens a specific chat screen on their phone
  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    console.log(`👤 User joined Room: ${roomId}`);
  });

  // When a user types a normal text message
  socket.on('send_message', async ({ roomId, text }) => {
    try {
      // Save it to the DB so it is permanently stored
      const newMessage = await prisma.chatMessage.create({
        data: {
          roomId,
          senderId: socket.user.userId,
          text,
          type: 'TEXT'
        },
        include: { sender: { select: { name: true, role: true } } }
      });

      // Broadcast it instantly to the other person in the room
      io.to(roomId).emit('receive_message', newMessage);
    } catch (error) {
      console.error("Socket Message Error:", error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User Disconnected: ${socket.user.userId}`);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server & Live Tracking running on port ${PORT}`);
});