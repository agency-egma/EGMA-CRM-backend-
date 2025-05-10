import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';

// Get all invoices with filtering, sorting, pagination
export const getAll = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// Get single invoice
export const getById = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    return next(new ErrorResponse(`Invoice not found with id ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: invoice
  });
});

// Create invoice
export const create = asyncHandler(async (req, res, next) => {
  // Check if this invoice is associated with a project
  if (req.body.projectId) {
    const project = await Project.findById(req.body.projectId);
    if (!project) {
      return next(new ErrorResponse(`Project not found with id ${req.body.projectId}`, 404));
    }
  }
  
  // Ensure payment object exists
  if (!req.body.payment) {
    req.body.payment = {};
  }
  
  // Initialize payment fields needed for model validation
  // These will be recalculated by the pre-save hook
  req.body.payment.amountPaid = req.body.payment.amountPaid || 0;
  
  try {
    // Create the invoice - the model's pre-save hook will handle all calculations
    const invoice = await Invoice.create(req.body);
    
    // If project exists, update the project with invoice reference
    if (req.body.projectId) {
      await Project.findByIdAndUpdate(
        req.body.projectId,
        { invoiceId: invoice._id, updatedAt: Date.now() }
      );
    }
    
    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Invoice creation error:', error);
    return next(error);
  }
});

// Update invoice
export const update = asyncHandler(async (req, res, next) => {
  let invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    return next(new ErrorResponse(`Invoice not found with id ${req.params.id}`, 404));
  }
  
  // Preserve the invoiceNumber when updating
  if (req.body.invoiceNumber) {
    delete req.body.invoiceNumber;
  }
  
  try {
    // First update the invoice with new data
    invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    // Force recalculation of payment amounts and status by saving
    // This will trigger the pre-save hook
    await invoice.save();
    
    // Fetch the updated invoice after recalculation
    invoice = await Invoice.findById(req.params.id);
    
    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Invoice update error:', error);
    return next(error);
  }
});

// Delete invoice
export const deleteInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    return next(new ErrorResponse(`Invoice not found with id ${req.params.id}`, 404));
  }
  
  // If this invoice is referenced by a project, remove the reference
  if (invoice.projectId) {
    await Project.findByIdAndUpdate(
      invoice.projectId,
      { $unset: { invoiceId: "" }, updatedAt: Date.now() }
    );
  }
  
  await invoice.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// Add a payment to an invoice
export const addPayment = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    return next(new ErrorResponse(`Invoice not found with id ${req.params.id}`, 404));
  }
  
  // Use the model's addPayment method which handles:
  // - Adding the payment to methods array
  // - Updating amountPaid
  // - Saving the invoice (which triggers the pre-save hook to recalculate values)
  await invoice.addPayment(req.body);
  
  // If project exists, update amount received
  if (invoice.projectId) {
    const project = await Project.findById(invoice.projectId);
    if (project) {
      project.amountReceived = invoice.payment.amountPaid;
      await project.save();
    }
  }
  
  res.status(200).json({
    success: true,
    data: invoice
  });
});

// Generate invoice for a project
export const generateFromProject = asyncHandler(async (req, res, next) => {
  const projectId = req.params.projectId;
  const project = await Project.findById(projectId);
  
  if (!project) {
    return next(new ErrorResponse(`Project not found with id ${projectId}`, 404));
  }
  
  // Create basic invoice data from project and request body
  const invoiceData = {
    projectId: project._id,
    // Currency information from project or request body
    currency: req.body.currency || project.currency || {
      code: 'INR',
      symbol: '₹'
    },
    // Use client data from request body, fall back to project data
    client: {
      name: req.body.client?.name || project.client.name,
      email: req.body.client?.email || project.client.email,
      phone: req.body.client?.phone || project.client.phone,
      address: req.body.client?.address || "Address not provided",
      agencyName: req.body.client?.agencyName,
      registrationNumber: req.body.client?.registrationNumber
    },
    // Use goods data from request body if provided, otherwise create default
    goods: req.body.goods || [{
      description: `Payment for project: ${project.name}`,
      quantity: 1,
      price: project.totalBudget,
    }],
    // Payment details
    payment: {
      status: req.body.payment?.status || 'pending',
      discount: req.body.payment?.discount || 0,
      methods: req.body.payment?.methods || [],
      amountPaid: 0 // Initialize to ensure the model hook calculates correctly
    },
    // Dates
    issuedDate: req.body.issuedDate || new Date(),
    dueDate: req.body.dueDate || null, // Allow null dueDate
    // Additional info
    notes: req.body.notes,
    terms: req.body.terms,
    // Agency details
    agency: req.body.agency || {
      name: "EGMA",
      email: "contact@egma.com",
      phone: "+91 9876543210",
      address: "EGMA Headquarters"
    }
  };
  
  try {
    // The model's pre-save hook will handle all calculations including invoice number generation
    const invoice = await Invoice.create(invoiceData);
    
    // Update project with invoice reference
    project.invoiceId = invoice._id;
    await project.save();
    
    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Invoice generation error:', error);
    return next(error);
  }
});

// Get invoice payment status
export const getPaymentStatus = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  
  if (!invoice) {
    return next(new ErrorResponse(`Invoice not found with id ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.payment.status,
      totalAmount: invoice.payment.totalAmount,
      amountPaid: invoice.payment.amountPaid,
      amountDue: invoice.payment.amountDue,
      paymentPercentage: invoice.paymentPercentage,
      isOverdue: new Date() > invoice.dueDate && invoice.payment.amountDue > 0,
      dueDate: invoice.dueDate
    }
  });
});

