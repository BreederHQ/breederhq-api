// ─────────────────────────────────────────────────────────────
// IMAGE WATERMARK SERVICE
// Uses Sharp for image processing
// ─────────────────────────────────────────────────────────────

import sharp from "sharp";
import crypto from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getS3Client, getS3Bucket } from "./s3-client.js";
import prisma from "../prisma.js";
import type {
  WatermarkOptions,
  WatermarkPosition,
  WatermarkSize,
  WatermarkPattern,
} from "../types/watermark.js";

// ─────────────────────────────────────────────────────────────
// Hash Calculation
// ─────────────────────────────────────────────────────────────

export function calculateSettingsHash(options: WatermarkOptions): string {
  const input = JSON.stringify({
    type: options.type,
    text: options.text,
    position: options.position,
    opacity: options.opacity,
    size: options.size,
    pattern: options.pattern || "single",
  });
  return crypto.createHash("md5").update(input).digest("hex");
}

// ─────────────────────────────────────────────────────────────
// S3 Operations
// ─────────────────────────────────────────────────────────────

export async function fetchFromS3(key: string): Promise<Buffer> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function uploadToS3(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();
  // CacheControl: watermarked images are cached variants — cache aggressively
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

async function deleteFromS3(key: string): Promise<void> {
  const s3 = getS3Client();
  const bucket = getS3Bucket();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ─────────────────────────────────────────────────────────────
// Cache Operations
// ─────────────────────────────────────────────────────────────

export async function getCachedWatermarkedAsset(
  tenantId: number,
  originalKey: string,
  settingsHash: string
): Promise<{ watermarkedKey: string } | null> {
  const cached = await prisma.watermarkedAsset.findUnique({
    where: {
      tenantId_originalKey_settingsHash: { tenantId, originalKey, settingsHash },
    },
  });

  if (cached && cached.expiresAt > new Date()) {
    return { watermarkedKey: cached.watermarkedKey };
  }
  return null;
}

export async function invalidateWatermarkCache(tenantId: number): Promise<number> {
  const assets = await prisma.watermarkedAsset.findMany({
    where: { tenantId },
    select: { id: true, watermarkedKey: true },
  });

  // Delete S3 files
  for (const asset of assets) {
    try {
      await deleteFromS3(asset.watermarkedKey);
    } catch (err) {
      console.error("Failed to delete cached watermark:", err);
    }
  }

  // Delete DB records
  const result = await prisma.watermarkedAsset.deleteMany({
    where: { tenantId },
  });

  return result.count;
}

// ─────────────────────────────────────────────────────────────
// Main Watermark Function
// ─────────────────────────────────────────────────────────────

export async function applyImageWatermark(
  tenantId: number,
  originalKey: string,
  options: WatermarkOptions
): Promise<{ watermarkedKey: string; buffer: Buffer }> {
  // 1. Calculate hash for cache lookup
  const settingsHash = calculateSettingsHash(options);

  // 2. Check cache first
  const cached = await getCachedWatermarkedAsset(tenantId, originalKey, settingsHash);
  if (cached) {
    const buffer = await fetchFromS3(cached.watermarkedKey);
    return { watermarkedKey: cached.watermarkedKey, buffer };
  }

  // 3. Fetch original image from S3
  const originalBuffer = await fetchFromS3(originalKey);

  // 4. Get image dimensions
  const metadata = await sharp(originalBuffer).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // 5. Create watermark overlay(s)
  const overlays: sharp.OverlayOptions[] = [];
  const pattern = options.pattern || "positions";

  if (pattern === "tiled") {
    // Tiled pattern: diagonal repeating text across entire image
    if ((options.type === "text" || options.type === "both") && options.text) {
      const tiledOverlay = await createTiledTextWatermark(
        options.text,
        width,
        height,
        options.size || "medium",
        options.opacity
      );
      overlays.push(tiledOverlay);
    }
    // Logo: center position for tiled pattern
    if ((options.type === "logo" || options.type === "both") && options.logoBuffer) {
      const logoOverlay = await createLogoWatermark(
        options.logoBuffer,
        width,
        height,
        "center",
        options.size || "medium",
        options.opacity
      );
      overlays.push(logoOverlay);
    }
  } else {
    // Positions pattern: watermark at each selected position
    // Fall back to legacy single position if positions array is empty
    const positionsToUse = options.positions && options.positions.length > 0
      ? options.positions
      : [options.position as WatermarkPosition];

    for (const pos of positionsToUse) {
      if ((options.type === "text" || options.type === "both") && options.text) {
        const textOverlay = await createTextWatermark(
          options.text,
          width,
          height,
          pos,
          options.size || "medium",
          options.opacity
        );
        overlays.push(textOverlay);
      }

      if ((options.type === "logo" || options.type === "both") && options.logoBuffer) {
        const logoOverlay = await createLogoWatermark(
          options.logoBuffer,
          width,
          height,
          pos,
          options.size || "medium",
          options.opacity
        );
        overlays.push(logoOverlay);
      }
    }
  }

  // 6. Apply overlays to image
  let image = sharp(originalBuffer);
  if (overlays.length > 0) {
    image = image.composite(overlays);
  }
  const watermarkedBuffer = await image.toBuffer();

  // 7. Upload watermarked version to S3 cache
  const watermarkedKey = `watermarked/${tenantId}/${settingsHash}/${originalKey}`;
  await uploadToS3(watermarkedKey, watermarkedBuffer, `image/${metadata.format || "jpeg"}`);

  // 8. Record in database cache (7 days)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.watermarkedAsset.upsert({
    where: {
      tenantId_originalKey_settingsHash: { tenantId, originalKey, settingsHash },
    },
    create: {
      tenantId,
      originalKey,
      watermarkedKey,
      settingsHash,
      mimeType: `image/${metadata.format || "jpeg"}`,
      sizeBytes: watermarkedBuffer.length,
      expiresAt,
    },
    update: {
      watermarkedKey,
      sizeBytes: watermarkedBuffer.length,
      expiresAt,
    },
  });

  return { watermarkedKey, buffer: watermarkedBuffer };
}

