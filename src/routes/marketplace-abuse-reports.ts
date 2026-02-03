// src/routes/marketplace-abuse-reports.ts
// Abuse Reporting API for Service Provider Portal
// Allows users to report inappropriate or fraudulent service listings

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { sendAdminListingFlaggedNotification } from "../services/marketplace-email-service.js";

// Valid abuse report reasons
const VALID_REASONS = [
  "spam",
  "fraud",
  "inappropriate_content",
  "misleading_information",
  "duplicate_listing",
  "copyright_violation",
  "other",
] as const;

type AbuseReason = typeof VALID_REASONS[number];

/**
 * POST /api/v1/marketplace/listings/report
 * Report a service listing for abuse
 */
async function reportListing(
  request: FastifyRequest<{
    Body: {
      listingId: number;
      reason: AbuseReason;
      details?: string;
      reporterEmail?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { listingId, reason, details, reporterEmail } = request.body;

  // Validation
  if (!listingId || typeof listingId !== "number") {
    return reply.status(400).send({
      error: "invalid_listing_id",
      message: "A valid listing ID is required.",
    });
  }

  if (!reason || !VALID_REASONS.includes(reason)) {
    return reply.status(400).send({
      error: "invalid_reason",
      message: `Reason must be one of: ${VALID_REASONS.join(", ")}`,
    });
  }

  if (details && typeof details === "string" && details.length > 1000) {
    return reply.status(400).send({
      error: "details_too_long",
      message: "Details must be 1000 characters or less.",
    });
  }

  if (reporterEmail && typeof reporterEmail === "string") {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reporterEmail)) {
      return reply.status(400).send({
        error: "invalid_email",
        message: "Please provide a valid email address.",
      });
    }
  }

  try {
    // Verify listing exists and is published
    const listing = await prisma.mktListingProviderService.findFirst({
      where: {
        id: listingId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        flaggedAt: true,
        provider: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
    });

    if (!listing) {
      return reply.status(404).send({
        error: "listing_not_found",
        message: "Listing not found.",
      });
    }

    // Create abuse report
    const report = await prisma.marketplaceAbuseReport.create({
      data: {
        listingId,
        reason,
        details: details || null,
        reporterEmail: reporterEmail || null,
        status: "pending",
      },
    });

    // Check if listing should be auto-flagged (3+ reports in 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReportCount = await prisma.marketplaceAbuseReport.count({
      where: {
        listingId,
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    // Auto-flag if 3 or more reports in 24 hours
    if (recentReportCount >= 3 && !listing.flaggedAt) {
      await prisma.mktListingProviderService.update({
        where: { id: listingId },
        data: {
          flaggedAt: new Date(),
        },
      });

      // Log auto-flag for admin notification
      request.log.warn(
        {
          listingId,
          reportCount: recentReportCount,
          reportId: report.id,
        },
        "Listing auto-flagged due to multiple abuse reports"
      );

      // P-02 FIX: Send admin notification email
      sendAdminListingFlaggedNotification({
        listingId,
        listingTitle: listing.title,
        providerId: listing.provider.id,
        providerBusinessName: listing.provider.businessName,
        reportCount: recentReportCount,
        latestReportId: report.id,
      }).catch((err) => {
        request.log.error({ err, listingId }, "Failed to send admin listing flagged notification");
      });
    }

    return reply.status(201).send({
      success: true,
      reportId: report.id,
      message: "Thank you for your report. We will review it shortly.",
    });
  } catch (error) {
    request.log.error(error, "Failed to create abuse report");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to submit report. Please try again.",
    });
  }
}

/**
 * Register routes
 */
export default async function marketplaceAbuseReportsRoutes(
  fastify: FastifyInstance
) {
  // POST /api/v1/marketplace/listings/report - Report listing
  fastify.post("/report", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 hour",
      },
    },
    handler: reportListing,
  });
}
