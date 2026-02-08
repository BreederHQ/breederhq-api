// src/routes/marketplace-report-provider.ts
// Marketplace provider report endpoint - allows marketplace users to report service providers
//
// Endpoints:
//   POST /api/v1/marketplace/report-provider  - Submit a report against a provider
//
// Security:
// - Requires valid marketplace session (user must be logged in)
// - Rate limited: one report per provider per user per 24 hours
// - Reports are for admin review only (no direct action)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession } from "../utils/session.js";
import { isUserSuspended } from "../services/marketplace-flag.js";

// ============================================================================
// Types
// ============================================================================

type ProviderReportReason = "fraud" | "harassment" | "spam" | "misrepresentation" | "other";
type ProviderReportSeverity = "low" | "medium" | "high";

interface ReportProviderBody {
  /** Provider ID (number) */
  providerId: number;
  /** Reason for the report */
  reason: ProviderReportReason;
  /** Severity of the issue */
  severity: ProviderReportSeverity;
  /** Optional description with details */
  details?: string;
  /** Optional related listing IDs */
  relatedListingIds?: number[];
  /** Optional related transaction ID */
  relatedTransactionId?: string;
}

// ============================================================================
// Validation
// ============================================================================

const VALID_REASONS: ProviderReportReason[] = [
  "fraud",
  "harassment",
  "spam",
  "misrepresentation",
  "other",
];

const VALID_SEVERITIES: ProviderReportSeverity[] = ["low", "medium", "high"];

function isValidReason(reason: unknown): reason is ProviderReportReason {
  return typeof reason === "string" && VALID_REASONS.includes(reason as ProviderReportReason);
}

function isValidSeverity(severity: unknown): severity is ProviderReportSeverity {
  return typeof severity === "string" && VALID_SEVERITIES.includes(severity as ProviderReportSeverity);
}

// ============================================================================
// Constants
// ============================================================================

// Auto-flag threshold: Provider gets flagged after this many reports
const AUTO_FLAG_THRESHOLD = 3;

// Rate limit window: 24 hours
const RATE_LIMIT_WINDOW_HOURS = 24;

// ============================================================================
// Routes
// ============================================================================

const marketplaceReportProviderRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // POST /report-provider - Submit a report against a service provider
  // --------------------------------------------------------------------------
  app.post<{
    Body: ReportProviderBody;
  }>("/report-provider", async (req, reply) => {
    const body = req.body ?? {};

    // 1) Verify user is authenticated (marketplace session)
    const sess = parseVerifiedSession(req, "MARKETPLACE");
    if (!sess) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    // 2) Check if user is suspended platform-wide (suspended users can't report)
    const suspended = await isUserSuspended(sess.userId);
    if (suspended) {
      return reply.code(403).send({
        error: "suspended",
        message: "Your account is suspended. You cannot submit reports.",
      });
    }

    // 3) Validate required fields
    if (!body.providerId || typeof body.providerId !== "number") {
      return reply.code(400).send({
        error: "provider_id_required",
        message: "providerId is required and must be a number",
      });
    }

    if (!isValidReason(body.reason)) {
      return reply.code(400).send({
        error: "invalid_reason",
        message: `reason must be one of: ${VALID_REASONS.join(", ")}`,
      });
    }

    if (!isValidSeverity(body.severity)) {
      return reply.code(400).send({
        error: "invalid_severity",
        message: `severity must be one of: ${VALID_SEVERITIES.join(", ")}`,
      });
    }

    // 4) Validate description if provided
    const details = body.details?.trim() || undefined;
    if (details && details.length > 2000) {
      return reply.code(400).send({
        error: "details_too_long",
        message: "Details cannot exceed 2000 characters",
      });
    }

    // 5) Validate related listing IDs if provided
    const relatedListingIds = Array.isArray(body.relatedListingIds)
      ? body.relatedListingIds.filter((id): id is number => typeof id === "number" && id > 0)
      : [];

    // 6) Validate related transaction ID if provided
    const relatedTransactionId = body.relatedTransactionId
      ? BigInt(body.relatedTransactionId)
      : null;

    // 7) Verify provider exists
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { id: body.providerId },
      select: { id: true, businessName: true },
    });

    if (!provider) {
      return reply.code(404).send({
        error: "provider_not_found",
        message: "The specified provider could not be found",
      });
    }

    // 8) Check rate limit: one report per provider per user per 24 hours
    const rateLimitWindow = new Date();
    rateLimitWindow.setHours(rateLimitWindow.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const recentReport = await prisma.marketplaceProviderReport.findFirst({
      where: {
        providerId: body.providerId,
        reporterUserId: sess.userId,
        createdAt: { gte: rateLimitWindow },
      },
      select: { id: true },
    });

    if (recentReport) {
      return reply.code(429).send({
        error: "duplicate_report",
        message: "You have already submitted a report for this provider recently. Please wait before submitting another.",
      });
    }

    // 9) Get reporter email (for admin reference)
    const user = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: { email: true },
    });

    // 10) Create the report
    try {
      const report = await prisma.marketplaceProviderReport.create({
        data: {
          providerId: body.providerId,
          reporterUserId: sess.userId,
          reporterEmail: user?.email || null,
          reason: body.reason,
          severity: body.severity,
          details,
          relatedListingIds,
          relatedTransactionId,
          status: "pending",
        },
      });

      // 11) Check if provider should be auto-flagged (3+ pending reports)
      const pendingReportsCount = await prisma.marketplaceProviderReport.count({
        where: {
          providerId: body.providerId,
          status: "pending",
        },
      });

      if (pendingReportsCount >= AUTO_FLAG_THRESHOLD) {
        // Flag the provider
        await prisma.marketplaceProvider.update({
          where: { id: body.providerId },
          data: {
            flaggedAt: new Date(),
            flagReason: `Auto-flagged: ${pendingReportsCount} pending reports`,
          },
        });

        // TODO: Send admin notification about flagged provider
      }

      // Return generic success (don't reveal report details to prevent gaming)
      return reply.send({
        success: true,
        reportId: report.id,
        message: "Thank you for your report. Our team will review it.",
      });
    } catch (err: any) {
      console.error("[marketplace/report-provider] Error:", err);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to submit report. Please try again later.",
      });
    }
  });
};

export default marketplaceReportProviderRoutes;
