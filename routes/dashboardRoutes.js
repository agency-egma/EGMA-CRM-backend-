import express from 'express';
import Project from '../models/Project.js';
import Invoice from '../models/Invoice.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', asyncHandler(async (req, res) => {
  // Get total project count
  const totalProjects = await Project.countDocuments();
  
  // Get revenue information
  const projects = await Project.find();
  const totalRevenue = projects.reduce((sum, project) => sum + project.amountReceived, 0);
  
  // Get pending invoices count
  const pendingInvoices = await Invoice.countDocuments({
    'payment.status': { $in: ['pending', 'partially_paid', 'overdue'] }
  });
  
  res.status(200).json({
    success: true,
    data: {
      totalProjects,
      totalRevenue,
      pendingInvoices
    }
  });
}));

export default router;
