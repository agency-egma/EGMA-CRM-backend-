import express from 'express';
import { advancedResults } from '../utils/routeUtils.js';
import Invoice from '../models/Invoice.js';
import * as invoiceController from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

// Apply authentication middleware to all routes
router.use(protect);

// Apply advanced results middleware to GET all route
router.get('/', advancedResults(Invoice, 'projectId'), invoiceController.getAll);
router.get('/:id', invoiceController.getById);
router.post('/', invoiceController.create);
router.put('/:id', invoiceController.update);
router.delete('/:id', invoiceController.deleteInvoice);

// Add custom routes
router.post('/:id/payments', invoiceController.addPayment);
router.get('/:id/status', invoiceController.getPaymentStatus);
router.get('/:id/pdf', invoiceController.downloadPDF); // Add PDF download route
router.post('/project/:projectId', invoiceController.generateFromProject);

export default router;
