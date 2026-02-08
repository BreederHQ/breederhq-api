// @ts-nocheck - Marketplace admin features temporarily disabled pending migration
// src/routes/marketplace-admin-moderation.ts
// Admin Moderation Queue API for Service Provider Portal
// Allows admins to review and moderate abuse reports

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";

/**
 * Middleware: Require admin role
 */
async function requireAdmin(request: any, reply: FastifyReply) {
  const userId = request.marketplaceUserId || request.userId;

  if (!userId) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  // Check if user is an admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    return reply.status(403).send({
      error: "forbidden",
      message: "Admin access required",
    });
  }
}

/**
 * GET /api/v1/marketplace/admin/listing-reports
 * List abuse reports for moderation
 */
async function listReports(
  request: FastifyRequest<{
    Querystring: {
      status?: "pending" | "under_review" | "resolved" | "dismissed";
      listingId?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { status, listingId, limit = "50", offset = "0" } = request.query;

  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const parsedOffset = parseInt(offset, 10) || 0;
  const parsedListingId = listingId ? parseInt(listingId, 10) : undefined;

  try {
    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (parsedListingId && !isNaN(parsedListingId)) {
      where.listingId = parsedListingId;
    }

    // Fetch reports with listing details
    const [reports, total] = await Promise.all([
      prisma.marketplaceAbuseReport.findMany({
        where,
        orderBy: [
          { status: "asc" }, // Pending first
          { createdAt: "desc" }, // Most recent first
        ],
        skip: parsedOffset,
        take: parsedLimit,
        include: {
          listing: {
            select: {
              id: true,
              slug: true,
              title: true,
              category: true,
              status: true,
              flaggedAt: true,
              provider: {
                select: {
                  id: true,
                  businessName: true,
                  publicEmail: true,
                },
              },
            },
          },
        },
      }),
      prisma.marketplaceAbuseReport.count({ where }),
    ]);

    // Transform to DTO (mask reporter emails for privacy)
    const items = reports.map((report) => ({
      id: report.id,
      listingId: report.listingId,
      reason: report.reason,
      details: report.details,
      reporterEmail: report.reporterEmail
        ? maskEmail(report.reporterEmail)
        : null,
      status: report.status,
      adminNotes: report.adminNotes,
      resolvedAt: report.resolvedAt?.toISOString() || null,
      createdAt: report.createdAt.toISOString(),
      listing: {
        id: report.listing.id,
        slug: report.listing.slug,
        title: report.listing.title,
        category: report.listing.category,
        status: report.listing.status,
        flaggedAt: report.listing.flaggedAt?.toISOString() || null,
        provider: {
          id: report.listing.provider.id,
          businessName: report.listing.provider.businessName,
          publicEmail: report.listing.provider.publicEmail,
        },
      },
    }));

    return reply.send({
      items,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + items.length < total,
    });
  } catch (error) {
    request.log.error(error, "Failed to list abuse reports");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to list reports.",
    });
  }
}

/**
 * PUT /api/v1/marketplace/admin/listing-reports/:id
 * Update abuse report status
 */
