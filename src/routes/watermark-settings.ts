// ─────────────────────────────────────────────────────────────
// WATERMARK SETTINGS ROUTES
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { invalidateWatermarkCache } from "../services/watermark-service.js";
import type { WatermarkSettings } from "../types/watermark.js";

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
};

export default watermarkSettingsRoutes;
