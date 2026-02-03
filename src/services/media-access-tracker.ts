// ─────────────────────────────────────────────────────────────
// MEDIA ACCESS TRACKER
// Tracks document/media views and downloads for audit trail
// ─────────────────────────────────────────────────────────────

import type { FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import type {
  TrackAccessParams,
  AccessLogFilters,
  MediaAccessActor,
} from "../types/watermark.js";
import type { MediaAccessEvent } from "@prisma/client";

/**
 * Track a media access event (fire-and-forget)
 * This function does not throw - errors are logged but don't interrupt the download flow
 */
export async function trackMediaAccess(
  req: FastifyRequest,
  params: TrackAccessParams
): Promise<void> {
  try {
    await prisma.mediaAccessEvent.create({
      data: {
        tenantId: params.tenantId,
        documentId: params.documentId,
        storageKey: params.storageKey,
        actorType: params.actorType,
        userId: params.userId,
        marketplaceUserId: params.marketplaceUserId,
        partyId: params.partyId,
        accessType: params.accessType,
        watermarked: params.watermarked,
        watermarkHash: params.watermarkHash,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      },
    });
  } catch (err) {
    // Fire-and-forget - don't break downloads on tracking failure
    req.log?.error?.({ err }, "Failed to track media access");
  }
}

/**
 * Get access log with filters and pagination
 */
export async function getAccessLog(
  tenantId: number,
  filters: AccessLogFilters
): Promise<{ events: MediaAccessEvent[]; total: number }> {
  const { page = 1, limit = 50, ...where } = filters;
  const skip = (page - 1) * limit;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = { tenantId };

  if (where.documentId) {
    whereClause.documentId = where.documentId;
  }
  if (where.storageKey) {
    whereClause.storageKey = where.storageKey;
  }
  if (where.actorType) {
    whereClause.actorType = where.actorType;
  }
  if (where.accessType) {
    whereClause.accessType = where.accessType;
  }
  if (where.startDate || where.endDate) {
    whereClause.createdAt = {};
    if (where.startDate) {
      whereClause.createdAt.gte = where.startDate;
    }
    if (where.endDate) {
      whereClause.createdAt.lte = where.endDate;
    }
  }

  const [events, total] = await Promise.all([
    prisma.mediaAccessEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.mediaAccessEvent.count({ where: whereClause }),
  ]);

  return { events, total };
}

/**
 * Get access statistics for a document
 */
export async function getDocumentAccessStats(
  tenantId: number,
  documentId: number
): Promise<{
  totalViews: number;
  totalDownloads: number;
  uniqueViewers: number;
  lastAccessed: Date | null;
}> {
  const [views, downloads, uniqueViewers, lastAccess] = await Promise.all([
    prisma.mediaAccessEvent.count({
      where: { tenantId, documentId, accessType: "VIEW" },
    }),
    prisma.mediaAccessEvent.count({
      where: { tenantId, documentId, accessType: "DOWNLOAD" },
    }),
    prisma.mediaAccessEvent.groupBy({
      by: ["userId", "marketplaceUserId", "partyId", "ip"],
      where: { tenantId, documentId },
    }),
    prisma.mediaAccessEvent.findFirst({
      where: { tenantId, documentId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    totalViews: views,
    totalDownloads: downloads,
    uniqueViewers: uniqueViewers.length,
    lastAccessed: lastAccess?.createdAt || null,
  };
}

/**
 * Clean up old access events (for scheduled jobs)
 * Keeps events for 90 days by default
 */
export async function cleanupOldAccessEvents(
  retentionDays: number = 90
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.mediaAccessEvent.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}

// ─────────────────────────────────────────────────────────────
// Request Context Extraction
// ─────────────────────────────────────────────────────────────

function getClientIp(req: FastifyRequest): string | null {
  // Cloudflare header
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string") return cfIp.slice(0, 45);

  // Standard proxy headers
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string") return xRealIp.slice(0, 45);

  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0]?.trim()?.slice(0, 45) || null;
  }

  // Direct connection
  return req.ip?.slice(0, 45) || null;
}

function getUserAgent(req: FastifyRequest): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 500) : null;
}

/**
 * Determine the actor type based on request context
 */
export function determineActorType(
  viewerTenantId: number | null,
  documentTenantId: number,
  marketplaceUserId: number | null,
  partyId: number | null
): MediaAccessActor {
  if (viewerTenantId === documentTenantId) {
    return "OWNER";
  }
  if (marketplaceUserId) {
    return "BUYER";
  }
  if (partyId) {
    return "PORTAL";
  }
  return "PUBLIC";
}
