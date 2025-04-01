import { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, 
  BorderStyle, HeadingLevel, WidthType, TableLayoutType, Packer } from 'docx';
import { stripHtml } from 'string-strip-html';
import { JSDOM } from 'jsdom';

/**
 * Format currency for display
 * @param {number} value - The monetary value to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value || 0);
};

/**
 * Format date for display
 * @param {string} date - ISO date string
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Clean HTML content and return plain text
 * @param {string} htmlContent - HTML content to clean
 * @returns {string} - Plain text without HTML tags
 */
const cleanHtml = (htmlContent) => {
  if (!htmlContent) return '';
  
  try {
    // Check if content contains HTML
    if (htmlContent.includes('<') && htmlContent.includes('>')) {
      return stripHtml(htmlContent).result;
    }
    
    return htmlContent;
  } catch (error) {
    console.error('Error cleaning HTML:', error);
    return htmlContent || '';
  }
};

/**
 * Safely get text content from HTML
 * @param {string} htmlContent - HTML content
 * @returns {string} - Plain text content
 */
const getTextFromHtml = (htmlContent) => {
  try {
    if (!htmlContent) return '';
    
    // Simple HTML detection
    if (htmlContent.includes('<') && htmlContent.includes('>')) {
      const dom = new JSDOM(`<div>${htmlContent}</div>`);
      return dom.window.document.querySelector('div').textContent || '';
    }
    
    return htmlContent;
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return htmlContent || '';
  }
};

/**
 * Extract tables from HTML content
 * @param {string} htmlContent - HTML content
 * @returns {Array} - Array of [tableElements, textContent]
 */
const extractTablesAndText = (htmlContent) => {
  try {
    if (!htmlContent || !(htmlContent.includes('<table') && htmlContent.includes('</table>'))) {
      return [[], getTextFromHtml(htmlContent)];
    }
    
    const dom = new JSDOM(`<div>${htmlContent}</div>`);
    const tableElements = Array.from(dom.window.document.querySelectorAll('table'));
    
    // Get text outside tables
    const div = dom.window.document.querySelector('div');
    const tableNodes = Array.from(div.querySelectorAll('table'));
    tableNodes.forEach(table => {
      table.parentNode.removeChild(table);
    });
    
    return [tableElements, div.textContent.trim()];
  } catch (error) {
    console.error('Error extracting tables:', error);
    return [[], getTextFromHtml(htmlContent)];
  }
};

/**
 * Convert HTML table to DOCX Table safely
 * @param {HTMLTableElement} tableNode - The HTML table node
 * @returns {Table} - DOCX Table object
 */
const convertHtmlTableToDocx = (tableNode) => {
  try {
    const rows = Array.from(tableNode.querySelectorAll('tr'));
    if (rows.length === 0) {
      return null;
    }
    
    const tableRows = [];
    
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (cells.length === 0) continue;
      
      const tableCells = [];
      
      for (const cell of cells) {
        const isHeader = cell.nodeName === 'TH';
        const cellText = cell.textContent.trim();
        
        tableCells.push(new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              bold: isHeader
            })],
          })],
          margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
          }
        }));
      }
      
      tableRows.push(new TableRow({
        children: tableCells
      }));
    }
    
    return new Table({
      rows: tableRows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" }
      }
    });
  } catch (error) {
    console.error('Error converting HTML table to DOCX:', error);
    return null;
  }
};

/**
 * Process content with tables and add to sections
 * @param {string} htmlContent - HTML content to process
 * @returns {Array} - Array of document elements
 */
const processContentWithTables = (htmlContent) => {
  try {
    const contentElements = [];
    const [tables, textContent] = extractTablesAndText(htmlContent);
    
    // Add text content first (if exists)
    if (textContent) {
      contentElements.push(
        new Paragraph({
          text: textContent,
          spacing: { after: 200 }
        })
      );
    }
    
    // Add tables
    for (const table of tables) {
      const docxTable = convertHtmlTableToDocx(table);
      if (docxTable) {
        contentElements.push(docxTable);
        // Add spacing after table
        contentElements.push(
          new Paragraph({
            text: '',
            spacing: { after: 200 }
          })
        );
      }
    }
    
    return contentElements;
  } catch (error) {
    console.error('Error processing content with tables:', error);
    // Fallback to plain text
    return [
      new Paragraph({
        text: cleanHtml(htmlContent),
        spacing: { after: 200 }
      })
    ];
  }
};

/**
 * Generate Word Document from proposal data
 * @param {Object} proposal - Proposal data
 * @returns {Promise<Buffer>} - Word document buffer
 */
