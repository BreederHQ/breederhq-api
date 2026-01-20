// src/services/contracts/pdf-generator/contract-pdf-builder.ts
/**
 * Contract PDF Builder
 *
 * Generates PDF documents from HTML contract content with embedded signatures.
 * Uses pdf-lib for PDF generation with no binary dependencies.
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, degrees } from "pdf-lib";
import prisma from "../../../prisma.js";
import { createAuditFooter, formatAuditFooterText, type AuditFooterData } from "./audit-footer.js";
import { embedSignatureImage, generateTypedSignatureText } from "./signature-embedder.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface SignaturePosition {
  partyId: number;
  partyName: string;
  signatureType: string;
  signatureData?: string; // Base64 image for drawn/uploaded
  typedName?: string;
  signedAt: Date;
}

interface PdfGenerationOptions {
  includeAuditTrail?: boolean;
  watermark?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612; // US Letter width in points
const PAGE_HEIGHT = 792; // US Letter height in points
const MARGIN = 50;
const LINE_HEIGHT = 14;
const FONT_SIZE = 11;
const HEADING_SIZE = 16;

// ────────────────────────────────────────────────────────────────────────────
// Main Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate a signed PDF for a contract
 */
export async function generateContractPdf(
  contractId: number,
  tenantId: number,
  options: PdfGenerationOptions = {}
): Promise<{ buffer: Uint8Array; filename: string }> {
  // Fetch contract with all related data
  const contract = await prisma.contract.findUnique({
    where: { id: contractId, tenantId },
    include: {
      content: true,
      parties: {
        include: {
          party: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  if (!contract.content) {
    throw new Error("Contract content not rendered");
  }

  // Fetch signature events for audit trail
  const events = await prisma.signatureEvent.findMany({
    where: { contractId, tenantId },
    include: {
      party: {
        select: { name: true, email: true },
      },
    },
    orderBy: { at: "asc" },
  });

  // Get signature data for each signed party
  const signatures: SignaturePosition[] = contract.parties
    .filter((cp) => cp.status === "signed" && cp.signedAt)
    .map((cp) => ({
      partyId: cp.id,
      partyName: cp.name || "Party",
      signatureType: (cp.signatureData as any)?.type || "typed",
      signatureData: (cp.signatureData as any)?.imageData,
      typedName: (cp.signatureData as any)?.typedName || cp.name || "Party",
      signedAt: cp.signedAt!,
    }));

  // Generate PDF
  const buffer = await generateContractPdfBuffer(
    contract.title,
    contract.content.renderedHtml,
    signatures,
    options.includeAuditTrail !== false
      ? createAuditFooter(contractId, contract.title, events)
      : undefined,
    options.watermark
  );

  // Generate filename
  const sanitizedTitle = contract.title.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);
  const filename = `${sanitizedTitle}-signed-${contractId}.pdf`;

  return { buffer, filename };
}

/**
 * Generate PDF buffer from contract content
 */
export async function generateContractPdfBuffer(
  title: string,
  htmlContent: string,
  signatures: SignaturePosition[],
  auditData?: AuditFooterData,
  watermark?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Convert HTML to text content (simplified parsing)
  const textContent = htmlToText(htmlContent);

  // Render content to pages
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPosition = PAGE_HEIGHT - MARGIN;

  const lines = textContent.split("\n");

  for (const line of lines) {
    // Check if we need a new page
    if (yPosition < MARGIN + 100) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    // Detect headings and style accordingly
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("# ")) {
      // H1 heading
      yPosition -= 10; // Extra space before heading
      drawText(currentPage, trimmedLine.substring(2), MARGIN, yPosition, boldFont, HEADING_SIZE);
      yPosition -= HEADING_SIZE + 8;
    } else if (trimmedLine.startsWith("## ")) {
      // H2 heading
      yPosition -= 8;
      drawText(currentPage, trimmedLine.substring(3), MARGIN, yPosition, boldFont, 14);
      yPosition -= 14 + 6;
    } else if (trimmedLine.startsWith("### ")) {
      // H3 heading
      yPosition -= 6;
      drawText(currentPage, trimmedLine.substring(4), MARGIN, yPosition, boldFont, 12);
      yPosition -= 12 + 4;
    } else if (trimmedLine === "---" || trimmedLine === "───") {
      // Horizontal rule
      yPosition -= 10;
      drawLine(currentPage, MARGIN, yPosition, PAGE_WIDTH - MARGIN, yPosition);
      yPosition -= 10;
    } else if (trimmedLine.startsWith("• ") || trimmedLine.startsWith("- ")) {
      // List item
      drawText(currentPage, `  • ${trimmedLine.substring(2)}`, MARGIN, yPosition, regularFont, FONT_SIZE);
      yPosition -= LINE_HEIGHT;
    } else if (trimmedLine.length > 0) {
      // Regular text - wrap lines
      const wrappedLines = wrapText(trimmedLine, regularFont, FONT_SIZE, PAGE_WIDTH - MARGIN * 2);
      for (const wrappedLine of wrappedLines) {
        if (yPosition < MARGIN + 50) {
          currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          yPosition = PAGE_HEIGHT - MARGIN;
        }
        drawText(currentPage, wrappedLine, MARGIN, yPosition, regularFont, FONT_SIZE);
        yPosition -= LINE_HEIGHT;
      }
    } else {
      // Empty line
      yPosition -= LINE_HEIGHT / 2;
    }
  }

  // Add signature section
  yPosition -= 30;
  if (yPosition < MARGIN + 200) {
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    yPosition = PAGE_HEIGHT - MARGIN;
  }

  // Draw signatures
  for (const sig of signatures) {
    if (yPosition < MARGIN + 100) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPosition = PAGE_HEIGHT - MARGIN;
    }

    // Signature label
    drawText(currentPage, `${sig.partyName}:`, MARGIN, yPosition, boldFont, FONT_SIZE);
    yPosition -= 20;

    // Signature line
    drawLine(currentPage, MARGIN, yPosition, MARGIN + 250, yPosition);
    yPosition -= 5;

    if (sig.signatureType === "drawn" && sig.signatureData) {
      // Embed drawn signature image
      try {
        await embedSignatureImage(pdfDoc, sig.signatureData, {
          pageIndex: pdfDoc.getPageCount() - 1,
          x: MARGIN,
          y: yPosition - 50,
          maxWidth: 200,
          maxHeight: 50,
        });
        yPosition -= 55;
      } catch (error) {
        // Fallback to typed name if image fails
        drawText(currentPage, sig.typedName || sig.partyName, MARGIN + 10, yPosition + 10, italicFont, 14);
      }
    } else {
      // Typed signature - render in italic/script style
      drawText(currentPage, sig.typedName || sig.partyName, MARGIN + 10, yPosition + 10, italicFont, 14);
    }

    // Signed date
    yPosition -= 15;
    drawText(
      currentPage,
      `Signed: ${sig.signedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      MARGIN,
      yPosition,
      regularFont,
      9
    );
    yPosition -= 40;
  }

  // Add audit trail if provided
  if (auditData) {
    // New page for audit trail
    currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    yPosition = PAGE_HEIGHT - MARGIN;

    const auditText = formatAuditFooterText(auditData);
    const auditLines = auditText.split("\n");
    const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

    for (const line of auditLines) {
      if (yPosition < MARGIN) {
        currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        yPosition = PAGE_HEIGHT - MARGIN;
      }
      drawText(currentPage, line, MARGIN, yPosition, monoFont, 8);
      yPosition -= 10;
    }
  }

  // Add watermark if provided
  if (watermark) {
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(watermark, {
        x: width / 2 - 100,
        y: height / 2,
        size: 50,
        font: boldFont,
        color: rgb(0.9, 0.9, 0.9),
        rotate: degrees(-45),
        opacity: 0.3,
      });
    }
  }

  // Add document metadata
  pdfDoc.setTitle(title);
  pdfDoc.setCreator("BreederHQ E-Signatures");
  pdfDoc.setProducer("BreederHQ");
  pdfDoc.setCreationDate(new Date());

  return pdfDoc.save();
}

// ────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert HTML to plain text with markdown-style formatting
 */
function htmlToText(html: string): string {
  let text = html;

  // Remove style and script tags
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Convert headings
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n");

  // Convert horizontal rules
  text = text.replace(/<hr\s*\/?>/gi, "---\n");

  // Convert line breaks and paragraphs
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<p[^>]*>/gi, "");

  // Convert list items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "• $1\n");
  text = text.replace(/<\/?ul[^>]*>/gi, "\n");
  text = text.replace(/<\/?ol[^>]*>/gi, "\n");

  // Convert table cells (simplified)
  text = text.replace(/<td[^>]*>(.*?)<\/td>/gi, "$1  ");
  text = text.replace(/<th[^>]*>(.*?)<\/th>/gi, "$1  ");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/?table[^>]*>/gi, "\n");
  text = text.replace(/<\/?tr[^>]*>/gi, "");
  text = text.replace(/<\/?thead[^>]*>/gi, "");
  text = text.replace(/<\/?tbody[^>]*>/gi, "");

  // Handle bold and strong
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "$1");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "$1");

  // Handle emphasis
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "$1");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "$1");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

/**
 * Draw text on a PDF page
 */
function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number
): void {
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

/**
 * Draw a line on a PDF page
 */
function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Wrap text to fit within a maximum width
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
