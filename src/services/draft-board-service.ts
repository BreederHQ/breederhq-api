// src/services/draft-board-service.ts
// Draft Board Service — Automated buyer selection system for breeding plan placement.
//
// The draft board enables structured buyer selection where buyers pick offspring
// in priority order. Supports two modes:
// - AUTO: Picks are auto-approved immediately
// - ASSISTED: Picks require breeder approval before finalization
//
// Related schema fields:
// - BreedingPlan: draftMode, draftStatus, draftStartedAt, draftTimePerPickMinutes,
//                 draftWindowExpiryBehavior, draftCurrentPickNumber
// - BreedingPlanBuyer: draftPickNumber, draftPickedAt, draftPickStatus, draftSelectedOffspringId
// - BreedingPlanBuyerPreference: planBuyerId, offspringId, rank
//
// See: docs/planning/product/BUYER-JOURNEY-PLACEMENT-ENHANCEMENT-PLAN.md (Enhancement 5)

import prisma from "../prisma.js";
import { broadcastToTenant, broadcastToParty } from "./websocket-service.js";
import { sendPushToUser } from "./push.service.js";
import { sendEmail } from "./email-service.js";

// ---------- Types ----------

export type DraftMode = "AUTO" | "ASSISTED";
export type DraftStatus = "ACTIVE" | "PAUSED" | "COMPLETE";
export type DraftPickStatus = "WAITING" | "ON_THE_CLOCK" | "PICK_PENDING" | "PICKED" | "SKIPPED" | "DEFERRED";
export type DraftWindowExpiryBehavior = "DEFER_TO_END" | "AUTO_PICK_PREFERENCE" | "PAUSE_FOR_BREEDER";

export interface StartDraftOptions {
  mode: DraftMode;
  timePerPickMinutes?: number;
  expiryBehavior?: DraftWindowExpiryBehavior;
}

export interface DraftBuyerState {
  id: number;
  partyId: number | null;
  buyerName: string;
  buyerEmail: string | null;
  draftPickNumber: number | null;
  draftPickStatus: DraftPickStatus | null;
  draftSelectedOffspringId: number | null;
  draftPickedAt: string | null;
  placementRank: number | null;
}

export interface DraftOffspringState {
  id: number;
  name: string | null;
  sex: string | null;
  collarColorName: string | null;
  collarColorHex: string | null;
  buyerPartyId: number | null;
  keeperIntent: string;
  lifeState: string;
  placementState: string;
  priceCents: number | null;
}

export interface DraftState {
  planId: number;
  draftMode: DraftMode | null;
  draftStatus: DraftStatus | null;
  draftStartedAt: string | null;
  draftTimePerPickMinutes: number | null;
  draftWindowExpiryBehavior: DraftWindowExpiryBehavior | null;
  draftCurrentPickNumber: number | null;
  buyers: DraftBuyerState[];
  offspring: DraftOffspringState[];
  totalPicks: number;
  completedPicks: number;
}

export interface PickResult {
  nextBuyerId: number | null;
  draftComplete: boolean;
  match: { offspringId: number; buyerPartyId: number } | null;
}

// ---------- Error ----------

export class DraftBoardError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DraftBoardError";
  }
}

// ---------- Helpers ----------

function resolveBuyerName(buyer: any): string {
  if (buyer.waitlistEntry?.clientParty?.name) return buyer.waitlistEntry.clientParty.name;
  if (buyer.party?.name) return buyer.party.name;
  return "Unknown";
}

function resolveBuyerEmail(buyer: any): string | null {
  if (buyer.waitlistEntry?.clientParty?.email) return buyer.waitlistEntry.clientParty.email;
  if (buyer.party?.email) return buyer.party.email;
  return null;
}

function resolveBuyerPartyId(buyer: any): number | null {
  return buyer.partyId ?? buyer.waitlistEntry?.clientPartyId ?? null;
}

/** Find the userId linked to a partyId (for push notifications). */
async function findUserIdForParty(partyId: number, tenantId: number): Promise<string | null> {
  const membership = await prisma.tenantMembership.findFirst({
    where: { partyId, tenantId, membershipStatus: "ACTIVE" },
    select: { userId: true },
  });
  return membership?.userId ?? null;
}

