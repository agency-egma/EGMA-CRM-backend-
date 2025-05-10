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
    
    // Add full-page wrapper styling with strong background enforcement
    const enhancedHtml = `
      <!DOCTYPE html>
      <html style="background-color: #1E293B !important; margin: 0; padding: 0;">
      <head>
        <style>
          @page {
            margin: 0 !important;
            padding: 0 !important;
            size: A4;
            background-color: #1E293B !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #1E293B !important;
            min-height: 100%;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          * {
            box-sizing: border-box;
          }
          .outer-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #1E293B !important;
            padding: 0;
            margin: 0;
          }
          .content-container {
            padding: 30px;
            max-width: 900px;
            margin: 0 auto;
            background-color: #1E293B !important;
          }
          .bg-layer {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #1E293B;
            z-index: -9999;
          }
          /* Add better page break styling with significantly increased top margin */
          .pagebreak {
            page-break-before: always;
            padding-top: 100px !important; 
            margin-top: 100px !important;
          }
          /* Target the footer info specifically for more margin */
          .footer-info {
            padding-top: 100px !important;
          }
          /* Force all page breaks to have significant top margin */
          @media print {
            div.footer-info {
              margin-top: 100px !important;
              padding-top: 100px !important;
            }
            .page-break-spacer {
              height: 100px !important;
              display: block !important;
            }
          }
        </style>
      </head>
      <body style="background-color: #1E293B !important; margin: 0; padding: 0;">
        <div class="bg-layer"></div>
        <div class="outer-wrapper">
          <div class="content-container">
            ${html}
          </div>
        </div>
      </body>
      </html>
    `;
    
    const content = { content: enhancedHtml };
    const options = { 
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
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
    
    // Add full-page wrapper styling with better background handling for PhantomJS
    const enhancedHtml = `
      <!DOCTYPE html>
      <html style="background-color: #1E293B !important; margin: 0; padding: 0;">
      <head>
        <style>
          @page {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #1E293B !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #1E293B !important;
            min-height: 100%;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .phantom-container {
            background-color: #1E293B !important;
            padding: 30px;
            margin: 0 auto;
            max-width: 900px;
          }
          .bg-fill {
            position: fixed;
            top: 0; right: 0; bottom: 0; left: 0;
            z-index: -1000;
            background-color: #1E293B !important;
          }
          /* New page break styling with much larger top margin */
          .pagebreak {
            page-break-before: always;
            padding-top: 100px !important;
            margin-top: 100px !important;
          }
          /* Force spacer to be large and visible */
          .page-break-spacer {
            height: 100px !important;
            background-color: #1E293B;
            display: block !important;
          }
          /* Ensure the footer has proper spacing when it breaks to a new page */
          @media print {
            .footer-info {
              margin-top: 100px !important;
              padding-top: 100px !important;
            }
          }
        </style>
      </head>
      <body style="background-color: #1E293B !important; margin: 0; padding: 0;">
        <div class="bg-fill"></div>
        <div class="phantom-container">
          ${html}
        </div>
      </body>
      </html>
    `;
    
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: '0',
      header: {
        height: '0'
      },
      footer: {
        height: '0'
      },
      base: `file://${process.cwd()}/`,
      timeout: 60000,
      phantomPath: require('phantomjs-prebuilt').path,
      zoomFactor: 1,
      quality: 100,
      background: '#1E293B'
    };
    
    const pdfBuffer = await new Promise((resolve, reject) => {
      htmlPdf.create(enhancedHtml, options).toBuffer((err, buffer) => {
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
    
    // Create a document with dark background and NO margins
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: `Invoice-${invoice.invoiceNumber}`,
        Author: 'EGMA'
      },
      autoFirstPage: false
    });
    
    // Custom function to add a page with full background
    function addPageWithBackground(isFirstPage = false) {
      doc.addPage({
        size: 'A4',
        margin: 0
      });
      
      // Fill the entire page with background color
      doc.rect(0, 0, doc.page.width, doc.page.height)
         .fill('#1E293B');
      
      // Reset text color
      doc.fillColor('#E2E8F0');
      
      // Add appropriate margins based on whether it's the first page or not
      if (isFirstPage) {
        // First page margin
        doc.translate(30, 30);
      } else {
        // SIGNIFICANTLY increased top margin for second and subsequent pages
        doc.translate(30, 120); // Increased from 80px to 120px for much more space
      }
    }
    
    // Add the first page
    addPageWithBackground(true);
    
    // Ensure all subsequent pages have the background and proper margins
    doc.on('pageAdded', () => {
      // Reset the transformation matrix to avoid accumulating translations
      doc.initializeCoordinates();
      
      // Fill the background
      doc.rect(0, 0, doc.page.width, doc.page.height)
         .fill('#1E293B');
      
      // Reset text color
      doc.fillColor('#E2E8F0');
      
      // Add page margins with extra top margin for subsequent pages
      doc.translate(30, 120); // Increased to 120px for second page content
    });
    
    // No need to add initial margin as it's handled in addPageWithBackground
    
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
    if (invoice.notes || invoice.terms) {
      // Force a page break if close to the bottom to get proper top margin on next page
      if (doc.y > doc.page.height - 350) { // Increased threshold dramatically (was 250)
        doc.addPage(); // This will trigger the pageAdded event with proper margins
      }
      
      // Add notes and terms
      if (invoice.notes) {
        doc.fontSize(10).text('Notes:', { bold: true });
        doc.fontSize(9).text(invoice.notes);
        doc.moveDown();
      }
      
      if (invoice.terms) {
        doc.fontSize(10).text('Terms and Conditions:', { bold: true });
        doc.fontSize(9).text(invoice.terms);
      }
    }
    
    // Finalize PDF
    doc.end();
    
    // Collect buffer
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
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