import express from 'express';
import { uploadImage } from '../utils/cloudinary.js';
import asyncHandler from '../utils/asyncHandler.js';
import ErrorResponse from '../utils/errorResponse.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Upload logo image
router.post('/logo', asyncHandler(async (req, res, next) => {
  try {
    // Check if the request contains the image file
    if (!req.body.image) {
      return next(new ErrorResponse('Please provide an image', 400));
    }

    // Log image data format (but not the full content for security/size reasons)
    console.log('Image data type:', typeof req.body.image);
    console.log('Image data length:', req.body.image.length);
    console.log('Image data starts with:', req.body.image.substring(0, 50) + '...');

    // Upload image to Cloudinary (folder: invoices/logos)
    const result = await uploadImage(req.body.image, 'invoices/logos');
    
    // Return the image details
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return next(new ErrorResponse(`Error uploading image: ${error.message || 'Unknown error'}`, 500));
  }
}));

export default router;