/** Notify a buyer that it's their turn to pick (email + push). */
async function notifyBuyerOnTheClock(
  buyer: any,
  plan: any,
  tenantId: number,
): Promise<void> {
  const buyerName = resolveBuyerName(buyer);
  const buyerEmail = resolveBuyerEmail(buyer);
  const partyId = resolveBuyerPartyId(buyer);

  // Send email notification
  if (buyerEmail) {
    sendEmail({
      tenantId,
      to: buyerEmail,
      subject: `It's your turn to pick — ${plan.name}`,
      html: `<p>Hi ${buyerName},</p>
<p>It's your turn to select your offspring from <strong>${plan.name}</strong>.</p>
<p>Please log in to the Client Portal to make your selection.</p>`,
      text: `Hi ${buyerName},\n\nIt's your turn to select your offspring from ${plan.name}.\nPlease log in to the Client Portal to make your selection.`,
      category: "transactional",
    }).catch((err) => {
      console.error("[draft-board] Failed to send on-the-clock email:", err);
    });
  }

  // Send push notification
  if (partyId) {
    const userId = await findUserIdForParty(partyId, tenantId);
    if (userId) {
      sendPushToUser(
        userId,
        "Your turn to pick!",
        `It's your turn to select your offspring from ${plan.name}.`,
        { type: "draft_on_the_clock", planId: String(plan.id) },
      ).catch((err) => {
        console.error("[draft-board] Failed to send on-the-clock push:", err);
      });
    }
  }
}

// ---------- Buyer/Offspring includes ----------

const buyerIncludes = {
  waitlistEntry: {
    include: {
      clientParty: { select: { id: true, name: true, email: true } },
    },
  },
  party: { select: { id: true, name: true, email: true } },
};

// ---------- Service Functions ----------

/**
 * Start the draft board for a breeding plan.
 * Validates prerequisites, initializes pick order, and notifies the first buyer.
 */
export async function startDraft(
  planId: number,
  tenantId: number,
  options: StartDraftOptions,
): Promise<DraftState> {
  const { mode, timePerPickMinutes, expiryBehavior } = options;

  return prisma.$transaction(async (tx) => {
    // Load plan
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");

    if (plan.draftStatus === "ACTIVE" || plan.draftStatus === "PAUSED") {
      throw new DraftBoardError("draft_already_started", "Draft has already been started for this plan");
    }

    // Load assigned buyers with placementRank set
    const buyers = await tx.breedingPlanBuyer.findMany({
      where: {
        planId,
        tenantId,
        stage: "ASSIGNED",
        placementRank: { not: null },
        optedOutAt: null,
      },
      include: buyerIncludes,
      orderBy: { placementRank: "asc" },
    });

    if (buyers.length === 0) {
      throw new DraftBoardError("no_eligible_buyers", "No assigned buyers with placement ranks found");
    }

    // Load available offspring (alive, not keeper, no buyer yet)
    const availableOffspring = await tx.offspring.findMany({
      where: {
        breedingPlanId: planId,
        tenantId,
        lifeState: "ALIVE",
        keeperIntent: { not: "KEEP" },
        buyerPartyId: null,
      },
    });

    if (availableOffspring.length === 0) {
      throw new DraftBoardError("no_available_offspring", "No available offspring for draft selection");
    }

    // Update plan with draft configuration
    await tx.breedingPlan.update({
      where: { id: planId, tenantId },
      data: {
        draftMode: mode,
        draftStatus: "ACTIVE",
        draftStartedAt: new Date(),
        draftTimePerPickMinutes: timePerPickMinutes ?? null,
        draftWindowExpiryBehavior: expiryBehavior ?? null,
        draftCurrentPickNumber: 1,
      },
    });

    // Copy placementRank → draftPickNumber and set first buyer ON_THE_CLOCK
    for (let i = 0; i < buyers.length; i++) {
      const buyer = buyers[i];
      const pickNumber = i + 1; // Sequential 1-based order
      const isFirst = i === 0;

      await tx.breedingPlanBuyer.update({
        where: { id: buyer.id, tenantId },
        data: {
          draftPickNumber: pickNumber,
          draftPickStatus: isFirst ? "ON_THE_CLOCK" : "WAITING",
          draftSelectedOffspringId: null,
          draftPickedAt: null,
        },
      });
    }

    // Notify first buyer (fire-and-forget, outside transaction)
    const firstBuyer = buyers[0];
    const updatedPlan = { ...plan, name: plan.name, id: plan.id };
    setImmediate(() => {
      notifyBuyerOnTheClock(firstBuyer, updatedPlan, tenantId);
    });

    // Broadcast draft started
    broadcastToTenant(tenantId, "draft:started", { planId });

    // Return full state
    return getDraftStateInternal(tx, planId, tenantId);
  });
}

