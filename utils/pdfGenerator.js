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
Handlebars.registerHelper('formatCurrency', function(value, currencyCode = 'INR', currencySymbol = '₹') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    }).format(value || 0);
  } catch (error) {
    // Fallback to basic formatting if Intl fails
    return `${currencySymbol}${(value || 0).toFixed(2)}`;
  }
});

// Register helper for formatting dates
Handlebars.registerHelper('formatDate', function(date) {
  if (!date) return 'Not set';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    // Fallback to ISO string if date formatting fails
    return new Date(date).toISOString().split('T')[0];
  }
});

// Add helper for addition (needed for combining total + taxAmount)
Handlebars.registerHelper('add', function(a, b) {
  return (a || 0) + (b || 0);
});

// Track browser instance for resource management
let browserInstance = null;

/**
 * Get a browser instance (cached for performance)
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
const getBrowser = async () => {
  if (browserInstance) {
    return browserInstance;
  }
  
  // Launch with production-friendly options
  browserInstance = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ],
    headless: 'new',
    timeout: 30000
  });
  
  // Handle browser closure on process exit
  process.on('exit', async () => {
    if (browserInstance) {
      try {
        await browserInstance.close();
      } catch (error) {
        console.error('Error closing browser on exit:', error);
      }
    }
  });
  
  return browserInstance;
};

/**
 * Generate PDF from invoice data
 * @param {Object} invoice - Invoice data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateInvoicePDF = async (invoice) => {
  let browser = null;
  let page = null;
  
  try {
    console.log('Starting PDF generation for invoice:', invoice._id || 'New Invoice');
    
    // Create a clean copy of the invoice data to avoid prototype chain issues
    const safeInvoice = JSON.parse(JSON.stringify(invoice));
    
    // Extract currency information
    const currencyCode = safeInvoice.currency?.code || 'INR';
    const currencySymbol = safeInvoice.currency?.symbol || '₹';
    
    // Prepare the data for the template
    const data = {
      invoice: safeInvoice,
      date: new Date().toLocaleDateString('en-US'),
      isPaid: safeInvoice.payment.status === 'paid',
      isPartiallyPaid: safeInvoice.payment.status === 'partially_paid',
      isPending: safeInvoice.payment.status === 'pending',
      isOverdue: safeInvoice.payment.status === 'overdue',
      isDraft: safeInvoice.payment.status === 'draft',
      isCancelled: safeInvoice.payment.status === 'cancelled',
      currencySymbol,
      currencyCode
    };

    // Render HTML with Handlebars
    const html = template(data);

    // Get browser instance with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        browser = await getBrowser();
        break;
      } catch (error) {
        retries--;
        console.error(`Error launching browser, ${retries} retries left:`, error);
        
        // Reset browser instance on error
        browserInstance = null;
        
        if (retries === 0) {
          throw new Error('Failed to launch browser after multiple attempts');
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Create a new page with error handling
    try {
      page = await browser.newPage();
    } catch (error) {
      console.error('Error creating page, attempting browser restart:', error);
      
      // Try to close and reset browser
      if (browserInstance) {
        try {
          await browserInstance.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
        browserInstance = null;
      }
      
      // Retry with a new browser instance
      browser = await getBrowser();
      page = await browser.newPage();
    }
    
    // Set viewport to A4 size with higher resolution for better quality
    await page.setViewport({
      width: 794, // A4 width in pixels (72 dpi)
      height: 1123, // A4 height
      deviceScaleFactor: 2 // Higher resolution
    });
    
    // Set the content with robust timeout and wait options
    await page.setContent(html, { 
      waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
      timeout: 30000
    });

    // Give extra time for fonts and resources to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Evaluate content height and fix layout issues
    await page.evaluate((currencySymbol) => {
      // Format currencies manually as a fallback
      document.querySelectorAll('.currency-value').forEach(el => {
        if (el.textContent.trim() === '') {
          const amount = parseFloat(el.getAttribute('data-amount') || 0);
          el.textContent = `${currencySymbol}${amount.toFixed(2)}`;
        }
      });
      
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
    }, currencySymbol);

    // Add custom styles for better PDF rendering
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
        @media print {
          .page-break { 
            page-break-before: always; 
          }
        }
      `
    });

    // Generate PDF with production-safe settings
    const pdfBuffer = await page.pdf({
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

    // Validate the PDF buffer
    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error('Generated PDF is invalid or too small');
    }

    console.log(`PDF generation successful, size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    // Close the page but keep the browser instance
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('Error closing page:', closeError);
      }
    }
    
    // In case of browser creation but not added to global instance 
    if (browser && browser !== browserInstance) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing temporary browser:', closeError);
      }
    }
  }
};

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing browser instance');
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (error) {
      console.error('Error closing browser on SIGINT:', error);
    }
    browserInstance = null;
  }
  process.exit(0);
});
