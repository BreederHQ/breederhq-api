// src/services/finance/invoice-pdf-builder.ts
/**
 * Invoice PDF Builder
 *
 * Generates PDF invoices using pdf-lib for manual (non-Stripe) invoices.
 * Follows the same pattern as contract-pdf-builder.ts.
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import prisma from "../../prisma.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface InvoicePdfData {
  invoiceNumber: string;
  currency: string;
  amountCents: number;
  balanceCents: number;
  status: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  notes: string | null;
  paymentInstructions: string | null;

  tenant: {
    name: string;
    primaryEmail: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  };

  client: {
    name: string;
    email: string | null;
    street: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;

  lineItems: Array<{
    description: string;
    qty: number;
    unitCents: number;
    totalCents: number;
  }>;

  payments: Array<{
    amountCents: number;
    receivedAt: Date;
    methodType: string | null;
    status: string;
  }>;
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
const HEADING_SIZE = 20;

const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.25, 0.25, 0.25);
const MID_GRAY = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);
const BRAND_ORANGE = rgb(0.976, 0.451, 0.086); // #f97316

// ────────────────────────────────────────────────────────────────────────────
// Main Export
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate an invoice PDF from database data.
 */
export async function generateInvoicePdf(
  invoiceId: number,
  tenantId: number
): Promise<{ buffer: Uint8Array; filename: string }> {
  // NOTE: paymentInstructions + invoicingMode are added via pending migration.
  // Once migration is applied and `prisma generate` run, remove the `as any` casts.
  const invoice: any = await prisma.invoice.findUnique({
    where: { id: invoiceId, tenantId },
    include: {
      tenant: {
        select: {
          name: true,
          primaryEmail: true,
          city: true,
          region: true,
          country: true,
        },
      },
      clientParty: {
        select: {
          name: true,
          email: true,
          street: true,
          street2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
      LineItems: {
        select: {
          description: true,
          qty: true,
          unitCents: true,
          totalCents: true,
        },
        orderBy: { createdAt: "asc" },
      },
      Payments: {
        where: { status: "succeeded" },
        select: {
          amountCents: true,
          receivedAt: true,
          methodType: true,
          status: true,
        },
        orderBy: { receivedAt: "asc" },
      },
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    amountCents: Number(invoice.amountCents),
    balanceCents: Number(invoice.balanceCents),
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt,
    notes: invoice.notes,
    paymentInstructions: invoice.tenant?.paymentInstructions ?? null,
    tenant: {
      name: invoice.tenant.name,
      primaryEmail: invoice.tenant.primaryEmail,
      city: invoice.tenant.city,
      region: invoice.tenant.region,
      country: invoice.tenant.country,
    },
    client: invoice.clientParty
      ? {
          name: invoice.clientParty.name,
          email: invoice.clientParty.email,
          street: invoice.clientParty.street,
          street2: invoice.clientParty.street2,
          city: invoice.clientParty.city,
          state: invoice.clientParty.state,
          postalCode: invoice.clientParty.postalCode,
          country: invoice.clientParty.country,
        }
      : null,
    lineItems: invoice.LineItems.map((li: any) => ({
      description: li.description,
      qty: li.qty,
      unitCents: li.unitCents,
      totalCents: li.totalCents,
    })),
    payments: invoice.Payments.map((p: any) => ({
      amountCents: Number(p.amountCents),
      receivedAt: p.receivedAt,
      methodType: p.methodType,
      status: p.status,
    })),
  };

  const buffer = await buildInvoicePdfBuffer(data);
  const sanitized = invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "_");
  const filename = `Invoice-${sanitized}.pdf`;

  return { buffer, filename };
}

// ────────────────────────────────────────────────────────────────────────────
// PDF Buffer Builder
// ────────────────────────────────────────────────────────────────────────────

async function buildInvoicePdfBuffer(data: InvoicePdfData): Promise<Uint8Array> {
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

  // ── Invoice Details (dates, status) ──
  drawInvoiceInfo(ctx, data);

  // ── Bill To ──
  drawBillTo(ctx, data);

  // ── Line Items Table ──
  drawLineItemsTable(ctx, data);

  // ── Summary (subtotal, paid, balance) ──
  drawSummary(ctx, data);

  // ── Payment History ──
  if (data.payments.length > 0) {
    drawPaymentHistory(ctx, data);
  }

  // ── Payment Instructions ──
  if (data.paymentInstructions) {
    drawPaymentInstructions(ctx, data.paymentInstructions);
  }

  // ── Notes ──
  if (data.notes) {
    drawNotes(ctx, data.notes);
  }

  // ── Footer on all pages ──
  drawFooterOnAllPages(ctx);

  // Metadata
  pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
  pdfDoc.setCreator("BreederHQ Invoicing");
  pdfDoc.setProducer("BreederHQ");
  pdfDoc.setCreationDate(new Date());

  return pdfDoc.save();
}

// ────────────────────────────────────────────────────────────────────────────
// Section Drawers
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

function drawHeader(ctx: DrawContext, data: InvoicePdfData): void {
  // Breeder name (left)
  drawText(ctx.page, data.tenant.name, MARGIN, ctx.y, ctx.bold, 14, BLACK);

  // "INVOICE" (right-aligned)
  const invoiceLabel = "INVOICE";
  const labelWidth = ctx.bold.widthOfTextAtSize(invoiceLabel, HEADING_SIZE);
  drawText(ctx.page, invoiceLabel, PAGE_WIDTH - MARGIN - labelWidth, ctx.y, ctx.bold, HEADING_SIZE, BRAND_ORANGE);

  ctx.y -= 16;

  // Breeder contact
  const tenantLines: string[] = [];
  if (data.tenant.primaryEmail) tenantLines.push(data.tenant.primaryEmail);
  const locationParts: string[] = [];
  if (data.tenant.city) locationParts.push(data.tenant.city);
  if (data.tenant.region) locationParts.push(data.tenant.region);
  if (data.tenant.country) locationParts.push(data.tenant.country);
  if (locationParts.length > 0) tenantLines.push(locationParts.join(", "));

  for (const line of tenantLines) {
    drawText(ctx.page, line, MARGIN, ctx.y, ctx.regular, SMALL_FONT, MID_GRAY);
    ctx.y -= 11;
  }

  ctx.y -= 10;

  // Divider
  drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, BRAND_ORANGE, 1.5);
  ctx.y -= 20;
}

function drawInvoiceInfo(ctx: DrawContext, data: InvoicePdfData): void {
  const leftCol = MARGIN;
  const rightCol = PAGE_WIDTH / 2 + 30;

  const rows: Array<[string, string, string, string]> = [
    ["Invoice #:", data.invoiceNumber, "Status:", formatStatus(data.status)],
  ];

  if (data.issuedAt) {
    rows.push(["Issued:", formatDate(data.issuedAt), "", ""]);
  }
  if (data.dueAt) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow[2]) {
      lastRow[2] = "Due:";
      lastRow[3] = formatDate(data.dueAt);
    } else {
      rows.push(["Due:", formatDate(data.dueAt), "", ""]);
    }
  }
  if (data.paidAt) {
    rows.push(["Paid:", formatDate(data.paidAt), "", ""]);
  }

  for (const [lLabel, lValue, rLabel, rValue] of rows) {
    drawText(ctx.page, lLabel, leftCol, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
    drawText(ctx.page, lValue, leftCol + 60, ctx.y, ctx.regular, FONT_SIZE, BLACK);
    if (rLabel) {
      drawText(ctx.page, rLabel, rightCol, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
      drawText(ctx.page, rValue, rightCol + 60, ctx.y, ctx.regular, FONT_SIZE, BLACK);
    }
    ctx.y -= LINE_HEIGHT + 2;
  }

  ctx.y -= 10;
}

function drawBillTo(ctx: DrawContext, data: InvoicePdfData): void {
  if (!data.client) return;

  drawText(ctx.page, "BILL TO", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 2;

  drawText(ctx.page, data.client.name, MARGIN, ctx.y, ctx.bold, FONT_SIZE, BLACK);
  ctx.y -= LINE_HEIGHT;

  if (data.client.email) {
    drawText(ctx.page, data.client.email, MARGIN, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
    ctx.y -= LINE_HEIGHT;
  }

  const addressLines = buildAddressLines(data.client);
  for (const line of addressLines) {
    drawText(ctx.page, line, MARGIN, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
    ctx.y -= LINE_HEIGHT;
  }

  ctx.y -= 10;
}

function drawLineItemsTable(ctx: DrawContext, data: InvoicePdfData): void {
  const colDesc = MARGIN;
  const colQty = PAGE_WIDTH - MARGIN - 200;
  const colUnit = PAGE_WIDTH - MARGIN - 130;
  const colTotal = PAGE_WIDTH - MARGIN - 60;

  ensureSpace(ctx, 60);

  // Table header
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 4,
    width: CONTENT_WIDTH,
    height: LINE_HEIGHT + 6,
    color: rgb(0.95, 0.95, 0.95),
  });

  drawText(ctx.page, "Description", colDesc + 4, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
  drawTextRight(ctx.page, "Qty", colQty + 30, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
  drawTextRight(ctx.page, "Unit Price", colUnit + 50, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
  drawTextRight(ctx.page, "Total", colTotal + 50, ctx.y, ctx.bold, FONT_SIZE, DARK_GRAY);
  ctx.y -= LINE_HEIGHT + 8;

  // Table rows
  if (data.lineItems.length === 0) {
    drawText(ctx.page, "(No line items)", colDesc + 4, ctx.y, ctx.regular, FONT_SIZE, MID_GRAY);
    ctx.y -= LINE_HEIGHT + 4;
  } else {
    for (const item of data.lineItems) {
      ensureSpace(ctx, LINE_HEIGHT + 6);

      // Wrap long descriptions
      const descLines = wrapText(item.description, ctx.regular, FONT_SIZE, colQty - colDesc - 20);
      const firstLine = descLines[0] || item.description;
      drawText(ctx.page, firstLine, colDesc + 4, ctx.y, ctx.regular, FONT_SIZE, BLACK);
      drawTextRight(ctx.page, String(item.qty), colQty + 30, ctx.y, ctx.regular, FONT_SIZE, BLACK);
      drawTextRight(ctx.page, formatMoney(item.unitCents, data.currency), colUnit + 50, ctx.y, ctx.regular, FONT_SIZE, BLACK);
      drawTextRight(ctx.page, formatMoney(item.totalCents, data.currency), colTotal + 50, ctx.y, ctx.regular, FONT_SIZE, BLACK);
      ctx.y -= LINE_HEIGHT + 2;

      // Additional wrapped lines for long descriptions
      for (let i = 1; i < descLines.length; i++) {
        ensureSpace(ctx, LINE_HEIGHT);
        drawText(ctx.page, descLines[i], colDesc + 4, ctx.y, ctx.regular, FONT_SIZE, BLACK);
        ctx.y -= LINE_HEIGHT;
      }

      // Row separator
      drawLine(ctx.page, MARGIN, ctx.y + 2, PAGE_WIDTH - MARGIN, ctx.y + 2, LIGHT_GRAY, 0.5);
      ctx.y -= 4;
    }
  }

  ctx.y -= 6;
}

function drawSummary(ctx: DrawContext, data: InvoicePdfData): void {
  ensureSpace(ctx, 80);

  const labelX = PAGE_WIDTH - MARGIN - 180;
  const valueX = PAGE_WIDTH - MARGIN - 10;
  const totalPaid = data.payments.reduce((sum, p) => sum + p.amountCents, 0);

  // Subtotal
  drawText(ctx.page, "Subtotal:", labelX, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
  drawTextRight(ctx.page, formatMoney(data.amountCents, data.currency), valueX, ctx.y, ctx.regular, FONT_SIZE, BLACK);
  ctx.y -= LINE_HEIGHT + 4;

  // Total paid
  if (totalPaid > 0) {
    drawText(ctx.page, "Amount Paid:", labelX, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
    drawTextRight(ctx.page, `- ${formatMoney(totalPaid, data.currency)}`, valueX, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.6, 0.2));
    ctx.y -= LINE_HEIGHT + 4;
  }

  // Divider before balance
  drawLine(ctx.page, labelX, ctx.y + 4, PAGE_WIDTH - MARGIN, ctx.y + 4, DARK_GRAY, 0.5);
  ctx.y -= 4;

  // Balance due
  const isFullyPaid = data.balanceCents <= 0;
  const balanceLabel = isFullyPaid ? "PAID IN FULL" : "Balance Due:";
  const balanceColor = isFullyPaid ? rgb(0.2, 0.6, 0.2) : BRAND_ORANGE;

  drawText(ctx.page, balanceLabel, labelX, ctx.y, ctx.bold, 12, balanceColor);
  if (!isFullyPaid) {
    drawTextRight(ctx.page, formatMoney(data.balanceCents, data.currency), valueX, ctx.y, ctx.bold, 12, balanceColor);
  }
  ctx.y -= 24;
}

function drawPaymentHistory(ctx: DrawContext, data: InvoicePdfData): void {
  ensureSpace(ctx, 40 + data.payments.length * (LINE_HEIGHT + 2));

  drawText(ctx.page, "PAYMENT HISTORY", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 4;

  for (const p of data.payments) {
    ensureSpace(ctx, LINE_HEIGHT + 4);
    const dateStr = formatDate(p.receivedAt);
    const method = p.methodType ? ` (${p.methodType})` : "";
    drawText(ctx.page, `${dateStr}${method}`, MARGIN + 8, ctx.y, ctx.regular, SMALL_FONT, DARK_GRAY);
    drawTextRight(ctx.page, formatMoney(p.amountCents, data.currency), PAGE_WIDTH - MARGIN - 10, ctx.y, ctx.regular, SMALL_FONT, BLACK);
    ctx.y -= LINE_HEIGHT;
  }

  ctx.y -= 10;
}

function drawPaymentInstructions(ctx: DrawContext, instructions: string): void {
  const lines = wrapText(instructions, ctx.regular, FONT_SIZE, CONTENT_WIDTH - 20);
  ensureSpace(ctx, 30 + lines.length * LINE_HEIGHT);

  drawText(ctx.page, "PAYMENT INSTRUCTIONS", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 4;

  // Light background box
  const boxHeight = lines.length * LINE_HEIGHT + 12;
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
    ensureSpace(ctx, LINE_HEIGHT);
    drawText(ctx.page, line, MARGIN + 10, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
    ctx.y -= LINE_HEIGHT;
  }

  ctx.y -= 10;
}

function drawNotes(ctx: DrawContext, notes: string): void {
  const lines = wrapText(notes, ctx.regular, FONT_SIZE, CONTENT_WIDTH);
  ensureSpace(ctx, 20 + lines.length * LINE_HEIGHT);

  drawText(ctx.page, "NOTES", MARGIN, ctx.y, ctx.bold, FONT_SIZE, MID_GRAY);
  ctx.y -= LINE_HEIGHT + 4;

  for (const line of lines) {
    ensureSpace(ctx, LINE_HEIGHT);
    drawText(ctx.page, line, MARGIN, ctx.y, ctx.regular, FONT_SIZE, DARK_GRAY);
    ctx.y -= LINE_HEIGHT;
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

function drawTextRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, size, font, color });
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

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
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

  return lines.length > 0 ? lines : [""];
}

// ────────────────────────────────────────────────────────────────────────────
// Formatters
// ────────────────────────────────────────────────────────────────────────────

function formatMoney(cents: number, currency = "USD"): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  const symbol = currency === "USD" ? "$" : currency + " ";
  return `${cents < 0 ? "-" : ""}${symbol}${dollars}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function buildAddressLines(client: NonNullable<InvoicePdfData["client"]>): string[] {
  const lines: string[] = [];
  if (client.street) lines.push(client.street);
  if (client.street2) lines.push(client.street2);
  const cityLine: string[] = [];
  if (client.city) cityLine.push(client.city);
  if (client.state) cityLine.push(client.state);
  if (client.postalCode) cityLine.push(client.postalCode);
  if (cityLine.length > 0) lines.push(cityLine.join(", "));
  if (client.country && client.country !== "US") lines.push(client.country);
  return lines;
}
