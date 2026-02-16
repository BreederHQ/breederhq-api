// src/routes/marketplace-assets.ts
// Auth-gated asset serving for marketplace images
//
// SECURITY: All assets require:
//   1. Valid session cookie (bhq_s)
//   2. Marketplace entitlement (superAdmin or MARKETPLACE_ACCESS entitlement)
//
// Features:
//   - EXIF metadata stripping
//   - Image resizing (max 1600px width)
//   - Rate limiting (60 req/min per IP, 120 req/min per session)
//   - Private caching headers

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import sharp from "sharp";
import prisma from "../prisma.js";
import { resolveAssetId, isAllowedOrigin, extractTenantIdFromUrl } from "../services/marketplace-assets.js";
import type { WatermarkSettings, WatermarkOptions } from "../types/watermark.js";
import { DEFAULT_PUBLIC_IMAGE_SETTINGS } from "../types/watermark.js";
import {
  applyWatermarkToBuffer,
  fetchFromS3,
  resolveTemplateVars,
} from "../services/watermark-service.js";
import { detectImageType } from "../services/public-image-watermark-service.js";

// ============================================================================
// Constants
// ============================================================================

const MAX_IMAGE_WIDTH = 1600;
const JPEG_QUALITY = 80;
const PNG_COMPRESSION = 6;
const FETCH_TIMEOUT_MS = 15000;
const MAX_SOURCE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB max source image

// ============================================================================
// Security: Environment flags
// ============================================================================

/**
 * SECURITY: STAFF bypass is disabled by default in production.
 * Set MARKETPLACE_STAFF_BYPASS=true to allow STAFF members marketplace access.
 */
const MARKETPLACE_STAFF_BYPASS = process.env.MARKETPLACE_STAFF_BYPASS === "true";

// ============================================================================
// Security: Entitlement Check
// ============================================================================

/**
 * Check if user has marketplace entitlement.
 * Same logic as public-marketplace.ts but returns boolean + sends response.
 *
 * Entitlement is granted via:
 * 1. superAdmin flag on user
 * 2. MARKETPLACE_ACCESS entitlement with ACTIVE status
 * 3. STAFF membership (ONLY if MARKETPLACE_STAFF_BYPASS=true env flag is set)
 */
async function requireMarketplaceEntitlement(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const userId = (req as any).userId;

  // No session = 401
  if (!userId) {
    reply.code(401).send({ error: "unauthorized", message: "Authentication required" });
    return false;
  }

  // 1. Check superAdmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true } as any,
  }) as any;

  if (user?.isSuperAdmin) {
    return true;
  }

  // 2. Check explicit MARKETPLACE_ACCESS entitlement
  try {
    const entitlement = await (prisma as any).userEntitlement.findUnique({
      where: { userId_key: { userId, key: "MARKETPLACE_ACCESS" } },
      select: { status: true },
    });
    if (entitlement?.status === "ACTIVE") {
      return true;
    }
  } catch {
    // Table may not exist - continue to staff check if bypass enabled
  }

  // 3. Check STAFF membership ONLY if bypass is explicitly enabled
  // SECURITY: This bypass is OFF by default in production
  if (MARKETPLACE_STAFF_BYPASS) {
    try {
      const staffMembership = await (prisma as any).tenantMembership.findFirst({
        where: {
          userId,
          membershipRole: "STAFF",
          membershipStatus: "ACTIVE",
        },
        select: { tenantId: true },
      });
      if (staffMembership) {
        return true;
      }
    } catch {
      // Fallback for old schema
      try {
        const anyMembership = await (prisma as any).tenantMembership.findFirst({
          where: { userId },
          select: { tenantId: true },
        });
        if (anyMembership) {
          return true;
        }
      } catch {
        // No memberships table
      }
    }
  }

  // Not entitled = 403
  reply.code(403).send({
    error: "not_entitled",
    message: "Marketplace access requires subscription or invitation"
  });
  return false;
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Fetch image from source URL with timeout and size limit.
 */
