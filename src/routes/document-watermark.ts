// ─────────────────────────────────────────────────────────────
// DOCUMENT DOWNLOAD ROUTES WITH WATERMARKING
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  applyImageWatermark,
  calculateSettingsHash,
  fetchFromS3,
  uploadToS3,
  isImageMimeType,
  resolveTemplateVars,
} from "../services/watermark-service.js";
import { applyPdfWatermark } from "../services/pdf-watermark-service.js";
import {
  trackMediaAccess,
  getAccessLog,
  getDocumentAccessStats,
  determineActorType,
} from "../services/media-access-tracker.js";
import { generatePresignedDownloadUrl } from "../services/media-storage.js";
import type { WatermarkSettings, MediaAccessActor } from "../types/watermark.js";

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

const documentWatermarkRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  // GET /documents/:id/download - Download document with optional watermark
  app.get<{ Params: { id: string } }>(
    "/documents/:id/download",
    async (req, reply) => {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return reply.code(400).send({ error: "invalid_document_id" });
      }

      // Get viewer context from request
      const viewerTenantId = (req as any).tenantId
        ? Number((req as any).tenantId)
        : null;
      const viewerUserId = (req as any).userId as string | undefined;
      const marketplaceUserId = (req as any).marketplaceUserId
        ? Number((req as any).marketplaceUserId)
        : null;
      const partyId = (req as any).partyId
        ? Number((req as any).partyId)
        : null;

      // Fetch document with tenant settings
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          tenant: {
            select: { id: true, name: true, watermarkSettings: true },
          },
        },
      });

      if (!document || !document.storageKey) {
        return reply.code(404).send({ error: "document_not_found" });
      }

      // Determine actor type
      const actorType = determineActorType(
        viewerTenantId,
        document.tenantId,
        marketplaceUserId,
        partyId
      );

      // Check access permission
      const hasAccess = await checkDocumentAccess(
        document,
        actorType,
        marketplaceUserId
      );
      if (!hasAccess) {
        return reply.code(403).send({ error: "access_denied" });
      }

      // Determine if watermark should be applied
      // Owner always gets unwatermarked, others only if document has watermark enabled
      const shouldWatermark =
        actorType !== "OWNER" && document.watermarkEnabled;

      let downloadUrl: string;
      let watermarked = false;
      let watermarkHash: string | undefined;

      if (shouldWatermark) {
        const settings = document.tenant
          .watermarkSettings as WatermarkSettings | null;

        if (settings?.enabled) {
          try {
            const isImage = isImageMimeType(document.mimeType);
            const isPdf = document.mimeType === "application/pdf";

            if (isImage) {
              // Apply image watermark
              const resolvedText = resolveTemplateVars(
                settings.imageWatermark.text,
                document.tenant.name
              );

              const result = await applyImageWatermark(
                document.tenantId,
                document.storageKey,
                {
                  type: settings.imageWatermark.type,
                  text: resolvedText,
                  position: settings.imageWatermark.position,
                  opacity: settings.imageWatermark.opacity,
                  size: settings.imageWatermark.size,
                }
              );

              const presigned = await generatePresignedDownloadUrl(
                result.watermarkedKey,
                3600
              );
              downloadUrl = presigned.url;
              watermarked = true;
              watermarkHash = calculateSettingsHash({
                type: settings.imageWatermark.type,
                text: resolvedText,
                position: settings.imageWatermark.position,
                opacity: settings.imageWatermark.opacity,
                size: settings.imageWatermark.size,
              });
            } else if (isPdf) {
              // Apply PDF watermark (on-demand, no long-term caching)
              const originalBuffer = await fetchFromS3(document.storageKey);
              const resolvedText = resolveTemplateVars(
                settings.pdfWatermark.text,
                document.tenant.name
              );

              const watermarkedBuffer = await applyPdfWatermark(
                originalBuffer,
                {
                  type: settings.pdfWatermark.type,
                  text: resolvedText,
                  position: settings.pdfWatermark.position,
                  opacity: settings.pdfWatermark.opacity,
                }
              );

              // Upload to temp location (short TTL)
              const tempKey = `watermarked/${document.tenantId}/pdf/${Date.now()}-${document.id}.pdf`;
              await uploadToS3(tempKey, watermarkedBuffer, "application/pdf");

              const presigned = await generatePresignedDownloadUrl(tempKey, 3600);
              downloadUrl = presigned.url;
              watermarked = true;
            } else {
              // Unsupported type for watermarking, return original
              const presigned = await generatePresignedDownloadUrl(
                document.storageKey,
                3600
              );
              downloadUrl = presigned.url;
            }
          } catch (err) {
            req.log?.error?.({ err }, "Watermark failed, returning original");
            const presigned = await generatePresignedDownloadUrl(
              document.storageKey,
              3600
            );
            downloadUrl = presigned.url;
          }
        } else {
          // Watermarking not enabled at tenant level
          const presigned = await generatePresignedDownloadUrl(
            document.storageKey,
            3600
          );
          downloadUrl = presigned.url;
        }
      } else {
        // No watermark needed (owner or document not marked for watermark)
        const presigned = await generatePresignedDownloadUrl(
          document.storageKey,
          3600
        );
        downloadUrl = presigned.url;
      }

      // Track access (fire-and-forget, don't await)
      trackMediaAccess(req, {
        tenantId: document.tenantId,
        documentId: document.id,
        storageKey: document.storageKey,
        actorType,
        userId: viewerUserId,
        marketplaceUserId: marketplaceUserId ?? undefined,
        partyId: partyId ?? undefined,
        accessType: "DOWNLOAD",
        watermarked,
        watermarkHash,
      });

      return reply.send({
        url: downloadUrl,
        watermarked,
        expiresIn: 3600,
        filename:
          document.title || document.originalFileName || "document",
      });
    }
  );

  // PATCH /documents/:id/watermark - Toggle watermark for a document
  app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
    "/documents/:id/watermark",
    async (req, reply) => {
      const documentId = parseInt(req.params.id, 10);
      const tenantId = Number((req as any).tenantId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { tenantId: true },
      });

      if (!document) {
        return reply.code(404).send({ error: "document_not_found" });
      }

      if (document.tenantId !== tenantId) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const { enabled } = req.body;

      await prisma.document.update({
        where: { id: documentId },
        data: { watermarkEnabled: enabled },
      });

      return reply.send({ ok: true, watermarkEnabled: enabled });
    }
  );

  // GET /documents/:id/access-log - Get access log for a document
  app.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>("/documents/:id/access-log", async (req, reply) => {
    const documentId = parseInt(req.params.id, 10);
    const tenantId = Number((req as any).tenantId);

    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { tenantId: true },
    });

    if (!document) {
      return reply.code(404).send({ error: "document_not_found" });
    }

    if (document.tenantId !== tenantId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const page = parseInt(req.query.page || "1", 10);
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);

    const { events, total } = await getAccessLog(tenantId, {
      documentId,
      page,
      limit,
    });

    return reply.send({
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });

  // GET /documents/:id/access-stats - Get access statistics for a document
  app.get<{ Params: { id: string } }>(
    "/documents/:id/access-stats",
    async (req, reply) => {
      const documentId = parseInt(req.params.id, 10);
      const tenantId = Number((req as any).tenantId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { tenantId: true },
      });

      if (!document) {
        return reply.code(404).send({ error: "document_not_found" });
      }

      if (document.tenantId !== tenantId) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const stats = await getDocumentAccessStats(tenantId, documentId);

      return reply.send(stats);
    }
  );
};

// ─────────────────────────────────────────────────────────────
// Access Control Helper
// ─────────────────────────────────────────────────────────────

async function checkDocumentAccess(
  document: {
    tenantId: number;
    visibility: string | null;
  },
  actorType: MediaAccessActor,
  marketplaceUserId: number | null
): Promise<boolean> {
  // Owner always has access
  if (actorType === "OWNER") {
    return true;
  }

  // Public documents are accessible to all
  if (document.visibility === "PUBLIC") {
    return true;
  }

  // Buyer visibility requires marketplace user with buyer relationship
  if (document.visibility === "BUYERS" && marketplaceUserId) {
    // Check if this marketplace user has an active thread/relationship with the tenant
    const thread = await prisma.marketplaceMessageThread.findFirst({
      where: {
        clientId: marketplaceUserId,
        provider: { tenantId: document.tenantId },
      },
      select: { id: true },
    });
    return !!thread;
  }

  // Portal access could be added here

  return false;
}

export default documentWatermarkRoutes;
