import express from 'express';
import { advancedResults } from '../utils/routeUtils.js';
import Project from '../models/Project.js';
import * as projectController from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Apply advanced results middleware to GET all route
router.get('/', advancedResults(Project, 'invoiceId'), projectController.getAll);
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.deleteProject);

// Add custom project routes
router.get('/:id/financial', projectController.getFinancialSummary);
router.put('/:id/payment', projectController.updatePaymentReceived);

export default router;
