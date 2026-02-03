// ─────────────────────────────────────────────────────────────
// PDF WATERMARK SERVICE
// Uses pdf-lib for PDF manipulation
// ─────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { WatermarkType, PdfWatermarkPosition } from "../types/watermark.js";

export type PdfWatermarkOptions = {
  type: WatermarkType;
  text?: string;
  logoBuffer?: Buffer;
  position: PdfWatermarkPosition;
  opacity: number;
};

export async function applyPdfWatermark(
  pdfBuffer: Buffer,
  options: PdfWatermarkOptions
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Apply text watermark
    if ((options.type === "text" || options.type === "both") && options.text) {
      if (options.position === "diagonal") {
        // Diagonal center watermark
        const fontSize = Math.min(width, height) * 0.08;
        const textWidth = font.widthOfTextAtSize(options.text, fontSize);

        page.drawText(options.text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.7, 0.7, 0.7),
          rotate: degrees(-45),
          opacity: options.opacity,
        });
      } else {
        // Header or footer
        const fontSize = 12;
        const yPos = options.position === "header" ? height - 30 : 20;

        page.drawText(options.text, {
          x: 20,
          y: yPos,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: options.opacity,
        });
      }
    }

    // Apply logo watermark
    if ((options.type === "logo" || options.type === "both") && options.logoBuffer) {
      try {
        // Try PNG first, fall back to JPEG
        let logoImage;
        try {
          logoImage = await pdfDoc.embedPng(options.logoBuffer);
        } catch {
          logoImage = await pdfDoc.embedJpg(options.logoBuffer);
        }

        const logoScale = Math.min(100, width * 0.15) / logoImage.width;
        const logoDims = {
          width: logoImage.width * logoScale,
          height: logoImage.height * logoScale,
        };

        // Position logo on opposite side from text if both
        const x = options.type === "both" ? width - logoDims.width - 20 : 20;
        const y = options.position === "header" ? height - logoDims.height - 20 : 20;

        page.drawImage(logoImage, {
          x,
          y,
          width: logoDims.width,
          height: logoDims.height,
          opacity: options.opacity,
        });
      } catch (err) {
        console.error("Failed to embed logo in PDF:", err);
      }
    }
  }

  return Buffer.from(await pdfDoc.save());
}
