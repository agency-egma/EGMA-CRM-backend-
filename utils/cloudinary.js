import { v2 as cloudinary } from 'cloudinary';
import ErrorResponse from './errorResponse.js';

// Retrieve Cloudinary credentials from environment variables
const CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "duwl14elv";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "396659778444928";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "r7vxi_uQPMdfgas6NSooyMFswL4";

// Configure Cloudinary with credentials
cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

console.log('Cloudinary configuration:', {
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY ? 'Key provided (length: ' + CLOUDINARY_API_KEY.length + ')' : 'MISSING',
  api_secret: CLOUDINARY_API_SECRET ? 'Secret provided (length: ' + CLOUDINARY_API_SECRET.length + ')' : 'MISSING'
});

/**
 * Upload a file to Cloudinary
 * @param {string} fileBuffer - Base64 encoded file data
 * @param {string} folder - Cloudinary folder to upload to (e.g., 'invoices/logos')
 * @param {string} publicId - Optional custom public ID for the image
 * @returns {Promise<object>} - Cloudinary upload response
 */
export const uploadImage = async (fileBuffer, folder = 'invoices/logos', publicId = null) => {
  try {
    // Validate input
    if (!fileBuffer) {
      throw new Error('No image data provided');
    }
    
    console.log('Attempting to upload image to Cloudinary folder:', folder);
    
    // Options for the upload with explicit credentials
    const options = {
      folder,
      resource_type: 'image',
      // Explicitly include credentials with each upload
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      // Automatically assign a unique ID if publicId is not provided
      ...(publicId && { public_id: publicId })
    };

    // Double-check credentials before upload
    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_NAME) {
      throw new Error('Missing Cloudinary credentials. Check environment variables.');
    }

    // Upload buffer to Cloudinary with explicit configuration
    const result = await cloudinary.uploader.upload(fileBuffer, options);
    
    console.log('Upload successful, received URL:', result.secure_url);
    
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format
    };
  } catch (error) {
    console.error('Cloudinary upload error details:', error);
    throw new ErrorResponse(`Image upload failed: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Public ID of the image to delete
 * @returns {Promise<object>} - Cloudinary delete response
 */
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new ErrorResponse(`Image deletion failed: ${error.message}`, 500);
  }
};

export default {
  uploadImage,
  deleteImage,
  cloudinary
};
