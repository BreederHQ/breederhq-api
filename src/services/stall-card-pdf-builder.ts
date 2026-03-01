// src/services/stall-card-pdf-builder.ts
/**
 * Stall Card PDF Builder
 *
 * Generates a single-page "stall door" printout using pdf-lib.
 * Large, readable font for barn environment.
 * Includes: animal name, active medications with dosages/frequency,
 * next-due dates, adverse reactions/allergies, emergency vet contact.
 *
 * Mirror: src/services/contracts/pdf-generator/contract-pdf-builder.ts
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { getBrandLogoPng } from "../assets/brand-logo.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface StallCardAnimal {
  name: string;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  photoUrl?: string | null;
}

export interface StallCardMedication {
  medicationName: string;
  dosageAmount?: number | null;
  dosageUnit?: string | null;
  frequency: string;
  administrationRoute?: string | null;
  nextDueDate?: string | null;
  isControlledSubstance?: boolean;
}

export interface StallCardData {
  animal: StallCardAnimal;
  activeMedications: StallCardMedication[];
  allergiesAndReactions: string[];
  emergencyVet?: {
    name: string;
    clinic?: string;
    phone?: string;
  } | null;
  generatedAt: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants — Large, readable for barn use
// ────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ────────────────────────────────────────────────────────────────────────────
// Main Export
// ────────────────────────────────────────────────────────────────────────────

export async function generateStallCardPdf(
  data: StallCardData
): Promise<{ buffer: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // ── Header: Logo (top-right) + Animal Name (big, bold) ──
  try {
    const logoPng = getBrandLogoPng();
    const logoImage = await pdfDoc.embedPng(logoPng);
    const logoDisplayHeight = 40;
    const logoScale = logoDisplayHeight / logoImage.height;
    const logoDisplayWidth = logoImage.width * logoScale;
    page.drawImage(logoImage, {
      x: PAGE_WIDTH - MARGIN - logoDisplayWidth,
      y: y - logoDisplayHeight + 28, // align with animal name
      width: logoDisplayWidth,
      height: logoDisplayHeight,
    });
  } catch {
    // Logo embedding is non-critical — continue without it
  }

  page.drawText(data.animal.name, {
    x: MARGIN,
    y,
    size: 28,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= 32;

  // Species / Breed / Sex line
  const infoLine = [data.animal.species, data.animal.breed, data.animal.sex]
    .filter(Boolean)
    .join(" · ");
  if (infoLine) {
    page.drawText(infoLine, { x: MARGIN, y, size: 14, font: regular, color: rgb(0.3, 0.3, 0.3) });
    y -= 20;
  }

  // Age
  if (data.animal.dateOfBirth) {
    const age = calculateAge(data.animal.dateOfBirth);
    page.drawText(`Born: ${formatDate(data.animal.dateOfBirth)} (${age})`, {
      x: MARGIN,
      y,
      size: 12,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 18;
  }

  // Divider
  y -= 8;
  drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, y, 2, rgb(0.2, 0.2, 0.2));
  y -= 20;

  // ── Active Medications ──
  page.drawText("ACTIVE MEDICATIONS", { x: MARGIN, y, size: 16, font: bold, color: rgb(0, 0, 0) });
  y -= 24;

  if (data.activeMedications.length === 0) {
    page.drawText("No active medications", { x: MARGIN + 10, y, size: 14, font: regular, color: rgb(0.5, 0.5, 0.5) });
    y -= 22;
  } else {
    for (const med of data.activeMedications) {
      if (y < MARGIN + 100) break; // Safety: don't overflow single page

      // Medication name (large)
      const namePrefix = med.isControlledSubstance ? "[C] " : "";
      page.drawText(`${namePrefix}${med.medicationName}`, {
        x: MARGIN + 10,
        y,
        size: 16,
        font: bold,
        color: rgb(0, 0, 0),
      });
      y -= 20;

      // Dosage + Route + Frequency
      const dosageStr = med.dosageAmount
        ? `${med.dosageAmount}${med.dosageUnit ? " " + med.dosageUnit : ""}`
        : "";
      const details = [dosageStr, med.administrationRoute, med.frequency]
        .filter(Boolean)
        .join(" · ");
      if (details) {
        page.drawText(details, { x: MARGIN + 20, y, size: 13, font: regular, color: rgb(0.2, 0.2, 0.2) });
        y -= 18;
      }

      // Next due
      if (med.nextDueDate) {
        page.drawText(`Next due: ${formatDate(med.nextDueDate)}`, {
          x: MARGIN + 20,
          y,
          size: 12,
          font: bold,
          color: rgb(0.7, 0.3, 0.0),
        });
        y -= 18;
      }
      y -= 8;
    }
  }

  // ── Allergies & Adverse Reactions ──
  y -= 8;
  drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, y, 1, rgb(0.6, 0.6, 0.6));
  y -= 18;

  page.drawText("ALLERGIES & ADVERSE REACTIONS", { x: MARGIN, y, size: 14, font: bold, color: rgb(0.7, 0.1, 0.1) });
  y -= 20;

  if (data.allergiesAndReactions.length === 0) {
    page.drawText("None recorded", { x: MARGIN + 10, y, size: 13, font: regular, color: rgb(0.5, 0.5, 0.5) });
    y -= 20;
  } else {
    for (const reaction of data.allergiesAndReactions) {
      if (y < MARGIN + 60) break;
      const lines = wrapText(reaction, regular, 12, CONTENT_WIDTH - 30);
      for (const line of lines) {
        page.drawText(`• ${line}`, { x: MARGIN + 10, y, size: 12, font: regular, color: rgb(0.6, 0.1, 0.1) });
        y -= 16;
      }
    }
  }

  // ── Emergency Vet Contact ──
  if (data.emergencyVet) {
    y -= 8;
    drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, y, 1, rgb(0.6, 0.6, 0.6));
    y -= 18;

    page.drawText("EMERGENCY VET", { x: MARGIN, y, size: 14, font: bold, color: rgb(0, 0, 0) });
    y -= 20;

    page.drawText(data.emergencyVet.name, { x: MARGIN + 10, y, size: 14, font: bold, color: rgb(0, 0, 0) });
    y -= 18;

    if (data.emergencyVet.clinic) {
      page.drawText(data.emergencyVet.clinic, { x: MARGIN + 10, y, size: 12, font: regular, color: rgb(0.3, 0.3, 0.3) });
      y -= 16;
    }
    if (data.emergencyVet.phone) {
      page.drawText(data.emergencyVet.phone, { x: MARGIN + 10, y, size: 16, font: bold, color: rgb(0, 0, 0) });
      y -= 20;
    }
  }

  // ── Footer ──
  const footerY = MARGIN;
  drawLine(page, MARGIN, footerY + 10, PAGE_WIDTH - MARGIN, footerY + 10, 0.5, rgb(0.7, 0.7, 0.7));
  const generatedStr = `Generated ${data.generatedAt.toLocaleDateString("en-US")} — BreederHQ`;
  page.drawText(generatedStr, { x: MARGIN, y: footerY, size: 8, font: regular, color: rgb(0.6, 0.6, 0.6) });

  // Metadata
  pdfDoc.setTitle(`Stall Card - ${data.animal.name}`);
  pdfDoc.setCreator("BreederHQ");
  pdfDoc.setProducer("BreederHQ Stall Cards");
  pdfDoc.setCreationDate(data.generatedAt);

  const buffer = await pdfDoc.save();
  const sanitizedName = data.animal.name.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 40);
  const filename = `stall-card-${sanitizedName}.pdf`;

  return { buffer, filename };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.5,
  color = rgb(0.7, 0.7, 0.7)
): void {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
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

function calculateAge(dob: string): string {
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
