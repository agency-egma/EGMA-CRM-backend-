import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
dotenv.config();

// Import DB connection
import connectDB from './config/db.js';
import errorHandler from './middleware/errorMiddleware.js';

// Import routes
import projectRoutes from './routes/projectRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import proposalRoutes from './routes/proposalRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(cors({ credentials: true, origin: true }));
app.use(morgan('dev'));

// Connect to MongoDB
connectDB();

// Log environment status
console.log('Cloudinary config status:',
  process.env.CLOUDINARY_NAME ? 'Name ✓' : 'Name ✗',
  process.env.CLOUDINARY_API_KEY ? 'API Key ✓' : 'API Key ✗',
  process.env.CLOUDINARY_API_SECRET ? 'Secret ✓' : 'Secret ✗'
);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

// Error handler middleware
app.use(errorHandler);

// Set port and start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
