import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template path
const templatePath = path.join(__dirname, '../templates/invoice.html');
const templateContent = fs.readFileSync(templatePath, 'utf8');

// Configure Handlebars with allowProtoPropertiesByDefault to fix the access warnings
const template = Handlebars.compile(templateContent, {
  allowProtoPropertiesByDefault: true,
  allowProtoMethodsByDefault: true
});

// Register helper for formatting currency
Handlebars.registerHelper('formatCurrency', function(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0); // Add fallback to handle undefined values
});

// Register helper for formatting dates
Handlebars.registerHelper('formatDate', function(date) {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
});

// Add helper for addition (needed for combining total + taxAmount)
Handlebars.registerHelper('add', function(a, b) {
  return (a || 0) + (b || 0);
});

/**
 * Generate PDF from invoice data using multi-strategy approach with fallbacks
 * @param {Object} invoice - Invoice data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateInvoicePDF = async (invoice) => {
  const requestId = `pdf-${invoice._id || 'new'}-${Date.now()}`;
  
  console.log(`[PDF:${requestId}] Starting PDF generation for invoice ${invoice._id || 'New Invoice'}`);
  console.log(`[PDF:${requestId}] System info: Node ${process.version}`);
  console.log(`[PDF:${requestId}] Invoice details: Number=${invoice.invoiceNumber}, Items=${invoice.goods?.length || 0}`);
  
  try {
    // Create a clean copy of the invoice data to avoid prototype chain issues
    const safeInvoice = JSON.parse(JSON.stringify(invoice));
    console.log(`[PDF:${requestId}] Invoice data sanitized`);
    
    // Prepare the data for the template
    const data = {
      invoice: safeInvoice,
      date: new Date().toLocaleDateString('en-US'),
      isPaid: safeInvoice.payment.status === 'paid',
      isPartiallyPaid: safeInvoice.payment.status === 'partially_paid',
      isPending: safeInvoice.payment.status === 'pending',
      isOverdue: safeInvoice.payment.status === 'overdue',
      isDraft: safeInvoice.payment.status === 'draft',
      isCancelled: safeInvoice.payment.status === 'cancelled'
    };
    console.log(`[PDF:${requestId}] Template data prepared`);

    // Render HTML with Handlebars
    console.log(`[PDF:${requestId}] Rendering HTML template`);
    const html = template(data);
    console.log(`[PDF:${requestId}] Template rendered successfully, HTML length: ${html.length} characters`);

    // Try strategies in sequence until one works
    const strategies = [
      tryGeneratePDFWithHtmlPdfNode,
      tryGeneratePDFWithHtmlPdf,
      tryGeneratePDFWithPDFKit
    ];
    
    let lastError = null;
    
    for (const strategy of strategies) {
      try {
        const result = await strategy(html, invoice, requestId);
        if (result && result.length > 1000) {
          return result;
        }
      } catch (error) {
        console.error(`[PDF:${requestId}] Strategy failed:`, error.message);
        lastError = error;
        // Continue to the next strategy
      }
    }
    
    // If we get here, all strategies failed
    throw lastError || new Error('All PDF generation strategies failed');
  } catch (error) {
    console.error(`[PDF:${requestId}] Error generating PDF:`, error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

/**
 * Strategy 1: Use html-pdf-node library (Chrome-based but with easier setup)
 */