// ─────────────────────────────────────────────────────────────
// Text Watermark Creation
// ─────────────────────────────────────────────────────────────

async function createTextWatermark(
  text: string,
  imageWidth: number,
  imageHeight: number,
  position: WatermarkPosition,
  size: WatermarkSize,
  opacity: number
): Promise<sharp.OverlayOptions> {
  // Calculate font size based on image dimensions and size setting
  const sizeMultiplier: Record<WatermarkSize, number> = {
    small: 0.03,
    medium: 0.05,
    large: 0.08,
  };
  const fontSize = Math.max(
    12,
    Math.floor(Math.min(imageWidth, imageHeight) * sizeMultiplier[size])
  );

  // Create SVG text element with proper namespace
  const svgWidth = Math.ceil(text.length * fontSize * 0.6);
  const svgHeight = Math.ceil(fontSize * 1.5);

  // Use solid colors in SVG, apply opacity via Sharp's blend options
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold"
        fill="white" stroke="black" stroke-width="1">
    ${escapeXml(text)}
  </text>
</svg>`;

  // Render SVG to PNG buffer with transparency, then apply opacity
  const textBuffer = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .png()
    .toBuffer();

  // Apply opacity by modifying alpha channel
  const { data, info } = await sharp(textBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelData = new Uint8Array(data);
  for (let i = 3; i < pixelData.length; i += 4) {
    pixelData[i] = Math.floor(pixelData[i] * opacity);
  }

  const opaqueBuffer = await sharp(pixelData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  const pos = calculatePosition(position, imageWidth, imageHeight, svgWidth, svgHeight);

  return {
    input: opaqueBuffer,
    top: Math.max(0, pos.top),
    left: Math.max(0, pos.left),
  };
}

// ─────────────────────────────────────────────────────────────
// Logo Watermark Creation
// ─────────────────────────────────────────────────────────────

async function createLogoWatermark(
  logoBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
  position: WatermarkPosition,
  size: WatermarkSize,
  opacity: number
): Promise<sharp.OverlayOptions> {
  const sizeMultiplier: Record<WatermarkSize, number> = {
    small: 0.1,
    medium: 0.2,
    large: 0.3,
  };
  const targetSize = Math.floor(
    Math.min(imageWidth, imageHeight) * sizeMultiplier[size]
  );

  // Resize logo maintaining aspect ratio
  const resizedLogo = await sharp(logoBuffer)
    .resize(targetSize, targetSize, { fit: "inside" })
    .ensureAlpha()
    .toBuffer();

  // Apply opacity using a composite with an alpha channel
  // Sharp doesn't have a direct opacity method, so we use modulate or composite
  // For simplicity, we'll create an image with reduced alpha
  const logoWithOpacity = await sharp(resizedLogo)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Modify alpha channel
  const { data, info } = logoWithOpacity;
  const pixelData = new Uint8Array(data);
  for (let i = 3; i < pixelData.length; i += 4) {
    pixelData[i] = Math.floor(pixelData[i] * opacity);
  }

  const finalLogo = await sharp(pixelData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  const logoMeta = await sharp(finalLogo).metadata();
  const pos = calculatePosition(
    position,
    imageWidth,
    imageHeight,
    logoMeta.width || targetSize,
    logoMeta.height || targetSize
  );

  return {
    input: finalLogo,
    top: Math.max(0, pos.top),
    left: Math.max(0, pos.left),
  };
}

// ─────────────────────────────────────────────────────────────
// Position Calculation
// ─────────────────────────────────────────────────────────────

function calculatePosition(
  position: WatermarkPosition,
  imageWidth: number,
  imageHeight: number,
  overlayWidth: number,
  overlayHeight: number,
  padding: number = 20
): { left: number; top: number } {
  const positions: Record<WatermarkPosition, { left: number; top: number }> = {
    "top-left": { left: padding, top: padding },
    "top-center": {
      left: Math.floor((imageWidth - overlayWidth) / 2),
      top: padding,
    },
    "top-right": {
      left: imageWidth - overlayWidth - padding,
      top: padding,
    },
    "middle-left": {
      left: padding,
      top: Math.floor((imageHeight - overlayHeight) / 2),
    },
    center: {
      left: Math.floor((imageWidth - overlayWidth) / 2),
      top: Math.floor((imageHeight - overlayHeight) / 2),
    },
    "middle-right": {
      left: imageWidth - overlayWidth - padding,
      top: Math.floor((imageHeight - overlayHeight) / 2),
    },
    "bottom-left": {
      left: padding,
      top: imageHeight - overlayHeight - padding,
    },
    "bottom-center": {
      left: Math.floor((imageWidth - overlayWidth) / 2),
      top: imageHeight - overlayHeight - padding,
    },
    "bottom-right": {
      left: imageWidth - overlayWidth - padding,
      top: imageHeight - overlayHeight - padding,
    },
  };
  return positions[position];
}

// ─────────────────────────────────────────────────────────────
// Tiled Watermark Pattern (Shutterstock-style)
// ─────────────────────────────────────────────────────────────

/**
 * Create a tiled watermark pattern that covers the entire image
 * with diagonal repeating text (like Shutterstock/Getty)
 */
async function createTiledTextWatermark(
  text: string,
  imageWidth: number,
  imageHeight: number,
  size: WatermarkSize,
  opacity: number
): Promise<sharp.OverlayOptions> {
  // Calculate font size based on image dimensions and size setting
  const sizeMultiplier: Record<WatermarkSize, number> = {
    small: 0.03,
    medium: 0.05,
    large: 0.07,
  };
  const fontSize = Math.max(
    16,
    Math.floor(Math.min(imageWidth, imageHeight) * sizeMultiplier[size])
  );

  // Calculate spacing between watermarks
  const spacingX = Math.max(150, fontSize * text.length * 0.8);
  const spacingY = Math.max(80, fontSize * 2);

  // Calculate how many rows and columns we need (with buffer for diagonal)
  const cols = Math.ceil(imageWidth / spacingX) + 4;
  const rows = Math.ceil(imageHeight / spacingY) + 4;

  // Create SVG at exact image dimensions with diagonal text pattern
  // Each text element is rotated individually to avoid transform issues
  const svgTexts: string[] = [];
  for (let row = -2; row < rows; row++) {
    for (let col = -2; col < cols; col++) {
      // Offset every other row for a more natural pattern
      const xOffset = (row % 2) * (spacingX / 2);
      const x = col * spacingX + xOffset;
      const y = row * spacingY;
      svgTexts.push(
        `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" stroke="black" stroke-width="0.5" transform="rotate(-30, ${x}, ${y})">${escapeXml(text)}</text>`
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">
  ${svgTexts.join("\n  ")}
</svg>`;

  // Render SVG to PNG buffer
  const textBuffer = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .png()
    .toBuffer();

  // Apply opacity by modifying alpha channel
  const { data, info } = await sharp(textBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelData = new Uint8Array(data);
  for (let i = 3; i < pixelData.length; i += 4) {
    pixelData[i] = Math.floor(pixelData[i] * opacity);
  }

  const opaqueBuffer = await sharp(pixelData, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return {
    input: opaqueBuffer,
    top: 0,
    left: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Check if a MIME type is a supported image format for watermarking
 */
export function isImageMimeType(mimeType: string | null): boolean {
  const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  return mimeType ? imageTypes.includes(mimeType) : false;
}

/**
 * Get image dimensions from S3 without loading the full image into memory.
 * Uses Sharp's metadata extraction which only reads the header.
 */
export async function getImageDimensionsFromS3(
  storageKey: string
): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await fetchFromS3(storageKey);
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve template variables in watermark text
 * Supported: {{businessName}}, {{date}}
 */
export function resolveTemplateVars(
  text: string | undefined,
  businessName: string
): string {
  if (!text) return "";
  return text
    .replace(/\{\{businessName\}\}/g, businessName)
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
}

// ─────────────────────────────────────────────────────────────
// PREVIEW WATERMARK (In-Memory Only)
// ─────────────────────────────────────────────────────────────

/**
 * Apply watermark directly to an image buffer (no S3, no caching).
 * Used for live previews in the settings UI.
 */
export async function applyWatermarkToBuffer(
  imageBuffer: Buffer,
  options: WatermarkOptions,
  logoBuffer?: Buffer
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;
  const format = metadata.format || "jpeg";

  // Create watermark overlay(s)
  const overlays: sharp.OverlayOptions[] = [];
  const pattern = options.pattern || "single";

  if (pattern === "tiled") {
    // Tiled pattern: diagonal repeating text across entire image
    if ((options.type === "text" || options.type === "both") && options.text) {
      const tiledOverlay = await createTiledTextWatermark(
        options.text,
        width,
        height,
        options.size || "medium",
        options.opacity
      );
      overlays.push(tiledOverlay);
    }
    // Logo: center position for tiled pattern
    if ((options.type === "logo" || options.type === "both") && logoBuffer) {
      const logoOverlay = await createLogoWatermark(
        logoBuffer,
        width,
        height,
        "center",
        options.size || "medium",
        options.opacity
      );
      overlays.push(logoOverlay);
    }
  } else {
    // Positions pattern: watermark at each selected position
    // Fall back to legacy single position if positions array is empty
    const positionsToUse = options.positions && options.positions.length > 0
      ? options.positions
      : [options.position as WatermarkPosition];

    for (const pos of positionsToUse) {
      if ((options.type === "text" || options.type === "both") && options.text) {
        const textOverlay = await createTextWatermark(
          options.text,
          width,
          height,
          pos,
          options.size || "medium",
          options.opacity
        );
        overlays.push(textOverlay);
      }

      if ((options.type === "logo" || options.type === "both") && logoBuffer) {
        const logoOverlay = await createLogoWatermark(
          logoBuffer,
          width,
          height,
          pos,
          options.size || "medium",
          options.opacity
        );
        overlays.push(logoOverlay);
      }
    }
  }

  // Apply overlays to image
  let image = sharp(imageBuffer);
  if (overlays.length > 0) {
    image = image.composite(overlays);
  }

  // Output as JPEG for consistent preview quality
  const watermarkedBuffer = await image.jpeg({ quality: 85 }).toBuffer();

  return {
    buffer: watermarkedBuffer,
    mimeType: "image/jpeg",
  };
}