/**
 * Pause an active draft.
 */
export async function pauseDraft(planId: number, tenantId: number): Promise<void> {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");
  if (plan.draftStatus !== "ACTIVE") {
    throw new DraftBoardError("draft_not_active", "Draft is not currently active");
  }

  await prisma.breedingPlan.update({
    where: { id: planId, tenantId },
    data: { draftStatus: "PAUSED" },
  });

  broadcastToTenant(tenantId, "draft:paused", { planId });
}

/**
 * Resume a paused draft. Re-sends notification to current on-the-clock buyer.
 */
export async function resumeDraft(planId: number, tenantId: number): Promise<void> {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");
  if (plan.draftStatus !== "PAUSED") {
    throw new DraftBoardError("draft_not_paused", "Draft is not currently paused");
  }

  await prisma.breedingPlan.update({
    where: { id: planId, tenantId },
    data: { draftStatus: "ACTIVE" },
  });

  // Re-notify current on-the-clock buyer
  const currentBuyer = await prisma.breedingPlanBuyer.findFirst({
    where: { planId, tenantId, draftPickStatus: "ON_THE_CLOCK" },
    include: buyerIncludes,
  });
  if (currentBuyer) {
    notifyBuyerOnTheClock(currentBuyer, plan, tenantId);
  }

  broadcastToTenant(tenantId, "draft:resumed", { planId });
}

/**
 * Submit a buyer's offspring pick.
 * - AUTO mode: immediately approves the pick.
 * - ASSISTED mode: sets pick as pending breeder approval.
 */
export async function submitPick(
  planId: number,
  tenantId: number,
  buyerId: number,
  offspringId: number,
): Promise<PickResult | { status: "pending" }> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");
    if (plan.draftStatus !== "ACTIVE") {
      throw new DraftBoardError("draft_not_active", "Draft is not currently active");
    }

    // Verify buyer is ON_THE_CLOCK
    const buyer = await tx.breedingPlanBuyer.findFirst({
      where: { id: buyerId, planId, tenantId },
      include: buyerIncludes,
    });
    if (!buyer) throw new DraftBoardError("buyer_not_found", "Buyer not found on this plan");
    if (buyer.draftPickStatus !== "ON_THE_CLOCK") {
      throw new DraftBoardError("not_on_the_clock", "This buyer is not currently on the clock");
    }

    // Verify offspring is available
    const offspring = await tx.offspring.findFirst({
      where: {
        id: offspringId,
        breedingPlanId: planId,
        tenantId,
        lifeState: "ALIVE",
        keeperIntent: { not: "KEEP" },
        buyerPartyId: null,
      },
    });
    if (!offspring) {
      throw new DraftBoardError("offspring_unavailable", "This offspring is not available for selection");
    }

    if (plan.draftMode === "ASSISTED") {
      // ASSISTED mode: set pending, wait for breeder approval
      await tx.breedingPlanBuyer.update({
        where: { id: buyerId, tenantId },
        data: {
          draftPickStatus: "PICK_PENDING",
          draftSelectedOffspringId: offspringId,
        },
      });

      broadcastToTenant(tenantId, "draft:pick_pending", {
        planId,
        buyerId,
        offspringId,
        buyerName: resolveBuyerName(buyer),
      });

      return { status: "pending" as const };
    }

    // AUTO mode: approve immediately
    return approvePickInternal(tx, plan, buyer, offspringId, tenantId);
  });
}

/**
 * Approve a pending pick (ASSISTED mode only).
 */
export async function approvePick(
  planId: number,
  tenantId: number,
  buyerId: number,
): Promise<PickResult> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");

    const buyer = await tx.breedingPlanBuyer.findFirst({
      where: { id: buyerId, planId, tenantId },
      include: buyerIncludes,
    });
    if (!buyer) throw new DraftBoardError("buyer_not_found", "Buyer not found on this plan");
    if (buyer.draftPickStatus !== "PICK_PENDING") {
      throw new DraftBoardError("no_pending_pick", "This buyer does not have a pending pick to approve");
    }
    if (!buyer.draftSelectedOffspringId) {
      throw new DraftBoardError("no_selected_offspring", "Buyer has no selected offspring to approve");
    }

    return approvePickInternal(tx, plan, buyer, buyer.draftSelectedOffspringId, tenantId);
  });
}

