// ─────────────────────────────────────────────────────────────
// PUBLIC IMAGE WATERMARK SERVICE
// Applies watermarks to public-facing images based on tenant settings
// ─────────────────────────────────────────────────────────────

import prisma from "../prisma.js";
import {
  applyImageWatermark,
  fetchFromS3,
  resolveTemplateVars,
  isImageMimeType,
  getImageDimensionsFromS3,
} from "./watermark-service.js";
import { generatePresignedDownloadUrl } from "./media-storage.js";
import type {
  WatermarkSettings,
  WatermarkOptions,
  PublicImageType,
  PublicImageWatermarkSettings,
} from "../types/watermark.js";
import { DEFAULT_PUBLIC_IMAGE_SETTINGS } from "../types/watermark.js";

// ─────────────────────────────────────────────────────────────
// Image Type Detection from Storage Key
// ─────────────────────────────────────────────────────────────

/**
 * Detect the public image type from a storage key pattern.
 *
 * Storage key patterns:
 * - tenants/{t}/animals/{a}/photo.jpg → animalProfile
 * - tenants/{t}/programs/{p}/cover.jpg → breedingProgramCover
 * - tenants/{t}/programs/{p}/media/{m} → breedingProgramGallery
 * - tenants/{t}/offspring/{o}/cover.jpg → offspringGroupCover
 * - tenants/{t}/services/{s}/banner.jpg → serviceListingBanner
 * - tenants/{t}/services/{s}/gallery/{g} → serviceGallery
 * - tenants/{t}/profile/banner.jpg → breederBanner
 * - tenants/{t}/profile/logo.jpg → breederLogo
 * - providers/{p}/banner.jpg → breederBanner (marketplace providers)
 * - providers/{p}/logo.jpg → breederLogo (marketplace providers)
 */
