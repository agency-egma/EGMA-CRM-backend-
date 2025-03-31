import Project from '../models/Project.js';
import Invoice from '../models/Invoice.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// Get all projects with filtering, sorting, pagination
export const getAll = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// Get single project
export const getById = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id).populate('invoiceId');
  
  if (!project) {
    return next(new ErrorResponse(`Project not found with id ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: project
  });
});

// Create project
export const create = asyncHandler(async (req, res, next) => {
  const project = await Project.create(req.body);
  
  res.status(201).json({
    success: true,
    data: project
  });
});

// Update project
export const update = asyncHandler(async (req, res, next) => {
  let project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(new ErrorResponse(`Project not found with id ${req.params.id}`, 404));
  }
  
  project = await Project.findByIdAndUpdate(
    req.params.id, 
    { ...req.body, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: project
  });
});

// Delete project
export const deleteProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(new ErrorResponse(`Project not found with id ${req.params.id}`, 404));
  }
  
  // If project has an invoice, delete it as well
  if (project.invoiceId) {
    await Invoice.findByIdAndDelete(project.invoiceId);
  }
  
  await project.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// Get project financial summary
export const getFinancialSummary = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id).populate('invoiceId');
  
  if (!project) {
    return next(new ErrorResponse(`Project not found with id ${req.params.id}`, 404));
  }
  
  const summary = {
    projectId: project._id,
    projectName: project.name,
    totalBudget: project.totalBudget,
    amountReceived: project.amountReceived,
    amountPending: project.amountPending,
    completionPercentage: (project.amountReceived / project.totalBudget) * 100,
    invoice: project.invoiceId ? {
      invoiceId: project.invoiceId._id,
      invoiceNumber: project.invoiceId.invoiceNumber,
      status: project.invoiceId.payment.status,
      amountDue: project.invoiceId.payment.amountDue
    } : null
  };
  
  res.status(200).json({
    success: true,
    data: summary
  });
});

// Update project payment received amount
export const updatePaymentReceived = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(new ErrorResponse(`Project not found with id ${req.params.id}`, 404));
  }
  
  if (!req.body.amountReceived && req.body.amountReceived !== 0) {
    return next(new ErrorResponse('Please provide amount received', 400));
  }
  
  project.amountReceived = req.body.amountReceived;
  await project.save();
  
  res.status(200).json({
    success: true,
    data: project
  });
});

// Export controller with standard names for the route util
export const projectController = {
  getAll,
  getById,
  create,
  update,
  delete: deleteProject
};

export default projectController;