/**
 * Reject a pending pick (ASSISTED mode). Buyer goes back to ON_THE_CLOCK to pick again.
 */
export async function rejectPick(
  planId: number,
  tenantId: number,
  buyerId: number,
): Promise<void> {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");

  const buyer = await prisma.breedingPlanBuyer.findFirst({
    where: { id: buyerId, planId, tenantId },
  });
  if (!buyer) throw new DraftBoardError("buyer_not_found", "Buyer not found on this plan");
  if (buyer.draftPickStatus !== "PICK_PENDING") {
    throw new DraftBoardError("no_pending_pick", "This buyer does not have a pending pick to reject");
  }

  await prisma.breedingPlanBuyer.update({
    where: { id: buyerId, tenantId },
    data: {
      draftPickStatus: "ON_THE_CLOCK",
      draftSelectedOffspringId: null,
    },
  });

  broadcastToTenant(tenantId, "draft:pick_rejected", { planId, buyerId });
}

/**
 * Handle pick window expiry for a buyer.
 * Behavior depends on the plan's draftWindowExpiryBehavior setting.
 */
export async function handleWindowExpiry(
  planId: number,
  tenantId: number,
  buyerId: number,
): Promise<PickResult | { status: "paused" } | { status: "deferred" }> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.breedingPlan.findFirst({
      where: { id: planId, tenantId },
    });
    if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");
    if (plan.draftStatus !== "ACTIVE") {
      throw new DraftBoardError("draft_not_active", "Draft is not currently active");
    }

    const buyer = await tx.breedingPlanBuyer.findFirst({
      where: { id: buyerId, planId, tenantId },
      include: buyerIncludes,
    });
    if (!buyer) throw new DraftBoardError("buyer_not_found", "Buyer not found on this plan");
    if (buyer.draftPickStatus !== "ON_THE_CLOCK") {
      throw new DraftBoardError("not_on_the_clock", "Buyer is not currently on the clock");
    }

    const behavior = (plan.draftWindowExpiryBehavior as DraftWindowExpiryBehavior) ?? "PAUSE_FOR_BREEDER";

    switch (behavior) {
      case "DEFER_TO_END": {
        // Move buyer to end of queue, advance to next
        const maxPickNumber = await tx.breedingPlanBuyer.aggregate({
          where: { planId, tenantId, draftPickNumber: { not: null } },
          _max: { draftPickNumber: true },
        });
        const newPickNumber = (maxPickNumber._max.draftPickNumber ?? 0) + 1;

        await tx.breedingPlanBuyer.update({
          where: { id: buyerId, tenantId },
          data: {
            draftPickStatus: "DEFERRED",
            draftPickNumber: newPickNumber,
          },
        });

        // Advance to next buyer
        const advanced = await advanceToNextBuyer(tx, plan, tenantId);

        broadcastToTenant(tenantId, "draft:buyer_deferred", {
          planId,
          buyerId,
          nextBuyerId: advanced.nextBuyerId,
          draftComplete: advanced.draftComplete,
        });

        if (advanced.draftComplete) {
          return { status: "deferred" as const };
        }

        // The deferred buyer will get another chance later
        // Reset their status so they can be put ON_THE_CLOCK again
        await tx.breedingPlanBuyer.update({
          where: { id: buyerId, tenantId },
          data: { draftPickStatus: "WAITING" },
        });

        return { status: "deferred" as const };
      }

      case "AUTO_PICK_PREFERENCE": {
        // Auto-pick buyer's highest available preference
        const preferences = await tx.breedingPlanBuyerPreference.findMany({
          where: { planBuyerId: buyerId },
          orderBy: { rank: "asc" },
        });

        // Batch fetch all preferred offspring availability in one query (no N+1)
        const preferredOffspringIds = preferences.map((p) => p.offspringId);
        const availablePreferred = await tx.offspring.findMany({
          where: {
            id: { in: preferredOffspringIds },
            breedingPlanId: planId,
            tenantId,
            lifeState: "ALIVE",
            keeperIntent: { not: "KEEP" },
            buyerPartyId: null,
          },
          select: { id: true },
        });
        const availableSet = new Set(availablePreferred.map((o) => o.id));

        // Find highest-ranked preference that is still available
        for (const pref of preferences) {
          if (availableSet.has(pref.offspringId)) {
            const result = await approvePickInternal(tx, plan, buyer, pref.offspringId, tenantId);
            broadcastToTenant(tenantId, "draft:auto_picked", {
              planId,
              buyerId,
              offspringId: pref.offspringId,
            });
            return result;
          }
        }

        // No preferences available — fall back to PAUSE_FOR_BREEDER
        await tx.breedingPlan.update({
          where: { id: planId, tenantId },
          data: { draftStatus: "PAUSED" },
        });

        broadcastToTenant(tenantId, "draft:paused", {
          planId,
          reason: "no_preferences_available",
          buyerId,
        });

        return { status: "paused" as const };
      }

      case "PAUSE_FOR_BREEDER":
      default: {
        // Pause draft, notify breeder
        await tx.breedingPlan.update({
          where: { id: planId, tenantId },
          data: { draftStatus: "PAUSED" },
        });

        broadcastToTenant(tenantId, "draft:paused", {
          planId,
          reason: "window_expired",
          buyerId,
          buyerName: resolveBuyerName(buyer),
        });

        return { status: "paused" as const };
      }
    }
  });
}

