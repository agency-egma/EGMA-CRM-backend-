import puppeteer from 'puppeteer';
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
 * Generate PDF from invoice data
 * @param {Object} invoice - Invoice data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateInvoicePDF = async (invoice) => {
  let browser = null;
  const requestId = `pdf-${invoice._id || 'new'}-${Date.now()}`;
  
  console.log(`[PDF:${requestId}] Starting PDF generation for invoice ${invoice._id || 'New Invoice'}`);
  console.log(`[PDF:${requestId}] System info: Node ${process.version}, Puppeteer ${puppeteer.version || 'unknown'}`);
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

    // Launch puppeteer with more robust options
    console.log(`[PDF:${requestId}] Launching Puppeteer browser`);
    const browserArgs = [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none'
    ];
    console.log(`[PDF:${requestId}] Browser args: ${browserArgs.join(', ')}`);
    
    try {
      browser = await puppeteer.launch({
        args: browserArgs,
        headless: 'new'
      });
      console.log(`[PDF:${requestId}] Browser launched successfully`);
    } catch (browserError) {
      console.error(`[PDF:${requestId}] Failed to launch browser: ${browserError.message}`);
      throw new Error(`Browser launch failed: ${browserError.message}`);
    }

    // Create a new page
    let page;
    try {
      page = await browser.newPage();
      console.log(`[PDF:${requestId}] Browser page created`);
    } catch (pageError) {
      console.error(`[PDF:${requestId}] Failed to create page: ${pageError.message}`);
      throw new Error(`Page creation failed: ${pageError.message}`);
    }
    
    // Set viewport to A4 size
    try {
      await page.setViewport({
        width: 794, // A4 width in pixels (72 dpi)
        height: 1123, // A4 height
        deviceScaleFactor: 1.5 // Higher resolution
      });
      console.log(`[PDF:${requestId}] Viewport set to A4 size`);
    } catch (viewportError) {
      console.error(`[PDF:${requestId}] Failed to set viewport: ${viewportError.message}`);
      // Continue execution as this isn't critical
    }
    
    // Set the content with longer wait options to ensure complete rendering
    try {
      console.log(`[PDF:${requestId}] Setting page content (HTML length: ${html.length} characters)`);
      await page.setContent(html, { 
        waitUntil: ['networkidle0', 'domcontentloaded', 'load']
      });
      console.log(`[PDF:${requestId}] Page content set successfully`);
    } catch (contentError) {
      console.error(`[PDF:${requestId}] Failed to set page content: ${contentError.message}`);
      throw new Error(`Content loading failed: ${contentError.message}`);
    }

    // Use a manual delay instead of waitForTimeout
    console.log(`[PDF:${requestId}] Waiting for content to settle`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check content height and determine if we need to force page breaks
    try {
      console.log(`[PDF:${requestId}] Evaluating document structure`);
      await page.evaluate(() => {
        const notesSection = document.querySelector('.notes-section');
        const termsSection = document.querySelector('.terms-section');
        
        // If either section doesn't exist, no need to proceed
        if ((!notesSection && !termsSection)) return;
        
        // Get the main content container
        const mainContent = document.querySelector('.invoice-items-container');
        if (!mainContent) return;
        
        // Calculate the height of the page and main content
        const pageHeight = document.body.clientHeight;
        const mainContentRect = mainContent.getBoundingClientRect();
        const mainContentBottom = mainContentRect.bottom;
        
        // Create a container for notes and terms to keep them together
        const footerContainer = document.createElement('div');
        footerContainer.classList.add('footer-container');
        
        // Apply consistent styling for both cases
        footerContainer.style.pageBreakInside = 'avoid';
        footerContainer.style.marginTop = '2rem';
        footerContainer.style.paddingTop = '1rem';
        
        // If main content takes up more than 75% of the page height, move notes and terms to second page
        if (mainContentBottom > pageHeight * 0.75) {
          footerContainer.style.pageBreakBefore = 'always';
          // Add extra styling for second page
          footerContainer.style.paddingTop = '2rem';
          footerContainer.style.marginTop = '0';
        }
        
        // Insert the container before the notes/terms and move them inside
        if (notesSection) {
          notesSection.parentNode.insertBefore(footerContainer, notesSection);
          footerContainer.appendChild(notesSection);
        }
        
        if (termsSection) {
          if (notesSection) {
            footerContainer.appendChild(termsSection);
          } else {
            termsSection.parentNode.insertBefore(footerContainer, termsSection);
            footerContainer.appendChild(termsSection);
          }
        }
      });
      console.log(`[PDF:${requestId}] Document structure evaluation complete`);
    } catch (evalError) {
      console.error(`[PDF:${requestId}] Document structure evaluation failed: ${evalError.message}`);
      // Continue execution as this isn't critical
    }

    // Add custom styles for better PDF rendering
    try {
      await page.addStyleTag({
        content: `
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .footer-container {
            break-inside: avoid;
            page-break-inside: avoid;
            padding: 0 20px;
          }
          .footer-container[style*="page-break-before: always"] {
            padding-top: 40px;
            min-height: 100px;
          }
        `
      });
      console.log(`[PDF:${requestId}] Custom print styles added`);
    } catch (styleError) {
      console.error(`[PDF:${requestId}] Failed to add styles: ${styleError.message}`);
      // Continue execution as this isn't critical
    }

    // Generate PDF with more specific settings
    console.log(`[PDF:${requestId}] Generating PDF file`);
    const startTime = Date.now();
    let pdfBuffer;
    
    try {
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 0.98, // Slightly scale down to ensure everything fits
        timeout: 60000 // 60 seconds timeout
      });
      
      const duration = Date.now() - startTime;
      console.log(`[PDF:${requestId}] PDF generated in ${duration}ms, size: ${pdfBuffer.length} bytes`);
    } catch (pdfError) {
      console.error(`[PDF:${requestId}] PDF generation failed: ${pdfError.message}`);
      throw new Error(`PDF creation failed: ${pdfError.message}`);
    }

    // Validate the PDF buffer
    if (!pdfBuffer || pdfBuffer.length < 1000) {
      console.error(`[PDF:${requestId}] Generated PDF is invalid or too small: ${pdfBuffer?.length || 0} bytes`);
      throw new Error('Generated PDF is invalid or too small');
    }

    console.log(`[PDF:${requestId}] PDF generation completed successfully`);
    return pdfBuffer;
  } catch (error) {
    console.error(`[PDF:${requestId}] Error generating PDF:`, error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    // Always close the browser to clean up resources
    if (browser) {
      try {
        await browser.close();
        console.log(`[PDF:${requestId}] Browser closed successfully`);
      } catch (closeError) {
        console.error(`[PDF:${requestId}] Error closing browser: ${closeError.message}`);
      }
    }
  }
};