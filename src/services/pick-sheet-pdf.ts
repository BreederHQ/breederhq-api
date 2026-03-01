// src/services/pick-sheet-pdf.ts
/**
 * Pick Sheet PDF Builder
 *
 * Generates printable pick sheets for breeding plan buyers.
 * Each buyer gets a page showing available offspring with space to rank preferences.
 * Follows the same pattern as invoice-pdf-builder.ts (uses pdf-lib).
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface PickSheetOffspring {
  id: number;
  name: string | null;
  sex: string | null;
  collarColorName: string | null;
  collarColorHex: string | null;
  photoUrl: string | null;
}

export interface PickSheetBuyer {
  buyerId: number;
  buyerName: string;
  pickNumber: number;
  totalPicks: number;
}

export interface PickSheetData {
  planName: string;
  damName: string | null;
  sireName: string | null;
  breederName: string;
  buyer: PickSheetBuyer;
  offspring: PickSheetOffspring[];
  generatedAt: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 14;
const FONT_SIZE = 10;
const SMALL_FONT = 8;
const HEADING_SIZE = 18;

const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.25, 0.25, 0.25);
const MID_GRAY = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);
const BRAND_ORANGE = rgb(0.976, 0.451, 0.086); // #f97316

// Offspring card layout
const CARDS_PER_ROW = 3;
const CARD_GAP = 12;
const CARD_WIDTH = (CONTENT_WIDTH - CARD_GAP * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW;
const CARD_HEIGHT = 120;
const PHOTO_SIZE = 50;

// ────────────────────────────────────────────────────────────────────────────
// Drawing Context
// ────────────────────────────────────────────────────────────────────────────

interface DrawContext {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function ensureSpace(ctx: DrawContext, needed: number): void {
  if (ctx.y - needed < MARGIN + 40) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main Export
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a single pick sheet PDF buffer for one buyer.
 */
export async function buildPickSheetPdf(data: PickSheetData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx: DrawContext = {
    doc: pdfDoc,
    regular,
    bold,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  // ── Header ──
  drawHeader(ctx, data);

  // ── Buyer Info ──
  drawBuyerInfo(ctx, data);

  // ── Offspring Grid ──
  drawOffspringGrid(ctx, data.offspring);

  // ── Ranking Guidance ──
  drawRankingGuidance(ctx, data.buyer);

  // ── Notes Area ──
  drawNotesArea(ctx);

  // ── Footer on all pages ──
  drawFooterOnAllPages(ctx);

  // Metadata
  pdfDoc.setTitle(`Pick Sheet - ${data.buyer.buyerName} - ${data.planName}`);
  pdfDoc.setCreator("BreederHQ");
  pdfDoc.setProducer("BreederHQ");
  pdfDoc.setCreationDate(data.generatedAt);

  return pdfDoc.save();
}

/**
 * Build pick sheets for multiple buyers into a single combined PDF.
 */
export async function buildCombinedPickSheetsPdf(
  sheets: PickSheetData[]
): Promise<Uint8Array> {
  if (sheets.length === 0) {
    throw new Error("No pick sheet data provided");
  }

  // Build each sheet individually, then merge into one PDF
  const combinedDoc = await PDFDocument.create();

  for (const sheet of sheets) {
    const sheetBytes = await buildPickSheetPdf(sheet);
    const sheetDoc = await PDFDocument.load(sheetBytes);
    const copiedPages = await combinedDoc.copyPages(
      sheetDoc,
      sheetDoc.getPageIndices()
    );
    for (const page of copiedPages) {
      combinedDoc.addPage(page);
    }
  }

  combinedDoc.setTitle(`Pick Sheets - ${sheets[0].planName}`);
  combinedDoc.setCreator("BreederHQ");
  combinedDoc.setProducer("BreederHQ");
  combinedDoc.setCreationDate(new Date());

  return combinedDoc.save();
}

// ────────────────────────────────────────────────────────────────────────────
// Section Drawers
// ────────────────────────────────────────────────────────────────────────────

function drawHeader(ctx: DrawContext, data: PickSheetData): void {
  // Breeder name (left)
  drawText(ctx.page, data.breederName, MARGIN, ctx.y, ctx.bold, 12, DARK_GRAY);

  // "PICK SHEET" (right-aligned)
  const label = "PICK SHEET";
  const labelWidth = ctx.bold.widthOfTextAtSize(label, HEADING_SIZE);
  drawText(ctx.page, label, PAGE_WIDTH - MARGIN - labelWidth, ctx.y, ctx.bold, HEADING_SIZE, BRAND_ORANGE);

  ctx.y -= 18;

  // Plan name
  drawText(ctx.page, data.planName, MARGIN, ctx.y, ctx.bold, 14, BLACK);
  ctx.y -= 16;

  // Dam × Sire
  const parentLine = buildParentLine(data.damName, data.sireName);
  if (parentLine) {
    drawText(ctx.page, parentLine, MARGIN, ctx.y, ctx.regular, FONT_SIZE, MID_GRAY);
    ctx.y -= LINE_HEIGHT;
  }

  ctx.y -= 6;

  // Divider
  drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, BRAND_ORANGE, 1.5);
  ctx.y -= 16;
}