/**
 * Get the full draft board state for rendering.
 */
export async function getDraftState(planId: number, tenantId: number): Promise<DraftState> {
  return getDraftStateInternal(prisma, planId, tenantId);
}

// ---------- Internal Helpers ----------

/**
 * Internal: approve a pick and advance the draft to the next buyer.
 * Used by both AUTO (immediate) and ASSISTED (after approval) flows.
 */
async function approvePickInternal(
  tx: any,
  plan: any,
  buyer: any,
  offspringId: number,
  tenantId: number,
): Promise<PickResult> {
  const buyerPartyId = resolveBuyerPartyId(buyer);

  // Mark buyer as PICKED
  await tx.breedingPlanBuyer.update({
    where: { id: buyer.id, tenantId },
    data: {
      draftPickStatus: "PICKED",
      draftSelectedOffspringId: offspringId,
      draftPickedAt: new Date(),
    },
  });

  // Assign offspring to buyer
  if (buyerPartyId) {
    await tx.offspring.update({
      where: { id: offspringId, tenantId },
      data: {
        buyerPartyId,
        placementState: "RESERVED",
      },
    });
  }

  // Advance to next buyer
  const advanced = await advanceToNextBuyer(tx, plan, tenantId);

  const match = buyerPartyId
    ? { offspringId, buyerPartyId }
    : null;

  broadcastToTenant(tenantId, "draft:pick_approved", {
    planId: plan.id,
    buyerId: buyer.id,
    offspringId,
    buyerPartyId,
    nextBuyerId: advanced.nextBuyerId,
    draftComplete: advanced.draftComplete,
  });

  // Also notify the buyer's portal
  if (buyerPartyId) {
    broadcastToParty(buyerPartyId, "draft:your_pick_confirmed", {
      planId: plan.id,
      offspringId,
    });
  }

  return {
    nextBuyerId: advanced.nextBuyerId,
    draftComplete: advanced.draftComplete,
    match,
  };
}

/**
 * Advance to the next buyer in the draft queue.
 * Sets the next WAITING buyer to ON_THE_CLOCK and sends notifications.
 * If all buyers have picked, marks the draft as COMPLETE.
 */
