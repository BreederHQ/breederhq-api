/**
 * Breeding Plan Buyers API Routes
 *
 * Manages buyer assignments at the breeding plan level before offspring exist.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  findPossibleMatches,
  refreshPlanMatches,
} from "../services/plan-buyer-matching.js";
import type {
  BreedingPlanBuyerDTO,
  PlanBuyersResponse,
  PlanBuyersSummary,
  AddPlanBuyerRequest,
  UpdatePlanBuyerRequest,
  RefreshMatchesResponse,
  MatchReason,
} from "../types/breeding-plan-buyer.js";
import { BreedingPlanBuyerStage } from "@prisma/client";

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
  console.error("[breeding-plan-buyers] Error:", err);
  if (err instanceof Error) {
    return { status: 500, payload: { error: "internal_error", message: err.message } };
  }
  return { status: 500, payload: { error: "internal_error" } };
}

/**
 * Transform a Prisma BreedingPlanBuyer record into a DTO.
 */
function toBuyerDTO(record: any): BreedingPlanBuyerDTO {
  const waitlistEntry = record.waitlistEntry;
  const party = record.party;

  // Compute display name from waitlist entry or party
  let buyerName = "Unknown";
  let buyerEmail: string | null = null;
  let buyerPhone: string | null = null;

  if (waitlistEntry?.clientParty) {
    buyerName = waitlistEntry.clientParty.name || "Unknown";
    buyerEmail = waitlistEntry.clientParty.email;
    buyerPhone = waitlistEntry.clientParty.phoneE164;
  } else if (party) {
    buyerName = party.name || "Unknown";
    buyerEmail = party.email;
    buyerPhone = party.phoneE164;
  }

  return {
    id: record.id,
    planId: record.planId,
    stage: record.stage,
    waitlistEntryId: record.waitlistEntryId,
    waitlistEntry: waitlistEntry
      ? {
          id: waitlistEntry.id,
          status: waitlistEntry.status,
          clientName: waitlistEntry.clientParty?.name || null,
          clientEmail: waitlistEntry.clientParty?.email || null,
          clientPhone: waitlistEntry.clientParty?.phoneE164 || null,
          speciesPref: waitlistEntry.speciesPref,
          breedPrefs: waitlistEntry.breedPrefs as string[] | null,
          sirePrefId: waitlistEntry.sirePrefId,
          sirePrefName: waitlistEntry.sirePref?.name || null,
          damPrefId: waitlistEntry.damPrefId,
          damPrefName: waitlistEntry.damPref?.name || null,
          priority: waitlistEntry.priority,
          depositPaidAt: waitlistEntry.depositPaidAt?.toISOString() || null,
          depositPaidCents: waitlistEntry.depositPaidCents,
          notes: waitlistEntry.notes,
          createdAt: waitlistEntry.createdAt.toISOString(),
        }
      : null,
    partyId: record.partyId,
    party: party
      ? {
          id: party.id,
          name: party.name,
          email: party.email,
          phone: party.phoneE164,
        }
      : null,
    buyerName,
    buyerEmail,
    buyerPhone,
    matchScore: record.matchScore,
    matchReasons: record.matchReasons as MatchReason[] | null,
    assignedAt: record.assignedAt?.toISOString() || null,
    assignedByPartyId: record.assignedByPartyId,
    priority: record.priority,
    offspringGroupBuyerId: record.offspringGroupBuyerId,
    offspringId: record.offspringId,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/* ───────────────────────── includes for queries ───────────────────────── */

const buyerIncludes = {
  waitlistEntry: {
    include: {
      clientParty: { select: { name: true, email: true, phoneE164: true } },
      sirePref: { select: { name: true } },
      damPref: { select: { name: true } },
    },
  },
  party: { select: { id: true, name: true, email: true, phoneE164: true } },
};

/* ───────────────────────── routes ───────────────────────── */

const breedingPlanBuyersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
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
   * GET /breeding/plans/:planId/buyers
   * List all buyers for a breeding plan, grouped by stage.
   */
  app.get<{ Params: { planId: string }; Querystring: { includeWaitlistDetails?: string } }>(
    "/breeding/plans/:planId/buyers",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Verify plan exists and belongs to tenant
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          include: { program: true },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Fetch all buyers for this plan
        const buyers = await prisma.breedingPlanBuyer.findMany({
          where: { planId, tenantId },
          include: buyerIncludes,
          orderBy: [{ stage: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
        });

        // Group by stage
        const possibleMatches: BreedingPlanBuyerDTO[] = [];
        const inquiries: BreedingPlanBuyerDTO[] = [];
        const assigned: BreedingPlanBuyerDTO[] = [];
        const matchedToOffspring: BreedingPlanBuyerDTO[] = [];

        for (const buyer of buyers) {
          const dto = toBuyerDTO(buyer);
          switch (buyer.stage) {
            case "POSSIBLE_MATCH":
              possibleMatches.push(dto);
              break;
            case "INQUIRY":
              inquiries.push(dto);
              break;
            case "ASSIGNED":
              assigned.push(dto);
              break;
            case "MATCHED_TO_OFFSPRING":
              matchedToOffspring.push(dto);
              break;
          }
        }

        // Calculate summary
        const totalAssigned = assigned.length;
        const expectedLitterSize = plan.expectedLitterSize;
        const availableSpots =
          expectedLitterSize !== null ? expectedLitterSize - totalAssigned : null;
        const isOverbooked = availableSpots !== null && availableSpots < 0;

        // Determine deposit settings
        let depositSettings: PlanBuyersSummary["depositSettings"];
        if (plan.depositOverrideRequired !== null) {
          depositSettings = {
            required: plan.depositOverrideRequired,
            amountCents: plan.depositOverrideAmountCents,
            source: "plan",
          };
        } else if (plan.program) {
          // Would need to add deposit fields to BreedingProgram - for now default to none
          depositSettings = {
            required: false,
            amountCents: null,
            source: "program",
          };
        } else {
          depositSettings = {
            required: false,
            amountCents: null,
            source: "none",
          };
        }

        const summary: PlanBuyersSummary = {
          totalAssigned,
          expectedLitterSize,
          availableSpots,
          isOverbooked,
          depositSettings,
        };

        const response: PlanBuyersResponse = {
          possibleMatches,
          inquiries,
          assigned,
          matchedToOffspring,
          summary,
        };

        reply.send(response);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * POST /breeding/plans/:planId/buyers
   * Add a buyer to a plan.
   */
  app.post<{ Params: { planId: string }; Body: AddPlanBuyerRequest }>(
    "/breeding/plans/:planId/buyers",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { waitlistEntryId, partyId, stage, priority, notes } = req.body || {};

        if (!waitlistEntryId && !partyId) {
          return reply.code(400).send({ error: "must_provide_waitlist_entry_or_party" });
        }

        // Verify plan exists
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Verify waitlist entry or party belongs to tenant
        if (waitlistEntryId) {
          const entry = await prisma.waitlistEntry.findFirst({
            where: { id: waitlistEntryId, tenantId },
          });
          if (!entry) return reply.code(404).send({ error: "waitlist_entry_not_found" });
        }
        if (partyId) {
          const party = await prisma.party.findFirst({
            where: { id: partyId, tenantId },
          });
          if (!party) return reply.code(404).send({ error: "party_not_found" });
        }

        // Create the buyer record
        const buyer = await prisma.breedingPlanBuyer.create({
          data: {
            tenantId,
            planId,
            waitlistEntryId: waitlistEntryId || null,
            partyId: partyId || null,
            stage: stage || "ASSIGNED",
            priority: priority || null,
            notes: notes || null,
            assignedAt: stage === "ASSIGNED" || !stage ? new Date() : null,
          },
          include: buyerIncludes,
        });

        reply.code(201).send(toBuyerDTO(buyer));
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * PATCH /breeding/plans/:planId/buyers/:id
   * Update a plan buyer (change stage, priority, notes).
   */
  app.patch<{ Params: { planId: string; id: string }; Body: UpdatePlanBuyerRequest }>(
    "/breeding/plans/:planId/buyers/:id",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.id);
        if (!planId || !buyerId) return reply.code(400).send({ error: "bad_id" });

        const { stage, priority, notes } = req.body || {};

        // Verify buyer exists and belongs to this plan/tenant
        const existing = await prisma.breedingPlanBuyer.findFirst({
          where: { id: buyerId, planId, tenantId },
        });
        if (!existing) return reply.code(404).send({ error: "buyer_not_found" });

        const updateData: any = {};
        if (stage !== undefined) {
          updateData.stage = stage;
          // Set assignedAt when transitioning to ASSIGNED
          if (stage === "ASSIGNED" && existing.stage !== "ASSIGNED") {
            updateData.assignedAt = new Date();
          }
        }
        if (priority !== undefined) updateData.priority = priority;
        if (notes !== undefined) updateData.notes = notes;

        const updated = await prisma.breedingPlanBuyer.update({
          where: { id: buyerId },
          data: updateData,
          include: buyerIncludes,
        });

        reply.send(toBuyerDTO(updated));
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * DELETE /breeding/plans/:planId/buyers/:id
   * Remove a buyer from a plan.
   */
  app.delete<{ Params: { planId: string; id: string } }>(
    "/breeding/plans/:planId/buyers/:id",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        const buyerId = toNum(req.params.id);
        if (!planId || !buyerId) return reply.code(400).send({ error: "bad_id" });

        // Verify buyer exists and belongs to this plan/tenant
        const existing = await prisma.breedingPlanBuyer.findFirst({
          where: { id: buyerId, planId, tenantId },
        });
        if (!existing) return reply.code(404).send({ error: "buyer_not_found" });

        await prisma.breedingPlanBuyer.delete({ where: { id: buyerId } });

        reply.code(204).send();
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * POST /breeding/plans/:planId/buyers/reorder
   * Reorder assigned buyers.
   */
  app.post<{ Params: { planId: string }; Body: { buyerIds: number[] } }>(
    "/breeding/plans/:planId/buyers/reorder",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { buyerIds } = req.body || {};
        if (!Array.isArray(buyerIds) || buyerIds.length === 0) {
          return reply.code(400).send({ error: "buyerIds_required" });
        }

        // Update priorities based on array order
        await prisma.$transaction(
          buyerIds.map((id, index) =>
            prisma.breedingPlanBuyer.updateMany({
              where: { id, planId, tenantId },
              data: { priority: index + 1 },
            })
          )
        );

        reply.send({ success: true });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * POST /breeding/plans/:planId/buyers/refresh-matches
   * Re-run matching algorithm and update POSSIBLE_MATCH entries.
   */
  app.post<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/buyers/refresh-matches",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Verify plan exists
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });

        // Refresh matches
        const result = await refreshPlanMatches(prisma, planId, tenantId);

        // Fetch updated possible matches
        const matches = await prisma.breedingPlanBuyer.findMany({
          where: { planId, tenantId, stage: "POSSIBLE_MATCH" },
          include: buyerIncludes,
          orderBy: [{ matchScore: "desc" }, { createdAt: "asc" }],
        });

        const response: RefreshMatchesResponse = {
          added: result.added,
          removed: result.removed,
          updated: result.updated,
          matches: matches.map(toBuyerDTO),
        };

        reply.send(response);
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * POST /breeding/plans/:planId/buyers/bulk-assign
   * Assign multiple buyers at once.
   */
  app.post<{ Params: { planId: string }; Body: { buyerIds: number[] } }>(
    "/breeding/plans/:planId/buyers/bulk-assign",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        const { buyerIds } = req.body || {};
        if (!Array.isArray(buyerIds) || buyerIds.length === 0) {
          return reply.code(400).send({ error: "buyerIds_required" });
        }

        // Update all specified buyers to ASSIGNED stage
        const updated = await prisma.breedingPlanBuyer.updateMany({
          where: {
            id: { in: buyerIds },
            planId,
            tenantId,
          },
          data: {
            stage: "ASSIGNED",
            assignedAt: new Date(),
          },
        });

        reply.send({ assigned: updated.count });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );

  /**
   * POST /breeding/plans/:planId/buyers/send-to-offspring-group
   * Copy assigned buyers to OffspringGroupBuyer when group is created.
   */
  app.post<{ Params: { planId: string } }>(
    "/breeding/plans/:planId/buyers/send-to-offspring-group",
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);
        const planId = toNum(req.params.planId);
        if (!planId) return reply.code(400).send({ error: "bad_plan_id" });

        // Get the plan's offspring group
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          include: { offspringGroup: true },
        });
        if (!plan) return reply.code(404).send({ error: "plan_not_found" });
        if (!plan.offspringGroup) {
          return reply.code(400).send({ error: "no_offspring_group" });
        }

        const groupId = plan.offspringGroup.id;

        // Get assigned buyers from the plan
        const planBuyers = await prisma.breedingPlanBuyer.findMany({
          where: { planId, tenantId, stage: "ASSIGNED" },
          orderBy: { priority: "asc" },
        });

        let created = 0;
        let skipped = 0;

        for (const buyer of planBuyers) {
          // Check if already exists in offspring group
          const existingGroupBuyer = await prisma.offspringGroupBuyer.findFirst({
            where: {
              groupId,
              OR: [
                buyer.waitlistEntryId ? { waitlistEntryId: buyer.waitlistEntryId } : {},
                buyer.partyId ? { buyerPartyId: buyer.partyId } : {},
              ].filter((o) => Object.keys(o).length > 0),
            },
          });

          if (existingGroupBuyer) {
            skipped++;
            // Link the plan buyer to existing group buyer
            await prisma.breedingPlanBuyer.update({
              where: { id: buyer.id },
              data: { offspringGroupBuyerId: existingGroupBuyer.id },
            });
          } else {
            // Create new offspring group buyer
            const groupBuyer = await prisma.offspringGroupBuyer.create({
              data: {
                tenantId,
                groupId,
                buyerPartyId: buyer.partyId,
                waitlistEntryId: buyer.waitlistEntryId,
                placementRank: buyer.priority,
              },
            });

            // Update plan buyer with the link
            await prisma.breedingPlanBuyer.update({
              where: { id: buyer.id },
              data: { offspringGroupBuyerId: groupBuyer.id },
            });

            created++;
          }
        }

        reply.send({ created, skipped, offspringGroupId: groupId });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );
};

export default breedingPlanBuyersRoutes;
