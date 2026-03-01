/**
 * Draft Board API Routes
 *
 * Manages the automated buyer selection (draft) process for breeding plan placement.
 * Includes both breeder-facing (platform) and buyer-facing (portal) endpoints.
 *
 * Platform routes: /breeding/plans/:planId/draft/*
 * Portal routes: /portal/breeding-plans/:planId/draft/*
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import {
  startDraft,
  pauseDraft,
  resumeDraft,
  submitPick,
  approvePick,
  rejectPick,
  handleWindowExpiry,
  getDraftState,
  DraftBoardError,
} from "../services/draft-board-service.js";
import type {
  StartDraftOptions,
  DraftMode,
  DraftWindowExpiryBehavior,
} from "../services/draft-board-service.js";

/* ───────────────────────── helpers ───────────────────────── */

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function draftErrorReply(err: unknown): { status: number; payload: { error: string; message?: string } } {
  if (err instanceof DraftBoardError) {
    // Map error codes to appropriate HTTP status
    const statusMap: Record<string, number> = {
      plan_not_found: 404,
      buyer_not_found: 404,
      draft_already_started: 409,
      draft_not_active: 409,
      draft_not_paused: 409,
      no_eligible_buyers: 400,
      no_available_offspring: 400,
      not_on_the_clock: 403,
      offspring_unavailable: 409,
      no_pending_pick: 409,
      no_selected_offspring: 400,
    };
    const status = statusMap[err.code] ?? 400;
    return { status, payload: { error: err.code, message: err.message } };
  }
  console.error("[draft-board] Error:", err);
  if (err instanceof Error) {
    return { status: 500, payload: { error: "internal_error", message: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

const VALID_DRAFT_MODES: DraftMode[] = ["AUTO", "ASSISTED"];
const VALID_EXPIRY_BEHAVIORS: DraftWindowExpiryBehavior[] = [
  "DEFER_TO_END",
  "AUTO_PICK_PREFERENCE",
  "PAUSE_FOR_BREEDER",
];

/* ───────────────────────── routes ───────────────────────── */

const draftBoardRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ══════════════════════════════════════════════════════════
  // PLATFORM ROUTES (breeder-facing, tenant-scoped)
  // ══════════════════════════════════════════════════════════

  /**
   * POST /breeding/plans/:planId/draft/start
   * Start the draft board for a breeding plan.
   */
  app.post<{
    Params: { planId: string };
    Body: { mode: string; timePerPickMinutes?: number; expiryBehavior?: string };
  }>(
    "/breeding/plans/:planId/draft/start",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { mode, timePerPickMinutes, expiryBehavior } = req.body || {};

        if (!mode || !VALID_DRAFT_MODES.includes(mode as DraftMode)) {
          return reply.code(400).send({ error: "invalid_mode", message: "mode must be AUTO or ASSISTED" });
        }

        if (expiryBehavior && !VALID_EXPIRY_BEHAVIORS.includes(expiryBehavior as DraftWindowExpiryBehavior)) {
          return reply.code(400).send({
            error: "invalid_expiry_behavior",
            message: "expiryBehavior must be DEFER_TO_END, AUTO_PICK_PREFERENCE, or PAUSE_FOR_BREEDER",
          });
        }

        const options: StartDraftOptions = {
          mode: mode as DraftMode,
          timePerPickMinutes: timePerPickMinutes ?? undefined,
          expiryBehavior: expiryBehavior as DraftWindowExpiryBehavior | undefined,
        };

        const state = await startDraft(planId, tenantId, options);
        reply.code(201).send(state);
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/draft/pause
   * Pause an active draft.
   */
  app.post<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/draft/pause",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        await pauseDraft(planId, tenantId);
        reply.send({ success: true });
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/draft/resume
   * Resume a paused draft.
   */
  app.post<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/draft/resume",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        await resumeDraft(planId, tenantId);
        reply.send({ success: true });
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * GET /breeding/plans/:planId/draft/state
   * Get full draft board state for rendering.
   */
  app.get<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/draft/state",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const state = await getDraftState(planId, tenantId);
        reply.send(state);
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/draft/pick
   * Submit a pick on behalf of a buyer (breeder-initiated).
   */
  app.post<{
    Params: { planId: string };
    Body: { buyerId: number; offspringId: number };
  }>(
    "/breeding/plans/:planId/draft/pick",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { buyerId, offspringId } = req.body || {};
        if (!buyerId || !offspringId) {
          return reply.code(400).send({ error: "buyerId_and_offspringId_required" });
        }

        const result = await submitPick(planId, tenantId, buyerId, offspringId);
        reply.send(result);
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/draft/approve/:buyerId
   * Approve a pending pick (ASSISTED mode).
   */
  app.post<{ Params: { planId: string; buyerId: string } }>(
    "/breeding/plans/:planId/draft/approve/:buyerId",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.buyerId);
        if (!planId || !buyerId) return reply.code(400).send({ error: "bad_id" });

        const result = await approvePick(planId, tenantId, buyerId);
        reply.send(result);
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/draft/reject/:buyerId
   * Reject a pending pick (ASSISTED mode). Buyer picks again.
   */
  app.post<{ Params: { planId: string; buyerId: string } }>(
    "/breeding/plans/:planId/draft/reject/:buyerId",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.buyerId);
        if (!planId || !buyerId) return reply.code(400).send({ error: "bad_id" });

        await rejectPick(planId, tenantId, buyerId);
        reply.send({ success: true });
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /breeding/plans/:planId/draft/expiry/:buyerId
   * Handle pick window expiry for a buyer (called by timer or manual trigger).
   */
  app.post<{ Params: { planId: string; buyerId: string } }>(
    "/breeding/plans/:planId/draft/expiry/:buyerId",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.buyerId);
        if (!planId || !buyerId) return reply.code(400).send({ error: "bad_id" });

        const result = await handleWindowExpiry(planId, tenantId, buyerId);
        reply.send(result);
      } catch (err) {
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  // ══════════════════════════════════════════════════════════
  // PORTAL ROUTES (buyer-facing, party-scoped)
  // ══════════════════════════════════════════════════════════

  /**
   * GET /portal/breeding-plans/:planId/draft/state
   * Get draft state filtered for portal buyer (no other buyer names, only own data).
   */
  app.get<{ Params: { planId: string } }>(
    "/portal/breeding-plans/:planId/draft/state",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const state = await getDraftState(planId, tenantId);

        // Filter: only show own buyer data, anonymize other buyers
        const filteredBuyers = state.buyers.map((buyer) => {
          if (buyer.partyId === partyId) {
            return buyer; // Full data for own record
          }
          return {
            id: buyer.id,
            partyId: null,
            buyerName: `Buyer #${buyer.draftPickNumber}`,
            buyerEmail: null,
            draftPickNumber: buyer.draftPickNumber,
            draftPickStatus: buyer.draftPickStatus,
            draftSelectedOffspringId: buyer.draftPickStatus === "PICKED" ? buyer.draftSelectedOffspringId : null,
            draftPickedAt: buyer.draftPickedAt,
            placementRank: null,
          };
        });

        reply.send({
          ...state,
          buyers: filteredBuyers,
        });
      } catch (err: any) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.error, detail: err.detail });
        }
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * POST /portal/breeding-plans/:planId/draft/pick
   * Submit a pick from the portal (buyer inferred from auth).
   */
  app.post<{
    Params: { planId: string };
    Body: { offspringId: number };
  }>(
    "/portal/breeding-plans/:planId/draft/pick",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { offspringId } = req.body || {};
        if (!offspringId) return reply.code(400).send({ error: "offspringId_required" });

        // Find the buyer record for this portal user on this plan
        const buyer = await prisma.breedingPlanBuyer.findFirst({
          where: {
            planId,
            tenantId,
            partyId,
          },
        });

        if (!buyer) {
          // Also check via waitlist entry clientPartyId
          const buyerViaWaitlist = await prisma.breedingPlanBuyer.findFirst({
            where: {
              planId,
              tenantId,
              waitlistEntry: { clientPartyId: partyId },
            },
          });
          if (!buyerViaWaitlist) {
            return reply.code(404).send({ error: "buyer_not_found", message: "You are not a buyer on this plan" });
          }
          const result = await submitPick(planId, tenantId, buyerViaWaitlist.id, offspringId);
          return reply.send(result);
        }

        const result = await submitPick(planId, tenantId, buyer.id, offspringId);
        reply.send(result);
      } catch (err: any) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.error, detail: err.detail });
        }
        const { status, payload } = draftErrorReply(err);
        reply.status(status).send(payload);
      }
    },
  );

  /**
   * GET /portal/breeding-plans/:planId/draft/preferences
   * Get the authenticated buyer's preference rankings for this plan.
   */
  app.get<{ Params: { planId: string } }>(
    "/portal/breeding-plans/:planId/draft/preferences",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Find buyer record for this party
        const buyer = await findBuyerForParty(planId, tenantId, partyId);
        if (!buyer) {
          return reply.code(404).send({ error: "buyer_not_found", message: "You are not a buyer on this plan" });
        }

        const preferences = await prisma.breedingPlanBuyerPreference.findMany({
          where: { planBuyerId: buyer.id },
          include: {
            Offspring: {
              select: {
                id: true,
                name: true,
                sex: true,
                collarColorName: true,
                collarColorHex: true,
                keeperIntent: true,
                lifeState: true,
                buyerPartyId: true,
              },
            },
          },
          orderBy: { rank: "asc" },
        });

        reply.send({
          buyerId: buyer.id,
          preferences: preferences.map((p) => ({
            offspringId: p.offspringId,
            rank: p.rank,
            notes: p.notes,
            offspring: {
              id: p.Offspring.id,
              name: p.Offspring.name,
              sex: p.Offspring.sex,
              collarColorName: p.Offspring.collarColorName,
              collarColorHex: p.Offspring.collarColorHex,
              available: p.Offspring.lifeState === "ALIVE" &&
                p.Offspring.keeperIntent !== "KEEP" &&
                p.Offspring.buyerPartyId === null,
            },
          })),
        });
      } catch (err: any) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.error, detail: err.detail });
        }
        req.log?.error?.({ err }, "Failed to load preferences");
        reply.code(500).send({ error: "failed_to_load" });
      }
    },
  );

  /**
   * PUT /portal/breeding-plans/:planId/draft/preferences
   * Save the authenticated buyer's preference rankings.
   */
  app.put<{
    Params: { planId: string };
    Body: { preferences: Array<{ offspringId: number; rank: number; notes?: string }> };
  }>(
    "/portal/breeding-plans/:planId/draft/preferences",
    async (req, reply) => {
      try {
        const { tenantId, partyId } = await requireClientPartyScope(req);

        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { preferences } = req.body || {};
        if (!Array.isArray(preferences) || preferences.length === 0) {
          return reply.code(400).send({ error: "preferences_required" });
        }

        // Validate: no duplicate ranks
        const ranks = preferences.map((p) => p.rank);
        if (new Set(ranks).size !== ranks.length) {
          return reply.code(400).send({ error: "duplicate_ranks", message: "Each preference must have a unique rank" });
        }

        // Find buyer record for this party
        const buyer = await findBuyerForParty(planId, tenantId, partyId);
        if (!buyer) {
          return reply.code(404).send({ error: "buyer_not_found", message: "You are not a buyer on this plan" });
        }

        // Validate all offspring belong to this plan
        const offspringIds = preferences.map((p) => p.offspringId);
        const validOffspring = await prisma.offspring.findMany({
          where: { id: { in: offspringIds }, breedingPlanId: planId, tenantId },
          select: { id: true },
        });
        const validIds = new Set(validOffspring.map((o) => o.id));
        const invalidIds = offspringIds.filter((id) => !validIds.has(id));
        if (invalidIds.length > 0) {
          return reply.code(400).send({
            error: "invalid_offspring",
            message: `Offspring IDs not found on this plan: ${invalidIds.join(", ")}`,
          });
        }

        // Replace all preferences in a transaction
        await prisma.$transaction(async (tx) => {
          // Delete existing preferences
          await tx.breedingPlanBuyerPreference.deleteMany({
            where: { planBuyerId: buyer.id },
          });

          // Create new preferences
          await tx.breedingPlanBuyerPreference.createMany({
            data: preferences.map((p) => ({
              planBuyerId: buyer.id,
              offspringId: p.offspringId,
              rank: p.rank,
              notes: p.notes ?? null,
              updatedAt: new Date(),
            })),
          });
        });

        reply.send({ success: true, saved: preferences.length });
      } catch (err: any) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.error, detail: err.detail });
        }
        req.log?.error?.({ err }, "Failed to save preferences");
        reply.code(500).send({ error: "failed_to_save" });
      }
    },
  );
};

/* ───────────────────────── internal helpers ───────────────────────── */

/**
 * Find the BreedingPlanBuyer record for a given partyId on a plan.
 * Checks both direct party link and waitlist entry clientPartyId.
 */
async function findBuyerForParty(
  planId: number,
  tenantId: number,
  partyId: number,
): Promise<{ id: number } | null> {
  // Check direct party link first
  const direct = await prisma.breedingPlanBuyer.findFirst({
    where: { planId, tenantId, partyId },
    select: { id: true },
  });
  if (direct) return direct;

  // Check via waitlist entry
  const viaWaitlist = await prisma.breedingPlanBuyer.findFirst({
    where: {
      planId,
      tenantId,
      waitlistEntry: { clientPartyId: partyId },
    },
    select: { id: true },
  });
  return viaWaitlist;
}

export default draftBoardRoutes;
