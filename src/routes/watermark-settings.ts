// ─────────────────────────────────────────────────────────────
// WATERMARK SETTINGS ROUTES
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  invalidateWatermarkCache,
  applyWatermarkToBuffer,
  fetchFromS3,
  resolveTemplateVars,
} from "../services/watermark-service.js";
import { applyPdfWatermark } from "../services/pdf-watermark-service.js";
import type { WatermarkSettings, WatermarkOptions } from "../types/watermark.js";

// ─────────────────────────────────────────────────────────────
// Default Settings
// ─────────────────────────────────────────────────────────────

function getDefaultSettings(): WatermarkSettings {
  return {
    enabled: false,
    imageWatermark: {
      type: "text",
      text: "{{businessName}}",
      position: "bottom-right",
      opacity: 0.3,
      size: "medium",
    },
    pdfWatermark: {
      type: "text",
      text: "{{businessName}}",
      position: "diagonal",
      opacity: 0.2,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

function validateSettings(
  settings: unknown
): { valid: boolean; error?: string } {
  if (!settings || typeof settings !== "object") {
    return { valid: false, error: "Settings must be an object" };
  }

  const s = settings as Record<string, unknown>;

  if (typeof s.enabled !== "boolean") {
    return { valid: false, error: "enabled must be boolean" };
  }

  const validTypes = ["text", "logo", "both"];
  const validPositions = [
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "center",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ];
  const validPdfPositions = ["diagonal", "header", "footer"];
  const validSizes = ["small", "medium", "large"];
  const validPatterns = ["positions", "tiled"];

  // Validate image watermark settings
  if (s.imageWatermark && typeof s.imageWatermark === "object") {
    const img = s.imageWatermark as Record<string, unknown>;

    if (!validTypes.includes(img.type as string)) {
      return { valid: false, error: "Invalid image watermark type" };
    }
    if (!validPositions.includes(img.position as string)) {
      return { valid: false, error: "Invalid image watermark position" };
    }
    if (!validSizes.includes(img.size as string)) {
      return { valid: false, error: "Invalid image watermark size" };
    }
    if (
      typeof img.opacity !== "number" ||
      img.opacity < 0.1 ||
      img.opacity > 1
    ) {
      return { valid: false, error: "Image opacity must be between 0.1 and 1" };
    }
    // Pattern is optional, defaults to "single"
    if (img.pattern !== undefined && !validPatterns.includes(img.pattern as string)) {
      return { valid: false, error: "Invalid image watermark pattern" };
    }
    // Validate positions array for multi pattern
    if (img.positions !== undefined) {
      if (!Array.isArray(img.positions)) {
        return { valid: false, error: "Positions must be an array" };
      }
      for (const pos of img.positions as string[]) {
        if (!validPositions.includes(pos)) {
          return { valid: false, error: `Invalid position in positions array: ${pos}` };
        }
      }
    }
  }

  // Validate PDF watermark settings
  if (s.pdfWatermark && typeof s.pdfWatermark === "object") {
    const pdf = s.pdfWatermark as Record<string, unknown>;

    if (!validTypes.includes(pdf.type as string)) {
      return { valid: false, error: "Invalid PDF watermark type" };
    }
    if (!validPdfPositions.includes(pdf.position as string)) {
      return { valid: false, error: "Invalid PDF watermark position" };
    }
    if (
      typeof pdf.opacity !== "number" ||
      pdf.opacity < 0.1 ||
      pdf.opacity > 0.5
    ) {
      return { valid: false, error: "PDF opacity must be between 0.1 and 0.5" };
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

const watermarkSettingsRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  // GET /settings/watermark - Get watermark settings
  app.get("/settings/watermark", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { watermarkSettings: true },
    });

    if (!tenant) {
      return reply.code(404).send({ error: "tenant_not_found" });
    }

    const settings =
      (tenant.watermarkSettings as WatermarkSettings) || getDefaultSettings();

    return reply.send({ settings });
  });

  // PUT /settings/watermark - Update watermark settings
  app.put<{ Body: WatermarkSettings }>(
    "/settings/watermark",
    async (req, reply) => {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const settings = req.body;

      // Validate
      const validation = validateSettings(settings);
      if (!validation.valid) {
        return reply
          .code(400)
          .send({ error: "invalid_settings", message: validation.error });
      }

      // Update tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { watermarkSettings: settings as object },
      });

      // Invalidate cache when settings change
      const invalidated = await invalidateWatermarkCache(tenantId);
      req.log?.info?.({ tenantId, invalidated }, "Watermark cache invalidated");

      return reply.send({ ok: true, settings });
    }
  );

  // DELETE /settings/watermark/cache - Manually invalidate watermark cache
  app.delete("/settings/watermark/cache", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const invalidated = await invalidateWatermarkCache(tenantId);

    return reply.send({ ok: true, invalidated });
  });

  // ─────────────────────────────────────────────────────────────
  // Preview Endpoint (In-Memory, No Persistence)
  // ─────────────────────────────────────────────────────────────

  // POST /settings/watermark/preview - Generate watermark preview
  // Body limit increased to 8MB to accommodate base64-encoded 5MB files (~33% overhead)
  app.post<{
    Body: {
      fileData: string; // Base64-encoded file data
      fileName: string;
      mimeType: string;
      settings?: WatermarkSettings; // Optional - uses tenant settings if not provided
    };
  }>("/settings/watermark/preview", { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const { fileData, fileName, mimeType, settings: providedSettings } = req.body;

    // Validate required fields
    if (!fileData || !fileName || !mimeType) {
      return reply.code(400).send({
        error: "missing_fields",
        message: "fileData, fileName, and mimeType are required",
      });
    }

    // Validate file type
    const isImage = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType);
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return reply.code(400).send({
        error: "unsupported_file_type",
        message: "Only JPEG, PNG, WebP images and PDF files are supported",
      });
    }

    // Decode base64 and check size (5MB limit for preview)
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(fileData, "base64");
    } catch {
      return reply.code(400).send({
        error: "invalid_file_data",
        message: "Could not decode base64 file data",
      });
    }

    const MAX_PREVIEW_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.length > MAX_PREVIEW_SIZE) {
      return reply.code(400).send({
        error: "file_too_large",
        message: "Preview files must be under 5MB",
      });
    }

    // Get settings (use provided or fetch from tenant)
    let settings: WatermarkSettings;
    if (providedSettings) {
      settings = providedSettings;
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { watermarkSettings: true, name: true },
      });
      if (!tenant) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }
      settings = (tenant.watermarkSettings as WatermarkSettings) || getDefaultSettings();
    }

    // Get tenant name for template variables
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const businessName = tenant?.name || "Business";

    try {
      if (isImage) {
        // Process image watermark
        const imageSettings = settings.imageWatermark;
        const resolvedText = resolveTemplateVars(imageSettings.text, businessName);

        // Load logo if needed
        let logoBuffer: Buffer | undefined;
        if (
          (imageSettings.type === "logo" || imageSettings.type === "both") &&
          imageSettings.logoStorageKey
        ) {
          try {
            logoBuffer = await fetchFromS3(imageSettings.logoStorageKey);
          } catch (err) {
            req.log?.warn?.({ err }, "Could not load logo for preview");
          }
        }

        const options: WatermarkOptions = {
          type: imageSettings.type,
          text: resolvedText,
          logoBuffer,
          position: imageSettings.position,
          positions: imageSettings.positions,
          opacity: imageSettings.opacity,
          size: imageSettings.size,
          pattern: imageSettings.pattern || "positions",
        };

        const result = await applyWatermarkToBuffer(fileBuffer, options, logoBuffer);

        return reply.send({
          preview: `data:${result.mimeType};base64,${result.buffer.toString("base64")}`,
          mimeType: result.mimeType,
          originalFileName: fileName,
        });
      } else {
        // Process PDF watermark
        const pdfSettings = settings.pdfWatermark;
        const resolvedText = resolveTemplateVars(pdfSettings.text, businessName);

        // Load logo if needed
        let logoBuffer: Buffer | undefined;
        if (
          (pdfSettings.type === "logo" || pdfSettings.type === "both") &&
          pdfSettings.logoStorageKey
        ) {
          try {
            logoBuffer = await fetchFromS3(pdfSettings.logoStorageKey);
          } catch (err) {
            req.log?.warn?.({ err }, "Could not load logo for preview");
          }
        }

        const pdfOptions = {
          type: pdfSettings.type,
          text: resolvedText,
          logoBuffer,
          position: pdfSettings.position,
          opacity: pdfSettings.opacity,
        };

        const watermarkedPdf = await applyPdfWatermark(fileBuffer, pdfOptions);

        // For PDFs, return the full watermarked PDF as base64
        return reply.send({
          preview: `data:application/pdf;base64,${watermarkedPdf.toString("base64")}`,
          mimeType: "application/pdf",
          originalFileName: fileName,
        });
      }
    } catch (err) {
      req.log?.error?.({ err }, "Failed to generate watermark preview");
      return reply.code(500).send({
        error: "preview_failed",
        message: "Failed to generate watermark preview",
      });
    }
  });
};

export default watermarkSettingsRoutes;