async function updateReportStatus(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
    Body: {
      status: "pending" | "under_review" | "resolved" | "dismissed";
      adminNotes?: string;
      unflagListing?: boolean;
    };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const { status, adminNotes, unflagListing } = request.body;
  const reportId = parseInt(id, 10);

  if (isNaN(reportId)) {
    return reply.status(400).send({
      error: "invalid_report_id",
      message: "Report ID must be a number.",
    });
  }

  const validStatuses = ["pending", "under_review", "resolved", "dismissed"];
  if (!status || !validStatuses.includes(status)) {
    return reply.status(400).send({
      error: "invalid_status",
      message: `Status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  if (adminNotes && typeof adminNotes === "string" && adminNotes.length > 1000) {
    return reply.status(400).send({
      error: "admin_notes_too_long",
      message: "Admin notes must be 1000 characters or less.",
    });
  }

  try {
    // Fetch report
    const report = await prisma.marketplaceAbuseReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        listingId: true,
        status: true,
      },
    });

    if (!report) {
      return reply.status(404).send({
        error: "report_not_found",
        message: "Report not found.",
      });
    }

    // Use transaction to update report and optionally unflag listing
    const result = await prisma.$transaction(async (tx) => {
      // Update report
      const updateData: any = {
        status,
      };

      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }

      if (status === "resolved" || status === "dismissed") {
        updateData.resolvedAt = new Date();
      }

      const updated = await tx.marketplaceAbuseReport.update({
        where: { id: reportId },
        data: updateData,
        include: {
          listing: {
            select: {
              id: true,
              slug: true,
              title: true,
              flaggedAt: true,
            },
          },
        },
      });

      // Unflag listing if requested
      if (unflagListing && updated.listing.flaggedAt) {
        await tx.mktListingProviderService.update({
          where: { id: updated.listingId },
          data: { flaggedAt: null },
        });
      }

      return updated;
    });

    return reply.send({
      id: result.id,
      listingId: result.listingId,
      status: result.status,
      adminNotes: result.adminNotes,
      resolvedAt: result.resolvedAt?.toISOString() || null,
      message: "Report updated successfully.",
    });
  } catch (error) {
    request.log.error(error, "Failed to update report");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to update report.",
    });
  }
}

/**
 * GET /api/v1/marketplace/admin/provider-reports
 * List provider abuse reports for moderation
 */
async function listProviderReports(
  request: FastifyRequest<{
    Querystring: {
      status?: "pending" | "under_review" | "resolved" | "dismissed";
      providerId?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { status, providerId, limit = "50", offset = "0" } = request.query;

  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const parsedOffset = parseInt(offset, 10) || 0;
  const parsedProviderId = providerId ? parseInt(providerId, 10) : undefined;

  try {
    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (parsedProviderId && !isNaN(parsedProviderId)) {
      where.providerId = parsedProviderId;
    }

    // Fetch reports with provider details
    const [reports, total] = await Promise.all([
      prisma.marketplaceProviderReport.findMany({
        where,
        orderBy: [
          { status: "asc" }, // Pending first
          { createdAt: "desc" }, // Most recent first
        ],
        skip: parsedOffset,
        take: parsedLimit,
        include: {
          provider: {
            select: {
              id: true,
              businessName: true,
              publicEmail: true,
              verificationTier: true,
              flaggedAt: true,
            },
          },
        },
      }),
      prisma.marketplaceProviderReport.count({ where }),
    ]);

    // Transform to DTO (mask reporter emails for privacy)
    const items = reports.map((report) => ({
      id: report.id,
      providerId: report.providerId,
      reason: report.reason,
      severity: report.severity,
      details: report.details,
      relatedListingIds: report.relatedListingIds,
      relatedTransactionId: report.relatedTransactionId?.toString() || null,
      reporterEmail: report.reporterEmail
        ? maskEmail(report.reporterEmail)
        : null,
      status: report.status,
      adminNotes: report.adminNotes,
      resolvedAt: report.resolvedAt?.toISOString() || null,
      createdAt: report.createdAt.toISOString(),
      provider: {
        id: report.provider.id,
        businessName: report.provider.businessName,
        publicEmail: report.provider.publicEmail,
        verificationTier: report.provider.verificationTier,
        flaggedAt: report.provider.flaggedAt?.toISOString() || null,
      },
    }));

    return reply.send({
      items,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: parsedOffset + items.length < total,
    });
  } catch (error) {
    request.log.error(error, "Failed to list provider reports");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to list reports.",
    });
  }
}

/**
 * PUT /api/v1/marketplace/admin/provider-reports/:id
 * Update provider abuse report status
 */
async function updateProviderReportStatus(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
    Body: {
      status: "pending" | "under_review" | "resolved" | "dismissed";
      adminNotes?: string;
      suspendProvider?: boolean;
    };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const { status, adminNotes, suspendProvider } = request.body;
  const reportId = parseInt(id, 10);

  if (isNaN(reportId)) {
    return reply.status(400).send({
      error: "invalid_report_id",
      message: "Report ID must be a number.",
    });
  }

  const validStatuses = ["pending", "under_review", "resolved", "dismissed"];
  if (!status || !validStatuses.includes(status)) {
    return reply.status(400).send({
      error: "invalid_status",
      message: `Status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  if (adminNotes && typeof adminNotes === "string" && adminNotes.length > 1000) {
    return reply.status(400).send({
      error: "admin_notes_too_long",
      message: "Admin notes must be 1000 characters or less.",
    });
  }

  try {
    // Fetch report
    const report = await prisma.marketplaceProviderReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        providerId: true,
        status: true,
      },
    });

    if (!report) {
      return reply.status(404).send({
        error: "report_not_found",
        message: "Report not found.",
      });
    }

    // Use transaction to update report and optionally suspend provider
    const result = await prisma.$transaction(async (tx) => {
      // Update report
      const updateData: any = {
        status,
      };

      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }

      if (status === "resolved" || status === "dismissed") {
        updateData.resolvedAt = new Date();
      }

      const updated = await tx.marketplaceProviderReport.update({
        where: { id: reportId },
        data: updateData,
        include: {
          provider: {
            select: {
              id: true,
              businessName: true,
              status: true,
            },
          },
        },
      });

      // Suspend provider if requested
      if (suspendProvider && updated.provider.status !== "suspended") {
        await tx.marketplaceProvider.update({
          where: { id: updated.providerId },
          data: {
            status: "suspended",
            suspendedAt: new Date(),
            suspendedReason: `Suspended due to report #${reportId}`,
          },
        });
      }

      return updated;
    });

    return reply.send({
      id: result.id,
      providerId: result.providerId,
      status: result.status,
      adminNotes: result.adminNotes,
      resolvedAt: result.resolvedAt?.toISOString() || null,
      message: "Report updated successfully.",
    });
  } catch (error) {
    request.log.error(error, "Failed to update provider report");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to update report.",
    });
  }
}

