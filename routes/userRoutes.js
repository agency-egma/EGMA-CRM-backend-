import express from 'express';
import { advancedResults } from '../utils/routeUtils.js';
import User from '../models/User.js';
import { 
  getUsers, 
  getUser, 
  updateUser, 
  deleteUser 
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protection middleware to all routes
router.use(protect);
// Restrict to admin only
router.use(authorize('admin'));

// Apply advanced results middleware to GET all route
router.route('/')
  .get(advancedResults(User), getUsers)

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

export default router;
