/**
 * Placement Scheduling API Routes
 *
 * Phase 6: Manages placement scheduling policies and per-buyer placement rank
 * on breeding plans. The service logic lives in services/placement-scheduling.ts;
 * these routes wire it to HTTP.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  parsePlacementSchedulingPolicy,
  validatePlacementSchedulingPolicy,
  computePlacementWindow,
  type PlacementSchedulingPolicy,
} from "../services/placement-scheduling.js";

/* ───────────────────────── helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function resolveTenantIdFromRequest(req: { headers?: Record<string, unknown> }): number | null {
  const h = req.headers?.["x-tenant-id"];
  if (typeof h === "string") return toNum(h);
  if (typeof h === "number") return toNum(h);
  return null;
}

function errorReply(err: unknown): { status: number; payload: { error: string; message?: string } } {
  console.error("[placement-scheduling] Error:", err);
  if (err instanceof Error) {
    return { status: 500, payload: { error: "internal_error", message: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/* ───────────────────────── default disabled policy ───────────────────────── */

const DEFAULT_DISABLED_POLICY: PlacementSchedulingPolicy = {
  enabled: false,
  windowMinutesPerBuyer: 0,
  startAt: "",
  timezone: "",
};

/* ───────────────────────── routes ───────────────────────── */

const placementSchedulingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context
  app.addHook("preHandler", async (req, reply) => {
    let tenantId: number | null = toNum((req as any).tenantId);
    if (!tenantId) {
      tenantId = resolveTenantIdFromRequest(req as any);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /**
   * GET /breeding/plans/:planId/placement-scheduling-policy
   * Returns the PlacementSchedulingPolicy stored on the plan (JSON field).
   * If none set, return default policy with enabled=false.
   */
  app.get<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/placement-scheduling-policy",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: { placementSchedulingPolicy: true },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        const policy = parsePlacementSchedulingPolicy(plan.placementSchedulingPolicy);
        reply.send(policy ?? DEFAULT_DISABLED_POLICY);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * PUT /breeding/plans/:planId/placement-scheduling-policy
   * Stores policy on plan record. Validates using service function.
   * Body: PlacementSchedulingPolicy
   */
  app.put<{ Params: { planId: string }; Body: PlacementSchedulingPolicy }>(
    "/breeding/plans/:planId/placement-scheduling-policy",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Parse and validate incoming policy
        const parsed = parsePlacementSchedulingPolicy(req.body);
        if (!parsed) {
          return reply.code(400).send({ error: "invalid_policy", message: "Could not parse placement scheduling policy" });
        }

        const errors = validatePlacementSchedulingPolicy(parsed);
        if (errors.length > 0) {
          return reply.code(400).send({ error: "validation_failed", messages: errors });
        }

        // Verify plan exists and belongs to tenant
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: { id: true },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Store the policy as JSON on the plan
        await prisma.breedingPlan.update({
          where: { id: planId, tenantId },
          data: { placementSchedulingPolicy: parsed as any },
        });

        reply.send(parsed);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * GET /breeding/plans/:planId/placement-status
   * Returns per-buyer placement status for the plan.
   */
  app.get<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/placement-status",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Fetch plan with policy
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: { id: true, placementSchedulingPolicy: true },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        const policy = parsePlacementSchedulingPolicy(plan.placementSchedulingPolicy);
        const policyEnabled = policy?.enabled ?? false;

        // Fetch all assigned buyers with placement rank info
        const buyers = await prisma.breedingPlanBuyer.findMany({
          where: { planId, tenantId, stage: "ASSIGNED" },
          include: {
            waitlistEntry: {
              include: {
                clientParty: { select: { name: true, email: true } },
              },
            },
            party: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ placementRank: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
        });

        // Determine booking status for each buyer
        const now = new Date();
        let bookedCount = 0;
        let pendingCount = 0;
        let missedCount = 0;

        const buyerStatuses = buyers.map((buyer) => {
          const buyerName =
            buyer.waitlistEntry?.clientParty?.name ?? buyer.party?.name ?? "Unknown";
          const rank = buyer.placementRank;

          let bookingStatus: "booked" | "pending" | "missed" | "unranked" = "unranked";
          let bookedAt: string | null = null;
          let eventType: string | null = null;

          if (rank != null && rank >= 1 && policyEnabled && policy) {
            const window = computePlacementWindow(policy, rank);
            if (window) {
              if (buyer.assignedAt && buyer.offspringId) {
                bookingStatus = "booked";
                bookedAt = buyer.assignedAt.toISOString();
                bookedCount++;
              } else if (now > window.graceEndAt) {
                bookingStatus = "missed";
                missedCount++;
              } else {
                bookingStatus = "pending";
                pendingCount++;
              }
            }
          } else if (rank == null || rank < 1) {
            bookingStatus = "unranked";
          }

          return {
            buyerId: buyer.id,
            buyerName,
            placementRank: rank,
            bookingStatus,
            bookedAt,
            eventType,
          };
        });

        reply.send({
          breedingPlanId: planId,
          policyEnabled,
          rankedBuyersCount: buyers.filter((b) => b.placementRank != null && b.placementRank >= 1).length,
          bookedCount,
          pendingCount,
          missedCount,
          buyers: buyerStatuses,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * PATCH /breeding/plans/:planId/buyers/:buyerId/placement-rank
   * Updates buyer's placementRank field.
   * Body: { placementRank: number | null }
   */
  app.patch<{ Params: { planId: string; buyerId: string }; Body: { placementRank: number | null } }>(
    "/breeding/plans/:planId/buyers/:buyerId/placement-rank",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.buyerId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });
        if (!buyerId) return reply.code(400).send({ error: "bad_buyer_id" });

        const { placementRank } = req.body || {};

        // Validate rank (must be positive integer or null)
        if (placementRank !== null && placementRank !== undefined) {
          if (!Number.isInteger(placementRank) || placementRank < 1) {
            return reply.code(400).send({ error: "invalid_rank", message: "placementRank must be a positive integer or null" });
          }
        }

        // Verify buyer exists and belongs to this plan/tenant
        const existing = await prisma.breedingPlanBuyer.findFirst({
          where: { id: buyerId, planId, tenantId },
        });
        if (!existing) return reply.code(404).send({ error: "buyer_not_found" });

        const updated = await prisma.breedingPlanBuyer.update({
          where: { id: buyerId, tenantId },
          data: { placementRank: placementRank ?? null },
          select: {
            id: true,
            planId: true,
            placementRank: true,
            updatedAt: true,
          },
        });

        reply.send(updated);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );
};

export default placementSchedulingRoutes;