async function advanceToNextBuyer(
  tx: any,
  plan: any,
  tenantId: number,
): Promise<{ nextBuyerId: number | null; draftComplete: boolean }> {
  // Find next WAITING buyer by pick number order
  const nextBuyer = await tx.breedingPlanBuyer.findFirst({
    where: {
      planId: plan.id,
      tenantId,
      draftPickStatus: "WAITING",
    },
    include: buyerIncludes,
    orderBy: { draftPickNumber: "asc" },
  });

  if (!nextBuyer) {
    // All buyers have picked — check for any still in DEFERRED status
    const deferredBuyer = await tx.breedingPlanBuyer.findFirst({
      where: {
        planId: plan.id,
        tenantId,
        draftPickStatus: "DEFERRED",
      },
      include: buyerIncludes,
      orderBy: { draftPickNumber: "asc" },
    });

    if (deferredBuyer) {
      // Put the deferred buyer on the clock
      await tx.breedingPlanBuyer.update({
        where: { id: deferredBuyer.id, tenantId },
        data: { draftPickStatus: "ON_THE_CLOCK" },
      });

      const nextPickNumber = deferredBuyer.draftPickNumber ?? 0;
      await tx.breedingPlan.update({
        where: { id: plan.id, tenantId },
        data: { draftCurrentPickNumber: nextPickNumber },
      });

      setImmediate(() => {
        notifyBuyerOnTheClock(deferredBuyer, plan, tenantId);
      });

      return { nextBuyerId: deferredBuyer.id, draftComplete: false };
    }

    // Draft is complete
    await tx.breedingPlan.update({
      where: { id: plan.id, tenantId },
      data: { draftStatus: "COMPLETE" },
    });

    broadcastToTenant(tenantId, "draft:complete", { planId: plan.id });

    return { nextBuyerId: null, draftComplete: true };
  }

  // Set next buyer ON_THE_CLOCK
  await tx.breedingPlanBuyer.update({
    where: { id: nextBuyer.id, tenantId },
    data: { draftPickStatus: "ON_THE_CLOCK" },
  });

  const nextPickNumber = nextBuyer.draftPickNumber ?? 0;
  await tx.breedingPlan.update({
    where: { id: plan.id, tenantId },
    data: { draftCurrentPickNumber: nextPickNumber },
  });

  // Notify next buyer (fire-and-forget)
  setImmediate(() => {
    notifyBuyerOnTheClock(nextBuyer, plan, tenantId);
  });

  return { nextBuyerId: nextBuyer.id, draftComplete: false };
}

/**
 * Get full draft state. Works with either prisma or transaction client.
 */
async function getDraftStateInternal(client: any, planId: number, tenantId: number): Promise<DraftState> {
  const plan = await client.breedingPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new DraftBoardError("plan_not_found", "Breeding plan not found");

  const buyers = await client.breedingPlanBuyer.findMany({
    where: {
      planId,
      tenantId,
      draftPickNumber: { not: null },
    },
    include: buyerIncludes,
    orderBy: { draftPickNumber: "asc" },
  });

  const offspring = await client.offspring.findMany({
    where: {
      breedingPlanId: planId,
      tenantId,
      lifeState: "ALIVE",
    },
    orderBy: { id: "asc" },
  });

  const buyerStates: DraftBuyerState[] = buyers.map((b: any) => ({
    id: b.id,
    partyId: resolveBuyerPartyId(b),
    buyerName: resolveBuyerName(b),
    buyerEmail: resolveBuyerEmail(b),
    draftPickNumber: b.draftPickNumber,
    draftPickStatus: b.draftPickStatus as DraftPickStatus | null,
    draftSelectedOffspringId: b.draftSelectedOffspringId,
    draftPickedAt: b.draftPickedAt?.toISOString() ?? null,
    placementRank: b.placementRank,
  }));

  const offspringStates: DraftOffspringState[] = offspring.map((o: any) => ({
    id: o.id,
    name: o.name,
    sex: o.sex,
    collarColorName: o.collarColorName,
    collarColorHex: o.collarColorHex,
    buyerPartyId: o.buyerPartyId,
    keeperIntent: o.keeperIntent,
    lifeState: o.lifeState,
    placementState: o.placementState,
    priceCents: o.priceCents,
  }));

  const completedPicks = buyerStates.filter((b) => b.draftPickStatus === "PICKED").length;

  return {
    planId,
    draftMode: plan.draftMode as DraftMode | null,
    draftStatus: plan.draftStatus as DraftStatus | null,
    draftStartedAt: plan.draftStartedAt?.toISOString() ?? null,
    draftTimePerPickMinutes: plan.draftTimePerPickMinutes,
    draftWindowExpiryBehavior: plan.draftWindowExpiryBehavior as DraftWindowExpiryBehavior | null,
    draftCurrentPickNumber: plan.draftCurrentPickNumber,
    buyers: buyerStates,
    offspring: offspringStates,
    totalPicks: buyerStates.length,
    completedPicks,
  };
}