// Download invoice as PDF
export const downloadPDF = asyncHandler(async (req, res, next) => {
  const requestId = `pdf-${req.params.id}-${Date.now()}`;
  console.log(`[PDF:${requestId}] PDF download request for invoice ${req.params.id} - User: ${req.user.id}`);
  
  // Log request information to help diagnose issues
  const userAgent = req.get('User-Agent') || 'Unknown';
  const acceptHeader = req.get('Accept') || 'Not specified';
  console.log(`[PDF:${requestId}] Request headers: Accept=${acceptHeader}, User-Agent=${userAgent.substring(0, 100)}`);
  
  try {
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      console.log(`[PDF:${requestId}] Invoice not found with id ${req.params.id}`);
      return next(new ErrorResponse(`Invoice not found with id ${req.params.id}`, 404));
    }
    
    console.log(`[PDF:${requestId}] Invoice found: ${invoice.invoiceNumber}, items: ${invoice.goods?.length || 0}`);
    
    try {
      // Prevent timeout on slow servers
      req.setTimeout(120000); // 2 minutes
      console.log(`[PDF:${requestId}] Request timeout increased to 120 seconds`);
      
      // Generate PDF
      console.log(`[PDF:${requestId}] Calling PDF generator function`);
      const startTime = Date.now();
      const pdfBuffer = await generateInvoicePDF(invoice);
      const duration = Date.now() - startTime;
      
      // Validate PDF Buffer
      if (!pdfBuffer || pdfBuffer.length < 1000) {
        console.error(`[PDF:${requestId}] Invalid PDF generated: ${pdfBuffer?.length || 0} bytes`);
        return next(new ErrorResponse('PDF generation failed - invalid PDF document', 500));
      }
      
      console.log(`[PDF:${requestId}] PDF successfully generated in ${duration}ms, size: ${pdfBuffer.length} bytes`);
      
      // Set proper content type and headers for PDF
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff'
      });
      
      console.log(`[PDF:${requestId}] Sending PDF response`);
      
      // Send PDF buffer directly
      res.end(pdfBuffer);
      console.log(`[PDF:${requestId}] PDF response sent successfully`);
    } catch (error) {
      console.error(`[PDF:${requestId}] PDF generation error:`, error);
      
      // Create a detailed error log with stack trace
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      };
      
      console.error(`[PDF:${requestId}] Error details:`, JSON.stringify(errorDetails, null, 2));
      
      return next(new ErrorResponse(`Failed to generate PDF: ${error.message}`, 500));
    }
  } catch (error) {
    console.error(`[PDF:${requestId}] Controller error:`, error);
    return next(new ErrorResponse(`PDF generation failed: ${error.message}`, 500));
  }
});

// Export controller with standard names for the route util
export const invoiceController = {
  getAll,
  getById,
  create,
  update,
  delete: deleteInvoice
};

export default invoiceController;