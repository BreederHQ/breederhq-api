// src/services/contracts/pdf-generator/signature-embedder.ts
/**
 * Signature Image Processing
 *
 * Handles processing and embedding of signature images into PDF documents.
 */

import { PDFDocument, PDFImage } from "pdf-lib";

/**
 * Process a base64 signature image and return image data
 */
export async function processSignatureImage(base64Data: string): Promise<{
  data: Uint8Array;
  format: "png" | "jpg";
}> {
  // Remove data URL prefix if present
  let cleanData = base64Data;
  let format: "png" | "jpg" = "png";

  if (base64Data.startsWith("data:")) {
    const matches = base64Data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 image format");
    }
    format = matches[1] === "jpeg" || matches[1] === "jpg" ? "jpg" : "png";
    cleanData = matches[2];
  }

  const buffer = Buffer.from(cleanData, "base64");
  return {
    data: new Uint8Array(buffer),
    format,
  };
}

/**
 * Embed a signature image into a PDF document at specified position
 */
export async function embedSignatureImage(
  pdfDoc: PDFDocument,
  signatureBase64: string,
  options: {
    pageIndex: number;
    x: number;
    y: number;
    maxWidth?: number;
    maxHeight?: number;
  }
): Promise<void> {
  const { data, format } = await processSignatureImage(signatureBase64);

  let pdfImage: PDFImage;
  if (format === "png") {
    pdfImage = await pdfDoc.embedPng(data);
  } else {
    pdfImage = await pdfDoc.embedJpg(data);
  }

  const page = pdfDoc.getPage(options.pageIndex);
  const maxWidth = options.maxWidth ?? 200;
  const maxHeight = options.maxHeight ?? 60;

  // Scale image to fit within bounds while maintaining aspect ratio
  const imgDims = pdfImage.scale(1);
  let width = imgDims.width;
  let height = imgDims.height;

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = height * ratio;
  }

  if (height > maxHeight) {
    const ratio = maxHeight / height;
    height = maxHeight;
    width = width * ratio;
  }

  page.drawImage(pdfImage, {
    x: options.x,
    y: options.y,
    width,
    height,
  });
}

/**
 * Generate a typed signature as an image
 * Returns a simple text representation (actual font rendering would require fontkit)
 */
export function generateTypedSignatureText(name: string): string {
  // For typed signatures, we'll render the name in the PDF using text
  // This is simpler and more reliable than generating an image
  return name;
}
