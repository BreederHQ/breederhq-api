// src/services/puppy-packet-pdf-builder.ts
/**
 * Puppy Packet PDF Builder
 *
 * Generates a comprehensive offspring packet PDF using pdf-lib.
 * Includes: cover page, health summary, temperament assessment,
 * rearing protocol progress, microchip info, breeder contact.
 *
 * Mirror: src/services/health-report-pdf-builder.ts
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { getBrandLogoPng } from "../assets/brand-logo.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface PacketOffspring {
  id: number;
  name: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  color?: string | null;
  collarColorName?: string | null;
  registrationNumber?: string | null;
  damName?: string | null;
  sireName?: string | null;
}

export interface PacketHealthEvent {
  eventType: string;
  description: string;
  eventDate: string;
  veterinarian?: string | null;
}

export interface PacketVaccination {
  protocolName: string;
  administeredDate: string;
  nextDueDate?: string | null;
}

export interface PacketAssessment {
  assessmentType: string;
  assessedAt: string;
  assessedBy: string;
  scores: Record<string, number>;
  notes?: string | null;
}

export interface PacketProtocolAssignment {
  protocolName: string;
  startDate: string;
  completedActivities: number;
  totalActivities: number;
  status: string;
}

export interface PacketMicrochip {
  chipNumber: string;
  registryName?: string | null;
  implantDate?: string | null;
}

export interface PacketBreederContact {
  organizationName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}

export interface PuppyPacketData {
  offspring: PacketOffspring;
  healthEvents: PacketHealthEvent[];
  vaccinations: PacketVaccination[];
  assessments: PacketAssessment[];
  protocolAssignments: PacketProtocolAssignment[];
  microchips: PacketMicrochip[];
  breederContact: PacketBreederContact;
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
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ────────────────────────────────────────────────────────────────────────────
// Main Export
// ────────────────────────────────────────────────────────────────────────────

export async function generatePuppyPacketPdf(
  data: PuppyPacketData
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

  // 1. Cover page
  await drawCoverPage(ctx, data);

  // 2. Start content on page 2
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
  ctx.pageNumber++;

  // 3. Health summary
  drawHealthSummary(ctx, data.healthEvents, data.vaccinations);

  // 4. Temperament assessments (skip if none)
  if (data.assessments.length > 0) {
    drawAssessments(ctx, data.assessments);
  }

  // 5. Rearing protocol (skip if none)
  if (data.protocolAssignments.length > 0) {
    drawProtocols(ctx, data.protocolAssignments);
  }

  // 6. Microchip info (skip if none)
  if (data.microchips.length > 0) {
    drawMicrochips(ctx, data.microchips);
  }

  // 7. Breeder contact
  drawBreederContact(ctx, data.breederContact);

  // 8. Footers on all pages
  addFooters(ctx);

  // Metadata
  const speciesLabel = getOffspringLabel(data.offspring.species);
  pdfDoc.setTitle(`${speciesLabel} Packet - ${data.offspring.name}`);
  pdfDoc.setCreator("BreederHQ");
  pdfDoc.setProducer(`BreederHQ ${speciesLabel} Packet`);
  pdfDoc.setCreationDate(data.generatedAt);

  const buffer = await pdfDoc.save();
  const sanitizedName = data.offspring.name.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40);
  const dateStr = data.generatedAt.toISOString().split("T")[0];
  const filename = `${speciesLabel.toLowerCase()}-packet-${sanitizedName}-${dateStr}.pdf`;

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
    const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
    if (months > 0) return `${months}m`;
    return `${days}d`;
  } catch {
    return "—";
  }
}

function getOffspringLabel(species: string): string {
  switch (species?.toUpperCase()) {
    case "DOG": return "Puppy";
    case "CAT": return "Kitten";
    case "HORSE": return "Foal";
    default: return "Offspring";
  }
}

function getAssessmentLabel(assessmentType: string): string {
  switch (assessmentType) {
    case "VOLHARD_PAT": return "Volhard Puppy Aptitude Test (PAT)";
    case "GUN_DOG_APTITUDE": return "Gun Dog Aptitude Test";
    default: return assessmentType;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Section Renderers
// ────────────────────────────────────────────────────────────────────────────

async function drawCoverPage(ctx: DrawContext, data: PuppyPacketData): Promise<void> {
  const { page, bold, regular } = ctx;
  const o = data.offspring;

  // Try embedding logo
  try {
    const logoPng = getBrandLogoPng();
    if (logoPng) {
      const logoImage = await ctx.doc.embedPng(logoPng);
      const logoDims = logoImage.scale(0.3);
      page.drawImage(logoImage, {
        x: PAGE_WIDTH / 2 - logoDims.width / 2,
        y: PAGE_HEIGHT - MARGIN - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
      ctx.y -= logoDims.height + 20;
    }
  } catch {
    // Logo embedding is non-critical
  }

  // Breeder name
  if (data.breederContact.organizationName) {
    const orgText = data.breederContact.organizationName;
    const orgWidth = regular.widthOfTextAtSize(orgText, 12);
    drawText(page, orgText, PAGE_WIDTH / 2 - orgWidth / 2, ctx.y, regular, 12, rgb(0.4, 0.4, 0.4));
    ctx.y -= 30;
  }

  // Title
  const speciesLabel = getOffspringLabel(o.species);
  const title = `${speciesLabel} Packet`;
  const titleWidth = bold.widthOfTextAtSize(title, 24);
  drawText(page, title, PAGE_WIDTH / 2 - titleWidth / 2, ctx.y, bold, 24, rgb(0.15, 0.15, 0.15));
  ctx.y -= 40;

  // Offspring name
  const nameText = o.name || `#${o.id}`;
  const nameWidth = bold.widthOfTextAtSize(nameText, 20);
  drawText(page, nameText, PAGE_WIDTH / 2 - nameWidth / 2, ctx.y, bold, 20, rgb(0.2, 0.2, 0.2));
  ctx.y -= 40;

  // Divider
  drawLine(page, MARGIN + 100, ctx.y, PAGE_WIDTH - MARGIN - 100, ctx.y, 1, rgb(0.8, 0.8, 0.8));
  ctx.y -= 30;

  // Info fields (centered)
  const infoFields: Array<[string, string]> = [];
  if (o.breed) infoFields.push(["Breed", o.breed]);
  if (o.sex) infoFields.push(["Sex", o.sex.charAt(0).toUpperCase() + o.sex.slice(1)]);
  if (o.dateOfBirth) infoFields.push(["Date of Birth", `${formatDate(o.dateOfBirth)} (${calculateAge(o.dateOfBirth)})`]);
  if (o.color) infoFields.push(["Color", o.color]);
  if (o.collarColorName) infoFields.push(["ID Marker", o.collarColorName]);
  if (o.damName) infoFields.push(["Dam", o.damName]);
  if (o.sireName) infoFields.push(["Sire", o.sireName]);
  if (o.registrationNumber) infoFields.push(["Registration", o.registrationNumber]);

  for (const [label, value] of infoFields) {
    const line = `${label}: ${value}`;
    const lineWidth = regular.widthOfTextAtSize(line, FONT_SIZE);
    drawText(page, label + ":", PAGE_WIDTH / 2 - lineWidth / 2, ctx.y, bold, FONT_SIZE, rgb(0.3, 0.3, 0.3));
    drawText(page, value, PAGE_WIDTH / 2 - lineWidth / 2 + bold.widthOfTextAtSize(label + ": ", FONT_SIZE), ctx.y, regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT + 4;
  }

  // Generation date at bottom
  const genDate = `Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
  const genWidth = regular.widthOfTextAtSize(genDate, 8);
  drawText(page, genDate, PAGE_WIDTH / 2 - genWidth / 2, MARGIN + 20, regular, 8, rgb(0.5, 0.5, 0.5));
}

function drawSectionHeading(ctx: DrawContext, title: string): void {
  ensureSpace(ctx, 40);
  ctx.y -= 10;
  drawLine(ctx.page, MARGIN, ctx.y + HEADING_SIZE + 4, PAGE_WIDTH - MARGIN, ctx.y + HEADING_SIZE + 4, 0.5, rgb(0.8, 0.8, 0.8));
  ctx.y -= 6;
  drawText(ctx.page, title, MARGIN, ctx.y, ctx.bold, HEADING_SIZE, rgb(0.15, 0.15, 0.15));
  ctx.y -= LINE_HEIGHT + 8;
}

function drawHealthSummary(
  ctx: DrawContext,
  healthEvents: PacketHealthEvent[],
  vaccinations: PacketVaccination[]
): void {
  drawSectionHeading(ctx, "Health Summary");

  if (healthEvents.length === 0 && vaccinations.length === 0) {
    drawText(ctx.page, "No health records on file.", MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.5, 0.5, 0.5));
    ctx.y -= LINE_HEIGHT;
    return;
  }

  // Vaccinations
  if (vaccinations.length > 0) {
    ensureSpace(ctx, 30);
    drawText(ctx.page, "Vaccinations", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT + 4;

    // Table header
    drawText(ctx.page, "Protocol", MARGIN, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
    drawText(ctx.page, "Date", MARGIN + 200, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
    drawText(ctx.page, "Next Due", MARGIN + 330, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
    ctx.y -= LINE_HEIGHT;
    drawLine(ctx.page, MARGIN, ctx.y + 4, PAGE_WIDTH - MARGIN, ctx.y + 4, 0.5, rgb(0.85, 0.85, 0.85));

    for (const v of vaccinations) {
      ensureSpace(ctx, LINE_HEIGHT + 4);
      drawText(ctx.page, v.protocolName, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
      drawText(ctx.page, formatDate(v.administeredDate), MARGIN + 200, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
      drawText(ctx.page, formatDate(v.nextDueDate), MARGIN + 330, ctx.y, ctx.regular, FONT_SIZE, rgb(0.4, 0.4, 0.4));
      ctx.y -= LINE_HEIGHT;
    }
    ctx.y -= 8;
  }

  // Health events
  if (healthEvents.length > 0) {
    ensureSpace(ctx, 30);
    drawText(ctx.page, "Health Events", MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT + 4;

    drawText(ctx.page, "Date", MARGIN, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
    drawText(ctx.page, "Type", MARGIN + 100, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
    drawText(ctx.page, "Description", MARGIN + 200, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
    ctx.y -= LINE_HEIGHT;
    drawLine(ctx.page, MARGIN, ctx.y + 4, PAGE_WIDTH - MARGIN, ctx.y + 4, 0.5, rgb(0.85, 0.85, 0.85));

    for (const e of healthEvents) {
      ensureSpace(ctx, LINE_HEIGHT + 4);
      drawText(ctx.page, formatDate(e.eventDate), MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
      drawText(ctx.page, e.eventType, MARGIN + 100, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));

      const descLines = wrapText(e.description, ctx.regular, FONT_SIZE, CONTENT_WIDTH - 200);
      for (const line of descLines) {
        drawText(ctx.page, line, MARGIN + 200, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
        ctx.y -= LINE_HEIGHT;
      }
    }
    ctx.y -= 4;
  }
}

function drawAssessments(ctx: DrawContext, assessments: PacketAssessment[]): void {
  drawSectionHeading(ctx, "Temperament Assessment");

  for (const a of assessments) {
    ensureSpace(ctx, 60);

    // Assessment type + date
    drawText(ctx.page, getAssessmentLabel(a.assessmentType), MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT;
    drawText(ctx.page, `Assessed: ${formatDate(a.assessedAt)} by ${a.assessedBy}`, MARGIN, ctx.y, ctx.regular, 9, rgb(0.4, 0.4, 0.4));
    ctx.y -= LINE_HEIGHT + 6;

    // Scores as a simple table
    const scoreEntries = Object.entries(a.scores).sort(([a], [b]) => a.localeCompare(b));
    if (scoreEntries.length > 0) {
      drawText(ctx.page, "Category", MARGIN, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
      drawText(ctx.page, "Score", MARGIN + 250, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
      ctx.y -= LINE_HEIGHT;
      drawLine(ctx.page, MARGIN, ctx.y + 4, PAGE_WIDTH - MARGIN, ctx.y + 4, 0.5, rgb(0.85, 0.85, 0.85));

      for (const [category, score] of scoreEntries) {
        ensureSpace(ctx, LINE_HEIGHT + 4);
        // Format category: social_attraction → Social Attraction
        const label = category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        drawText(ctx.page, label, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
        drawText(ctx.page, String(score), MARGIN + 250, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));

        // Simple visual bar (max score 6)
        const barX = MARGIN + 290;
        const barWidth = 120;
        const maxScore = a.assessmentType === "VOLHARD_PAT" ? 6 : 10;
        const fillWidth = Math.min((score / maxScore) * barWidth, barWidth);

        // Background bar
        ctx.page.drawRectangle({
          x: barX, y: ctx.y - 2, width: barWidth, height: 10,
          color: rgb(0.92, 0.92, 0.92),
        });
        // Filled bar
        if (fillWidth > 0) {
          ctx.page.drawRectangle({
            x: barX, y: ctx.y - 2, width: fillWidth, height: 10,
            color: rgb(0.22, 0.56, 0.73),
          });
        }

        ctx.y -= LINE_HEIGHT;
      }
    }

    // Notes
    if (a.notes) {
      ctx.y -= 4;
      ensureSpace(ctx, 30);
      drawText(ctx.page, "Notes:", MARGIN, ctx.y, ctx.bold, 9, rgb(0.4, 0.4, 0.4));
      ctx.y -= LINE_HEIGHT;
      const noteLines = wrapText(a.notes, ctx.regular, FONT_SIZE, CONTENT_WIDTH);
      for (const line of noteLines) {
        ensureSpace(ctx, LINE_HEIGHT);
        drawText(ctx.page, line, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
        ctx.y -= LINE_HEIGHT;
      }
    }

    ctx.y -= 8;
  }
}

function drawProtocols(ctx: DrawContext, assignments: PacketProtocolAssignment[]): void {
  drawSectionHeading(ctx, "Rearing Protocol");

  for (const a of assignments) {
    ensureSpace(ctx, 40);
    drawText(ctx.page, a.protocolName, MARGIN, ctx.y, ctx.bold, SUBHEADING_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT;

    const statusLabel = a.status === "COMPLETED" ? "Completed" : a.status === "ACTIVE" ? "In Progress" : a.status;
    drawText(ctx.page, `Status: ${statusLabel}`, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
    ctx.y -= LINE_HEIGHT;

    drawText(ctx.page, `Started: ${formatDate(a.startDate)}`, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
    ctx.y -= LINE_HEIGHT;

    // Progress
    const pct = a.totalActivities > 0 ? Math.round((a.completedActivities / a.totalActivities) * 100) : 0;
    drawText(ctx.page, `Progress: ${a.completedActivities} / ${a.totalActivities} activities (${pct}%)`, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
    ctx.y -= LINE_HEIGHT;

    // Progress bar
    const barX = MARGIN;
    const barWidth = 200;
    const fillWidth = (pct / 100) * barWidth;
    ctx.page.drawRectangle({ x: barX, y: ctx.y - 2, width: barWidth, height: 10, color: rgb(0.92, 0.92, 0.92) });
    if (fillWidth > 0) {
      ctx.page.drawRectangle({
        x: barX, y: ctx.y - 2, width: fillWidth, height: 10,
        color: pct === 100 ? rgb(0.22, 0.65, 0.35) : rgb(0.22, 0.56, 0.73),
      });
    }
    ctx.y -= LINE_HEIGHT + 8;
  }
}

function drawMicrochips(ctx: DrawContext, microchips: PacketMicrochip[]): void {
  drawSectionHeading(ctx, "Microchip Registration");

  for (const m of microchips) {
    ensureSpace(ctx, 30);
    drawText(ctx.page, `Chip Number: ${m.chipNumber}`, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT;
    if (m.registryName) {
      drawText(ctx.page, `Registry: ${m.registryName}`, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
      ctx.y -= LINE_HEIGHT;
    }
    if (m.implantDate) {
      drawText(ctx.page, `Implant Date: ${formatDate(m.implantDate)}`, MARGIN, ctx.y, ctx.regular, FONT_SIZE, rgb(0.3, 0.3, 0.3));
      ctx.y -= LINE_HEIGHT;
    }
    ctx.y -= 4;
  }
}

function drawBreederContact(ctx: DrawContext, contact: PacketBreederContact): void {
  drawSectionHeading(ctx, "Breeder Contact Information");

  const fields: Array<[string, string]> = [];
  fields.push(["Breeder", contact.organizationName]);
  if (contact.contactName) fields.push(["Contact", contact.contactName]);
  if (contact.email) fields.push(["Email", contact.email]);
  if (contact.phone) fields.push(["Phone", contact.phone]);
  if (contact.website) fields.push(["Website", contact.website]);

  for (const [label, value] of fields) {
    ensureSpace(ctx, LINE_HEIGHT + 4);
    drawText(ctx.page, `${label}:`, MARGIN, ctx.y, ctx.bold, FONT_SIZE, rgb(0.3, 0.3, 0.3));
    drawText(ctx.page, value, MARGIN + 80, ctx.y, ctx.regular, FONT_SIZE, rgb(0.2, 0.2, 0.2));
    ctx.y -= LINE_HEIGHT + 2;
  }
}

function addFooters(ctx: DrawContext): void {
  const pages = ctx.doc.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    const p = pages[i];
    const text = `Page ${i + 1} of ${total}`;
    const w = ctx.regular.widthOfTextAtSize(text, 8);
    drawText(p, text, PAGE_WIDTH / 2 - w / 2, MARGIN - 20, ctx.regular, 8, rgb(0.5, 0.5, 0.5));

    const disclaimer = "Generated by BreederHQ — For informational purposes only.";
    const dw = ctx.regular.widthOfTextAtSize(disclaimer, 7);
    drawText(p, disclaimer, PAGE_WIDTH / 2 - dw / 2, MARGIN - 30, ctx.regular, 7, rgb(0.6, 0.6, 0.6));
  }
}
