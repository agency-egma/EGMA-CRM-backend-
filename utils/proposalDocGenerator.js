import { Document, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, 
  BorderStyle, HeadingLevel, WidthType, TableLayoutType, UnderlineType, NumberFormat, Packer } from 'docx';
import { stripHtml } from 'string-strip-html';

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
  
  // Check if content contains HTML
  if (htmlContent.includes('<') && htmlContent.includes('>')) {
    return stripHtml(htmlContent).result;
  }
  
  return htmlContent;
};

/**
 * Generate Word Document from proposal data
 * @param {Object} proposal - Proposal data
 * @returns {Buffer} - Word document buffer
 */
export const generateProposalDOC = async (proposal) => {
  try {
    // Create a clean copy of the proposal data
    const safeProposal = JSON.parse(JSON.stringify(proposal));
    
    // Clean HTML content in text fields
    safeProposal.description = cleanHtml(safeProposal.description);
    safeProposal.scope = cleanHtml(safeProposal.scope);
    safeProposal.timeline = cleanHtml(safeProposal.timeline);
    safeProposal.terms = cleanHtml(safeProposal.terms);
    safeProposal.notes = cleanHtml(safeProposal.notes);
    
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
      }),
      new Paragraph({
        text: safeProposal.description,
        spacing: { after: 400 }
      })
    );
    
    // Scope
    sections.push(
      new Paragraph({
        text: "SCOPE",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        text: safeProposal.scope,
        spacing: { after: 400 }
      })
    );
    
    // Timeline
    sections.push(
      new Paragraph({
        text: "TIMELINE",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        text: safeProposal.timeline,
        spacing: { after: 400 }
      })
    );
    
    // Deliverables
    sections.push(
      new Paragraph({
        text: "DELIVERABLES",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 200 }
      })
    );
    
    // Add deliverables as bullet points
    safeProposal.deliverables.forEach(deliverable => {
      sections.push(
        new Paragraph({
          text: deliverable,
          bullet: {
            level: 0
          },
          spacing: { after: 100 }
        })
      );
    });
    
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
        }),
        new Paragraph({
          text: safeProposal.notes,
          spacing: { after: 400 }
        })
      );
    }
    
    // Terms section
    if (safeProposal.terms) {
      sections.push(
        new Paragraph({
          text: "TERMS AND CONDITIONS",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          text: safeProposal.terms,
          spacing: { after: 200 }
        })
      );
    }
    
    // Create document with all sections
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections
        }
      ]
    });
    
    // Create a buffer with the Word document content - FIXED LINE
    const buffer = await Packer.toBuffer(doc);
    
    return buffer;
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error(`Failed to generate Word document: ${error.message}`);
  }
};