export const generateProposalDOC = async (proposal) => {
  try {
    console.log('Starting document generation');
    
    // Create a clean copy of the proposal data
    const safeProposal = JSON.parse(JSON.stringify(proposal));
    
    // Document sections
    const sections = [];
    
    // Header section
    sections.push(
      new Paragraph({
        text: "PROPOSAL",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `ID: ${safeProposal._id.substring(0, 8)}`,
            bold: true,
            size: 24,
            color: "3B82F6"
          })
        ],
        spacing: { after: 400 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Status: ",
            bold: true
          }),
          new TextRun({
            text: safeProposal.status.toUpperCase(),
            bold: true,
            color: safeProposal.status === 'accepted' ? "10B981" : 
                  safeProposal.status === 'sent' ? "60A5FA" : 
                  safeProposal.status === 'rejected' ? "EF4444" : 
                  safeProposal.status === 'negotiating' ? "FBBF24" : "94A3B8"
          })
        ],
        spacing: { after: 400 }
      })
    );
    
    // Title
    sections.push(
      new Paragraph({
        text: safeProposal.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 300 }
      })
    );
    
    // Dates
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Created: ", bold: true }),
          new TextRun({ text: formatDate(safeProposal.createdAt) })
        ],
        spacing: { after: 200 }
      })
    );
    
    if (safeProposal.sentDate) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Sent Date: ", bold: true }),
            new TextRun({ text: formatDate(safeProposal.sentDate) })
          ],
          spacing: { after: 200 }
        })
      );
    }
    
    // Client information
    sections.push(
      new Paragraph({
        text: "CLIENT DETAILS",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [new TextRun({ text: safeProposal.clientDetails.name, bold: true })],
        spacing: { after: 100 }
      })
    );
    
    if (safeProposal.clientDetails.address) {
      sections.push(
        new Paragraph({
          text: safeProposal.clientDetails.address,
          spacing: { after: 100 }
        })
      );
    }
    
    sections.push(
      new Paragraph({
        text: safeProposal.clientDetails.email,
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: safeProposal.clientDetails.phone,
        spacing: { after: 400 }
      })
    );
    
    // Project reference (if available)
    if (safeProposal.projectId) {
      sections.push(
        new Paragraph({
          text: "PROJECT REFERENCE",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          text: `Project ID: ${safeProposal.projectId}`,
          spacing: { after: 400 }
        })
      );
    }
    
    // Description
    sections.push(
      new Paragraph({
        text: "DESCRIPTION",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      })
    );
    
    // Process description content with tables
    const descriptionContent = processContentWithTables(safeProposal.description);
    sections.push(...descriptionContent);
    
    // Scope
    sections.push(
      new Paragraph({
        text: "SCOPE",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      })
    );
    
    // Process scope content with tables
    const scopeContent = processContentWithTables(safeProposal.scope);
    sections.push(...scopeContent);
    
    // Timeline
    sections.push(
      new Paragraph({
        text: "TIMELINE",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      })
    );
    
    // Process timeline content with tables
    const timelineContent = processContentWithTables(safeProposal.timeline);
    sections.push(...timelineContent);
    
    // Deliverables
    sections.push(
      new Paragraph({
        text: "DELIVERABLES",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      })
    );
    
    // Add deliverables as bullet points
    if (Array.isArray(safeProposal.deliverables) && safeProposal.deliverables.length > 0) {
      safeProposal.deliverables.forEach(deliverable => {
        if (deliverable) {
          sections.push(
            new Paragraph({
              text: deliverable,
              bullet: {
                level: 0
              },
              spacing: { after: 100 }
            })
          );
        }
      });
    } else {
      sections.push(
        new Paragraph({
          text: "No deliverables specified",
          spacing: { after: 200 }
        })
      );
    }
    
    // Budget
    sections.push(
      new Paragraph({
        text: "BUDGET ESTIMATE",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: formatCurrency(safeProposal.budgetEstimate),
            bold: true,
            size: 28,
            color: "3B82F6"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
    
    // Notes section
    if (safeProposal.notes) {
      sections.push(
        new Paragraph({
          text: "NOTES",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 400, after: 200 }
        })
      );
      
      // Process notes content with tables
      const notesContent = processContentWithTables(safeProposal.notes);
      sections.push(...notesContent);
    }
    
    // Terms section
    if (safeProposal.terms) {
      sections.push(
        new Paragraph({
          text: "TERMS AND CONDITIONS",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 400, after: 200 }
        })
      );
      
      // Process terms content with tables
      const termsContent = processContentWithTables(safeProposal.terms);
      sections.push(...termsContent);
    }
    
    console.log('Creating document with sections');
    
    // Create document with all sections
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections
        }
      ]
    });
    
    console.log('Packing document to buffer');
    
    // Create a buffer with the Word document content
    const buffer = await Packer.toBuffer(doc);
    
    console.log('Document generation complete');
    
    return buffer;
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
};
