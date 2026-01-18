// src/routes/media.ts
// Unified media upload API supporting both providers and tenants

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getPublicCdnUrl,
  deleteFile,
  fileExists,
  validateContentType,
  validateFileSize,
  parseStorageKey,
  type UploadContext,
  type OwnerType,
  type TenantPurpose,
  type ProviderPurpose,
} from "../services/media-storage.js";
import type { DocVisibility, DocStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UploadUrlRequest {
  filename: string;
  contentType: string;
  contentLength?: number;
  context:
    | {
        type: "provider";
        providerId: number;
        purpose: ProviderPurpose;
        resourceId?: string;
        subPath?: string;
      }
    | {
        type: "tenant";
        tenantId: number;
        purpose: TenantPurpose;
        resourceId?: string;
        subPath?: string;
      };
  visibility?: DocVisibility;
}

interface ConfirmUploadRequest {
  storageKey: string;
}

interface VisibilityChangeRequest {
  visibility: DocVisibility;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getActorInfo(request: FastifyRequest): {
  userId: string | null;
  tenantId: number | null;
  providerId: number | null;
} {
  const userId = (request as any).userId || (request as any).marketplaceUserId || null;
  const tenantId = (request as any).tenantId || null;
  const providerId = (request as any).marketplaceProvider?.id || null;

  return { userId, tenantId, providerId };
}

async function checkDocumentOwnership(
  storageKey: string,
  actor: { userId: string | null; tenantId: number | null; providerId: number | null }
): Promise<{ owned: boolean; document: any | null }> {
  const document = await prisma.document.findFirst({
    where: { storageKey },
  });

  if (!document) {
    return { owned: false, document: null };
  }

  // Check tenant ownership
  if (document.tenantId && actor.tenantId === document.tenantId) {
    return { owned: true, document };
  }

  // Check provider ownership (via providerId field if we add it)
  // For now, providers don't have Document records - they use marketplace tables

  return { owned: false, document };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload-url - Get presigned URL for upload
// ─────────────────────────────────────────────────────────────────────────────

async function handleUploadUrl(
  request: FastifyRequest<{ Body: UploadUrlRequest }>,
  reply: FastifyReply
) {
  const { filename, contentType, contentLength, context, visibility } = request.body;
  const actor = getActorInfo(request);

  // Validate required fields
  if (!filename || typeof filename !== "string") {
    return reply.status(400).send({
      error: "invalid_filename",
      message: "Filename is required",
    });
  }

  if (!contentType || typeof contentType !== "string") {
    return reply.status(400).send({
      error: "invalid_content_type",
      message: "Content type is required",
    });
  }

  if (!context || !context.type) {
    return reply.status(400).send({
      error: "invalid_context",
      message: "Upload context is required",
    });
  }

  // Validate content type for this purpose
  const typeValidation = validateContentType(contentType, context.purpose);
  if (!typeValidation.valid) {
    return reply.status(400).send({
      error: "invalid_content_type",
      message: typeValidation.error,
    });
  }

  // Validate file size if provided
  if (contentLength) {
    const sizeValidation = validateFileSize(contentLength, contentType);
    if (!sizeValidation.valid) {
      return reply.status(400).send({
        error: "file_too_large",
        message: sizeValidation.error,
      });
    }
  }

  // Authorization check
  if (context.type === "provider") {
    // Must be the provider or have marketplace session
    if (!actor.providerId) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "Provider authentication required",
      });
    }
    if (actor.providerId !== context.providerId) {
      return reply.status(403).send({
        error: "forbidden",
        message: "You can only upload to your own provider account",
      });
    }
  } else if (context.type === "tenant") {
    // Must be authenticated to this tenant
    if (!actor.tenantId) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "Tenant authentication required",
      });
    }
    if (actor.tenantId !== context.tenantId) {
      return reply.status(403).send({
        error: "forbidden",
        message: "You can only upload to your own tenant account",
      });
    }
  }

  try {
    // Build upload context
    const uploadContext: UploadContext = {
      ownerType: context.type as OwnerType,
      ownerId: context.type === "provider" ? context.providerId : context.tenantId,
      purpose: context.purpose,
      resourceId: context.resourceId,
      subPath: context.subPath,
    };

    // Generate presigned URL
    const result = await generatePresignedUploadUrl(
      uploadContext,
      filename,
      contentType,
      contentLength
    );

    // Create Document record with UPLOADING status (for tenant uploads)
    if (context.type === "tenant") {
      await prisma.document.create({
        data: {
          tenantId: context.tenantId,
          scope: mapPurposeToScope(context.purpose),
          kind: "generic",
          title: filename,
          storageKey: result.storageKey,
          storageProvider: "s3",
          bucket: process.env.S3_BUCKET,
          objectKey: result.storageKey,
          mimeType: contentType,
          bytes: contentLength || null,
          originalFileName: filename,
          visibility: visibility || "PRIVATE",
          status: "UPLOADING",
          // Link to resource if provided
          animalId: context.purpose === "animal" && context.resourceId
            ? parseInt(context.resourceId, 10)
            : null,
          contractId: context.purpose === "contract" && context.resourceId
            ? parseInt(context.resourceId, 10)
            : null,
        },
      });
    }

    // For provider uploads, we could create a separate ProviderMedia record
    // or use marketplace-specific tables - for now just return the URL

    return reply.send({
      uploadUrl: result.uploadUrl,
      storageKey: result.storageKey,
      cdnUrl: result.cdnUrl,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    request.log.error(error, "Failed to generate presigned upload URL");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to generate upload URL",
    });
  }
}