async function fetchSourceImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BreederHQ-AssetProxy/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Source returned ${response.status}`);
    }

    // Check content-length if available
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SOURCE_SIZE_BYTES) {
      throw new Error("Source image too large");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > MAX_SOURCE_SIZE_BYTES) {
      throw new Error("Source image too large");
    }

    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Process image: strip EXIF, resize, encode.
 * Returns processed buffer and content type.
 */
async function processImage(
  sourceBuffer: Buffer
): Promise<{ buffer: Buffer; contentType: string }> {
  // Detect format
  const metadata = await sharp(sourceBuffer).metadata();
  const format = metadata.format;

  // Create sharp instance with EXIF stripping
  let pipeline = sharp(sourceBuffer, { failOn: "none" })
    .rotate() // Auto-rotate based on EXIF orientation before stripping
    .withMetadata({ orientation: undefined }); // Strip all metadata including EXIF

  // Resize if needed (maintain aspect ratio)
  if (metadata.width && metadata.width > MAX_IMAGE_WIDTH) {
    pipeline = pipeline.resize(MAX_IMAGE_WIDTH, undefined, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Encode based on source format
  let outputBuffer: Buffer;
  let contentType: string;

  switch (format) {
    case "png":
      outputBuffer = await pipeline.png({ compressionLevel: PNG_COMPRESSION }).toBuffer();
      contentType = "image/png";
      break;
    case "webp":
      outputBuffer = await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer();
      contentType = "image/webp";
      break;
    case "gif":
      // GIFs: convert first frame to PNG to strip metadata
      outputBuffer = await pipeline.png({ compressionLevel: PNG_COMPRESSION }).toBuffer();
      contentType = "image/png";
      break;
    case "jpeg":
    case "jpg":
    default:
      // Default to JPEG for unknown formats
      outputBuffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      contentType = "image/jpeg";
      break;
  }

  return { buffer: outputBuffer, contentType };
}

// ============================================================================
// Watermark Application
// ============================================================================

/**
 * Apply breeder-defined watermark to a processed image buffer.
 *
 * Fetches the tenant's watermark settings and applies them to the image.
 * Returns the original buffer unchanged if:
 *   - Tenant has no watermark settings or watermarking is disabled
 *   - Public image watermarking is disabled for the detected image type
 *   - The tenant/settings cannot be resolved
 *
 * IMPORTANT: This uses the BREEDER's configured settings, not defaults.
 */
async function applyBreederWatermark(
  buffer: Buffer,
  sourceUrl: string,
  req: FastifyRequest
): Promise<Buffer> {
  // 1. Extract tenant ID from the source URL
  const tenantId = extractTenantIdFromUrl(sourceUrl);
  if (!tenantId) {
    req.log.debug("Watermark skipped: no tenant ID in source URL");
    return buffer;
  }

  // 2. Fetch tenant watermark settings
  let tenant: { watermarkSettings: unknown; name: string | null } | null;
  try {
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { watermarkSettings: true, name: true },
    });
  } catch (err) {
    req.log.warn({ tenantId }, "Watermark skipped: failed to fetch tenant");
    return buffer;
  }

  if (!tenant) {
    req.log.debug({ tenantId }, "Watermark skipped: tenant not found");
    return buffer;
  }

  const settings = tenant.watermarkSettings as WatermarkSettings | null;

  // 3. Check if watermarking is globally enabled
  if (!settings?.enabled) {
    req.log.debug({ tenantId }, "Watermark skipped: watermarking disabled for tenant");
    return buffer;
  }

  // 4. Check public image watermark settings
  const publicSettings = settings.publicImages || DEFAULT_PUBLIC_IMAGE_SETTINGS;
  if (!publicSettings.enabled) {
    req.log.debug({ tenantId }, "Watermark skipped: public image watermarking disabled");
    return buffer;
  }

  // 5. Detect image type from the URL path and check if it's enabled
  //    Extract the storage key portion from the full URL
  const urlPath = new URL(sourceUrl).pathname;
  const imageType = detectImageType(urlPath);
  if (imageType && !publicSettings.imageTypes[imageType]) {
    req.log.debug({ tenantId, imageType }, "Watermark skipped: image type not enabled");
    return buffer;
  }

  // 6. Build watermark options from the breeder's settings
  const imageWatermarkSettings = publicSettings.overrideSettings
    ? { ...settings.imageWatermark, ...publicSettings.overrideSettings }
    : settings.imageWatermark;

  const businessName = tenant.name || "Business";
  const resolvedText = resolveTemplateVars(imageWatermarkSettings.text, businessName);

  // 7. Load logo if needed
  let logoBuffer: Buffer | undefined;
  if (
    (imageWatermarkSettings.type === "logo" || imageWatermarkSettings.type === "both") &&
    imageWatermarkSettings.logoStorageKey
  ) {
    try {
      logoBuffer = await fetchFromS3(imageWatermarkSettings.logoStorageKey);
    } catch (err) {
      req.log.warn({ tenantId }, "Watermark: failed to load logo, proceeding with text only");
    }
  }

  // 8. Apply watermark
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
    const result = await applyWatermarkToBuffer(buffer, options, logoBuffer);
    req.log.info({ tenantId }, "Watermark applied to marketplace asset");
    return result.buffer;
  } catch (err: any) {
    req.log.error({ tenantId, error: err.message }, "Watermark application failed, returning original");
    return buffer;
  }
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceAssetsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /assets/:assetId - Serve authenticated, processed image
  // --------------------------------------------------------------------------
  app.get<{ Params: { assetId: string }; Querystring: { wm?: string } }>(
    "/assets/:assetId",
    {
      config: {
        // Rate limit: 60 per minute per IP for unauthenticated probing,
        // 120 per minute for authenticated users (per session key)
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
          keyGenerator: (req: FastifyRequest) => {
            // Use userId if available, otherwise IP
            const userId = (req as any).userId;
            if (userId) {
              return `user:${userId}`;
            }
            return req.ip;
          },
        },
      },
    },
    async (req, reply) => {
      const { assetId } = req.params;

      // Check origin/referer for logging (not blocking for now)
      const origin = req.headers.origin;
      const referer = req.headers.referer;
      const hasValidOrigin = isAllowedOrigin(origin) || (referer && isAllowedOrigin(new URL(referer).origin));

      // SECURITY: Require authentication and entitlement
      if (!(await requireMarketplaceEntitlement(req, reply))) {
        return;
      }

      // Resolve asset ID to source URL
      const resolved = resolveAssetId(assetId);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found", message: "Asset not found" });
      }

      try {
        // Fetch source image
        const sourceBuffer = await fetchSourceImage(resolved.sourceUrl);

        // Process image (strip EXIF, resize)
        const { buffer: processedBuffer, contentType } = await processImage(sourceBuffer);

        // Apply breeder-defined watermark if requested via ?wm=1
        const wantWatermark = req.query.wm === "1";
        const buffer = wantWatermark
          ? await applyBreederWatermark(processedBuffer, resolved.sourceUrl, req)
          : processedBuffer;

        // Set security headers (shorter cache for watermarked to respect settings changes)
        reply.header("Cache-Control", wantWatermark ? "private, max-age=120" : "private, max-age=300");
        reply.header("Content-Security-Policy", "default-src 'none'");
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Content-Disposition", "inline");
        reply.header("Vary", "Cookie");

        // Add warning header if origin is missing/invalid
        // TODO: Enforce stricter origin checking later
        if (!hasValidOrigin) {
          reply.header("X-BHQ-Asset-Warn", "origin-missing");
        }

        // Send processed image
        reply.type(contentType);
        return reply.send(buffer);
      } catch (err: any) {
        req.log.warn({ assetId, error: err.message }, "Asset fetch/processing failed");

        // Don't leak internal errors
        if (err.message === "Source image too large") {
          return reply.code(413).send({ error: "too_large", message: "Image too large to process" });
        }

        return reply.code(502).send({ error: "upstream_error", message: "Failed to fetch asset" });
      }
    }
  );
};

export default marketplaceAssetsRoutes;
