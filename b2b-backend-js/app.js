import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middlewares
app.use(cors());
app.use(express.json()); 
app.use('/uploads',express.static(path.join(process.cwd(),'uploads')));

// API Base Routes Mounting
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

app.use((req, res, next) => {
  console.log(`🚨 404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

// Base Health Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'B2B API is running!' });
});
app.use((req, res, next) => {
  console.log(`🚨 404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
app.use((req, res, next) => {
  console.log(`🚨 404 ERROR: Frontend tried to hit -> ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});