function mapPurposeToScope(purpose: string): "animal" | "offspring" | "contract" | "invoice" | "group" {
  switch (purpose) {
    case "animal":
      return "animal";
    case "offspring":
      return "offspring";
    case "contract":
      return "contract";
    case "finance":
      return "invoice";
    default:
      return "animal"; // Default fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /confirm - Confirm upload completed
// ─────────────────────────────────────────────────────────────────────────────

async function handleConfirmUpload(
  request: FastifyRequest<{ Body: ConfirmUploadRequest }>,
  reply: FastifyReply
) {
  const { storageKey } = request.body;
  const actor = getActorInfo(request);

  if (!storageKey) {
    return reply.status(400).send({
      error: "missing_storage_key",
      message: "Storage key is required",
    });
  }

  try {
    // Verify file exists in S3
    const exists = await fileExists(storageKey);
    if (!exists) {
      return reply.status(404).send({
        error: "file_not_found",
        message: "File not found in storage. Upload may have failed.",
      });
    }

    // Update Document record if it exists
    const document = await prisma.document.findFirst({
      where: { storageKey },
    });

    if (document) {
      // Verify ownership
      if (document.tenantId && document.tenantId !== actor.tenantId) {
        return reply.status(403).send({
          error: "forbidden",
          message: "You do not have permission to confirm this upload",
        });
      }

      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "READY",
        },
      });
    }

    return reply.send({
      ok: true,
      storageKey,
      status: "READY",
    });
  } catch (error) {
    request.log.error(error, "Failed to confirm upload");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to confirm upload",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /access/:storageKey - Get access URL for a file
// ─────────────────────────────────────────────────────────────────────────────

async function handleGetAccessUrl(
  request: FastifyRequest<{ Params: { storageKey: string } }>,
  reply: FastifyReply
) {
  const { storageKey } = request.params;
  const actor = getActorInfo(request);

  if (!storageKey) {
    return reply.status(400).send({
      error: "missing_storage_key",
      message: "Storage key is required",
    });
  }

  const decodedKey = decodeURIComponent(storageKey);

  try {
    // Parse storage key to determine owner
    const parsed = parseStorageKey(decodedKey);
    if (!parsed) {
      return reply.status(400).send({
        error: "invalid_storage_key",
        message: "Invalid storage key format",
      });
    }

    // Look up document record for visibility info
    const document = await prisma.document.findFirst({
      where: { storageKey: decodedKey },
    });

    // Determine access
    let hasAccess = false;
    let visibility: DocVisibility = "PRIVATE";

    if (document) {
      visibility = document.visibility || "PRIVATE";

      // PUBLIC files are accessible to everyone
      if (visibility === "PUBLIC") {
        hasAccess = true;
      }
      // Owner (same tenant) has access
      else if (document.tenantId && document.tenantId === actor.tenantId) {
        hasAccess = true;
      }
      // BUYERS visibility - check buyer relationship
      else if (visibility === "BUYERS" && actor.userId) {
        // TODO: Implement buyer relationship check
        // For now, deny access
        hasAccess = false;
      }
    } else {
      // No document record - check ownership from storage key
      if (parsed.ownerType === "tenant" && parsed.ownerId === actor.tenantId) {
        hasAccess = true;
      } else if (parsed.ownerType === "provider" && parsed.ownerId === actor.providerId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return reply.status(403).send({
        error: "forbidden",
        message: "You do not have permission to access this file",
      });
    }

    // Return appropriate URL
    if (visibility === "PUBLIC") {
      // Direct CDN URL for public files
      return reply.send({
        url: getPublicCdnUrl(decodedKey),
        visibility,
        expiresIn: null, // Public URLs don't expire
      });
    } else {
      // Presigned URL for private files
      const result = await generatePresignedDownloadUrl(decodedKey, 3600);
      return reply.send({
        url: result.url,
        visibility,
        expiresIn: result.expiresIn,
      });
    }
  } catch (error) {
    request.log.error(error, "Failed to get access URL");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to get access URL",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:storageKey/visibility - Change file visibility
// ─────────────────────────────────────────────────────────────────────────────

async function handleChangeVisibility(
  request: FastifyRequest<{
    Params: { storageKey: string };
    Body: VisibilityChangeRequest;
  }>,
  reply: FastifyReply
) {
  const { storageKey } = request.params;
  const { visibility } = request.body;
  const actor = getActorInfo(request);

  if (!storageKey) {
    return reply.status(400).send({
      error: "missing_storage_key",
      message: "Storage key is required",
    });
  }

  const validVisibilities: DocVisibility[] = ["PRIVATE", "BUYERS", "PUBLIC"];
  if (!visibility || !validVisibilities.includes(visibility)) {
    return reply.status(400).send({
      error: "invalid_visibility",
      message: "Visibility must be PRIVATE, BUYERS, or PUBLIC",
    });
  }

  const decodedKey = decodeURIComponent(storageKey);

  try {
    // Find document record
    const document = await prisma.document.findFirst({
      where: { storageKey: decodedKey },
    });

    if (!document) {
      return reply.status(404).send({
        error: "not_found",
        message: "Document not found",
      });
    }

    // Verify ownership
    if (document.tenantId !== actor.tenantId) {
      return reply.status(403).send({
        error: "forbidden",
        message: "You can only change visibility of your own files",
      });
    }

    // Update visibility
    await prisma.document.update({
      where: { id: document.id },
      data: { visibility },
    });

    return reply.send({
      ok: true,
      storageKey: decodedKey,
      visibility,
    });
  } catch (error) {
    request.log.error(error, "Failed to change visibility");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to change visibility",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:storageKey - Delete a file
// ─────────────────────────────────────────────────────────────────────────────

async function handleDeleteFile(
  request: FastifyRequest<{ Params: { storageKey: string } }>,
  reply: FastifyReply
) {
  const { storageKey } = request.params;
  const actor = getActorInfo(request);

  if (!storageKey) {
    return reply.status(400).send({
      error: "missing_storage_key",
      message: "Storage key is required",
    });
  }

  const decodedKey = decodeURIComponent(storageKey);

  try {
    // Parse storage key to determine owner
    const parsed = parseStorageKey(decodedKey);
    if (!parsed) {
      return reply.status(400).send({
        error: "invalid_storage_key",
        message: "Invalid storage key format",
      });
    }

    // Verify ownership
    let hasPermission = false;

    if (parsed.ownerType === "tenant" && parsed.ownerId === actor.tenantId) {
      hasPermission = true;
    } else if (parsed.ownerType === "provider" && parsed.ownerId === actor.providerId) {
      hasPermission = true;
    }

    // Also check document record if it exists
    const document = await prisma.document.findFirst({
      where: { storageKey: decodedKey },
    });

    if (document) {
      if (document.tenantId && document.tenantId !== actor.tenantId) {
        hasPermission = false;
      }
    }

    if (!hasPermission) {
      return reply.status(403).send({
        error: "forbidden",
        message: "You do not have permission to delete this file",
      });
    }

    // Delete from S3
    await deleteFile(decodedKey);

    // Update/delete document record if it exists
    if (document) {
      await prisma.document.update({
        where: { id: document.id },
        data: { status: "FAILED" }, // Mark as failed/deleted
      });
    }

    return reply.send({ ok: true });
  } catch (error) {
    request.log.error(error, "Failed to delete file");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to delete file",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────────────────

export default async function mediaRoutes(fastify: FastifyInstance) {
  // POST /api/v1/media/upload-url - Get presigned upload URL
  fastify.post("/upload-url", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
    handler: handleUploadUrl,
  });

  // POST /api/v1/media/confirm - Confirm upload completed
  fastify.post("/confirm", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
    handler: handleConfirmUpload,
  });

  // GET /api/v1/media/access/:storageKey - Get access URL
  fastify.get("/access/:storageKey", {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: handleGetAccessUrl,
  });

  // PATCH /api/v1/media/:storageKey/visibility - Change visibility
  fastify.patch("/:storageKey/visibility", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
      },
    },
    handler: handleChangeVisibility,
  });

  // DELETE /api/v1/media/:storageKey - Delete file
  fastify.delete("/:storageKey", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
      },
    },
    handler: handleDeleteFile,
  });
}