function drawBuyerInfo(ctx: DrawContext, data: PickSheetData): void {
  const { buyer } = data;

  // Buyer name row
  drawText(ctx.page, "Buyer:", MARGIN, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
  drawText(ctx.page, buyer.buyerName, MARGIN + 45, ctx.y, ctx.regular, FONT_SIZE, BLACK);

  // Pick position (right side)
  const pickText = `Pick ${buyer.pickNumber} of ${buyer.totalPicks}`;
  const pickWidth = ctx.bold.widthOfTextAtSize(pickText, 12);
  drawText(ctx.page, pickText, PAGE_WIDTH - MARGIN - pickWidth, ctx.y, ctx.bold, 12, BRAND_ORANGE);

  ctx.y -= LINE_HEIGHT + 2;

  // Available offspring count
  const countText = `${data.offspring.length} offspring available for selection`;
  drawText(ctx.page, countText, MARGIN, ctx.y, ctx.regular, FONT_SIZE, MID_GRAY);

  ctx.y -= LINE_HEIGHT + 10;
}

function drawOffspringGrid(ctx: DrawContext, offspring: PickSheetOffspring[]): void {
  if (offspring.length === 0) {
    drawText(ctx.page, "No offspring available.", MARGIN, ctx.y, ctx.regular, FONT_SIZE, MID_GRAY);
    ctx.y -= LINE_HEIGHT + 10;
    return;
  }

  // Section heading
  drawText(ctx.page, "AVAILABLE OFFSPRING", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 6;

  // Draw offspring in rows of CARDS_PER_ROW
  for (let i = 0; i < offspring.length; i += CARDS_PER_ROW) {
    ensureSpace(ctx, CARD_HEIGHT + 10);

    const rowOffspring = offspring.slice(i, i + CARDS_PER_ROW);
    const rowTopY = ctx.y;

    for (let j = 0; j < rowOffspring.length; j++) {
      const o = rowOffspring[j];
      const cardX = MARGIN + j * (CARD_WIDTH + CARD_GAP);

      drawOffspringCard(ctx, o, cardX, rowTopY);
    }

    ctx.y = rowTopY - CARD_HEIGHT - 8;
  }
}

function drawOffspringCard(
  ctx: DrawContext,
  offspring: PickSheetOffspring,
  x: number,
  topY: number
): void {
  const cardBottomY = topY - CARD_HEIGHT;

  // Card border
  ctx.page.drawRectangle({
    x,
    y: cardBottomY,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderColor: LIGHT_GRAY,
    borderWidth: 0.75,
  });

  let innerY = topY - 12;

  // Photo placeholder area (square, top-left of card)
  const photoX = x + 8;
  const photoY = innerY - PHOTO_SIZE;
  ctx.page.drawRectangle({
    x: photoX,
    y: photoY,
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
    color: rgb(0.96, 0.96, 0.96),
  });

  // "Photo" label in placeholder
  const photoLabel = "Photo";
  const photoLabelWidth = ctx.regular.widthOfTextAtSize(photoLabel, 7);
  drawText(
    ctx.page,
    photoLabel,
    photoX + (PHOTO_SIZE - photoLabelWidth) / 2,
    photoY + PHOTO_SIZE / 2 - 3,
    ctx.regular,
    7,
    MID_GRAY
  );

  // Info to the right of photo
  const infoX = photoX + PHOTO_SIZE + 8;
  const infoWidth = CARD_WIDTH - PHOTO_SIZE - 24;

  // Name (bold)
  const displayName = offspring.name || `Offspring #${offspring.id}`;
  const truncName = truncateText(displayName, ctx.bold, FONT_SIZE, infoWidth);
  drawText(ctx.page, truncName, infoX, innerY, ctx.bold, FONT_SIZE, BLACK);
  innerY -= LINE_HEIGHT;

  // Sex
  const sexLabel = formatSex(offspring.sex);
  drawText(ctx.page, sexLabel, infoX, innerY, ctx.regular, SMALL_FONT, DARK_GRAY);
  innerY -= LINE_HEIGHT - 2;

  // Collar color (with color swatch if hex available)
  if (offspring.collarColorName) {
    if (offspring.collarColorHex) {
      const swatchColor = hexToRgb(offspring.collarColorHex);
      if (swatchColor) {
        ctx.page.drawRectangle({
          x: infoX,
          y: innerY - 2,
          width: 8,
          height: 8,
          color: swatchColor,
          borderColor: DARK_GRAY,
          borderWidth: 0.3,
        });
        drawText(ctx.page, offspring.collarColorName, infoX + 12, innerY, ctx.regular, SMALL_FONT, DARK_GRAY);
      } else {
        drawText(ctx.page, offspring.collarColorName, infoX, innerY, ctx.regular, SMALL_FONT, DARK_GRAY);
      }
    } else {
      drawText(ctx.page, offspring.collarColorName, infoX, innerY, ctx.regular, SMALL_FONT, DARK_GRAY);
    }
  }

  // Rank line at bottom of card
  const rankY = cardBottomY + 10;
  drawText(ctx.page, "My Rank:", x + 8, rankY, ctx.bold, SMALL_FONT, DARK_GRAY);
  // Blank line for writing
  drawLine(ctx.page, x + 52, rankY - 1, x + CARD_WIDTH - 8, rankY - 1, MID_GRAY, 0.5);
}

function drawRankingGuidance(ctx: DrawContext, buyer: PickSheetBuyer): void {
  ensureSpace(ctx, 60);

  ctx.y -= 6;
  drawText(ctx.page, "RANKING GUIDANCE", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 4;

  // Background box
  const lines = [
    `As pick #${buyer.pickNumber}, we recommend ranking at least ${getRecommendedDepth(buyer.pickNumber, buyer.totalPicks)} offspring.`,
    "Rank 1 = your top choice. Higher numbers = fallback choices.",
    "Your final placement depends on availability after earlier picks.",
  ];

  const boxHeight = lines.length * (LINE_HEIGHT + 2) + 12;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - boxHeight + LINE_HEIGHT + 4,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
  });

  for (const line of lines) {
    drawText(ctx.page, `  ${line}`, MARGIN + 6, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
    ctx.y -= LINE_HEIGHT + 2;
  }

  ctx.y -= 10;
}

function drawNotesArea(ctx: DrawContext): void {
  ensureSpace(ctx, 100);

  drawText(ctx.page, "NOTES", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 6;

  // Draw 5 blank lines for notes
  for (let i = 0; i < 5; i++) {
    drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, LIGHT_GRAY, 0.5);
    ctx.y -= LINE_HEIGHT + 4;
  }

  ctx.y -= 10;
}

function drawFooterOnAllPages(ctx: DrawContext): void {
  const pages = ctx.doc.getPages();
  const footerText = `Generated by BreederHQ  |  ${new Date().toLocaleDateString("en-US")}`;
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    drawText(page, footerText, MARGIN, 25, ctx.regular, 7, MID_GRAY);
    const pageNum = `Page ${i + 1} of ${totalPages}`;
    const pageNumWidth = ctx.regular.widthOfTextAtSize(pageNum, 7);
    drawText(page, pageNum, PAGE_WIDTH - MARGIN - pageNumWidth, 25, ctx.regular, 7, MID_GRAY);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Drawing Helpers
// ────────────────────────────────────────────────────────────────────────────

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK
): void {
  page.drawText(text, { x, y, size, font, color });
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = MID_GRAY,
  thickness = 0.5
): void {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Formatters & Helpers
// ────────────────────────────────────────────────────────────────────────────

function buildParentLine(damName: string | null, sireName: string | null): string | null {
  if (damName && sireName) return `${damName}  ×  ${sireName}`;
  if (damName) return `Dam: ${damName}`;
  if (sireName) return `Sire: ${sireName}`;
  return null;
}

function formatSex(sex: string | null): string {
  if (!sex) return "Sex: Unknown";
  switch (sex.toUpperCase()) {
    case "MALE":
    case "M":
      return "Male";
    case "FEMALE":
    case "F":
      return "Female";
    default:
      return `Sex: ${sex}`;
  }
}

function getRecommendedDepth(pickNumber: number, totalPicks: number): number {
  // Recommend ranking more offspring the later your pick number
  // Pick 1: rank at least 2 (have a backup)
  // Pick 2-3: rank at least 3
  // Later picks: rank most/all available
  if (pickNumber <= 1) return Math.min(2, totalPicks);
  if (pickNumber <= 3) return Math.min(3, totalPicks);
  return Math.min(pickNumber + 1, totalPicks);
}

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + "...", size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

function hexToRgb(hex: string): ReturnType<typeof rgb> | null {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return rgb(r / 255, g / 255, b / 255);
}
