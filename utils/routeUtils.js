import express from 'express';

/**
 * Create standard CRUD routes for a resource
 * @param {Object} controller - The controller with CRUD methods
 * @returns {express.Router} - Express router with standard routes
 */
export const createCrudRoutes = (controller) => {
  const router = express.Router();

  // GET all resources with filtering, pagination, and sorting
  router.get('/', controller.getAll);
  
  // GET single resource by ID
  router.get('/:id', controller.getById);
  
  // POST new resource
  router.post('/', controller.create);
  
  // PUT update resource
  router.put('/:id', controller.update);
  
  // DELETE resource
  router.delete('/:id', controller.delete);

  return router;
};

/**
 * Creates a middleware for advanced query features
 * @returns {Function} - Express middleware function
 */
export const advancedResults = (model, populate) => async (req, res, next) => {
  let query;
  
  // Copy req.query
  const reqQuery = { ...req.query };
  
  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];
  
  // Delete excluded fields from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);
  
  // Create query string
  let queryStr = JSON.stringify(reqQuery);
  
  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
  
  // Finding resource
  query = model.find(JSON.parse(queryStr));
  
  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }
  
  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }
  
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await model.countDocuments(JSON.parse(queryStr));
  
  query = query.skip(startIndex).limit(limit);
  
  if (populate) {
    query = query.populate(populate);
  }
  
  // Execute query
  const results = await query;
  
  // Pagination result
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }
  
  res.advancedResults = {
    success: true,
    count: results.length,
    pagination,
    data: results
  };
  
  next();
};