/**
 * GET /api/v1/marketplace/admin/moderation-stats
 * Get moderation queue statistics (listings + providers)
 */
async function getModerationStats(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const [
      listingPendingCount,
      listingUnderReviewCount,
      flaggedListingsCount,
      providerPendingCount,
      providerUnderReviewCount,
      flaggedProvidersCount,
    ] = await Promise.all([
      // Listing reports
      prisma.marketplaceAbuseReport.count({
        where: { status: "pending" },
      }),
      prisma.marketplaceAbuseReport.count({
        where: { status: "under_review" },
      }),
      prisma.mktListingProviderService.count({
        where: {
          flaggedAt: { not: null },
          deletedAt: null,
        },
      }),
      // Provider reports
      prisma.marketplaceProviderReport.count({
        where: { status: "pending" },
      }),
      prisma.marketplaceProviderReport.count({
        where: { status: "under_review" },
      }),
      prisma.marketplaceProvider.count({
        where: {
          flaggedAt: { not: null },
        },
      }),
    ]);

    return reply.send({
      listingReports: {
        pending: listingPendingCount,
        underReview: listingUnderReviewCount,
        flaggedListings: flaggedListingsCount,
      },
      providerReports: {
        pending: providerPendingCount,
        underReview: providerUnderReviewCount,
        flaggedProviders: flaggedProvidersCount,
      },
      // Legacy fields for backwards compatibility
      pendingReports: listingPendingCount,
      underReviewReports: listingUnderReviewCount,
      flaggedListings: flaggedListingsCount,
      totalActionRequired: listingPendingCount + listingUnderReviewCount + providerPendingCount + providerUnderReviewCount,
    });
  } catch (error) {
    request.log.error(error, "Failed to get moderation stats");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to get statistics.",
    });
  }
}

/**
 * Helper: Mask email for privacy (show first 2 chars + domain)
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const visibleChars = Math.min(2, localPart.length);
  const masked = localPart.slice(0, visibleChars) + "***";

  return `${masked}@${domain}`;
}

/**
 * Register routes
 */
export default async function marketplaceAdminModerationRoutes(
  fastify: FastifyInstance
) {
  // All routes require admin role
  fastify.addHook("preHandler", requireAdmin);

  // GET /api/v1/marketplace/admin/listing-reports - List reports
  fastify.get("/listing-reports", {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: listReports,
  });

  // PUT /api/v1/marketplace/admin/listing-reports/:id - Update report
  fastify.put("/listing-reports/:id", {
    config: {
      rateLimit: {
        max: 50,
        timeWindow: "1 minute",
      },
    },
    handler: updateReportStatus,
  });

  // GET /api/v1/marketplace/admin/provider-reports - List provider reports
  fastify.get("/provider-reports", {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: listProviderReports,
  });

  // PUT /api/v1/marketplace/admin/provider-reports/:id - Update provider report
  fastify.put("/provider-reports/:id", {
    config: {
      rateLimit: {
        max: 50,
        timeWindow: "1 minute",
      },
    },
    handler: updateProviderReportStatus,
  });

  // GET /api/v1/marketplace/admin/moderation-stats - Get stats
  fastify.get("/moderation-stats", {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: "1 minute",
      },
    },
    handler: getModerationStats,
  });
}