export function detectImageType(storageKey: string): PublicImageType | null {
  const key = storageKey.toLowerCase();

  // Animal profile photos
  if (/tenants\/\d+\/animals\/\d+\/(photo|profile)/i.test(storageKey)) {
    return "animalProfile";
  }

  // Breeding program covers
  if (/tenants\/\d+\/programs\/\d+\/cover/i.test(storageKey)) {
    return "breedingProgramCover";
  }

  // Breeding program gallery/media
  if (/tenants\/\d+\/programs\/\d+\/(media|gallery)/i.test(storageKey)) {
    return "breedingProgramGallery";
  }

  // Offspring group covers
  if (/tenants\/\d+\/offspring\/\d+\/cover/i.test(storageKey)) {
    return "offspringGroupCover";
  }

  // Service listing banners
  if (/tenants\/\d+\/services\/[^/]+\/banner/i.test(storageKey)) {
    return "serviceListingBanner";
  }

  // Service gallery
  if (/tenants\/\d+\/services\/[^/]+\/gallery/i.test(storageKey)) {
    return "serviceGallery";
  }

  // Breeder profile banner (tenant or provider)
  if (/tenants\/\d+\/profile\/banner/i.test(storageKey) ||
      /providers\/\d+\/banner/i.test(storageKey)) {
    return "breederBanner";
  }

  // Breeder logo (tenant or provider)
  if (/tenants\/\d+\/profile\/logo/i.test(storageKey) ||
      /providers\/\d+\/logo/i.test(storageKey)) {
    return "breederLogo";
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Size Threshold Check
// ─────────────────────────────────────────────────────────────

const SIZE_THRESHOLDS = {
  none: 0,
  small: 200,
  medium: 400,
  large: 800,
};

/**
 * Check if an image meets the minimum size threshold for watermarking.
 * Uses the larger dimension (width or height).
 */
export function meetsMinSizeThreshold(
  width: number,
  height: number,
  threshold: keyof typeof SIZE_THRESHOLDS
): boolean {
  const minSize = SIZE_THRESHOLDS[threshold];
  return Math.max(width, height) >= minSize;
}

// ─────────────────────────────────────────────────────────────
// Main Public Image Watermark Function
// ─────────────────────────────────────────────────────────────

export interface PublicImageWatermarkResult {
  shouldWatermark: boolean;
  watermarkedKey?: string;
  presignedUrl?: string;
  reason?: string;
}

/**
 * Get a watermarked presigned URL for a public image if watermarking is enabled.
 *
 * @param tenantId - The tenant ID
 * @param storageKey - The original S3 storage key
 * @param mimeType - The MIME type of the file (optional, will be detected if not provided)
 * @returns Result with presigned URL to watermarked or original image
 */
export async function getPublicImageWatermarkUrl(
  tenantId: number,
  storageKey: string,
  mimeType?: string | null
): Promise<PublicImageWatermarkResult> {
  // 1. Check if this is an image
  if (mimeType && !isImageMimeType(mimeType)) {
    return { shouldWatermark: false, reason: "Not an image file" };
  }

  // 2. Detect image type from storage key
  const imageType = detectImageType(storageKey);
  if (!imageType) {
    return { shouldWatermark: false, reason: "Unknown image type" };
  }

  // 3. Get tenant watermark settings
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { watermarkSettings: true, name: true },
  });

  if (!tenant) {
    return { shouldWatermark: false, reason: "Tenant not found" };
  }

  const settings = tenant.watermarkSettings as WatermarkSettings | null;

  // 4. Check if watermarking is enabled globally
  if (!settings?.enabled) {
    return { shouldWatermark: false, reason: "Watermarking disabled" };
  }

  // 5. Get public image settings (use defaults if not set)
  const publicSettings: PublicImageWatermarkSettings =
    settings.publicImages || DEFAULT_PUBLIC_IMAGE_SETTINGS;

  // 6. Check if public image watermarking is enabled
  if (!publicSettings.enabled) {
    return { shouldWatermark: false, reason: "Public image watermarking disabled" };
  }

  // 7. Check if this image type should be watermarked
  if (!publicSettings.imageTypes[imageType]) {
    return { shouldWatermark: false, reason: `Image type ${imageType} not enabled` };
  }

  // 7.5. Check if image meets minimum size threshold
  const minSizeThreshold = publicSettings.minSizeToWatermark || "medium";
  if (minSizeThreshold !== "none") {
    const dimensions = await getImageDimensionsFromS3(storageKey);
    if (dimensions) {
      if (!meetsMinSizeThreshold(dimensions.width, dimensions.height, minSizeThreshold)) {
        return {
          shouldWatermark: false,
          reason: `Image too small (${dimensions.width}×${dimensions.height}px, threshold: ${minSizeThreshold})`,
        };
      }
    }
  }

  // 8. Get the watermark settings to use
  const imageWatermarkSettings = publicSettings.overrideSettings
    ? { ...settings.imageWatermark, ...publicSettings.overrideSettings }
    : settings.imageWatermark;

  // 9. Resolve template variables
  const businessName = tenant.name || "Business";
  const resolvedText = resolveTemplateVars(imageWatermarkSettings.text, businessName);

  // 10. Load logo if needed
  let logoBuffer: Buffer | undefined;
  if (
    (imageWatermarkSettings.type === "logo" || imageWatermarkSettings.type === "both") &&
    imageWatermarkSettings.logoStorageKey
  ) {
    try {
      logoBuffer = await fetchFromS3(imageWatermarkSettings.logoStorageKey);
    } catch (err) {
      console.warn("Could not load logo for public image watermark:", err);
    }
  }

  // 11. Apply watermark (uses cache)
  const options: WatermarkOptions = {
    type: imageWatermarkSettings.type,
    text: resolvedText,
    logoBuffer,
    position: imageWatermarkSettings.position,
    positions: imageWatermarkSettings.positions,
    opacity: imageWatermarkSettings.opacity,
    size: imageWatermarkSettings.size,
    pattern: imageWatermarkSettings.pattern || "positions",
  };

  try {
    const { watermarkedKey } = await applyImageWatermark(tenantId, storageKey, options);

    // 12. Generate presigned URL for the watermarked image
    const presignedResult = await generatePresignedDownloadUrl(watermarkedKey, 3600);

    return {
      shouldWatermark: true,
      watermarkedKey,
      presignedUrl: presignedResult.url,
    };
  } catch (err) {
    console.error("Failed to apply public image watermark:", err);
    // Fall back to original image on error
    return { shouldWatermark: false, reason: "Watermark application failed" };
  }
}

/**
 * Check if a storage key represents a public image type (without applying watermark).
 * Useful for quick filtering before fetching settings.
 */
export function isPublicImageType(storageKey: string): boolean {
  return detectImageType(storageKey) !== null;
}
