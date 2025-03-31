import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

// Import DB connection
import connectDB from './config/db.js';
import errorHandler from './middleware/errorMiddleware.js';

// Import routes
import projectRoutes from './routes/projectRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import proposalRoutes from './routes/proposalRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js'; // Add the new import

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' })); // Increase body size limit for image uploads
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(morgan('dev'));

// Connect to MongoDB
connectDB();

// Log environment status
console.log('Cloudinary config status:',
  process.env.CLOUDINARY_NAME ? 'Name ✓' : 'Name ✗',
  process.env.CLOUDINARY_API_KEY ? 'API Key ✓' : 'API Key ✗',
  process.env.CLOUDINARY_API_SECRET ? 'Secret ✓' : 'Secret ✗'
);

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes); // Add the new route

// Error handling middleware (must be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
