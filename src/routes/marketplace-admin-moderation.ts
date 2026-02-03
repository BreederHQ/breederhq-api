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
 * GET /api/v1/marketplace/admin/moderation-stats
 * Get moderation queue statistics
 */
async function getModerationStats(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const [pendingCount, underReviewCount, flaggedListingsCount] = await Promise.all([
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
    ]);

    return reply.send({
      pendingReports: pendingCount,
      underReviewReports: underReviewCount,
      flaggedListings: flaggedListingsCount,
      totalActionRequired: pendingCount + underReviewCount,
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
