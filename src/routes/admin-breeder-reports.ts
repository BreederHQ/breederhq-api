// src/routes/admin-breeder-reports.ts
// Admin-only endpoints for breeder report management (flagged breeders, warnings, suspension, settings)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import {
  getFlaggedBreeders,
  getBreederReports,
  dismissReport,
  warnBreeder,
  suspendBreederMarketplace,
  unsuspendBreederMarketplace,
  clearBreederFlag,
  getReportSettings,
  updateReportSettings,
  type FlaggedBreederStatus,
  type BreederReportSettings,
} from "../services/breeder-reports.js";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Require the current user to be a super admin
 * Returns the actor ID if authorized, or sends error response and returns null
 */
async function requireSuperAdmin(req: any, reply: any): Promise<string | null> {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });

  if (!actor?.isSuperAdmin) {
    reply.code(403).send({ error: "forbidden", message: "Super admin access required" });
    return null;
  }

  return actorId;
}

// ============================================================================
// Routes
// ============================================================================

const adminBreederReportsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /admin/breeder-reports/flagged
  // Get paginated list of flagged/warned/suspended breeders
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: {
      q?: string;
      status?: FlaggedBreederStatus;
      page?: string;
      limit?: string;
    };
  }>("/admin/breeder-reports/flagged", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const query = req.query;
      const q = query.q?.trim() || undefined;
      const status = (query.status as FlaggedBreederStatus) || "all";
      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "25", 10) || 25));

      const result = await getFlaggedBreeders({ q, status, page, limit });

      return reply.send({
        items: result.items.map((f) => ({
          id: f.id,
          breederTenantId: f.breederTenantId,
          tenantName: f.tenant.name,
          tenantEmail: f.tenant.primaryEmail,
          totalReports: f.totalReports,
          pendingReports: f.pendingReports,
          lightReports: f.lightReports,
          mediumReports: f.mediumReports,
          heavyReports: f.heavyReports,
          flaggedAt: f.flaggedAt?.toISOString() ?? null,
          flagReason: f.flagReason,
          warningIssuedAt: f.warningIssuedAt?.toISOString() ?? null,
          warningNote: f.warningNote,
          marketplaceSuspendedAt: f.marketplaceSuspendedAt?.toISOString() ?? null,
          suspendedReason: f.suspendedReason,
          updatedAt: f.updatedAt.toISOString(),
        })),
        total: result.total,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("[admin/breeder-reports/flagged] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /admin/breeder-reports/breeders/:tenantId
  // Get detailed flag info and all reports for a specific breeder
  // --------------------------------------------------------------------------
  app.get<{
    Params: { tenantId: string };
  }>("/admin/breeder-reports/breeders/:tenantId", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      if (Number.isNaN(tenantId)) {
        return reply.code(400).send({ error: "invalid_tenant_id" });
      }

      const result = await getBreederReports(tenantId);

      return reply.send({
        flag: result.flag
          ? {
              id: result.flag.id,
              breederTenantId: result.flag.breederTenantId,
              tenantName: result.flag.tenant.name,
              tenantEmail: result.flag.tenant.primaryEmail,
              totalReports: result.flag.totalReports,
              pendingReports: result.flag.pendingReports,
              lightReports: result.flag.lightReports,
              mediumReports: result.flag.mediumReports,
              heavyReports: result.flag.heavyReports,
              flaggedAt: result.flag.flaggedAt?.toISOString() ?? null,
              flagReason: result.flag.flagReason,
              warningIssuedAt: result.flag.warningIssuedAt?.toISOString() ?? null,
              warningNote: result.flag.warningNote,
              marketplaceSuspendedAt: result.flag.marketplaceSuspendedAt?.toISOString() ?? null,
              suspendedReason: result.flag.suspendedReason,
              updatedAt: result.flag.updatedAt.toISOString(),
            }
          : null,
        reports: result.reports.map((r) => ({
          id: r.id,
          reporterUserIdMasked: r.reporterUserIdMasked,
          reason: r.reason,
          severity: r.severity,
          description: r.description,
          status: r.status,
          adminNotes: r.adminNotes,
          reviewedByUserId: r.reviewedByUserId,
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (err: any) {
      console.error("[admin/breeder-reports/breeders/:tenantId] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/breeder-reports/:reportId/dismiss
  // Dismiss a report
  // --------------------------------------------------------------------------
  app.post<{
    Params: { reportId: string };
    Body: { reason: string };
  }>("/admin/breeder-reports/:reportId/dismiss", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const reportId = parseInt(req.params.reportId, 10);
      if (Number.isNaN(reportId)) {
        return reply.code(400).send({ error: "invalid_report_id" });
      }

      const { reason } = req.body ?? {};

      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return reply.code(400).send({ error: "reason_required" });
      }

      await dismissReport(reportId, reason.trim(), actorId);

      return reply.send({ success: true });
    } catch (err: any) {
      if (err?.message === "Report not found") {
        return reply.code(404).send({ error: "report_not_found" });
      }
      console.error("[admin/breeder-reports/:reportId/dismiss] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/breeder-reports/breeders/:tenantId/warn
  // Issue a warning to a breeder
  // --------------------------------------------------------------------------
  app.post<{
    Params: { tenantId: string };
    Body: { note: string };
  }>("/admin/breeder-reports/breeders/:tenantId/warn", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      if (Number.isNaN(tenantId)) {
        return reply.code(400).send({ error: "invalid_tenant_id" });
      }

      const { note } = req.body ?? {};

      if (!note || typeof note !== "string" || !note.trim()) {
        return reply.code(400).send({ error: "note_required" });
      }

      // Verify tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }

      await warnBreeder(tenantId, note.trim());

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/breeder-reports/breeders/:tenantId/warn] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/breeder-reports/breeders/:tenantId/suspend-marketplace
  // Suspend a breeder's marketplace listing (soft suspension)
  // --------------------------------------------------------------------------
  app.post<{
    Params: { tenantId: string };
    Body: { reason: string };
  }>("/admin/breeder-reports/breeders/:tenantId/suspend-marketplace", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      if (Number.isNaN(tenantId)) {
        return reply.code(400).send({ error: "invalid_tenant_id" });
      }

      const { reason } = req.body ?? {};

      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return reply.code(400).send({ error: "reason_required" });
      }

      // Verify tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        return reply.code(404).send({ error: "tenant_not_found" });
      }

      await suspendBreederMarketplace(tenantId, reason.trim());

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/breeder-reports/breeders/:tenantId/suspend-marketplace] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/breeder-reports/breeders/:tenantId/unsuspend-marketplace
  // Unsuspend a breeder's marketplace listing
  // --------------------------------------------------------------------------
  app.post<{
    Params: { tenantId: string };
  }>("/admin/breeder-reports/breeders/:tenantId/unsuspend-marketplace", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      if (Number.isNaN(tenantId)) {
        return reply.code(400).send({ error: "invalid_tenant_id" });
      }

      await unsuspendBreederMarketplace(tenantId);

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/breeder-reports/breeders/:tenantId/unsuspend-marketplace] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /admin/breeder-reports/breeders/:tenantId/clear-flag
  // Clear the flagged status for a breeder (keep historical data)
  // --------------------------------------------------------------------------
  app.post<{
    Params: { tenantId: string };
  }>("/admin/breeder-reports/breeders/:tenantId/clear-flag", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const tenantId = parseInt(req.params.tenantId, 10);
      if (Number.isNaN(tenantId)) {
        return reply.code(400).send({ error: "invalid_tenant_id" });
      }

      await clearBreederFlag(tenantId);

      return reply.send({ success: true });
    } catch (err: any) {
      console.error("[admin/breeder-reports/breeders/:tenantId/clear-flag] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /admin/platform-settings/breeder-reports
  // Get current breeder report settings
  // --------------------------------------------------------------------------
  app.get("/admin/platform-settings/breeder-reports", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const settings = await getReportSettings();

      return reply.send(settings);
    } catch (err: any) {
      console.error("[admin/platform-settings/breeder-reports] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });

  // --------------------------------------------------------------------------
  // PUT /admin/platform-settings/breeder-reports
  // Update breeder report settings
  // --------------------------------------------------------------------------
  app.put<{
    Body: Partial<BreederReportSettings>;
  }>("/admin/platform-settings/breeder-reports", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const updates = req.body ?? {};

      // Validate threshold if provided
      if (updates.flagThreshold !== undefined) {
        if (typeof updates.flagThreshold !== "number" || updates.flagThreshold < 1) {
          return reply.code(400).send({
            error: "invalid_threshold",
            message: "flagThreshold must be a positive number",
          });
        }
      }

      // Validate enableAutoFlag if provided
      if (updates.enableAutoFlag !== undefined) {
        if (typeof updates.enableAutoFlag !== "boolean") {
          return reply.code(400).send({
            error: "invalid_setting",
            message: "enableAutoFlag must be a boolean",
          });
        }
      }

      const settings = await updateReportSettings(updates);

      return reply.send(settings);
    } catch (err: any) {
      console.error("[admin/platform-settings/breeder-reports] Error:", err);
      return reply.code(500).send({ error: "internal_error", detail: err?.message });
    }
  });
};

export default adminBreederReportsRoutes;
