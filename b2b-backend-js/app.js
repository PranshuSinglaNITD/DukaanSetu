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

dotenv.config();

const app = express();
app.use(helmet()) //Helmet automatically sets various HTTP headers to protect against well-known web vulnerabilities (like XSS, clickjacking, etc.)
const PORT = process.env.PORT || 3000;
const httpServer=createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*' }
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
app.use(limiter);

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

app.use((req, res, next) => {
  console.log(`404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

// Base Health Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'B2B API is running!' });
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server & Live Tracking running on port ${PORT}`);
});