async function tryGeneratePDFWithHtmlPdfNode(html, invoice, requestId) {
  try {
    console.log(`[PDF:${requestId}] Trying html-pdf-node strategy`);
    
    // Dynamically import to handle optional dependency
    const htmlPdfNode = await import('html-pdf-node').catch(() => null);
    
    if (!htmlPdfNode) {
      throw new Error('html-pdf-node module not available');
    }
    
    const content = { content: html };
    const options = { 
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      args: ['--no-sandbox']
    };
    
    const pdfBuffer = await new Promise((resolve, reject) => {
      htmlPdfNode.generatePdf(content, options)
        .then(resolve)
        .catch(reject);
    });
    
    console.log(`[PDF:${requestId}] html-pdf-node strategy succeeded, PDF size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.error(`[PDF:${requestId}] html-pdf-node strategy failed:`, error);
    throw error;
  }
}

/**
 * Strategy 2: Use html-pdf library (PhantomJS-based)
 */
async function tryGeneratePDFWithHtmlPdf(html, invoice, requestId) {
  try {
    console.log(`[PDF:${requestId}] Trying html-pdf strategy`);
    
    // Dynamically import to handle optional dependency
    const htmlPdf = await import('html-pdf').catch(() => null);
    
    if (!htmlPdf) {
      throw new Error('html-pdf module not available');
    }
    
    const options = {
      format: 'A4',
      border: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      timeout: 60000
    };
    
    const pdfBuffer = await new Promise((resolve, reject) => {
      htmlPdf.create(html, options).toBuffer((err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    
    console.log(`[PDF:${requestId}] html-pdf strategy succeeded, PDF size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.error(`[PDF:${requestId}] html-pdf strategy failed:`, error);
    throw error;
  }
}

/**
 * Strategy 3: Use PDFKit (pure JS, no external dependencies)
 */
async function tryGeneratePDFWithPDFKit(html, invoice, requestId) {
  try {
    console.log(`[PDF:${requestId}] Trying PDFKit strategy (simplified output)`);
    
    // Dynamically import to handle optional dependency
    const PDFDocument = (await import('pdfkit')).default;
    
    // Create a document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Invoice-${invoice.invoiceNumber}`,
        Author: 'EGMA'
      }
    });
    
    // Collect PDF data chunks
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Title
    doc.fontSize(20).text('INVOICE', { align: 'left' });
    doc.fontSize(12).text(`#${invoice.invoiceNumber}`, { align: 'left', color: 'blue' });
    doc.moveDown();
    
    // Status
    doc.fontSize(10).text(`Status: ${invoice.payment.status}`, { align: 'right' });
    doc.moveDown();
    
    // From/To information
    doc.fontSize(12).text('From:', { bold: true });
    doc.fontSize(10).text(invoice.agency.name);
    doc.fontSize(9).text(invoice.agency.address);
    doc.fontSize(9).text(`Email: ${invoice.agency.email}`);
    doc.fontSize(9).text(`Phone: ${invoice.agency.phone}`);
    doc.moveDown();
    
    doc.fontSize(12).text('Bill To:', { bold: true });
    doc.fontSize(10).text(invoice.client.name);
    if (invoice.client.agencyName) doc.fontSize(9).text(invoice.client.agencyName);
    doc.fontSize(9).text(invoice.client.address);
    doc.fontSize(9).text(`Email: ${invoice.client.email}`);
    doc.fontSize(9).text(`Phone: ${invoice.client.phone}`);
    doc.moveDown();
    
    // Dates
    doc.fontSize(9).text(`Invoice Date: ${new Date(invoice.issuedDate).toLocaleDateString()}`);
    if (invoice.dueDate) {
      doc.fontSize(9).text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
    }
    doc.moveDown();
    
    // Items table (simplified)
    const currencySymbol = invoice.currency?.symbol || '₹';
    doc.fontSize(10).text('Items:', { bold: true });
    const items = invoice.goods;
    items.forEach(item => {
      doc.fontSize(9).text(`${item.description} (${item.quantity} x ${currencySymbol}${item.price.toFixed(2)})`, { continued: true });
      doc.text(`${currencySymbol}${item.total.toFixed(2)}`, { align: 'right' });
    });
    
    doc.moveDown();
    
    // Summary
    doc.fontSize(9).text(`Subtotal: ${currencySymbol}${invoice.payment.subtotal.toFixed(2)}`, { align: 'right' });
    if (invoice.payment.taxTotal) {
      doc.fontSize(9).text(`Tax: ${currencySymbol}${invoice.payment.taxTotal.toFixed(2)}`, { align: 'right' });
    }
    if (invoice.payment.discount) {
      doc.fontSize(9).text(`Discount: -${currencySymbol}${invoice.payment.discount.toFixed(2)}`, { align: 'right' });
    }
    doc.fontSize(10).text(`Total: ${currencySymbol}${invoice.payment.totalAmount.toFixed(2)}`, { align: 'right' });
    doc.fontSize(9).text(`Paid: ${currencySymbol}${(invoice.payment.amountPaid || 0).toFixed(2)}`, { align: 'right' });
    doc.fontSize(9).text(`Due: ${currencySymbol}${(invoice.payment.amountDue || 0).toFixed(2)}`, { align: 'right' });
    
    doc.moveDown();
    
    // Notes and Terms
    if (invoice.notes) {
      doc.fontSize(10).text('Notes:', { bold: true });
      doc.fontSize(9).text(invoice.notes);
      doc.moveDown();
    }
    
    if (invoice.terms) {
      doc.fontSize(10).text('Terms and Conditions:', { bold: true });
      doc.fontSize(9).text(invoice.terms);
    }
    
    // Finalize PDF
    doc.end();
    
    // Collect buffer
    const pdfBuffer = await new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
    
    console.log(`[PDF:${requestId}] PDFKit strategy succeeded, PDF size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.error(`[PDF:${requestId}] PDFKit strategy failed:`, error);
    throw error;
  }
}