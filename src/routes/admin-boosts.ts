// src/routes/admin-boosts.ts
// Admin-only endpoints for boost management
//
// GET   /api/v1/admin/boosts            - List all boosts (paginated, filterable)
// GET   /api/v1/admin/boosts/stats      - Revenue and adoption statistics
// PATCH /api/v1/admin/boosts/:id/cancel - Admin cancel/override any boost

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import {
  getAllBoosts,
  getBoostStats,
  adminCancelBoost,
} from "../services/listing-boost-service.js";
import type { BoostStatus } from "@prisma/client";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Require the current user to be a super admin.
 * Returns actor ID if authorized, or sends error response and returns null.
 */
async function requireSuperAdmin(
  req: any,
  reply: any
): Promise<string | null> {
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
    reply
      .code(403)
      .send({ error: "forbidden", message: "Super admin access required" });
    return null;
  }

  return actorId;
}

// ============================================================================
// Routes
// ============================================================================

const adminBoostRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  /**
   * GET /api/v1/admin/boosts
   *
   * List all boosts across all tenants and providers (paginated).
   *
   * Query: { status?: BoostStatus, page?: string, limit?: string }
   */
  app.get<{
    Querystring: { status?: string; page?: string; limit?: string };
  }>("/admin/boosts", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit ?? "25", 10) || 25)
      );
      const status = req.query.status as BoostStatus | undefined;

      const result = await getAllBoosts({ status, page, limit });
      return reply.send(result);
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list boosts (admin)");
      return reply.code(500).send({ error: "list_boosts_failed" });
    }
  });

  /**
   * GET /api/v1/admin/boosts/stats
   *
   * Revenue and adoption statistics for the boost program.
   *
   * Response:
   * {
   *   activeBoosts: number,
   *   totalRevenueCents: number,
   *   tierBreakdown: [{ tier, count, revenueCents }],
   *   statusBreakdown: [{ status, count }]
   * }
   */
  app.get("/admin/boosts/stats", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const stats = await getBoostStats();
      return reply.send(stats);
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to get boost stats");
      return reply.code(500).send({ error: "stats_failed" });
    }
  });

  /**
   * PATCH /api/v1/admin/boosts/:id/cancel
   *
   * Admin cancel/override any boost. FR-49.
   * No ownership check — super admin only.
   */
  app.patch<{
    Params: { id: string };
  }>("/admin/boosts/:id/cancel", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const boostId = parseInt(req.params.id, 10);
      if (isNaN(boostId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      await adminCancelBoost(boostId);
      return reply.send({ success: true });
    } catch (err: any) {
      if (err.message === "Boost not found") {
        return reply.code(404).send({ error: "not_found" });
      }
      req.log?.error?.({ err }, "Failed to cancel boost (admin)");
      return reply
        .code(500)
        .send({ error: "cancel_failed", detail: err.message });
    }
  });
};

export default adminBoostRoutes;
