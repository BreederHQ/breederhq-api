// src/routes/marketplace-report-breeder.ts
// Marketplace breeder report endpoint - allows marketplace users to report breeders
//
// Endpoints:
//   POST /api/v1/marketplace/report-breeder  - Submit a report against a breeder
//
// Security:
// - Requires valid marketplace session (user must be logged in)
// - Rate limited: one report per breeder per user per 24 hours
// - Reports are for admin review only (no direct action)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession } from "../utils/session.js";
import { isUserSuspended } from "../services/marketplace-flag.js";
import { submitReport } from "../services/breeder-reports.js";
import type { BreederReportReason, BreederReportSeverity } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

interface ReportBreederBody {
  /** Tenant ID (number) - provide either this or breederTenantSlug */
  breederTenantId?: number;
  /** Tenant slug (string) - provide either this or breederTenantId */
  breederTenantSlug?: string;
  /** Reason for the report */
  reason: BreederReportReason;
  /** Severity of the issue */
  severity: BreederReportSeverity;
  /** Optional description with details */
  description?: string;
}

// ============================================================================
// Validation
// ============================================================================

const VALID_REASONS: BreederReportReason[] = [
  "SPAM",
  "FRAUD",
  "HARASSMENT",
  "MISREPRESENTATION",
  "OTHER",
];

const VALID_SEVERITIES: BreederReportSeverity[] = ["LIGHT", "MEDIUM", "HEAVY"];

function isValidReason(reason: unknown): reason is BreederReportReason {
  return typeof reason === "string" && VALID_REASONS.includes(reason as BreederReportReason);
}

function isValidSeverity(severity: unknown): severity is BreederReportSeverity {
  return typeof severity === "string" && VALID_SEVERITIES.includes(severity as BreederReportSeverity);
}

// ============================================================================
// Routes
// ============================================================================

const marketplaceReportBreederRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // POST /report-breeder - Submit a report against a breeder
  // --------------------------------------------------------------------------
  app.post<{
    Body: ReportBreederBody;
  }>("/report-breeder", async (req, reply) => {
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
    if (!body.breederTenantId && !body.breederTenantSlug) {
      return reply.code(400).send({
        error: "breeder_required",
        message: "Either breederTenantId or breederTenantSlug is required",
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
    const description = body.description?.trim() || undefined;
    if (description && description.length > 5000) {
      return reply.code(400).send({
        error: "description_too_long",
        message: "Description cannot exceed 5000 characters",
      });
    }

    // 5) Resolve breeder tenant
    let breederTenantId = body.breederTenantId;

    if (!breederTenantId && body.breederTenantSlug) {
      const normalizedSlug = body.breederTenantSlug.trim().toLowerCase();
      const tenant = await prisma.tenant.findUnique({
        where: { slug: normalizedSlug },
        select: { id: true },
      });

      if (!tenant) {
        return reply.code(404).send({
          error: "breeder_not_found",
          message: "The specified breeder could not be found",
        });
      }

      breederTenantId = tenant.id;
    }

    // 6) Submit the report
    try {
      const result = await submitReport({
        reporterUserId: sess.userId,
        breederTenantId,
        reason: body.reason,
        severity: body.severity,
        description,
      });

      // Return generic success (don't reveal report details to prevent gaming)
      return reply.send({
        success: true,
        message: "Thank you for your report. Our team will review it.",
      });
    } catch (err: any) {
      // Handle specific errors
      if (err?.message === "Breeder not found") {
        return reply.code(404).send({
          error: "breeder_not_found",
          message: "The specified breeder could not be found",
        });
      }

      if (err?.message?.includes("already submitted a report")) {
        return reply.code(429).send({
          error: "duplicate_report",
          message: "You have already submitted a report for this breeder recently. Please wait before submitting another.",
        });
      }

      console.error("[marketplace/report-breeder] Error:", err);
      return reply.code(500).send({
        error: "internal_error",
        message: "Failed to submit report. Please try again later.",
      });
    }
  });
};

export default marketplaceReportBreederRoutes;
