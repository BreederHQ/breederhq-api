// src/services/health-report-pdf-builder.ts
/**
 * Health Report PDF Builder
 *
 * Generates a full animal health report PDF using pdf-lib.
 * Includes: animal info, withdrawal status, current medications,
 * vaccination status, key health clearances, medication history.
 *
 * Mirror: src/services/contracts/pdf-generator/contract-pdf-builder.ts
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface HealthReportAnimal {
  id: number;
  name: string;
  species?: string | null;
  breed?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  registrationNumber?: string | null;
  microchipId?: string | null;
  ownerName?: string | null;
  organizationName?: string | null;
}

export interface HealthReportMedication {
  medicationName: string;
  dosageAmount?: number | null;
  dosageUnit?: string | null;
  administrationRoute?: string | null;
  frequency: string;
  startDate: string;
  status: string;
  completedDoses: number;
  totalDoses?: number | null;
  nextDueDate?: string | null;
  withdrawalPeriodDays?: number | null;
  withdrawalExpiryDate?: string | null;
  isControlledSubstance?: boolean;
  endDate?: string | null;
}

export interface HealthReportVaccination {
  protocolName: string;
  lastAdministered?: string | null;
  expiresAt?: string | null;
  status: "current" | "overdue" | "due_soon" | "not_started";
}

export interface HealthReportClearance {
  name: string;
  value?: string | null;
  date?: string | null;
  status: "clear" | "positive" | "unknown";
}

export interface HealthReportOptions {
  historyMonths?: number;
}

export interface HealthReportData {
  animal: HealthReportAnimal;
  currentMedications: HealthReportMedication[];
  medicationHistory: HealthReportMedication[];
  vaccinations: HealthReportVaccination[];
  clearances: HealthReportClearance[];
  generatedAt: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const FONT_SIZE = 10;
const HEADING_SIZE = 14;
const SUBHEADING_SIZE = 12;

// ────────────────────────────────────────────────────────────────────────────
// Main Export
// ────────────────────────────────────────────────────────────────────────────

export async function generateHealthReportPdf(
  data: HealthReportData
): Promise<{ buffer: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx: DrawContext = {
    doc: pdfDoc,
    regular,
    bold,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    pageNumber: 1,
  };

  // 1. Header
  drawHeader(ctx, data);

  // 2. Animal info card
  drawAnimalInfo(ctx, data.animal);

  // 3. Withdrawal status banner
  drawWithdrawalBanner(ctx, data.currentMedications);

  // 4. Current medications table
  drawCurrentMedications(ctx, data.currentMedications);

  // 5. Vaccination status table
  drawVaccinations(ctx, data.vaccinations);

  // 6. Key health clearances
  drawClearances(ctx, data.clearances);

  // 7. Medication history
  drawMedicationHistory(ctx, data.medicationHistory);

  // 8. Footer on all pages
  addFooters(ctx);

  // Metadata
  pdfDoc.setTitle(`Health Report - ${data.animal.name}`);
  pdfDoc.setCreator("BreederHQ");
  pdfDoc.setProducer("BreederHQ Health Reports");
  pdfDoc.setCreationDate(data.generatedAt);

  const buffer = await pdfDoc.save();
  const sanitizedName = data.animal.name.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40);
  const dateStr = data.generatedAt.toISOString().split("T")[0];
  const filename = `health-report-${sanitizedName}-${dateStr}.pdf`;

  return { buffer, filename };
}

// ────────────────────────────────────────────────────────────────────────────
// Drawing Helpers
// ────────────────────────────────────────────────────────────────────────────

interface DrawContext {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  pageNumber: number;
}

function ensureSpace(ctx: DrawContext, needed: number): void {
  if (ctx.y < MARGIN + needed) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
    ctx.pageNumber++;
  }
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
): void {
  page.drawText(text, { x, y, size, font, color });
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.5,
  color = rgb(0.7, 0.7, 0.7)
): void {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color,
  });
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function calculateAge(dob: string | null | undefined): string {
  if (!dob) return "—";
  try {
    const birth = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years > 0) return `${years}y ${months}m`;
    return `${months}m`;
  } catch {
    return "—";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Section Renderers
// ────────────────────────────────────────────────────────────────────────────

function drawHeader(ctx: DrawContext, data: HealthReportData): void {
  drawText(ctx.page, "Animal Health Report", MARGIN, ctx.y, ctx.bold, 18);
  ctx.y -= 20;
  const dateStr = data.generatedAt.toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  drawText(ctx.page, `Generated: ${dateStr}`, MARGIN, ctx.y, ctx.regular, 9, rgb(0.4, 0.4, 0.4));
  if (data.animal.organizationName) {
    const orgWidth = ctx.regular.widthOfTextAtSize(data.animal.organizationName, 9);
    drawText(ctx.page, data.animal.organizationName, PAGE_WIDTH - MARGIN - orgWidth, ctx.y, ctx.regular, 9, rgb(0.4, 0.4, 0.4));
  }
  ctx.y -= 15;
  drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y, 1, rgb(0.3, 0.3, 0.3));
  ctx.y -= 20;
}

function drawAnimalInfo(ctx: DrawContext, animal: HealthReportAnimal): void {
  ensureSpace(ctx, 100);
  drawText(ctx.page, "Animal Information", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE);
  ctx.y -= 18;

  const rows: [string, string][] = [
    ["Name", animal.name],
    ["Species", animal.species || "—"],
    ["Breed", animal.breed || "—"],
    ["Date of Birth", `${formatDate(animal.dateOfBirth)} (Age: ${calculateAge(animal.dateOfBirth)})`],
    ["Sex", animal.sex || "—"],
  ];
  if (animal.registrationNumber) rows.push(["Registration #", animal.registrationNumber]);
  if (animal.microchipId) rows.push(["Microchip", animal.microchipId]);
  if (animal.ownerName) rows.push(["Owner", animal.ownerName]);

  for (const [label, value] of rows) {
    drawText(ctx.page, `${label}:`, MARGIN + 10, ctx.y, ctx.bold, FONT_SIZE);
    drawText(ctx.page, value, MARGIN + 130, ctx.y, ctx.regular, FONT_SIZE);
    ctx.y -= LINE_HEIGHT;
  }
  ctx.y -= 10;
}

function drawWithdrawalBanner(ctx: DrawContext, medications: HealthReportMedication[]): void {
  ensureSpace(ctx, 40);
  const activeWithdrawals = medications.filter(
    (m) => m.withdrawalExpiryDate && new Date(m.withdrawalExpiryDate) > new Date()
  );

  if (activeWithdrawals.length > 0) {
    // Red banner
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 20,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 25,
      color: rgb(0.95, 0.85, 0.85),
      borderColor: rgb(0.8, 0.2, 0.2),
      borderWidth: 1,
    });
    const latestExpiry = activeWithdrawals
      .map((m) => new Date(m.withdrawalExpiryDate!))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    drawText(
      ctx.page,
      `WITHDRAWAL ACTIVE — cleared ${formatDate(latestExpiry.toISOString())}`,
      MARGIN + 10,
      ctx.y - 14,
      ctx.bold,
      FONT_SIZE,
      rgb(0.7, 0.1, 0.1)
    );
  } else {
    // Green banner
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 20,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 25,
      color: rgb(0.85, 0.95, 0.85),
      borderColor: rgb(0.2, 0.6, 0.2),
      borderWidth: 1,
    });
    drawText(
      ctx.page,
      "ALL CLEAR — no active withdrawals",
      MARGIN + 10,
      ctx.y - 14,
      ctx.bold,
      FONT_SIZE,
      rgb(0.1, 0.5, 0.1)
    );
  }
  ctx.y -= 35;
}

function drawCurrentMedications(ctx: DrawContext, medications: HealthReportMedication[]): void {
  ensureSpace(ctx, 60);
  drawText(ctx.page, "Current Medications", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE);
  ctx.y -= 18;

  const active = medications.filter((m) => m.status === "ACTIVE" || m.status === "SCHEDULED");
  if (active.length === 0) {
    drawText(ctx.page, "No active medications.", MARGIN + 10, ctx.y, ctx.regular, FONT_SIZE, rgb(0.5, 0.5, 0.5));
    ctx.y -= LINE_HEIGHT + 10;
    return;
  }

  // Table header
  const cols = [MARGIN, MARGIN + 140, MARGIN + 230, MARGIN + 310, MARGIN + 370, MARGIN + 430];
  const headers = ["Medication", "Dosage", "Frequency", "Start", "Compliance", "Next Due"];
  for (let i = 0; i < headers.length; i++) {
    drawText(ctx.page, headers[i], cols[i], ctx.y, ctx.bold, 8, rgb(0.3, 0.3, 0.3));
  }
  ctx.y -= 4;
  drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y);
  ctx.y -= LINE_HEIGHT;

  for (const med of active) {
    ensureSpace(ctx, LINE_HEIGHT + 5);
    const dosage = med.dosageAmount
      ? `${med.dosageAmount}${med.dosageUnit ? " " + med.dosageUnit : ""}`
      : "—";
    const compliance = med.totalDoses
      ? `${med.completedDoses}/${med.totalDoses} (${Math.round((med.completedDoses / med.totalDoses) * 100)}%)`
      : `${med.completedDoses} doses`;

    const nameText = med.medicationName.length > 22
      ? med.medicationName.substring(0, 20) + "..."
      : med.medicationName;

    drawText(ctx.page, nameText, cols[0], ctx.y, ctx.regular, 8);
    drawText(ctx.page, dosage.substring(0, 14), cols[1], ctx.y, ctx.regular, 8);
    drawText(ctx.page, med.frequency, cols[2], ctx.y, ctx.regular, 8);
    drawText(ctx.page, formatDate(med.startDate), cols[3], ctx.y, ctx.regular, 8);
    drawText(ctx.page, compliance, cols[4], ctx.y, ctx.regular, 8);
    drawText(ctx.page, formatDate(med.nextDueDate), cols[5], ctx.y, ctx.regular, 8);
    ctx.y -= LINE_HEIGHT;
  }
  ctx.y -= 10;
}

function drawVaccinations(ctx: DrawContext, vaccinations: HealthReportVaccination[]): void {
  ensureSpace(ctx, 60);
  drawText(ctx.page, "Vaccination Status", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE);
  ctx.y -= 18;

  if (vaccinations.length === 0) {
    drawText(ctx.page, "No vaccination records.", MARGIN + 10, ctx.y, ctx.regular, FONT_SIZE, rgb(0.5, 0.5, 0.5));
    ctx.y -= LINE_HEIGHT + 10;
    return;
  }

  const cols = [MARGIN, MARGIN + 180, MARGIN + 300, MARGIN + 400];
  const headers = ["Protocol", "Last Administered", "Expires", "Status"];
  for (let i = 0; i < headers.length; i++) {
    drawText(ctx.page, headers[i], cols[i], ctx.y, ctx.bold, 8, rgb(0.3, 0.3, 0.3));
  }
  ctx.y -= 4;
  drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y);
  ctx.y -= LINE_HEIGHT;

  for (const vax of vaccinations) {
    ensureSpace(ctx, LINE_HEIGHT + 5);
    const statusColor = vax.status === "current" ? rgb(0.1, 0.5, 0.1)
      : vax.status === "overdue" ? rgb(0.8, 0.1, 0.1)
      : vax.status === "due_soon" ? rgb(0.8, 0.6, 0.0)
      : rgb(0.5, 0.5, 0.5);
    const statusText = vax.status === "current" ? "Current"
      : vax.status === "overdue" ? "Overdue"
      : vax.status === "due_soon" ? "Due Soon"
      : "Not Started";

    drawText(ctx.page, vax.protocolName.substring(0, 30), cols[0], ctx.y, ctx.regular, 8);
    drawText(ctx.page, formatDate(vax.lastAdministered), cols[1], ctx.y, ctx.regular, 8);
    drawText(ctx.page, formatDate(vax.expiresAt), cols[2], ctx.y, ctx.regular, 8);
    drawText(ctx.page, statusText, cols[3], ctx.y, ctx.bold, 8, statusColor);
    ctx.y -= LINE_HEIGHT;
  }
  ctx.y -= 10;
}

function drawClearances(ctx: DrawContext, clearances: HealthReportClearance[]): void {
  if (clearances.length === 0) return;
  ensureSpace(ctx, 60);
  drawText(ctx.page, "Key Health Clearances", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE);
  ctx.y -= 18;

  for (const c of clearances) {
    ensureSpace(ctx, LINE_HEIGHT + 5);
    const statusColor = c.status === "clear" ? rgb(0.1, 0.5, 0.1)
      : c.status === "positive" ? rgb(0.8, 0.1, 0.1)
      : rgb(0.5, 0.5, 0.5);
    const statusText = c.status === "clear" ? "Clear" : c.status === "positive" ? "Positive" : "Unknown";

    drawText(ctx.page, `${c.name}:`, MARGIN + 10, ctx.y, ctx.bold, FONT_SIZE);
    drawText(ctx.page, c.value || statusText, MARGIN + 180, ctx.y, ctx.regular, FONT_SIZE, statusColor);
    if (c.date) {
      drawText(ctx.page, `(${formatDate(c.date)})`, MARGIN + 340, ctx.y, ctx.regular, 8, rgb(0.5, 0.5, 0.5));
    }
    ctx.y -= LINE_HEIGHT;
  }
  ctx.y -= 10;
}

function drawMedicationHistory(ctx: DrawContext, history: HealthReportMedication[]): void {
  ensureSpace(ctx, 60);
  drawText(ctx.page, "Medication History", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE);
  ctx.y -= 18;

  if (history.length === 0) {
    drawText(ctx.page, "No medication history in the selected period.", MARGIN + 10, ctx.y, ctx.regular, FONT_SIZE, rgb(0.5, 0.5, 0.5));
    ctx.y -= LINE_HEIGHT + 10;
    return;
  }

  const cols = [MARGIN, MARGIN + 160, MARGIN + 260, MARGIN + 340, MARGIN + 420];
  const headers = ["Medication", "Status", "Date Range", "Doses", "Withdrawal"];
  for (let i = 0; i < headers.length; i++) {
    drawText(ctx.page, headers[i], cols[i], ctx.y, ctx.bold, 8, rgb(0.3, 0.3, 0.3));
  }
  ctx.y -= 4;
  drawLine(ctx.page, MARGIN, ctx.y, PAGE_WIDTH - MARGIN, ctx.y);
  ctx.y -= LINE_HEIGHT;

  for (const med of history) {
    ensureSpace(ctx, LINE_HEIGHT + 5);
    const dateRange = `${formatDate(med.startDate)} - ${formatDate(med.endDate)}`;
    const doses = med.totalDoses ? `${med.completedDoses}/${med.totalDoses}` : `${med.completedDoses}`;
    const withdrawal = med.withdrawalPeriodDays ? `${med.withdrawalPeriodDays}d` : "—";

    drawText(ctx.page, med.medicationName.substring(0, 26), cols[0], ctx.y, ctx.regular, 8);
    drawText(ctx.page, med.status, cols[1], ctx.y, ctx.regular, 8);
    drawText(ctx.page, dateRange, cols[2], ctx.y, ctx.regular, 8);
    drawText(ctx.page, doses, cols[3], ctx.y, ctx.regular, 8);
    drawText(ctx.page, withdrawal, cols[4], ctx.y, ctx.regular, 8);
    ctx.y -= LINE_HEIGHT;
  }
  ctx.y -= 10;
}

function addFooters(ctx: DrawContext): void {
  const pages = ctx.doc.getPages();
  const totalPages = pages.length;
  const footerText = "Generated by BreederHQ — for informational purposes only — not a substitute for veterinary medical records";

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    drawLine(page, MARGIN, MARGIN - 10, PAGE_WIDTH - MARGIN, MARGIN - 10, 0.5, rgb(0.7, 0.7, 0.7));
    drawText(page, footerText, MARGIN, MARGIN - 22, ctx.regular, 7, rgb(0.5, 0.5, 0.5));
    const pageNumText = `Page ${i + 1} of ${totalPages}`;
    const pageNumWidth = ctx.regular.widthOfTextAtSize(pageNumText, 7);
    drawText(page, pageNumText, PAGE_WIDTH - MARGIN - pageNumWidth, MARGIN - 22, ctx.regular, 7, rgb(0.5, 0.5, 0.5));
  }
}
