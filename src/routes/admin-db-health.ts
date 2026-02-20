// src/routes/admin-db-health.ts
// Super-admin-only endpoints for database health monitoring
//
// GET  /api/v1/admin/db-health          - Live health report
// GET  /api/v1/admin/db-health/history  - Growth trend (requires _monitoring schema)
// POST /api/v1/admin/db-health/snapshot - Manually trigger a snapshot

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import {
  captureHealthReport,
  captureSnapshot,
  getGrowthHistory,
} from "../services/db-health-service.js";

// ============================================================================
// Helpers
// ============================================================================

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

const adminDbHealthRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  /**
   * GET /api/v1/admin/db-health
   * Returns live database health report with alerts.
   */
  app.get("/admin/db-health", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const report = await captureHealthReport();
      return report;
    } catch (err: any) {
      console.error("[admin-db-health] Health check failed:", err.message);
      reply.code(500).send({ error: "health_check_failed", message: err.message });
    }
  });

  /**
   * GET /api/v1/admin/db-health/history
   * Returns growth trend data from _monitoring.table_stats.
   * Query params: ?days=30 (default 30)
   */
  app.get("/admin/db-health/history", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const days = Math.min(
      Math.max(Number((req.query as any)?.days) || 30, 1),
      365
    );

    try {
      const history = await getGrowthHistory(days);
      return { days, rows: history };
    } catch (err: any) {
      console.error("[admin-db-health] History query failed:", err.message);
      reply.code(500).send({ error: "history_failed", message: err.message });
    }
  });

  /**
   * POST /api/v1/admin/db-health/snapshot
   * Manually trigger a monitoring snapshot capture.
   */
  app.post("/admin/db-health/snapshot", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const captured = await captureSnapshot();
      if (captured === null) {
        return {
          ok: false,
          message: "_monitoring schema not found. Apply the migration first: npm run db:dev:sync",
        };
      }
      return { ok: true, tablesRecorded: captured };
    } catch (err: any) {
      console.error("[admin-db-health] Snapshot failed:", err.message);
      reply.code(500).send({ error: "snapshot_failed", message: err.message });
    }
  });
};

export default adminDbHealthRoutes;
