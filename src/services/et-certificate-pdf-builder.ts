// src/services/et-certificate-pdf-builder.ts
/**
 * Embryo Transfer Certificate PDF Builder
 *
 * Generates an ET certificate for breed registry submission.
 * Includes: donor dam, sire, recipient dam, procedure details,
 * offspring info, and flush event summary.
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { getBrandLogoPng } from "../assets/brand-logo.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ETCertificateData {
  // Organization
  organizationName: string;
  // Genetic Parents
  geneticDam: { name: string; registrationNumber?: string; breed?: string; dnaNumber?: string };
  sire: { name: string; registrationNumber?: string; breed?: string; dnaNumber?: string };
  // Recipient
  recipientDam: { name: string; registrationNumber?: string };
  // Procedure
  flushDate?: string;
  transferDate?: string;
  embryoType?: string;
  vetName?: string;
  // Offspring
  offspring?: { name: string; sex?: string; dateOfBirth?: string; registrationNumber?: string }[];
  // Flush Event Summary
  flushSummary?: {
    embryosRecovered?: number;
    embryosViable?: number;
    embryoGrade?: string;
  };
  // Metadata
  planName?: string;
  generatedDate: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

interface DrawContext {
  doc: any; // PDFDocument
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function drawText(
  ctx: DrawContext,
  text: string,
  x: number,
  options?: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> }
) {
  const font = options?.font ?? ctx.regular;
  const size = options?.size ?? 10;
  const color = options?.color ?? rgb(0.2, 0.2, 0.2);
  ctx.page.drawText(text, { x, y: ctx.y, size, font, color });
}

function drawLine(ctx: DrawContext, x1: number, x2: number, color = rgb(0.8, 0.8, 0.8)) {
  ctx.page.drawLine({
    start: { x: x1, y: ctx.y },
    end: { x: x2, y: ctx.y },
    thickness: 0.5,
    color,
  });
}

function drawSectionTitle(ctx: DrawContext, title: string) {
  ctx.y -= 6;
  drawLine(ctx, MARGIN, PAGE_WIDTH - MARGIN);
  ctx.y -= 16;
  drawText(ctx, title, MARGIN, { font: ctx.bold, size: 11, color: rgb(0.3, 0.2, 0.5) });
  ctx.y -= 16;
}

function drawField(ctx: DrawContext, label: string, value: string | undefined, x: number, width = 250) {
  if (!value) return;
  drawText(ctx, label, x, { size: 8, color: rgb(0.5, 0.5, 0.5) });
  ctx.y -= 12;
  drawText(ctx, value, x, { size: 10 });
  ctx.y -= 14;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ────────────────────────────────────────────────────────────────────────────
// Main Builder
// ────────────────────────────────────────────────────────────────────────────

export async function generateETCertificatePdf(
  data: ETCertificateData
): Promise<{ buffer: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: DrawContext = { doc: pdfDoc, regular, bold, page, y: PAGE_HEIGHT - MARGIN };

  // ── Logo ──
  try {
    const logoPng = getBrandLogoPng();
    const logoImage = await pdfDoc.embedPng(logoPng);
    const logoScale = 40 / logoImage.height;
    page.drawImage(logoImage, {
      x: MARGIN,
      y: ctx.y - 30,
      width: logoImage.width * logoScale,
      height: 40,
    });
  } catch {
    // Logo not available — skip
  }

  // ── Title ──
  drawText(ctx, "Embryo Transfer Certificate", MARGIN + 60, {
    font: bold, size: 18, color: rgb(0.3, 0.2, 0.5),
  });
  ctx.y -= 16;
  drawText(ctx, data.organizationName, MARGIN + 60, { size: 10, color: rgb(0.5, 0.5, 0.5) });
  ctx.y -= 10;
  drawText(ctx, `Generated: ${formatDate(data.generatedDate)}`, MARGIN + 60, {
    size: 8, color: rgb(0.6, 0.6, 0.6),
  });
  ctx.y -= 30;

  // ── Section: Genetic Parents ──
  drawSectionTitle(ctx, "Genetic Parents");

  const col1 = MARGIN;
  const col2 = MARGIN + CONTENT_WIDTH / 2;

  // Donor Dam
  drawText(ctx, "DONOR DAM", col1, { font: bold, size: 9, color: rgb(0.5, 0.3, 0.6) });
  ctx.y -= 14;
  drawField(ctx, "Name", data.geneticDam.name, col1);
  const savedY = ctx.y;
  if (data.geneticDam.registrationNumber) drawField(ctx, "Registration #", data.geneticDam.registrationNumber, col1);
  if (data.geneticDam.breed) drawField(ctx, "Breed", data.geneticDam.breed, col1);
  if (data.geneticDam.dnaNumber) drawField(ctx, "DNA #", data.geneticDam.dnaNumber, col1);
  const afterDamY = ctx.y;

  // Sire (right column)
  ctx.y = savedY + 14 + 14; // reset to after DONOR DAM header
  drawText(ctx, "SIRE", col2, { font: bold, size: 9, color: rgb(0.2, 0.4, 0.6) });
  ctx.y -= 14;
  drawField(ctx, "Name", data.sire.name, col2);
  if (data.sire.registrationNumber) drawField(ctx, "Registration #", data.sire.registrationNumber, col2);
  if (data.sire.breed) drawField(ctx, "Breed", data.sire.breed, col2);
  if (data.sire.dnaNumber) drawField(ctx, "DNA #", data.sire.dnaNumber, col2);

  ctx.y = Math.min(afterDamY, ctx.y);

  // ── Section: Recipient Dam ──
  drawSectionTitle(ctx, "Recipient Dam");
  drawField(ctx, "Name", data.recipientDam.name, col1);
  if (data.recipientDam.registrationNumber) {
    drawField(ctx, "Registration #", data.recipientDam.registrationNumber, col1);
  }

  // ── Section: Procedure Details ──
  drawSectionTitle(ctx, "Procedure Details");
  if (data.flushDate) drawField(ctx, "Flush Date", formatDate(data.flushDate), col1);
  if (data.transferDate) drawField(ctx, "Transfer Date", formatDate(data.transferDate), col1);
  if (data.embryoType) drawField(ctx, "Embryo Type", data.embryoType === "FRESH" ? "Fresh" : "Frozen", col1);
  if (data.vetName) drawField(ctx, "Veterinarian", data.vetName, col1);

  // ── Section: Offspring ──
  if (data.offspring && data.offspring.length > 0) {
    drawSectionTitle(ctx, "Offspring");
    for (const o of data.offspring) {
      drawText(ctx, `${o.name}${o.sex ? ` (${o.sex})` : ""}`, col1, { font: bold, size: 10 });
      ctx.y -= 14;
      if (o.dateOfBirth) drawField(ctx, "Date of Birth", formatDate(o.dateOfBirth), col1);
      if (o.registrationNumber) drawField(ctx, "Registration #", o.registrationNumber, col1);
      ctx.y -= 4;
    }
  }

  // ── Section: Flush Event Summary ──
  if (data.flushSummary) {
    drawSectionTitle(ctx, "Flush Summary");
    if (data.flushSummary.embryosRecovered != null) {
      drawField(ctx, "Embryos Recovered", String(data.flushSummary.embryosRecovered), col1);
    }
    if (data.flushSummary.embryosViable != null) {
      drawField(ctx, "Embryos Viable", String(data.flushSummary.embryosViable), col1);
    }
    if (data.flushSummary.embryoGrade) {
      drawField(ctx, "Embryo Grade", data.flushSummary.embryoGrade, col1);
    }
  }

  // ── Footer ──
  ctx.y = MARGIN + 20;
  drawLine(ctx, MARGIN, PAGE_WIDTH - MARGIN, rgb(0.7, 0.7, 0.7));
  ctx.y -= 12;
  drawText(ctx, `Generated by BreederHQ on ${formatDate(data.generatedDate)}`, MARGIN, {
    size: 7, color: rgb(0.6, 0.6, 0.6),
  });

  // ── Metadata ──
  pdfDoc.setTitle("Embryo Transfer Certificate");
  pdfDoc.setCreator("BreederHQ");
  pdfDoc.setCreationDate(new Date());

  const pdfBytes = await pdfDoc.save();
  const sanitizedName = (data.geneticDam.name || "et-cert").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const dateStr = new Date().toISOString().split("T")[0];

  return {
    buffer: pdfBytes,
    filename: `et-certificate-${sanitizedName}-${dateStr}.pdf`,
  };
}
