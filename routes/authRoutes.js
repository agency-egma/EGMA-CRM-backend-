import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateDetails,
  updatePassword,
  verifyEmail
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);

// Protected routes (authentication required)
router.use('/me', protect);
router.use('/update-details', protect);
router.use('/update-password', protect);
router.use('/logout', protect);

// Apply middleware to specific routes
router.get('/me', getMe);
router.get('/logout', logout);
router.put('/update-details', updateDetails);
router.put('/update-password', updatePassword);

export default router;
