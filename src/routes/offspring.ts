// [OG-SERVICE-START] Offspring Groups domain logic, inline factory to avoid extra files.
import {
  OffspringLifeState,
  OffspringPlacementState,
  OffspringKeeperIntent,
  OffspringFinancialState,
  OffspringPaperworkState,
  type Offspring,
  Prisma,
  type PrismaClient,
  type OffspringGroup,
  type BreedingPlan,
  type Animal,
  type Sex,
} from "@prisma/client";
import prismaClient from "../prisma.js";
import { auditCreate, auditUpdate, auditDelete, auditArchive, auditRestore, type AuditContext } from "../services/audit-trail.js";
import { logEntityActivity } from "../services/activity-log.js";

/** Build AuditContext from a Fastify request */
function auditCtx(req: any, tenantId: number): AuditContext {
  return {
    tenantId,
    userId: String((req as any).userId ?? "unknown"),
    userName: (req as any).userName ?? undefined,
    changeSource: "PLATFORM",
    ip: req.ip,
  };
}


function __og_addDays(d: Date, days: number): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt;
}
function __og_coerceISODateOnly(v: Date | string): Date {
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) throw new Error("invalid date: " + v);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}
function __og_safeSeasonLabel(date: Date): string {
  const m = date.getUTCMonth();
  if (m <= 1) return "Winter " + date.getUTCFullYear();
  if (m <= 4) return "Spring " + date.getUTCFullYear();
  if (m <= 7) return "Summer " + date.getUTCFullYear();
  if (m <= 10) return "Fall " + date.getUTCFullYear();
  return "Winter " + (date.getUTCFullYear() + 1);
}
function __og_compactName(name: string): string {
  const n = String(name || "").trim();
  if (!n) return "";
  return n.replace(/\s+/g, " ");
}

function __og_deriveBreedFromGroup(group: any): string | null {
  if (!group) return null;

  // 1. Breeding plan breed text
  const planBreed = group.plan?.breedText;
  if (typeof planBreed === "string" && planBreed.trim().length > 0) {
    return planBreed.trim();
  }

  // 2. Dam canonical breed name
  const damCanonicalName = group.dam?.canonicalBreed?.name;
  if (typeof damCanonicalName === "string" && damCanonicalName.trim().length > 0) {
    return damCanonicalName.trim();
  }

  // 3. Dam free form breed
  const damBreed = group.dam?.breed;
  if (typeof damBreed === "string" && damBreed.trim().length > 0) {
    return damBreed.trim();
  }

  return null;
}


type __OG_EventInput = {
  tenantId: number;
  groupId: number;
  type: "LINK" | "UNLINK" | "CHANGE" | "NOTE" | "STATUS_OVERRIDE" | "BUYER_MOVE";
  field?: string | null;
  before?: unknown;
  after?: unknown;
  notes?: string | null;
  actorId?: string | null;
};

type __OG_Authorizer = { ensureAdmin(tenantId: number, actorId: string): Promise<void> };
const __og_authorizer: __OG_Authorizer = {
  async ensureAdmin(tenantId: number, actorId: string): Promise<void> {
    if (!actorId) throw new Error("Actor ID required for admin operations");

    const membership = await prismaClient.tenantMembership.findFirst({
      where: {
        tenantId,
        userId: actorId,
        role: { in: ["OWNER", "ADMIN"] },
      },
    });

    if (!membership) {
      throw new Error("Admin access required for this operation");
    }
  },
};

export function __makeOffspringGroupsService({ prisma, authorizer }: { prisma: PrismaClient; authorizer?: __OG_Authorizer }) {
  function expectedBirthFromPlan(plan: Pick<BreedingPlan, "expectedBirthDate" | "lockedOvulationDate">): Date | null {
    if (plan.expectedBirthDate) return __og_coerceISODateOnly(plan.expectedBirthDate);
    if (plan.lockedOvulationDate) return __og_addDays(__og_coerceISODateOnly(plan.lockedOvulationDate), 63);
    return null;
  }
  function buildTentativeGroupName(plan: Pick<BreedingPlan, "name"> & { dam?: Pick<Animal, "name"> | null }, dt: Date): string {
    if (plan.name && plan.name.trim()) return plan.name.trim();
    const damName = __og_compactName(plan.dam?.name ?? "");
    const season = __og_safeSeasonLabel(dt);
    return [damName || "Unnamed Dam", season].join(" • ");
  }

  async function ensureGroupForBredPlan(args: { tenantId: number; planId: number; actorId: string }): Promise<OffspringGroup> {
    const { tenantId, planId, actorId } = args;
    return prisma.$transaction(async (tx) => {
      const plan = await tx.breedingPlan.findFirst({
        where: { id: planId, tenantId },
        include: { dam: { select: { id: true, name: true, species: true } }, sire: { select: { id: true, name: true } } },
      });
      if (!plan) throw new Error("plan not found for tenant");

      const existing = await tx.offspringGroup.findFirst({ where: { tenantId, planId } });
      if (existing) return existing;

      const expectedBirthOn = expectedBirthFromPlan(plan);
      const tentativeName = buildTentativeGroupName({ name: plan.name, dam: plan.dam }, expectedBirthOn ?? new Date());

      const created = await tx.offspringGroup.create({
        data: {
          tenantId,
          planId: plan.id,
          species: (plan.dam as any)?.species ?? (plan as any).species ?? "DOG",
          damId: plan.damId ?? null,
          sireId: plan.sireId ?? null,
          linkState: "linked",
          expectedBirthOn,
          name: tentativeName,
        },
      });

      await tx.offspringGroupEvent.create({
        data: {
          tenantId,
          offspringGroupId: created.id,
          type: "LINK",
          field: "planId",
          occurredAt: new Date(),
          before: Prisma.DbNull,
          after: { planId: plan.id },
          notes: "Group ensured for bred plan",
          recordedByUserId: actorId,
        },
      });

      return created;
    });
  }

  async function linkGroupToPlan(args: { tenantId: number; groupId: number; planId: number; actorId: string }): Promise<OffspringGroup> {
    const { tenantId, groupId, planId, actorId } = args;
    return prisma.$transaction(async (tx) => {
      const [group, plan] = await Promise.all([
        tx.offspringGroup.findFirst({ where: { id: groupId, tenantId } }),
        tx.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          include: { dam: { select: { id: true, name: true, species: true } }, sire: { select: { id: true, name: true } } },
        }),
      ]);
      if (!group) throw new Error("group not found for tenant");
      if (!plan) throw new Error("plan not found for tenant");

      const before = { ...group };
      const patch: Prisma.OffspringGroupUncheckedUpdateInput = { planId: plan.id, linkState: "linked" };

      if (!group.species) patch.species = (plan.dam as any)?.species ?? (plan as any).species ?? "DOG";
      if (!group.damId && plan.damId) patch.damId = plan.damId;
      if (!group.sireId && plan.sireId) patch.sireId = plan.sireId;
      if (!group.expectedBirthOn) {
        const exp = expectedBirthFromPlan(plan);
        if (exp) patch.expectedBirthOn = exp;
      }
      if (!group.name) {
        const exp = (patch as any).expectedBirthOn ?? expectedBirthFromPlan(plan) ?? new Date();
        patch.name = buildTentativeGroupName({ name: plan.name, dam: plan.dam }, exp);
      }

      const updated = await tx.offspringGroup.update({ where: { id: group.id }, data: patch });

      await tx.offspringGroupEvent.create({
        data: {
          tenantId,
          offspringGroupId: group.id,
          type: "LINK",
          field: "planId",
          occurredAt: new Date(),
          before,
          after: { ...updated },
          notes: "Group linked to plan",
          recordedByUserId: actorId,
        },
      });

      return updated;
    });
  }

  async function unlinkGroup(args: { tenantId: number; groupId: number; actorId: string }): Promise<OffspringGroup> {
    const { tenantId, groupId, actorId } = args;
    if (authorizer) await authorizer.ensureAdmin(tenantId, actorId);

    return prisma.$transaction(async (tx) => {
      const group = await tx.offspringGroup.findFirst({ where: { id: groupId, tenantId } });
      if (!group) throw new Error("group not found for tenant");

      // BUSINESS RULE: Cannot unlink an offspring group that has offspring
      // Check for offspring in the Animal table (legacy)
      const animalCount = await tx.animal.count({
        where: { tenantId, offspringGroupId: groupId },
      });
      // Check for offspring in the Offspring table
      const offspringCount = await tx.offspring.count({
        where: { tenantId, groupId },
      });
      if (animalCount > 0 || offspringCount > 0) {
        const error = new Error("cannot_unlink_group_with_offspring") as any;
        error.code = "BUSINESS_RULE_VIOLATION";
        error.detail = "Cannot unlink an offspring group from its breeding plan because offspring have already been added. Remove all offspring first before unlinking the group.";
        error.statusCode = 400;
        throw error;
      }

      const updated = await tx.offspringGroup.update({
        where: { id: group.id },
        data: { planId: null, linkState: "orphan" },
      });

      await tx.offspringGroupEvent.create({
        data: {
          tenantId,
          offspringGroupId: group.id,
          type: "UNLINK",
          occurredAt: new Date(),
          field: "planId",
          before: { ...group },
          after: { ...updated },
          notes: "Group manually unlinked from plan",
          recordedByUserId: actorId,
        },
      });

      return updated;
    });
  }

  async function getLinkSuggestions(args: { tenantId: number; groupId: number; limit?: number }) {
    const { tenantId, groupId, limit = 10 } = args;

    const [group, plans] = await Promise.all([
      prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        include: { dam: { select: { id: true, name: true, species: true } }, sire: { select: { id: true, name: true } } },
      }),
      prisma.breedingPlan.findMany({
        where: { tenantId },
        include: { dam: { select: { id: true, name: true, species: true } }, sire: { select: { id: true, name: true } } },
      }),
    ]);
    if (!group) throw new Error("group not found for tenant");

    const groupExp = group.expectedBirthOn ?? group.actualBirthOn ?? null;
    const groupDamId = group.damId ?? null;
    const groupSireId = group.sireId ?? null;
    const groupSpecies = group.species ?? (group.dam as any)?.species ?? null;

    const within7 = (d1: Date | null, d2: Date | null) => {
      if (!d1 || !d2) return false;
      const ms = Math.abs(__og_coerceISODateOnly(d1).getTime() - __og_coerceISODateOnly(d2).getTime());
      return ms <= 7 * 24 * 60 * 60 * 1000;
    };

    return plans
      .map((p) => {
        let score = 10;
        const pSpecies = (p.dam as any)?.species ?? (p as any).species ?? null;
        if (groupSpecies && pSpecies && String(groupSpecies) === String(pSpecies)) score += 25;
        if (groupDamId && p.damId && groupDamId === p.damId) score += 40;
        const pExpected = p.expectedBirthDate
          ? __og_coerceISODateOnly(p.expectedBirthDate as any)
          : p.lockedOvulationDate
            ? __og_addDays(__og_coerceISODateOnly(p.lockedOvulationDate as any), 63)
            : null;
        if (within7(groupExp, pExpected)) score += 20;
        if (groupSireId && p.sireId && groupSireId === p.sireId) score += 5;

        return {
          planId: p.id,
          planName: p.name ?? `Plan #${p.id}`,
          expectedBirthDate: pExpected ?? null,
          damName: p.dam?.name ?? null,
          sireName: p.sire?.name ?? null,
          matchScore: score,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  return { ensureGroupForBredPlan, linkGroupToPlan, unlinkGroup, getLinkSuggestions };
}
// [OG-SERVICE-END]

// src/routes/offspring.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";
import {
  parsePlacementSchedulingPolicy,
  validatePlacementSchedulingPolicy,
  type PlacementSchedulingPolicy,
} from "../services/placement-scheduling.js";
import {
  triggerOnOffspringCreated,
  triggerOnOffspringUpdated,
  triggerOnOffspringGroupCreated,
  triggerOnOffspringGroupUpdated,
} from "../lib/rule-triggers.js";
import {
  transferMicrochipOwnership,
  isPlacementTransition,
} from "../services/microchip-ownership-transfer.js";

/* ========= helpers ========= */

function getTenantId(req: any) {
  const raw = req.headers["x-tenant-id"] ?? req.query.tenantId;
  const id = Number(raw);
  if (!Number.isFinite(id)) return null;
  return id;
}

function parseISO(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asBool(v: any): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return undefined;
}

function pick<T extends object>(obj: any, keys: (keyof T)[]): Partial<T> {
  const out: any = {};
  for (const k of keys) {
    if (k in obj) out[k] = obj[k as string];
  }
  return out;
}

/* ========= serializers ========= */


function litePlanForList(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    species: p.species,
    breedText: p.breedText,
    dam: p.dam ? { id: p.dam.id, name: p.dam.name } : null,
    sire: p.sire ? { id: p.sire.id, name: p.sire.name } : null,
    expectedPlacementStart: p.expectedPlacementStart?.toISOString() ?? null,
    expectedPlacementCompleted: p.expectedPlacementCompleted?.toISOString() ?? null,
    placementStartDateActual: p.placementStartDateActual?.toISOString() ?? null,
    placementCompletedDateActual: p.placementCompletedDateActual?.toISOString() ?? null,
  };
}

function groupListItem(G: any, animalsCt: number, waitlistCt: number) {
  return {
    id: G.id,
    tenantId: G.tenantId,
    identifier: G.name ?? null,

    // Foreign keys for linking - used by frontend to match groups to plans/programs
    breedingPlanId: G.planId ?? G.plan?.id ?? null,
    breedingProgramId: G.breedingProgramId ?? G.plan?.programId ?? null,

    // expose real group species, not only plan.species
    species: G.species ?? null,

    // expose a breed name for convenience, derived from the plan for now
    breedName: G.plan?.breedText ?? null,

    // Derive published from status field (LIVE = published, DRAFT = not published)
    published: G.status === "LIVE",
    counts: {
      animals: animalsCt ?? 0,
      waitlist: waitlistCt ?? 0,
      born: G.countBorn ?? null,
      live: G.countLive ?? null,
      stillborn: G.countStillborn ?? null,
      male: G.countMale ?? null,
      female: G.countFemale ?? null,
      weaned: G.countWeaned ?? null,
      placed: G.countPlaced ?? null,
    },
    dates: {
      birthedStartAt: G.actualBirthOn ?? null,
      birthedEndAt: G.actualBirthOn ?? null,
      weanedAt: G.weanedAt ?? null,
      placementStartAt: G.placementStartAt ?? G.plan?.expectedPlacementStart ?? null,
      placementCompletedAt:
        G.placementCompletedAt ?? G.plan?.expectedPlacementCompleted ?? null,
    },
    plan: G.plan && {
      id: G.plan.id,
      code: G.plan.code,
      name: G.plan.name,
      species: G.plan.species,
      breedText: G.plan.breedText,
      dam: G.plan.dam,
      sire: G.plan.sire,
      programId: G.plan.programId ?? null,
      program: G.plan.program ?? null,
      expectedPlacementStart: G.plan.expectedPlacementStart,
      expectedPlacementCompleted: G.plan.expectedPlacementCompleted,
      // Breeding plan status for offspring group display
      status: G.plan.status ?? null,
      // Actual dates for offspring group UI (determines if offspring can be added)
      birthDateActual: G.plan.birthDateActual?.toISOString?.()?.slice(0, 10) ?? null,
      breedDateActual: G.plan.breedDateActual?.toISOString?.()?.slice(0, 10) ?? null,
      // Dates for computing expected timeline in offspring UI
      lockedCycleStart: G.plan.lockedCycleStart?.toISOString?.() ?? G.plan.lockedCycleStart ?? null,
      expectedBirthDate: G.plan.expectedBirthDate?.toISOString?.() ?? G.plan.expectedBirthDate ?? null,
      expectedWeaned: G.plan.expectedWeaned?.toISOString?.() ?? G.plan.expectedWeaned ?? null,
    },
    statusOverride: G.statusOverride ?? null,
    statusOverrideReason: G.statusOverrideReason ?? null,
    createdAt: G.createdAt?.toISOString?.() ?? null,
    updatedAt: G.updatedAt?.toISOString?.() ?? null,
  };
}

/* ── Buyer summary helper for ?include=buyerSummary on the groups list ── */

const BUYER_PAID_STAGES = new Set([
  "DEPOSIT_PAID", "AWAITING_PICK", "MATCH_PROPOSED", "MATCHED",
  "VISIT_SCHEDULED", "PICKUP_SCHEDULED", "COMPLETED",
]);
const BUYER_DUE_STAGES = new Set(["DEPOSIT_NEEDED"]);

function buildBuyerSummary(buyers: any[], offspringRows: any[]) {
  const activeBuyers = buyers.filter((b) => b.stage !== "OPTED_OUT");
  const optedOut = buyers.filter((b) => b.stage === "OPTED_OUT").length;

  let depositPaid = 0, depositDue = 0, noDeposit = 0;
  for (const b of activeBuyers) {
    if (BUYER_PAID_STAGES.has(b.stage)) depositPaid++;
    else if (BUYER_DUE_STAGES.has(b.stage)) depositDue++;
    else noDeposit++;
  }

  const ranked = [...activeBuyers]
    .sort((a, b) => (a.placementRank ?? 9999) - (b.placementRank ?? 9999))
    .map((b) => {
      let depositStatus: "paid" | "due" | "none" = "none";
      if (BUYER_PAID_STAGES.has(b.stage)) depositStatus = "paid";
      else if (BUYER_DUE_STAGES.has(b.stage)) depositStatus = "due";

      // Find matched offspring by buyerPartyId linkage
      const matched = b.buyerPartyId
        ? offspringRows.find((o) => o.buyerPartyId === b.buyerPartyId) ?? null
        : null;

      return {
        id: b.id,
        label:
          b.buyerParty?.name ??
          b.waitlistEntry?.clientParty?.name ??
          `Buyer #${b.id}`,
        placementRank: b.placementRank,
        stage: b.stage as string,
        depositStatus,
        matchedOffspringLabel: matched
          ? (matched.collarColorName ?? matched.name ?? null)
          : null,
      };
    });

  const offspringSummary = offspringRows.map((o) => ({
    id: o.id,
    label: o.collarColorName ?? o.name ?? `#${o.id}`,
    sex: o.sex ?? null,
    isKeeper: o.keeperIntent === "KEEP",
    isMatched: o.buyerPartyId !== null,
  }));

  return {
    total: activeBuyers.length,
    depositPaid,
    depositDue,
    noDeposit,
    optedOut,
    buyers: ranked,
    offspring: offspringSummary,
  };
}

async function attachBuyerSummaries(ids: number[], items: any[]) {
  if (!ids.length) return;

  const [buyerRows, offspringRows, legacyAnimalRows] = await Promise.all([
    prisma.offspringGroupBuyer.findMany({
      where: { groupId: { in: ids } },
      select: {
        id: true,
        groupId: true,
        buyerPartyId: true,
        stage: true,
        placementRank: true,
        buyerParty: { select: { id: true, name: true, type: true } },
        waitlistEntry: { select: { clientParty: { select: { name: true } } } },
      },
      orderBy: [{ groupId: "asc" }, { placementRank: "asc" }],
    }),
    prisma.offspring.findMany({
      where: { groupId: { in: ids } },
      select: {
        id: true,
        groupId: true,
        name: true,
        sex: true,
        keeperIntent: true,
        buyerPartyId: true,
        collarColorName: true,
      },
    }),
    // Also fetch legacy Animal records linked via offspringGroupId
    prisma.animal.findMany({
      where: { offspringGroupId: { in: ids } },
      select: {
        id: true,
        offspringGroupId: true,
        name: true,
        sex: true,
        buyerPartyId: true,
        collarColorName: true,
      },
    }),
  ]);

  const buyersByGroup = new Map<number, typeof buyerRows>();
  for (const b of buyerRows) {
    if (!buyersByGroup.has(b.groupId)) buyersByGroup.set(b.groupId, []);
    buyersByGroup.get(b.groupId)!.push(b);
  }

  // Normalize offspring: combine Offspring model + legacy Animal records into a uniform shape
  type OffspringSummaryRow = {
    id: number;
    groupId: number;
    name: string | null;
    sex: string | null;
    keeperIntent: string | null;
    buyerPartyId: number | null;
    collarColorName: string | null;
  };

  const offspringByGroup = new Map<number, OffspringSummaryRow[]>();
  for (const o of offspringRows) {
    if (!offspringByGroup.has(o.groupId)) offspringByGroup.set(o.groupId, []);
    offspringByGroup.get(o.groupId)!.push(o as OffspringSummaryRow);
  }
  // Merge legacy Animal records (those not already covered by Offspring model)
  const seenAnimalIds = new Set(offspringRows.map((o) => o.id));
  for (const a of legacyAnimalRows) {
    const gId = a.offspringGroupId!;
    // Skip if an Offspring record already covers this (shouldn't happen but be safe)
    if (seenAnimalIds.has(a.id)) continue;
    if (!offspringByGroup.has(gId)) offspringByGroup.set(gId, []);
    offspringByGroup.get(gId)!.push({
      id: a.id,
      groupId: gId,
      name: a.name ?? null,
      sex: a.sex ? String(a.sex) : null,
      keeperIntent: null, // Animal model doesn't track keeper intent
      buyerPartyId: a.buyerPartyId ?? null,
      collarColorName: a.collarColorName ?? null,
    });
  }

  for (const item of items) {
    item.buyerSummary = buildBuyerSummary(
      buyersByGroup.get(item.id) ?? [],
      offspringByGroup.get(item.id) ?? [],
    );
  }
}

function groupDetail(
  G: any,
  animals: any[],
  waitlist: any[],
  attachments: any[],
  buyers: any[] = [],
  offspring: any[] = [],
) {
  const summary = summarizeOffspringStates(offspring);
  return {
    id: G.id,
    tenantId: G.tenantId,
    identifier: G.name ?? null,
    notes: G.notes ?? null,
    // Derive published from status field (LIVE = published, DRAFT = not published)
    published: G.status === "LIVE",
    coverImageUrl: G.coverImageUrl ?? null,
    themeName: G.themeName ?? null,

    // Foreign keys for linking - used by frontend to match groups to plans/programs
    breedingPlanId: G.planId ?? G.plan?.id ?? null,
    breedingProgramId: G.breedingProgramId ?? G.plan?.programId ?? null,

    counts: {
      born: G.countBorn ?? null,
      live: G.countLive ?? null,
      stillborn: G.countStillborn ?? null,
      male: G.countMale ?? null,
      female: G.countFemale ?? null,
      weaned: G.countWeaned ?? null,
      placed: G.countPlaced ?? null,
    },

    plan: G.plan
      ? {
        id: G.plan.id,
        code: G.plan.code,
        name: G.plan.name,
        species: G.plan.species,
        breedText: G.plan.breedText,
        dam: G.plan.dam ? { id: G.plan.dam.id, name: G.plan.dam.name } : null,
        sire: G.plan.sire ? { id: G.plan.sire.id, name: G.plan.sire.name } : null,
        programId: G.plan.programId ?? null,
        program: G.plan.program ? { id: G.plan.program.id, name: G.plan.program.name } : null,
        expectedPlacementStart: G.plan.expectedPlacementStart?.toISOString?.() ?? G.plan.expectedPlacementStart ?? null,
        expectedPlacementCompleted: G.plan.expectedPlacementCompleted?.toISOString?.() ?? G.plan.expectedPlacementCompleted ?? null,
        // Birth date fields for offspring group UI
        status: G.plan.status ?? null,
        birthDateActual: G.plan.birthDateActual?.toISOString?.()?.slice(0, 10) ?? null,
        breedDateActual: G.plan.breedDateActual?.toISOString?.()?.slice(0, 10) ?? null,
        // Dates for computing expected timeline in offspring UI
        lockedCycleStart: G.plan.lockedCycleStart?.toISOString?.() ?? G.plan.lockedCycleStart ?? null,
        expectedBirthDate: G.plan.expectedBirthDate?.toISOString?.() ?? G.plan.expectedBirthDate ?? null,
        expectedWeaned: G.plan.expectedWeaned?.toISOString?.() ?? G.plan.expectedWeaned ?? null,
      }
      : null,

    Animals: animals.map((a: any) => ({
      id: a.id,
      name: a.name,
      sex: a.sex,
      status: a.status,
      birthDate: a.birthDate?.toISOString?.() ?? null,
      species: a.species,
      breed: a.breed ?? null,
      collarColorId: a.collarColorId ?? null,
      collarColorName: a.collarColorName ?? null,
      collarColorHex: a.collarColorHex ?? null,
      collarAssignedAt: a.collarAssignedAt?.toISOString?.() ?? null,
      collarLocked: !!a.collarLocked,
      updatedAt: a.updatedAt.toISOString(),
    })),

    Offspring: offspring.map((o: any) => {
      // Step 6D: Use Party-native fields directly
      const buyerParty = o.buyerParty;

      return {
        id: o.id,
        name: o.name ?? "",
        placeholderLabel: o.name ?? "",
        sex: o.sex ?? null,
        status: o.status ?? null,
        lifeState: o.lifeState ?? null,
        placementState: o.placementState ?? null,
        keeperIntent: o.keeperIntent ?? null,
        financialState: o.financialState ?? null,
        paperworkState: o.paperworkState ?? null,
        diedAt: o.diedAt
          ? o.diedAt instanceof Date
            ? o.diedAt.toISOString()
            : String(o.diedAt)
          : null,
        birthDate: o.bornAt
          ? o.bornAt instanceof Date
            ? o.bornAt.toISOString()
            : String(o.bornAt)
          : null,
        species: o.species ?? null,
        breed: (o as any).breed ?? null,
        buyerContact: buyerParty?.type === "CONTACT"
          ? {
            id: buyerParty.id,
            name: buyerParty.name ?? "",
          }
          : null,
        buyerOrg: buyerParty?.type === "ORGANIZATION"
          ? {
            id: buyerParty.id,
            name: buyerParty.name ?? "",
          }
          : null,
        placedAt:
          o.placedAt instanceof Date
            ? o.placedAt.toISOString()
            : o.placedAt ?? null,
        paidInFullAt:
          (o as any).paidInFullAt instanceof Date
            ? (o as any).paidInFullAt.toISOString()
            : (o as any).paidInFullAt ?? null,
        contractId: (o as any).contractId ?? null,
        contractSignedAt:
          (o as any).contractSignedAt instanceof Date
            ? (o as any).contractSignedAt.toISOString()
            : (o as any).contractSignedAt ?? null,
        waitlistEntry: (o as any).waitlistEntry
          ? {
            id: (o as any).waitlistEntry.id,
            label: (o as any).waitlistEntry.identifier ?? null,
          }
          : null,
        price:
          typeof (o as any).priceCents === "number"
            ? (o as any).priceCents / 100
            : null,
        // Collar color fields for display in Offspring tab
        whelpingCollarColor: (o as any).collarColorName ?? null,
        collarColorName: (o as any).collarColorName ?? null,
        collarColorHex: (o as any).collarColorHex ?? null,
        collarAssignedAt: (o as any).collarAssignedAt
          ? ((o as any).collarAssignedAt instanceof Date
            ? (o as any).collarAssignedAt.toISOString()
            : String((o as any).collarAssignedAt))
          : null,
      };
    }),

    Waitlist: waitlist.map((w: any) => ({
      id: w.id,
      tenantId: w.tenantId,
      status: w.status ?? null,
      priority: w.priority ?? null,
      contactId: w.contactId ?? null,
      organizationId: w.organizationId ?? null,
      speciesPref: w.speciesPref ?? null,
      breedPrefs: w.breedPrefs ?? null,
      sirePref: w.sirePref ? { id: w.sirePref.id, name: w.sirePref.name } : null,
      damPref: w.damPref ? { id: w.damPref.id, name: w.damPref.name } : null,
      contact: w.contact
        ? {
          id: w.contact.id,
          displayName:
            w.contact.displayName ??
            w.contact.display_name ??
            w.contact.name ??
            null,
          email: (w.contact as any).email ?? null,
          phoneE164: (w.contact as any).phoneE164 ?? null,
        }
        : null,
      organization: w.organization
        ? {
          id: w.organization.id,
          displayName: w.organization.name ?? null,
          email: (w.organization as any).email ?? null,
          phone: (w.organization as any).phone ?? null,
        }
        : null,
      tags: Array.isArray((w as any).TagAssignment)
        ? (w as any).TagAssignment.map((ta: any) => ({
          id: ta.id,
          tag: ta.tag,
        }))
        : [],
    })),

    BuyerLinks: buyers.map((b: any) => ({
      id: b.id,
      contactId: b.contactId ?? null,
      organizationId: b.organizationId ?? null,
      waitlistEntryId: b.waitlistEntryId ?? null,
      contact: b.contact
        ? {
          id: b.contact.id,
          displayName:
            b.contact.displayName ??
            b.contact.display_name ??
            b.contact.name ??
            null,
          email: (b.contact as any).email ?? null,
          phoneE164: (b.contact as any).phoneE164 ?? null,
        }
        : null,
      organization: b.organization
        ? {
          id: b.organization.id,
          name: b.organization.name ?? null,
          email: (b.organization as any).email ?? null,
          phone: (b.organization as any).phone ?? null,
        }
        : null,
      waitlistEntry: b.waitlistEntry
        ? {
          id: b.waitlistEntry.id,
          identifier: b.waitlistEntry.identifier ?? null,
        }
        : null,
    })),

    Attachment: (attachments ?? []).map((att: any) => ({
      ...att,
      attachmentPartyId: att.attachmentPartyId,
      partyName: att.attachmentParty?.name ?? null,
    })),
    summary,
    createdAt: G.createdAt?.toISOString?.() ?? null,
    updatedAt: G.updatedAt?.toISOString?.() ?? null,
  };
}


function mapOffspringToAnimalLite(o: any) {
  const group = o.group as any | undefined;

  // Step 6D: Use Party-native fields directly
  const buyerParty = o.buyerParty;

  // carry forward flexible JSON fields like color from the data blob
  const extra =
    typeof (o as any).data === "object" && (o as any).data !== null
      ? ((o as any).data as any)
      : null;

  return {
    id: o.id,
    name: o.name ?? "",
    sex: o.sex ?? null,
    status: String(o.status ?? ""),
    lifeState: o.lifeState ?? null,
    placementState: o.placementState ?? null,
    keeperIntent: o.keeperIntent ?? null,
    financialState: o.financialState ?? null,
    paperworkState: o.paperworkState ?? null,
    diedAt: (o as any).diedAt
      ? ((o as any).diedAt instanceof Date
        ? (o as any).diedAt.toISOString()
        : String((o as any).diedAt))
      : null,
    paidInFullAt: (o as any).paidInFullAt
      ? ((o as any).paidInFullAt instanceof Date
        ? (o as any).paidInFullAt.toISOString()
        : String((o as any).paidInFullAt))
      : null,
    contractId: (o as any).contractId ?? null,
    contractSignedAt: (o as any).contractSignedAt
      ? ((o as any).contractSignedAt instanceof Date
        ? (o as any).contractSignedAt.toISOString()
        : String((o as any).contractSignedAt))
      : null,
    birthDate: o.bornAt
      ? (o.bornAt instanceof Date ? o.bornAt.toISOString() : String(o.bornAt))
      : null,
    species: o.species ?? null,
    breed:
      (o as any).breed ??
      (group as any)?.breedName ??
      (group as any)?.breed ??
      (group as any)?.plan?.breedText ??
      null,

    // surface core identity fields
    color:
      (o as any).color ??
      (extra && typeof extra === "object" ? (extra as any).color ?? null : null),

    microchip:
      (o as any).microchip ??
      (extra && typeof extra === "object" ? (extra as any).microchip ?? null : null),
    registryNumber:
      (o as any).registryNumber ??
      (o as any).registration ??
      (extra && typeof extra === "object" ? (extra as any).registrationId ?? null : null),

    litterId: o.groupId ?? null,
    groupName: group?.name ?? null,
    // Include full group object with plan for DOB inheritance
    group: group
      ? {
          id: group.id,
          name: group.name ?? null,
          code: group.code ?? null,
          birthedStartAt: group.birthedStartAt
            ? (group.birthedStartAt instanceof Date
              ? group.birthedStartAt.toISOString()
              : String(group.birthedStartAt))
            : null,
          birthedEndAt: group.birthedEndAt
            ? (group.birthedEndAt instanceof Date
              ? group.birthedEndAt.toISOString()
              : String(group.birthedEndAt))
            : null,
          breedText: group.breedText ?? null,
          plan: group.plan
            ? {
                id: group.plan.id,
                birthedAt: group.plan.birthedAt
                  ? (group.plan.birthedAt instanceof Date
                    ? group.plan.birthedAt.toISOString()
                    : String(group.plan.birthedAt))
                  : null,
                breedText: group.plan.breedText ?? null,
              }
            : null,
        }
      : null,
    buyerPartyId: (o as any).buyerPartyId ?? null,
    buyerName: buyerParty?.name ?? null,

    placedAt: (o as any).placedAt
      ? ((o as any).placedAt instanceof Date
        ? (o as any).placedAt.toISOString()
        : String((o as any).placedAt))
      : null,
    updatedAt: o.updatedAt
      ? (o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt))
      : null,

    collarColorId: (o as any).collarColorId ?? null,
    collarColorName: (o as any).collarColorName ?? null,
    collarColorHex: (o as any).collarColorHex ?? null,
    collarAssignedAt: (o as any).collarAssignedAt
      ? ((o as any).collarAssignedAt instanceof Date
        ? (o as any).collarAssignedAt.toISOString()
        : String((o as any).collarAssignedAt))
      : null,
    collarLocked: (o as any).collarLocked ?? false,
  };
}

export function summarizeOffspringStates(offspring: any[]) {
  let alive = 0;
  let deceased = 0;
  let unassigned = 0;
  let optionHold = 0;
  let reserved = 0;
  let placed = 0;
  let returned = 0;
  let transferred = 0;
  let availableToPlace = 0;

  for (const o of offspring || []) {
    const life = o.lifeState ?? null;
    const placement = o.placementState ?? null;
    const intent = o.keeperIntent ?? null;

    if (life === OffspringLifeState.ALIVE) alive += 1;
    if (life === OffspringLifeState.DECEASED) deceased += 1;

    switch (placement) {
      case OffspringPlacementState.UNASSIGNED:
        unassigned += 1;
        break;
      case OffspringPlacementState.OPTION_HOLD:
        optionHold += 1;
        break;
      case OffspringPlacementState.RESERVED:
        reserved += 1;
        break;
      case OffspringPlacementState.PLACED:
        placed += 1;
        break;
      case OffspringPlacementState.RETURNED:
        returned += 1;
        break;
      case OffspringPlacementState.TRANSFERRED:
        transferred += 1;
        break;
      default:
        break;
    }

    const placeablePlacement =
      placement === OffspringPlacementState.UNASSIGNED || placement === OffspringPlacementState.OPTION_HOLD;
    const notHeldByKeeper =
      intent !== OffspringKeeperIntent.WITHHELD && intent !== OffspringKeeperIntent.KEEP;
    if (life === OffspringLifeState.ALIVE && placeablePlacement && notHeldByKeeper) {
      availableToPlace += 1;
    }
  }

  const denominator = alive + deceased;
  const placementRate = denominator > 0 ? placed / denominator : null;

  return {
    counts: {
      alive,
      deceased,
      unassigned,
      optionHold,
      reserved,
      placed,
      returned,
      transferred,
    },
    availableToPlaceCount: availableToPlace,
    placementRate,
  };
}

/* ========= offspring state normalization ========= */

export type OffspringStatePatch = Partial<Offspring> & Record<string, unknown>;
export type NormalizedOffspringPatch = OffspringStatePatch;

const PAPERWORK_ORDER: OffspringPaperworkState[] = [
  OffspringPaperworkState.NONE,
  OffspringPaperworkState.SENT,
  OffspringPaperworkState.SIGNED,
  OffspringPaperworkState.COMPLETE,
];

function sameInstant(a?: Date | null, b?: Date | null) {
  if (a == null && b == null) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function promotePaperworkState(
  current: OffspringPaperworkState,
  min: OffspringPaperworkState,
) {
  const currentIdx = PAPERWORK_ORDER.indexOf(current);
  const minIdx = PAPERWORK_ORDER.indexOf(min);
  return PAPERWORK_ORDER[Math.max(currentIdx, minIdx)];
}

export function normalizeOffspringState(
  current: Offspring | null,
  patch: OffspringStatePatch,
): NormalizedOffspringPatch {
  const normalized: NormalizedOffspringPatch = { ...patch };

  let nextLifeState =
    patch.lifeState ?? current?.lifeState ?? OffspringLifeState.ALIVE;
  let nextPlacementState =
    patch.placementState ?? current?.placementState ?? OffspringPlacementState.UNASSIGNED;
  let nextKeeperIntent =
    patch.keeperIntent ?? current?.keeperIntent ?? OffspringKeeperIntent.AVAILABLE;
  let nextFinancialState =
    patch.financialState ?? current?.financialState ?? OffspringFinancialState.NONE;
  let nextPaperworkState =
    patch.paperworkState ?? current?.paperworkState ?? OffspringPaperworkState.NONE;

  let nextDiedAt =
    patch.diedAt === undefined ? current?.diedAt ?? null : (patch.diedAt as Date | null);
  let nextPlacedAt =
    patch.placedAt === undefined ? current?.placedAt ?? null : (patch.placedAt as Date | null);
  const nextPaidInFullAt =
    patch.paidInFullAt === undefined
      ? current?.paidInFullAt ?? null
      : (patch.paidInFullAt as Date | null);
  const nextContractId =
    patch.contractId === undefined ? current?.contractId ?? null : (patch.contractId as string | null);
  const nextContractSignedAt =
    patch.contractSignedAt === undefined
      ? current?.contractSignedAt ?? null
      : (patch.contractSignedAt as Date | null);
  const nextPromotedAnimalId =
    patch.promotedAnimalId === undefined
      ? current?.promotedAnimalId ?? null
      : (patch.promotedAnimalId as number | null);
  const nextDepositCents =
    patch.depositCents === undefined
      ? current?.depositCents ?? null
      : (patch.depositCents as number | null);
  const nextPriceCents =
    patch.priceCents === undefined ? current?.priceCents ?? null : (patch.priceCents as number | null);
  const bornAt =
    patch.bornAt === undefined ? current?.bornAt ?? null : (patch.bornAt as Date | null);

  // Clearing diedAt while still DECEASED is illegal to avoid silent resurrection.
  if ("diedAt" in patch && patch.diedAt === null) {
    const finalLifeState = patch.lifeState ?? current?.lifeState ?? OffspringLifeState.ALIVE;
    if (finalLifeState === OffspringLifeState.DECEASED) {
      throw new Error("cannot clear diedAt while lifeState is DECEASED");
    }
  }

  // A death timestamp always forces the DECEASED lifeState.
  if (nextDiedAt) {
    nextLifeState = OffspringLifeState.DECEASED;
  }
  if (nextLifeState === OffspringLifeState.DECEASED && !nextDiedAt) {
    nextDiedAt = current?.diedAt ?? new Date();
  }

  // Once deceased, block any placement transitions or timestamp edits.
  const placementChangedWhileDead =
    nextLifeState === OffspringLifeState.DECEASED &&
    (("placementState" in patch &&
      (patch.placementState as OffspringPlacementState | undefined) !==
      (current?.placementState ?? OffspringPlacementState.UNASSIGNED)) ||
      ("placedAt" in patch && !sameInstant(patch.placedAt as Date | null | undefined, current?.placedAt)));
  if (placementChangedWhileDead) {
    throw new Error("cannot change placement details for a deceased offspring");
  }

  // Removing placement timing while still marked placed is not allowed.
  const placementStateFromPatch = patch.placementState ?? current?.placementState ?? nextPlacementState;
  if ("placedAt" in patch && patch.placedAt == null && placementStateFromPatch === OffspringPlacementState.PLACED) {
    throw new Error("cannot remove placedAt while placementState is PLACED");
  }

  // placedAt drives PLACED and PLACED requires a timestamp.
  if (nextPlacedAt) {
    if (nextLifeState === OffspringLifeState.DECEASED) {
      throw new Error("cannot place a deceased offspring");
    }
    nextPlacementState = OffspringPlacementState.PLACED;
  }
  if (nextPlacementState === OffspringPlacementState.PLACED) {
    if (!nextPlacedAt) {
      throw new Error("placedAt is required when placementState is PLACED");
    }
    if (nextLifeState === OffspringLifeState.DECEASED) {
      throw new Error("cannot place a deceased offspring");
    }
  }

  // Step 6D: Buyer assignment via buyerPartyId implies RESERVED until placement completes
  const nextBuyerPartyId =
    patch.buyerPartyId === undefined
      ? current?.buyerPartyId ?? null
      : (patch.buyerPartyId as number | null);
  const buyerAssigned = nextBuyerPartyId != null;
  if (
    buyerAssigned &&
    nextPlacementState !== OffspringPlacementState.PLACED &&
    nextLifeState !== OffspringLifeState.DECEASED
  ) {
    nextPlacementState = OffspringPlacementState.RESERVED;
  }

  // Promotion locks keeper intent to KEEP and cannot be flipped back to AVAILABLE.
  if (nextPromotedAnimalId != null) {
    nextKeeperIntent = OffspringKeeperIntent.KEEP;
  }
  if (
    current?.keeperIntent === OffspringKeeperIntent.KEEP &&
    patch.keeperIntent === OffspringKeeperIntent.AVAILABLE
  ) {
    throw new Error("cannot mark offspring as AVAILABLE once keeper intent is KEEP");
  }

  // paidInFullAt forces the terminal financial state.
  if (nextPaidInFullAt) {
    nextFinancialState = OffspringFinancialState.PAID_IN_FULL;
  }
  const depositRequired = typeof nextDepositCents === "number" && nextDepositCents > 0;
  const hasTerminalFinancialState =
    nextFinancialState === OffspringFinancialState.PAID_IN_FULL ||
    nextFinancialState === OffspringFinancialState.DEPOSIT_PAID ||
    nextFinancialState === OffspringFinancialState.REFUNDED ||
    nextFinancialState === OffspringFinancialState.CHARGEBACK;
  if (depositRequired && buyerAssigned && !hasTerminalFinancialState && nextFinancialState === OffspringFinancialState.NONE) {
    nextFinancialState = OffspringFinancialState.DEPOSIT_PENDING;
  }

  // Contract milestones advance paperwork.
  if (nextContractSignedAt) {
    nextPaperworkState = promotePaperworkState(nextPaperworkState, OffspringPaperworkState.SIGNED);
  } else if (nextContractId) {
    nextPaperworkState = promotePaperworkState(nextPaperworkState, OffspringPaperworkState.SENT);
  }

  normalized.lifeState = nextLifeState;
  normalized.placementState = nextPlacementState;
  normalized.keeperIntent = nextKeeperIntent;
  normalized.financialState = nextFinancialState;
  normalized.paperworkState = nextPaperworkState;
  normalized.diedAt = nextDiedAt ?? null;
  normalized.placedAt = nextPlacedAt ?? null;
  normalized.paidInFullAt = nextPaidInFullAt ?? null;
  normalized.contractId = nextContractId ?? null;
  normalized.contractSignedAt = nextContractSignedAt ?? null;
  normalized.promotedAnimalId = nextPromotedAnimalId ?? null;
  normalized.depositCents = nextDepositCents ?? null;
  normalized.priceCents = nextPriceCents ?? null;
  return normalized;
}
/* ========= router ========= */

const offspringRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // inject tenant
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  /* ===== LIST: GET /api/v1/offspring ===== */
  app.get("/offspring", async (req, reply) => {
    const actorContext = (req as any).actorContext;
    const tenantId = (req as any).tenantId as number;
    const q = String((req as any).query?.q ?? "").trim();

    // Support both cursor-based (legacy) and page/limit pagination
    const page = (req as any).query?.page ? Number((req as any).query.page) : undefined;
    const limit = Math.min(250, Math.max(1, Number((req as any).query?.limit ?? 25)));
    const cursorId = (req as any).query?.cursor ? Number((req as any).query.cursor) : undefined;
    const published = asBool((req as any).query?.published);

    // ?include=buyerSummary — attach per-group buyer + offspring overview
    const includeParam = String((req as any).query?.include ?? "");
    const includeBuyerSummary = includeParam.split(",").includes("buyerSummary");

    const where: any = {
      tenantId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : null),
      ...(published !== undefined ? { published } : null),
      ...(cursorId ? { id: { lt: cursorId } } : null),
    };

    // PORTAL CLIENT: Enforce party scope - only show groups where they are buyer
    if (actorContext === "CLIENT") {
      const { partyId } = await requireClientPartyScope(req);
      where.buyers = {
        some: { buyerPartyId: partyId },
      };
    }

    // If page is specified, use offset-based pagination and include total count
    if (page !== undefined) {
      const skip = (page - 1) * limit;

      const [groups, total] = await Promise.all([
        prisma.offspringGroup.findMany({
          where,
          orderBy: { id: "desc" },
          skip,
          take: limit,
          include: {
            plan: {
              where: { deletedAt: null },
              select: {
                id: true,
                code: true,
                name: true,
                species: true,
                breedText: true,
                dam: { select: { id: true, name: true } },
                sire: { select: { id: true, name: true } },
                programId: true,
                program: { select: { id: true, name: true } },
                expectedPlacementStart: true,
                expectedPlacementCompleted: true,
                placementStartDateActual: true,
                placementCompletedDateActual: true,
                // Birth date fields for offspring group UI
                status: true,
                birthDateActual: true,
                breedDateActual: true,
                // Locked cycle date for computing expected dates
                lockedCycleStart: true,
                expectedBirthDate: true,
                expectedWeaned: true,
                // Foaling outcome for horses
                foalingOutcome: true,
              },
            },
          },
        }),
        prisma.offspringGroup.count({ where }),
      ]);

      const ids = groups.map((g) => g.id);
      // batch counts to avoid _count key mismatches
      const [animalCounts, waitlistCounts] = await Promise.all([
        ids.length
          ? prisma.animal.groupBy({
            by: ["offspringGroupId"],
            where: { offspringGroupId: { in: ids } },
            _count: { _all: true },
          })
          : Promise.resolve([] as any[]),
        ids.length
          ? prisma.waitlistEntry.groupBy({
            by: ["offspringGroupId"],
            where: { offspringGroupId: { in: ids } },
            _count: { _all: true },
          })
          : Promise.resolve([] as any[]),
      ]);

      const aMap = new Map<number, number>();
      for (const r of animalCounts) aMap.set(Number(r.offspringGroupId), Number(r._count?._all ?? 0));
      const wMap = new Map<number, number>();
      for (const r of waitlistCounts) wMap.set(Number(r.offspringGroupId), Number(r._count?._all ?? 0));

      const items = groups.map((g) => groupListItem(g, aMap.get(g.id) ?? 0, wMap.get(g.id) ?? 0));
      if (includeBuyerSummary) await attachBuyerSummaries(ids, items);
      const totalPages = Math.ceil(total / limit);

      reply.send({
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      });
    } else {
      // Legacy cursor-based pagination
      const groups = await prisma.offspringGroup.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit + 1,
        include: {
          plan: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              name: true,
              species: true,
              breedText: true,
              dam: { select: { id: true, name: true } },
              sire: { select: { id: true, name: true } },
              programId: true,
              program: { select: { id: true, name: true } },
              expectedPlacementStart: true,
              expectedPlacementCompleted: true,
              placementStartDateActual: true,
              placementCompletedDateActual: true,
              // Birth date fields for offspring group UI
              status: true,
              birthDateActual: true,
              breedDateActual: true,
              // Locked cycle date for computing expected dates
              lockedCycleStart: true,
              expectedBirthDate: true,
              expectedWeaned: true,
              // Foaling outcome for horses
              foalingOutcome: true,
            },
          },
        },
      });

      const ids = groups.map((g) => g.id);
      // batch counts to avoid _count key mismatches
      const [animalCounts, waitlistCounts] = await Promise.all([
        ids.length
          ? prisma.animal.groupBy({
            by: ["offspringGroupId"],
            where: { offspringGroupId: { in: ids } },
            _count: { _all: true },
          })
          : Promise.resolve([] as any[]),
        ids.length
          ? prisma.waitlistEntry.groupBy({
            by: ["offspringGroupId"],
            where: { offspringGroupId: { in: ids } },
            _count: { _all: true },
          })
          : Promise.resolve([] as any[]),
      ]);

      const aMap = new Map<number, number>();
      for (const r of animalCounts) aMap.set(Number(r.offspringGroupId), Number(r._count?._all ?? 0));
      const wMap = new Map<number, number>();
      for (const r of waitlistCounts) wMap.set(Number(r.offspringGroupId), Number(r._count?._all ?? 0));

      const rows = groups.length > limit ? groups.slice(0, limit) : groups;
      const items = rows.map((g) => groupListItem(g, aMap.get(g.id) ?? 0, wMap.get(g.id) ?? 0));
      if (includeBuyerSummary) {
        const rowIds = rows.map((g) => g.id);
        await attachBuyerSummaries(rowIds, items);
      }
      const nextCursor = groups.length > limit ? String(rows[rows.length - 1].id) : null;

      reply.send({ items, nextCursor });
    }
  });

  /* ===== DETAIL: GET /api/v1/offspring/:id ===== */
  app.get("/offspring/:id", async (req, reply) => {
    try {
      const actorContext = (req as any).actorContext;
      const tenantId = (req as any).tenantId as number;
      const idRaw = (req.params as any).id;
      const id = Number(idRaw);

      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: "invalid id" });
      }

      const where: any = { id, tenantId };

      // PORTAL CLIENT: Enforce party scope - only show group if they are buyer
      if (actorContext === "CLIENT") {
        const { partyId } = await requireClientPartyScope(req);
        where.buyers = {
          some: { buyerPartyId: partyId },
        };
      }

      const G = await prisma.offspringGroup.findFirst({
        where,
        include: {
          plan: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              name: true,
              species: true,
              breedText: true,
              dam: { select: { id: true, name: true } },
              sire: { select: { id: true, name: true } },
              programId: true,
              program: { select: { id: true, name: true } },
              expectedPlacementStart: true,
              expectedPlacementCompleted: true,
              // Birth date fields for offspring group UI
              status: true,
              birthDateActual: true,
              breedDateActual: true,
              // Locked cycle date for computing expected dates
              lockedCycleStart: true,
              expectedBirthDate: true,
              expectedWeaned: true,
              // Foaling outcome for horses
              foalingOutcome: true,
            },
          },
        },
      });

      if (!G) {
        return reply.code(404).send({ error: "not found" });
      }

      const [animals, waitlist, attachments, buyers, offspring] = await Promise.all([
        prisma.animal.findMany({
          where: {
            offspringGroupId: id,
            tenantId,
          },
          select: {
            id: true,
            name: true,
            sex: true,
            status: true,
            birthDate: true,
            species: true,
            breed: true,
            updatedAt: true,
            collarColorId: true,
            collarColorName: true,
            collarColorHex: true,
            collarAssignedAt: true,
            collarLocked: true,
            buyerPartyId: true,
            buyerParty: {
              select: {
                id: true,
                type: true,
                contact: { select: { id: true } },
                organization: { select: { id: true } },
              },
            },
          },
          orderBy: {
            id: "asc",
          },
        }),
        prisma.waitlistEntry.findMany({
          where: {
            offspringGroupId: id,
            tenantId,
          },
          include: {
            clientParty: {
              select: {
                id: true,
                type: true,
                name: true,
              },
            },
          },
          orderBy: [
            { priority: "asc" },
            { id: "asc" },
          ],
        }),
        prisma.attachment.findMany({
          where: {
            offspringGroupId: id,
            tenantId,
          },
          include: {
            attachmentParty: {
              select: {
                id: true,
                type: true,
                name: true,
              },
            },
          },
        }),
        prisma.offspringGroupBuyer.findMany({
          where: {
            groupId: id,
            tenantId,
          },
          include: {
            buyerParty: {
              select: {
                id: true,
                type: true,
                name: true,
              },
            },
          },
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" },
          ],
        }),
        prisma.offspring.findMany({
          where: {
            tenantId,
            groupId: id,
          },
          orderBy: {
            id: "asc",
          },
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      // Step 6C: Map buyers to Party-native fields
      const mappedBuyers = buyers.map((buyer: any) => ({
        id: buyer.id,
        buyerPartyId: buyer.buyerPartyId,
        buyerName: buyer.buyerParty?.name ?? null,
        buyerKind: buyer.buyerParty?.type ?? null,
        priority: buyer.priority,
        poolMin: buyer.poolMin,
        poolMax: buyer.poolMax,
        createdAt: buyer.createdAt,
        updatedAt: buyer.updatedAt,
      }));

      reply.send(
        groupDetail(
          G as any,
          animals as any,
          waitlist as any,
          attachments as any,
          mappedBuyers as any,
          offspring as any,
        ),
      );

    } catch (err) {
      console.error("offspring group detail failed", err);
      reply.code(500).send({ error: "internal_error" });
    }
  });

  /* ===== CREATE: POST /api/v1/offspring ===== */
  app.post("/offspring", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const { planId, identifier, notes, published, dates, counts, publishedMeta, statusOverride, statusOverrideReason, data, species } = (req.body as any) ?? {};

    // planId is optional - if not provided, we auto-create a BreedingPlan for the group
    let plan: any = null;
    let existing: any = null;

    if (planId) {
      plan = await prisma.breedingPlan.findFirst({ where: { id: Number(planId), tenantId } });
      if (!plan) return reply.code(404).send({ error: "plan not found" });
      const planStatus = (plan as any).status;
      if (planStatus && planStatus !== "CYCLE" && planStatus !== "COMMITTED") return reply.code(409).send({ error: "plan must be in CYCLE status" });

      existing = await prisma.offspringGroup.findFirst({ where: { planId: plan.id, tenantId } });
    }

    // species is required - get from plan if linked, otherwise require in body
    const resolvedSpecies = plan?.species ?? species;
    if (!resolvedSpecies) return reply.code(400).send({ error: "species required" });

    // identifier (group name) is required when creating without a plan
    if (!planId && !identifier?.trim()) {
      return reply.code(400).send({ error: "identifier required" });
    }

    // Auto-create a BreedingPlan for manually created groups (no planId provided)
    if (!planId) {
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      // Create plan first to get the ID
      plan = await prisma.breedingPlan.create({
        data: {
          tenantId,
          name: identifier.trim(),
          species: resolvedSpecies,
          status: "CYCLE",
          committedAt: now,
        },
      });

      // Generate a unique code: PLN-MANUAL-YYYYMMDD-ID
      const baseCode = `PLN-MANUAL-${ymd}`;
      let code = `${baseCode}-${plan.id}`;
      let suffix = 2;
      while (await prisma.breedingPlan.findFirst({ where: { tenantId, code }, select: { id: true } })) {
        code = `${baseCode}-${plan.id}-${suffix++}`;
      }

      // Update with the generated code
      plan = await prisma.breedingPlan.update({
        where: { id: plan.id },
        data: { code },
      });
    }

    const payload: Prisma.OffspringGroupUncheckedCreateInput | Prisma.OffspringGroupUncheckedUpdateInput = {
      tenantId,
      planId: plan?.id ?? null,
      species: resolvedSpecies,
      name: identifier ?? null,
      notes: notes ?? null,
      status: (published ?? false) ? "LIVE" : "DRAFT",
      data: data ?? null,
    };

    if (publishedMeta) {
      if ("coverImageUrl" in publishedMeta) (payload as any).coverImageUrl = publishedMeta.coverImageUrl ?? null;
      if ("themeName" in publishedMeta) (payload as any).themeName = publishedMeta.themeName ?? null;
    }

    if (dates) {
      (payload as any).weanedAt = parseISO(dates.weanedAt);
      (payload as any).placementStartAt = parseISO(dates.placementStartAt) ?? (plan?.lockedPlacementStartDate ?? null);
      (payload as any).placementCompletedAt = parseISO(dates.placementCompletedAt);
    } else if (plan) {
      (payload as any).placementStartAt = plan.lockedPlacementStartDate ?? null;
    }

    // Note: statusOverride and statusOverrideReason are not fields on OffspringGroup (only on Litter model)
    // These fields are accepted in the API but not persisted

    if (counts) {
      if ("countBorn" in counts) (payload as any).countBorn = counts.countBorn ?? null;
      if ("countLive" in counts) (payload as any).countLive = counts.countLive ?? null;
      if ("countStillborn" in counts) (payload as any).countStillborn = counts.countStillborn ?? null;
      if ("countMale" in counts) (payload as any).countMale = counts.countMale ?? null;
      if ("countFemale" in counts) (payload as any).countFemale = counts.countFemale ?? null;
      if ("countWeaned" in counts) (payload as any).countWeaned = counts.countWeaned ?? null;
      if ("countPlaced" in counts) (payload as any).countPlaced = counts.countPlaced ?? null;
    }

    const created = existing
      ? await prisma.offspringGroup.update({ where: { id: existing.id }, data: payload as any })
      : await prisma.offspringGroup.create({ data: payload as any });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      if (!existing) {
        auditCreate("LITTER", created.id, created as any, ctx);
        logEntityActivity({
          tenantId,
          entityType: "LITTER",
          entityId: created.id,
          kind: "litter_created",
          category: "event",
          title: "Litter/group created",
          actorId: ctx.userId,
          actorName: ctx.userName,
        });
      } else {
        auditUpdate("LITTER", created.id, existing as any, created as any, ctx);
      }
    }

    // return detail payload
    const fresh = await prisma.offspringGroup.findFirst({
      where: { id: created.id, tenantId },
      include: {
        plan: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            species: true,
            breedText: true,
            dam: { select: { id: true, name: true } },
            sire: { select: { id: true, name: true } },
            // Birth date fields for offspring group UI
            status: true,
            birthDateActual: true,
            breedDateActual: true,
          },
        },
      },
    });

    const [animals, waitlist, attachments, buyers, offspring] = await Promise.all([
      prisma.animal.findMany({
        where: {
          offspringGroupId: created.id,
          tenantId,
        },
        select: {
          id: true,
          name: true,
          sex: true,
          status: true,
          birthDate: true,
          species: true,
          breed: true,
          updatedAt: true,
          collarColorId: true,
          collarColorName: true,
          collarColorHex: true,
          collarAssignedAt: true,
          collarLocked: true,
        },
        orderBy: {
          id: "asc",
        },
      }),
      prisma.waitlistEntry.findMany({
        where: {
          offspringGroupId: created.id,
          tenantId,
        },
        include: {
          clientParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
      prisma.attachment.findMany({
        where: {
          offspringGroupId: created.id,
          tenantId,
        },
        include: {
          attachmentParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      }),
      prisma.offspringGroupBuyer.findMany({
        where: {
          groupId: created.id,
          tenantId,
        },
        include: {
          buyerParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
      prisma.offspring.findMany({
        where: {
          tenantId,
          groupId: created.id,
        },
        orderBy: {
          id: "asc",
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          buyerParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Step 6C: Map buyers to Party-native fields
    const mappedBuyers = buyers.map((buyer: any) => ({
      id: buyer.id,
      buyerPartyId: buyer.buyerPartyId,
      buyerName: buyer.buyerParty?.name ?? null,
      buyerKind: buyer.buyerParty?.type ?? null,
      priority: buyer.priority,
      poolMin: buyer.poolMin,
      poolMax: buyer.poolMax,
      createdAt: buyer.createdAt,
      updatedAt: buyer.updatedAt,
    }));

    // Trigger rule execution for offspring group
    if (!existing) {
      // New group created
      triggerOnOffspringGroupCreated(created.id, tenantId).catch(err =>
        req.log.error({ err, groupId: created.id }, 'Failed to trigger rules on group creation')
      );
    } else {
      // Group updated
      const changedFields = Object.keys(payload);
      triggerOnOffspringGroupUpdated(created.id, tenantId, changedFields).catch(err =>
        req.log.error({ err, groupId: created.id }, 'Failed to trigger rules on group update')
      );
    }

    reply.send(
      groupDetail(
        fresh as any,
        animals as any,
        waitlist as any,
        attachments as any,
        mappedBuyers as any,
        offspring as any,
      ),
    );

  });

  /* ===== UPDATE: PATCH /api/v1/offspring/:id ===== */
  app.patch("/offspring/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    const G = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!G) return reply.code(404).send({ error: "not found" });

    const data: any = {};
    if ("identifier" in body) data.name = body.identifier ?? null;
    if ("notes" in body) data.notes = body.notes ?? null;
    // "published" is a convenience alias for status: convert boolean to "LIVE"/"DRAFT"
    if ("published" in body) data.status = body.published ? "LIVE" : "DRAFT";
    if ("statusOverride" in body) data.statusOverride = body.statusOverride ?? null;
    if ("statusOverrideReason" in body) data.statusOverrideReason = body.statusOverrideReason ?? null;
    if ("data" in body) data.data = body.data ?? null;
    if (body.publishedMeta) {
      if ("coverImageUrl" in body.publishedMeta) data.coverImageUrl = body.publishedMeta.coverImageUrl ?? null;
      if ("themeName" in body.publishedMeta) data.themeName = body.publishedMeta.themeName ?? null;
    }
    if (body.dates) {
      if ("weanedAt" in body.dates) data.weanedAt = parseISO(body.dates.weanedAt);
      if ("placementStartAt" in body.dates) data.placementStartAt = parseISO(body.dates.placementStartAt);
      if ("placementCompletedAt" in body.dates) data.placementCompletedAt = parseISO(body.dates.placementCompletedAt);
    }
    if (body.counts) {
      const c = body.counts;
      if ("countBorn" in c) data.countBorn = c.countBorn ?? null;
      if ("countLive" in c) data.countLive = c.countLive ?? null;
      if ("countStillborn" in c) data.countStillborn = c.countStillborn ?? null;
      if ("countMale" in c) data.countMale = c.countMale ?? null;
      if ("countFemale" in c) data.countFemale = c.countFemale ?? null;
      if ("countWeaned" in c) data.countWeaned = c.countWeaned ?? null;
      if ("countPlaced" in c) data.countPlaced = c.countPlaced ?? null;
    }

    await prisma.offspringGroup.update({ where: { id }, data });

    const refreshed = await prisma.offspringGroup.findFirst({
      where: { id, tenantId },
      include: {
        plan: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            species: true,
            breedText: true,
            dam: { select: { id: true, name: true } },
            sire: { select: { id: true, name: true } },
            // Birth date fields for offspring group UI
            status: true,
            birthDateActual: true,
            breedDateActual: true,
          },
        },
      },
    });

    // Audit trail + activity log (fire-and-forget, fail-open) — G is the before-snapshot
    if (G && refreshed) {
      const ctx = auditCtx(req, tenantId);
      auditUpdate("LITTER", id, G as any, refreshed as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: id,
        kind: "litter_updated",
        category: "system",
        title: "Litter details updated",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    const [animals, waitlist, attachments, buyers, offspring] = await Promise.all([
      prisma.animal.findMany({
        where: { offspringGroupId: id, tenantId },
        select: {
          id: true,
          name: true,
          sex: true,
          status: true,
          birthDate: true,
          species: true,
          breed: true,
          updatedAt: true,
          collarColorId: true,
          collarColorName: true,
          collarColorHex: true,
          collarAssignedAt: true,
          collarLocked: true,
        },
      }),
      prisma.waitlistEntry.findMany({
        where: { offspringGroupId: id, tenantId },
        include: {
          clientParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      }),
      prisma.attachment.findMany({
        where: { offspringGroupId: id, tenantId },
        include: {
          attachmentParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      }),
      prisma.offspringGroupBuyer.findMany({
        where: {
          groupId: id,
          tenantId,
        },
        include: {
          buyerParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
      prisma.offspring.findMany({
        where: {
          tenantId,
          groupId: id,
        },
        orderBy: {
          id: "asc",
        },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          buyerParty: {
            select: {
              id: true,
              type: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Step 6C: Map buyers to Party-native fields
    const mappedBuyers = buyers.map((buyer: any) => ({
      id: buyer.id,
      buyerPartyId: buyer.buyerPartyId,
      buyerName: buyer.buyerParty?.name ?? null,
      buyerKind: buyer.buyerParty?.type ?? null,
      priority: buyer.priority,
      poolMin: buyer.poolMin,
      poolMax: buyer.poolMax,
      createdAt: buyer.createdAt,
      updatedAt: buyer.updatedAt,
    }));

    reply.send(groupDetail(refreshed as any, animals as any, waitlist as any, attachments as any, mappedBuyers as any, offspring as any));
  });

  /* ===== DELETE: DELETE /api/v1/offspring/:id ===== */
  /* Safe delete with blocker checks - prevents deletion of linked or in-use groups */
  app.delete("/offspring/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    // Block deletion of auto-linked groups (linked to breeding plan)
    if (existing.linkState === "linked") {
      return reply.code(409).send({
        error: "OFFSPRING_GROUP_DELETE_BLOCKED_LINKED_PLAN",
        offspringGroupId: id,
        message: "Cannot delete an offspring group that is linked to a breeding plan. Unlink or archive instead.",
      });
    }

    // Compute blockers by counting all related entities
    const [
      offspringCount,
      buyerCount,
      invoiceCount,
      documentCount,
      contractCount,
      expenseCount,
      waitlistCount,
      eventCount,
      attachmentCount,
      campaignCount,
      taskCount,
      schedulingBlockCount,
      tagCount,
    ] = await Promise.all([
      prisma.offspring.count({ where: { groupId: id } }),
      prisma.offspringGroupBuyer.count({ where: { groupId: id } }),
      prisma.invoice.count({ where: { groupId: id } }),
      prisma.document.count({ where: { groupId: id } }),
      prisma.contract.count({ where: { groupId: id } }),
      prisma.expense.count({ where: { offspringGroupId: id } }),
      prisma.waitlistEntry.count({ where: { offspringGroupId: id } }),
      prisma.offspringGroupEvent.count({ where: { offspringGroupId: id } }),
      prisma.attachment.count({ where: { offspringGroupId: id } }),
      prisma.campaign.count({ where: { offspringGroupId: id } }),
      prisma.task.count({ where: { groupId: id } }),
      prisma.schedulingAvailabilityBlock.count({ where: { offspringGroupId: id } }),
      prisma.tagAssignment.count({ where: { offspringGroupId: id } }),
    ]);

    const blockers = {
      hasOffspring: offspringCount > 0,
      hasBuyers: buyerCount > 0,
      hasInvoices: invoiceCount > 0,
      hasDocuments: documentCount > 0,
      hasContracts: contractCount > 0,
      hasExpenses: expenseCount > 0,
      hasWaitlist: waitlistCount > 0,
      hasEvents: eventCount > 0,
      hasAttachments: attachmentCount > 0,
      hasCampaigns: campaignCount > 0,
      hasTasks: taskCount > 0,
      hasSchedulingBlocks: schedulingBlockCount > 0,
      hasTags: tagCount > 0,
    };

    const other: string[] = [];
    if (blockers.hasEvents) other.push("events");
    if (blockers.hasAttachments) other.push("attachments");
    if (blockers.hasCampaigns) other.push("campaigns");
    if (blockers.hasTasks) other.push("tasks");
    if (blockers.hasSchedulingBlocks) other.push("schedulingBlocks");
    if (blockers.hasTags) other.push("tags");

    const hasBlockers =
      blockers.hasOffspring ||
      blockers.hasBuyers ||
      blockers.hasInvoices ||
      blockers.hasDocuments ||
      blockers.hasContracts ||
      blockers.hasExpenses ||
      blockers.hasWaitlist ||
      other.length > 0;

    if (hasBlockers) {
      return reply.code(409).send({
        error: "OFFSPRING_GROUP_DELETE_BLOCKED_IN_USE",
        offspringGroupId: id,
        blockers,
        other,
        message: "Cannot delete offspring group with existing related data. Archive instead.",
      });
    }

    // Safe to delete - use transaction for consistency
    await prisma.$transaction(async (tx) => {
      await tx.offspringGroup.delete({ where: { id } });
    });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditDelete("LITTER", id, ctx);
      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: id,
        kind: "litter_deleted",
        category: "system",
        title: "Litter deleted",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    reply.send({ ok: true, id });
  });

  /* ===== ARCHIVE: POST /api/v1/offspring/:id/archive ===== */
  app.post("/offspring/:id/archive", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    // Idempotent - if already archived, just return current state
    if (existing.archivedAt) {
      return reply.send({ ok: true, id, archivedAt: existing.archivedAt });
    }

    const updated = await prisma.offspringGroup.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditArchive("LITTER", id, ctx);
      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: id,
        kind: "litter_archived",
        category: "status",
        title: "Litter archived",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    reply.send({ ok: true, id, archivedAt: updated.archivedAt });
  });

  /* ===== RESTORE: POST /api/v1/offspring/:id/restore ===== */
  app.post("/offspring/:id/restore", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    // Idempotent - if not archived, just return current state
    if (!existing.archivedAt) {
      return reply.send({ ok: true, id, archivedAt: null });
    }

    await prisma.offspringGroup.update({
      where: { id },
      data: { archivedAt: null },
    });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditRestore("LITTER", id, ctx);
      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: id,
        kind: "litter_restored",
        category: "status",
        title: "Litter restored",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    reply.send({ ok: true, id, archivedAt: null });
  });

  /* ===== MOVE WAITLIST INTO GROUP: POST /offspring/:id/move-waitlist ===== */
  app.post("/offspring/:id/move-waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const { waitlistEntryIds } = (req.body as any) ?? {};
    if (!Array.isArray(waitlistEntryIds) || waitlistEntryIds.length === 0) {
      return reply.code(400).send({ error: "waitlistEntryIds required" });
    }

    const G = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!G) return reply.code(404).send({ error: "group not found" });

    const entries = await prisma.waitlistEntry.findMany({
      where: { id: { in: waitlistEntryIds.map(Number) }, tenantId },
      select: { id: true },
    });
    if (entries.length !== waitlistEntryIds.length) {
      return reply.code(404).send({ error: "some entries not found" });
    }

    await prisma.$transaction(entries.map((e) =>
      prisma.waitlistEntry.update({ where: { id: e.id }, data: { offspringGroupId: id } }),
    ));

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "litter_waitlist_entries_moved",
      category: "system",
      title: "Waitlist entries moved to litter",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.send({ moved: entries.length });
  });


  /* ===== OFFSPRING INDIVIDUALS CRUD: /api/v1/offspring/individuals ===== */
  app.post("/offspring/individuals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const body = (req.body as any) ?? {};

    const groupId = body.groupId ?? null;
    if (!groupId) {
      return reply
        .code(400)
        .send({ error: "groupId is required for offspring creation with current schema" });
    }

    const group = await prisma.offspringGroup.findFirst({
      where: { id: groupId, tenantId },
      include: {
        plan: { where: { deletedAt: null } },
        dam: {
          include: {
            canonicalBreed: true,
          },
        },
      },
    });
    if (!group) {
      return reply.code(404).send({ error: "offspring group not found" });
    }

    // Business rule: Cannot add offspring until the birth date actual has been recorded on the linked breeding plan
    if (group.plan && !group.plan.birthDateActual) {
      return reply.code(400).send({
        error: "birth_date_not_recorded",
        detail: "Cannot add offspring until the birth date has been recorded on the linked breeding plan.",
      });
    }

    const name: string | null =
      typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;

    const sex =
      body.sex === "MALE" || body.sex === "FEMALE"
        ? body.sex
        : null;

    // Default bornAt from the breeding plan's birthDateActual if not explicitly provided
    const bornAt = body.birthDate
      ? parseISO(body.birthDate)
      : group.plan?.birthDateActual ?? null;

    const data: any =
      typeof body.data === "object" && body.data !== null ? { ...body.data } : {};
    if (body.unlinkedOverride) {
      data.unlinkedOverride = true;
    }

    // persist color into JSON payload for now
    if ("color" in body) {
      const raw = body.color;
      if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
        delete data.color;
      } else {
        data.color = raw;
      }
    }

    const collarName =
      typeof body.whelpingCollarColor === "string" &&
        body.whelpingCollarColor.trim()
        ? body.whelpingCollarColor.trim()
        : null;

    // enforce species match on create
    const childSpeciesRaw = body.species;
    if (
      childSpeciesRaw != null &&
      String(childSpeciesRaw).trim() !== "" &&
      String(childSpeciesRaw).toUpperCase() !== String(group.species).toUpperCase()
    ) {
      return reply
        .code(400)
        .send({ error: "offspring species must match parent group species" });
    }

    // derive breed from parent group context
    const derivedBreed = __og_deriveBreedFromGroup(group);

    // Registration stored in JSON blob for flexibility
    if ("registrationId" in body || "registryNumber" in body) {
      const reg =
        (typeof body.registryNumber === "string" && body.registryNumber.trim() !== ""
          ? body.registryNumber.trim()
          : undefined) ??
        (typeof body.registrationId === "string" && body.registrationId.trim() !== ""
          ? body.registrationId.trim()
          : undefined) ??
        null;

      if (reg != null) {
        (data as any).registrationId = reg;
      }
    }

    const statePatch: NormalizedOffspringPatch = { bornAt };

    if ("lifeState" in body) statePatch.lifeState = body.lifeState;
    if ("placementState" in body) statePatch.placementState = body.placementState;
    if ("keeperIntent" in body) statePatch.keeperIntent = body.keeperIntent;
    if ("financialState" in body) statePatch.financialState = body.financialState;
    if ("paperworkState" in body) statePatch.paperworkState = body.paperworkState;
    if ("diedAt" in body) statePatch.diedAt = body.diedAt ? parseISO(body.diedAt) : null;
    if ("placedAt" in body) statePatch.placedAt = body.placedAt ? parseISO(body.placedAt) : null;
    if ("paidInFullAt" in body) statePatch.paidInFullAt = body.paidInFullAt ? parseISO(body.paidInFullAt) : null;
    if ("contractSignedAt" in body) statePatch.contractSignedAt = body.contractSignedAt ? parseISO(body.contractSignedAt) : null;
    if ("contractId" in body) statePatch.contractId = body.contractId ?? null;
    if ("promotedAnimalId" in body) statePatch.promotedAnimalId = body.promotedAnimalId == null ? null : Number(body.promotedAnimalId);

    if ("buyerPartyId" in body) {
      statePatch.buyerPartyId = body.buyerPartyId == null ? null : Number(body.buyerPartyId);
    }

    if ("depositCents" in body) statePatch.depositCents = body.depositCents == null ? null : Number(body.depositCents);
    if ("priceCents" in body) statePatch.priceCents = body.priceCents == null ? null : Number(body.priceCents);

    let normalizedState: NormalizedOffspringPatch;
    try {
      normalizedState = normalizeOffspringState(null, statePatch);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }

    const created = await prisma.offspring.create({
      data: {
        tenantId,
        groupId: group.id,

        // core identity
        name: name ?? null,
        sex,
        species: body.species ?? group.plan?.species ?? "DOG",
        breed: derivedBreed,
        bornAt,

        // Auto-link parents from the offspring group (fallback to plan if group doesn't have it)
        damId: group.damId ?? group.plan?.damId ?? null,
        sireId: group.sireId ?? group.plan?.sireId ?? null,

        // new: core identity fields
        notes: body.notes ?? null,

        // extra data payload (may include registrationId)
        data,

        // collar fields
        collarColorName: collarName,
        collarAssignedAt: collarName ? new Date() : null,

        ...normalizedState,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        buyerParty: {
          select: {
            id: true,
            type: true,
            name: true,
          },
        },
      },
    });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditCreate("OFFSPRING", created.id, created as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: created.id,
        kind: "offspring_created",
        category: "event",
        title: `Offspring "${created.name || "unnamed"}" created`,
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    // Trigger rule execution for new offspring
    triggerOnOffspringCreated(created.id, tenantId).catch(err =>
      req.log.error({ err, offspringId: created.id }, 'Failed to trigger rules on offspring creation')
    );

    reply.code(201).send(mapOffspringToAnimalLite(created));
  });

  app.get("/offspring/individuals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const query = (req as any).query ?? {};

    try {
      const qRaw = query.q;
      const q = qRaw == null ? "" : String(qRaw).trim();

      const groupIdRaw = query.groupId;
      const groupId =
        groupIdRaw == null || String(groupIdRaw).trim() === ""
          ? undefined
          : Number(groupIdRaw);

      const limitRaw = query.limit;
      const limit = Number.isFinite(Number(limitRaw))
        ? Math.min(250, Math.max(1, Number(limitRaw)))
        : 50;

      const where: any = { tenantId };
      if (groupId != null && !Number.isNaN(groupId)) {
        where.groupId = groupId;
      }

      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { group: { name: { contains: q, mode: "insensitive" } } },
        ];
      }

      let rows: any[] = [];
      let total = 0;

      try {
        const result = await Promise.all([
          prisma.offspring.findMany({
            where,
            take: limit,
            orderBy: { id: "desc" },
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
              },
          }),
          prisma.offspring.count({ where }),
        ]);
        rows = result[0];
        total = result[1];
      } catch (err) {
        console.error("offspring individuals list include failed, retrying with simple shape", err);
        const simpleWhere = q
          ? {
            ...where,
            OR: [{ name: { contains: q, mode: "insensitive" } }],
          }
          : where;
        const result = await Promise.all([
          prisma.offspring.findMany({
            where: simpleWhere,
            take: limit,
            orderBy: { id: "desc" },
          }),
          prisma.offspring.count({ where: simpleWhere }),
        ]);
        rows = result[0];
        total = result[1];
      }

      reply.send({
        items: rows.map((o) => mapOffspringToAnimalLite(o)),
        total,
      });
    } catch (err) {
      console.error("offspring individuals list failed", err);
      reply.code(500).send({ error: "internal_error" });
    }
  });


  app.get("/offspring/individuals/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    try {
      let row: any | null = null;
      try {
        row = await prisma.offspring.findFirst({
          where: { id, tenantId },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                actualBirthOn: true,
                plan: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    code: true,
                    breedText: true,
                    birthDateActual: true,
                  },
                },
              },
            },
            buyerParty: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
      } catch (err) {
        console.error("offspring individuals get include failed, retrying with simple shape", err);
        row = await prisma.offspring.findFirst({
          where: { id, tenantId },
        });
      }

      if (!row) return reply.code(404).send({ error: "not found" });

      reply.send(mapOffspringToAnimalLite(row));
    } catch (err) {
      console.error("offspring individuals get failed", err);
      reply.code(500).send({ error: "internal_error" });
    }
  });


  app.patch("/offspring/individuals/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    const existing = await prisma.offspring.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const data: any = {};
    const statePatch: NormalizedOffspringPatch = {};

    let targetGroupSpecies: string | null | undefined = undefined;

    // 1. Handle parent group change and enforce species match for that group
    if ("groupId" in body) {
      const rawGroupId = body.groupId;

      if (rawGroupId == null || String(rawGroupId).trim?.() === "") {
        // Current schema requires a parent group,
        // so ignore attempts to clear it and let other fields update.
        // We leave targetGroupSpecies as undefined so species logic below
        // will use the existing group.
        targetGroupSpecies = undefined;
      } else {
        const targetGroupId = Number(rawGroupId);
        if (!Number.isFinite(targetGroupId)) {
          return reply.code(400).send({ error: "invalid groupId" });
        }

        const targetGroup = await prisma.offspringGroup.findFirst({
          where: { id: targetGroupId, tenantId },
          include: {
            plan: { where: { deletedAt: null } },
            dam: {
              include: {
                canonicalBreed: true,
              },
            },
          },
        });

        if (!targetGroup) {
          return reply.code(400).send({ error: "group not found for tenant" });
        }

        // effective species during this update
        const effectiveSpecies = body.species ?? existing.species;

        if (
          effectiveSpecies != null &&
          String(effectiveSpecies).toUpperCase() !==
          String(targetGroup.species).toUpperCase()
        ) {
          return reply
            .code(400)
            .send({ error: "offspring species must match parent group species" });
        }

        // Use relation update instead of a raw groupId write
        data.group = { connect: { id: targetGroupId } };
        targetGroupSpecies = targetGroup.species;
        // keep offspring breed aligned to new parent group
        data.breed = __og_deriveBreedFromGroup(targetGroup);
      }
    }

    // 2. Handle species field itself
    if ("species" in body) {
      if (targetGroupSpecies !== undefined) {
        // group changed in this patch, species must follow that group
        if (
          body.species != null &&
          String(body.species).toUpperCase() !==
          String(targetGroupSpecies ?? "").toUpperCase()
        ) {
          return reply
            .code(400)
            .send({ error: "offspring species must match parent group species" });
        }

        data.species = targetGroupSpecies ?? null;
      } else if (existing.groupId != null) {
        // group is already set and not changed in this patch, enforce against current group
        const group = await prisma.offspringGroup.findFirst({
          where: { id: existing.groupId, tenantId },
          include: {
            plan: { where: { deletedAt: null } },
            dam: {
              include: {
                canonicalBreed: true,
              },
            },
          },
        });

        if (!group) {
          return reply.code(400).send({ error: "parent group not found" });
        }

        if (
          body.species != null &&
          String(body.species).toUpperCase() !=
          String(group.species).toUpperCase()
        ) {
          return reply
            .code(400)
            .send({ error: "offspring species must match parent group species" });
        }

        data.species = group.species;
        // keep offspring breed aligned to existing parent group
        data.breed = __og_deriveBreedFromGroup(group);
      } else {
        // no group linked, species can be set freely
        data.species = body.species ?? null;
      }
    }

    // 3. Existing simple field updates stay the same
    if (typeof body.name === "string") {
      data.name = body.name.trim();
    }

    // Sex (including UNKNOWN and clearing)
    if ("sex" in body) {
      const sexValue = body.sex;
      // Only allow Prisma enum values, anything else becomes null
      if (sexValue === "MALE" || sexValue === "FEMALE") {
        data.sex = sexValue as Sex;
      } else {
        data.sex = null;
      }
    }

    // Birth date: accept either birthDate (App-Offspring) or dob (OffspringPage)
    if ("birthDate" in body) {
      data.bornAt = body.birthDate ? parseISO(body.birthDate) : null;
      statePatch.bornAt = data.bornAt;
    } else if ("dob" in body) {
      data.bornAt = body.dob ? parseISO(body.dob) : null;
      statePatch.bornAt = data.bornAt;
    }
    if ("notes" in body) {
      data.notes = body.notes ?? null;
    }

    if ("lifeState" in body) statePatch.lifeState = body.lifeState;
    if ("placementState" in body) statePatch.placementState = body.placementState;
    if ("keeperIntent" in body) statePatch.keeperIntent = body.keeperIntent;
    if ("financialState" in body) statePatch.financialState = body.financialState;
    if ("paperworkState" in body) statePatch.paperworkState = body.paperworkState;
    if ("diedAt" in body) statePatch.diedAt = body.diedAt ? parseISO(body.diedAt) : null;
    if ("placedAt" in body) {
      const placedAtVal = body.placedAt ? parseISO(body.placedAt) : null;
      data.placedAt = placedAtVal;
      statePatch.placedAt = placedAtVal;
    }
    if ("paidInFullAt" in body) {
      const paidInFullAtVal = body.paidInFullAt ? parseISO(body.paidInFullAt) : null;
      data.paidInFullAt = paidInFullAtVal;
      statePatch.paidInFullAt = paidInFullAtVal;
    }
    if ("contractSignedAt" in body) {
      const signedAtVal = body.contractSignedAt ? parseISO(body.contractSignedAt) : null;
      data.contractSignedAt = signedAtVal;
      statePatch.contractSignedAt = signedAtVal;
    }
    if ("contractId" in body) {
      const contractIdVal = body.contractId ?? null;
      data.contractId = contractIdVal;
      statePatch.contractId = contractIdVal;
    }
    if ("promotedAnimalId" in body) {
      const promotedId = body.promotedAnimalId == null ? null : Number(body.promotedAnimalId);
      if (promotedId != null) {
        data.promotedAnimal = { connect: { id: promotedId } };
      } else {
        data.promotedAnimal = { disconnect: true };
      }
      statePatch.promotedAnimalId = promotedId;
    }

    if ("priceCents" in body) {
      const priceCentsVal = body.priceCents ?? null;
      data.priceCents = priceCentsVal;
      statePatch.priceCents = priceCentsVal;
    }

    if ("depositCents" in body) {
      const depositCentsVal = body.depositCents == null ? null : Number(body.depositCents);
      data.depositCents = depositCentsVal;
      statePatch.depositCents = depositCentsVal;
    }

    if ("buyerPartyId" in body) {
      data.buyerPartyId = body.buyerPartyId == null ? null : Number(body.buyerPartyId);
    }

    if ("color" in body || "microchip" in body || "registrationId" in body) {
      const existingData = existing.data && typeof existing.data === "object" ? existing.data : {};
      const updatedData: Record<string, unknown> = { ...existingData };

      if ("color" in body) {
        updatedData.color = body.color ?? null;
      }

      if ("microchip" in body) {
        updatedData.microchip = body.microchip ?? null;
      }

      if ("registrationId" in body) {
        updatedData.registrationId = body.registrationId ?? null;
      }

      data.data = updatedData;
    }

    if ("whelpingCollarColor" in body) {
      const raw =
        typeof body.whelpingCollarColor === "string"
          ? body.whelpingCollarColor.trim()
          : "";
      const name = raw || null;

      data.collarColorName = name;
      data.collarAssignedAt = name ? new Date() : null;
    }

    let normalizedState: NormalizedOffspringPatch;
    try {
      normalizedState = normalizeOffspringState(existing as Offspring, statePatch);
    } catch (err) {
      req.log?.error?.(
        { route: "offspring.individuals.update", requestId: (req as any).id, error: err },
        "normalizeOffspringState failed",
      );
      return reply.code(400).send({ error: (err as Error).message });
    }

    let updated;
    try {
      updated = await prisma.offspring.update({
        where: { id },
        data: { ...data, ...normalizedState },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          buyerParty: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (err) {
      req.log?.error?.(
        { route: "offspring.individuals.update", requestId: (req as any).id, error: err },
        "Database update failed",
      );
      return reply.code(500).send({ error: "database_error" });
    }

    // Audit trail + activity log (fire-and-forget, fail-open) — existing is the before-snapshot
    if (existing) {
      const ctx = auditCtx(req, tenantId);
      auditUpdate("OFFSPRING", id, existing as any, updated as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: id,
        kind: "offspring_updated",
        category: "system",
        title: "Offspring details updated",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    // Trigger rule execution for updated offspring
    const changedFields = Object.keys(data);
    triggerOnOffspringUpdated(id, tenantId, changedFields).catch(err =>
      req.log.error({ err, offspringId: id }, 'Failed to trigger rules on offspring update')
    );

    // Check if placement state transitioned to PLACED - trigger microchip ownership transfer
    if (isPlacementTransition(existing.placementState, updated.placementState)) {
      transferMicrochipOwnership(id, tenantId).catch(err =>
        req.log.error({ err, offspringId: id }, 'Failed to transfer microchip ownership on placement')
      );
    }

    reply.send(mapOffspringToAnimalLite(updated));
  });

  app.delete("/offspring/individuals/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    const existing = await prisma.offspring.findFirst({
      where: { id, tenantId },
      include: {
        group: {
          select: {
            id: true,
            planId: true,
            plan: { where: { deletedAt: null }, select: { birthDateActual: true } },
          },
        },
      },
    });
    if (!existing) return reply.code(404).send({ error: "not found" });

    // ═══════════════════════════════════════════════════════════════════════════
    // BUSINESS RULE: Offspring Deletion Protection
    // Offspring can only be deleted if they are "fresh" (no real business data).
    // Once an offspring has contracts, buyers, invoices, health records, or has
    // been placed, it becomes part of the permanent record for lineage tracking.
    // ═══════════════════════════════════════════════════════════════════════════

    const blockers: Record<string, boolean> = {};

    // Check if offspring has a buyer assigned
    if (existing.buyerPartyId) {
      blockers.hasBuyer = true;
    }

    // Check if offspring has been placed
    if (existing.placementState === "PLACED" || existing.placedAt) {
      blockers.isPlaced = true;
    }

    // Check if offspring has financial transactions
    if (existing.financialState && existing.financialState !== "NONE") {
      blockers.hasFinancialState = true;
    }
    if (existing.paidInFullAt || existing.depositCents) {
      blockers.hasPayments = true;
    }

    // Check if offspring has contracts
    if (existing.contractId || existing.contractSignedAt) {
      blockers.hasContract = true;
    }

    // Check if offspring has been promoted to a full animal record
    if (existing.promotedAnimalId) {
      blockers.isPromoted = true;
    }

    // Check if offspring is deceased (death is a permanent record)
    if (existing.lifeState === "DECEASED" || existing.diedAt) {
      blockers.isDeceased = true;
    }

    // Check for related records that would create orphaned data
    const [healthEventsCount, documentsCount, invoicesCount] = await Promise.all([
      prisma.offspringEvent?.count?.({ where: { offspringId: id, type: "HEALTH" } }).catch(() => 0) ?? 0,
      prisma.offspringDocument?.count?.({ where: { offspringId: id } }).catch(() => 0) ?? 0,
      prisma.offspringInvoiceLink?.count?.({ where: { offspringId: id } }).catch(() => 0) ?? 0,
    ]);

    if (healthEventsCount > 0) blockers.hasHealthEvents = true;
    if (documentsCount > 0) blockers.hasDocuments = true;
    if (invoicesCount > 0) blockers.hasInvoices = true;

    if (Object.keys(blockers).length > 0) {
      return reply.code(409).send({
        error: "offspring_delete_blocked",
        detail: "Cannot delete this offspring because it has associated business data. Offspring with buyers, contracts, payments, health records, or placement history are permanent records for lineage and regulatory compliance.",
        blockers,
      });
    }

    // Safe to delete - offspring is fresh with no business data
    await prisma.offspring.delete({ where: { id } });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditDelete("OFFSPRING", id, ctx);
      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: id,
        kind: "offspring_deleted",
        category: "system",
        title: "Offspring deleted",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    reply.send({ ok: true, deleted: id });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Archive Individual Offspring (Soft Delete)
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/offspring/individuals/:id/archive", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const { reason } = (req.body as any) ?? {};

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    // Verify ownership
    const existing = await prisma.offspring.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "not found" });

    // Archive the offspring (soft delete)
    const archived = await prisma.offspring.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archiveReason: reason || null,
      },
    });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditArchive("OFFSPRING", id, ctx);
      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: id,
        kind: "offspring_archived",
        category: "status",
        title: "Offspring archived",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    reply.send({ ok: true, archived });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Restore Archived Offspring
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/offspring/individuals/:id/restore", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    // Verify ownership and that it's archived
    const existing = await prisma.offspring.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "not found" });
    if (!existing.archivedAt) {
      return reply.code(400).send({ error: "offspring_not_archived" });
    }

    // Restore the offspring
    const restored = await prisma.offspring.update({
      where: { id },
      data: {
        archivedAt: null,
        archiveReason: null,
      },
    });

    // Audit trail + activity log (fire-and-forget, fail-open)
    {
      const ctx = auditCtx(req, tenantId);
      auditRestore("OFFSPRING", id, ctx);
      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: id,
        kind: "offspring_restored",
        category: "status",
        title: "Offspring restored",
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
    }

    reply.send({ ok: true, restored });
  });

  /* ===== OFFSPRING ANIMALS: CREATE ===== */
  app.post("/offspring/:id/animals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    const G = await prisma.offspringGroup.findFirst({
      where: { id, tenantId },
      include: { plan: { where: { deletedAt: null }, select: { id: true, birthDateActual: true, species: true, damId: true, sireId: true } } },
    });
    if (!G) return reply.code(404).send({ error: "group not found" });

    // Business rule: Cannot add offspring until the birth date actual has been recorded on the linked breeding plan
    if (G.plan && !G.plan.birthDateActual) {
      return reply.code(400).send({
        error: "birth_date_not_recorded",
        detail: "Cannot add offspring until the birth date has been recorded on the linked breeding plan.",
      });
    }

    if (!body?.name || !body?.sex) {
      return reply.code(400).send({ error: "name and sex are required" });
    }

    const created = await prisma.animal.create({
      data: {
        tenantId,
        organizationId: null, // optional for now
        name: String(body.name),
        species: body.species ?? G.plan?.species ?? "DOG",
        sex: body.sex,
        status: body.status ?? "ACTIVE",
        birthDate: parseISO(body.birthDate),
        microchip: body.microchip ?? null,
        notes: body.notes ?? null,
        breed: body.breed ?? null,
        offspringGroupId: G.id,
        // parent lineage from offspring group (fallback to plan if group doesn't have it)
        damId: G.damId ?? G.plan?.damId ?? null,
        sireId: G.sireId ?? G.plan?.sireId ?? null,
        // collar fields
        collarColorId: body.collarColorId ?? null,
        collarColorName: body.collarColorName ?? null,
        collarColorHex: body.collarColorHex ?? null,
        collarAssignedAt: (body.collarColorId || body.collarColorHex || body.collarColorName) ? new Date() : null,
        collarLocked: body.collarLocked === true ? true : false,
      },
    });

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_animal_added",
      category: "relationship",
      title: "Animal added to litter",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.code(201).send(created);
  });

  /* ===== OFFSPRING ANIMALS: UPDATE ===== */
  app.patch("/offspring/:id/animals/:animalId", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const animalId = Number((req.params as any).animalId);
    const body = (req.body as any) ?? {};

    const A = await prisma.animal.findFirst({ where: { id: animalId, tenantId } });
    if (!A) return reply.code(404).send({ error: "animal not found" });
    if (A.offspringGroupId !== id) return reply.code(409).send({ error: "animal does not belong to this group" });

    const data: any = {};
    if ("name" in body) data.name = body.name;
    if ("sex" in body) data.sex = body.sex;
    if ("status" in body) data.status = body.status;
    if ("species" in body) data.species = body.species;
    if ("breed" in body) data.breed = body.breed ?? null;
    if ("microchip" in body) data.microchip = body.microchip ?? null;
    if ("notes" in body) data.notes = body.notes ?? null;
    if ("birthDate" in body) data.birthDate = parseISO(body.birthDate);

    // collar fields
    let settingAnyCollar = false;
    if ("collarColorId" in body) {
      data.collarColorId = body.collarColorId ?? null;
      settingAnyCollar = true;
    }
    if ("collarColorName" in body) {
      data.collarColorName = body.collarColorName ?? null;
      settingAnyCollar = true;
    }
    if ("collarColorHex" in body) {
      data.collarColorHex = body.collarColorHex ?? null;
      settingAnyCollar = true;
    }
    if ("collarLocked" in body) {
      data.collarLocked = !!body.collarLocked;
    }
    if (settingAnyCollar) {
      data.collarAssignedAt = new Date();
    }

    const updated = await prisma.animal.update({ where: { id: animalId }, data });

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_animal_updated",
      category: "relationship",
      title: "Litter animal details updated",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.send(updated);
  });

  /* ===== OFFSPRING ANIMALS: DELETE or UNLINK ===== */
  app.delete("/offspring/:id/animals/:animalId", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const animalId = Number((req.params as any).animalId);
    const mode = String((req as any).query?.mode ?? "unlink");

    const A = await prisma.animal.findFirst({ where: { id: animalId, tenantId } });
    if (!A) return reply.code(404).send({ error: "animal not found" });
    if (A.offspringGroupId !== id) return reply.code(409).send({ error: "animal does not belong to this group" });

    if (mode === "delete") {
      await prisma.animal.delete({ where: { id: animalId } });
    } else {
      await prisma.animal.update({ where: { id: animalId }, data: { offspringGroupId: null } });
    }

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_animal_removed",
      category: "relationship",
      title: "Animal removed from litter",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    if (mode === "delete") {
      return reply.send({ ok: true, deleted: animalId });
    }
    reply.send({ ok: true, unlinked: animalId });
  });

  /* ===== WAITLIST: CREATE under group ===== */
  // Step 6E: Party-only writes - accepts legacy contactId/organizationId, resolves to clientPartyId
  app.post("/offspring/:id/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const G = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!G) return reply.code(404).send({ error: "group not found" });

    // Step 6E: Accept clientPartyId directly (Party-native API)
    const clientPartyId = b.clientPartyId ? Number(b.clientPartyId) : null;
    if (!clientPartyId) {
      return reply.code(400).send({ error: "clientPartyId_required" });
    }

    const data: any = {
      tenantId,
      offspringGroupId: id,
      planId: b.planId ?? null,
      clientPartyId, // Step 6E: Party-only storage (no more partyType, contactId, organizationId)
      speciesPref: b.speciesPref ?? null,
      breedPrefs: b.breedPrefs ?? null,
      sirePrefId: b.sirePrefId ? Number(b.sirePrefId) : null,
      damPrefId: b.damPrefId ? Number(b.damPrefId) : null,
      status: b.status ?? "INQUIRY",
      priority: b.priority ?? null,
      depositInvoiceId: b.depositInvoiceId ?? null,
      balanceInvoiceId: b.balanceInvoiceId ?? null,
      depositPaidAt: parseISO(b.depositPaidAt),
      depositRequiredCents: b.depositRequiredCents ?? null,
      depositPaidCents: b.depositPaidCents ?? null,
      balanceDueCents: b.balanceDueCents ?? null,
      animalId: b.animalId ? Number(b.animalId) : null,
      skipCount: b.skipCount ?? null,
      lastSkipAt: parseISO(b.lastSkipAt),
      notes: b.notes ?? null,
    };

    const created = await prisma.waitlistEntry.create({ data });

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_waitlist_entry_added",
      category: "system",
      title: "Waitlist entry added",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.code(201).send(created);
  });

  /* ===== WAITLIST: UPDATE ===== */
  // Step 6E: Party-only writes - accepts legacy contactId/organizationId, resolves to clientPartyId
  app.patch("/offspring/:id/waitlist/:wid", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const wid = Number((req.params as any).wid);
    const b = (req.body as any) ?? {};

    const W = await prisma.waitlistEntry.findFirst({ where: { id: wid, tenantId } });
    if (!W) return reply.code(404).send({ error: "waitlist entry not found" });
    if (W.offspringGroupId !== id) return reply.code(409).send({ error: "waitlist entry does not belong to this group" });

    const data: any = {};

    // Step 6E: Accept clientPartyId directly (Party-native API)
    if ("clientPartyId" in b) {
      data.clientPartyId = b.clientPartyId ? Number(b.clientPartyId) : null;
      if (!data.clientPartyId) {
        return reply.code(400).send({ error: "clientPartyId_required" });
      }
    }

    if ("speciesPref" in b) data.speciesPref = b.speciesPref ?? null;
    if ("breedPrefs" in b) data.breedPrefs = b.breedPrefs ?? null;
    if ("sirePrefId" in b) data.sirePrefId = b.sirePrefId ? Number(b.sirePrefId) : null;
    if ("damPrefId" in b) data.damPrefId = b.damPrefId ? Number(b.damPrefId) : null;
    if ("status" in b) data.status = b.status;
    if ("priority" in b) data.priority = b.priority ?? null;
    if ("depositInvoiceId" in b) data.depositInvoiceId = b.depositInvoiceId ?? null;
    if ("balanceInvoiceId" in b) data.balanceInvoiceId = b.balanceInvoiceId ?? null;
    if ("depositPaidAt" in b) data.depositPaidAt = parseISO(b.depositPaidAt);
    if ("depositRequiredCents" in b) data.depositRequiredCents = b.depositRequiredCents ?? null;
    if ("depositPaidCents" in b) data.depositPaidCents = b.depositPaidCents ?? null;
    if ("balanceDueCents" in b) data.balanceDueCents = b.balanceDueCents ?? null;
    if ("animalId" in b) data.animalId = b.animalId ? Number(b.animalId) : null;
    if ("skipCount" in b) data.skipCount = b.skipCount ?? null;
    if ("lastSkipAt" in b) data.lastSkipAt = parseISO(b.lastSkipAt);
    if ("notes" in b) data.notes = b.notes ?? null;

    const updated = await prisma.waitlistEntry.update({ where: { id: wid }, data });

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_waitlist_entry_updated",
      category: "system",
      title: "Waitlist entry updated",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.send(updated);
  });

  /* ===== WAITLIST: DELETE or UNLINK ===== */
  app.delete("/offspring/:id/waitlist/:wid", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const wid = Number((req.params as any).wid);
    const mode = String((req as any).query?.mode ?? "unlink");

    const W = await prisma.waitlistEntry.findFirst({ where: { id: wid, tenantId } });
    if (!W) return reply.code(404).send({ error: "waitlist entry not found" });
    if (W.offspringGroupId !== id) return reply.code(409).send({ error: "waitlist entry does not belong to this group" });

    if (mode === "delete") {
      await prisma.waitlistEntry.delete({ where: { id: wid } });
    } else {
      await prisma.waitlistEntry.update({ where: { id: wid }, data: { offspringGroupId: null } });
    }

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_waitlist_entry_removed",
      category: "system",
      title: "Waitlist entry removed",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    if (mode === "delete") {
      return reply.send({ ok: true, deleted: wid });
    }
    reply.send({ ok: true, unlinked: wid });
  });

  /* ===== ATTACHMENTS: LIST ===== */
  app.get("/offspring/:id/attachments", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const G = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!G) return reply.code(404).send({ error: "group not found" });

    const attachments = await prisma.attachment.findMany({
      where: { offspringGroupId: id, tenantId },
      include: {
        attachmentParty: {
          select: { id: true, type: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    reply.send(
      attachments.map((att: any) => ({
        ...att,
        attachmentPartyId: att.attachmentPartyId,
        partyName: att.attachmentParty?.name ?? null,
      })),
    );
  });

  /* ===== ATTACHMENTS: CREATE ===== */
  app.post("/offspring/:id/attachments", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const G = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!G) return reply.code(404).send({ error: "group not found" });

    const required = ["kind", "storageProvider", "storageKey", "filename", "mime", "bytes"] as const;
    for (const k of required) {
      if (!(k in b)) return reply.code(400).send({ error: `missing field ${k}` });
    }

    const created = await prisma.attachment.create({
      data: {
        tenantId,
        offspringGroupId: id,
        planId: null,
        animalId: null,
        attachmentPartyId: b.attachmentPartyId ?? null,
        kind: b.kind,
        storageProvider: b.storageProvider,
        storageKey: b.storageKey,
        filename: b.filename,
        mime: b.mime,
        bytes: Number(b.bytes) || 0,
        createdByUserId: b.createdByUserId ?? null,
      },
    });

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_attachment_added",
      category: "document",
      title: "Attachment added",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.code(201).send(created);
  });

  /* ===== ATTACHMENTS: DELETE ===== */
  app.delete("/offspring/:id/attachments/:aid", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const aid = Number((req.params as any).aid);

    const A = await prisma.attachment.findFirst({ where: { id: aid, tenantId } });
    if (!A) return reply.code(404).send({ error: "attachment not found" });
    if (A.offspringGroupId !== id) return reply.code(409).send({ error: "attachment does not belong to this group" });

    await prisma.attachment.delete({ where: { id: aid } });

    // Activity log (fire-and-forget, fail-open)
    logEntityActivity({
      tenantId,
      entityType: "LITTER",
      entityId: id,
      kind: "offspring_attachment_removed",
      category: "document",
      title: "Attachment removed",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.send({ ok: true, deleted: aid });
  });

  // [OG-ROUTES-START] Offspring Group linking endpoints
  // NOTE: POST /offspring/groups/:groupId/buyers and DELETE /offspring/groups/:groupId/buyers/:buyerId
  // are now in offspring-group-buyers.ts (Selection Board routes). Do not duplicate them here.

  app.post<{ Params: { groupId: string }; Body: { planId: number; actorId: string } }>(
    "/offspring/groups/:groupId/link",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);
      const { planId, actorId } = req.body;
      const og = __makeOffspringGroupsService({ prisma: (app as any).prisma ?? prisma, authorizer: __og_authorizer });
      const out = await og.linkGroupToPlan({ tenantId, groupId, planId, actorId });
      reply.send(out);
    }
  );

  app.post<{ Params: { groupId: string }; Body: { actorId: string } }>(
    "/offspring/groups/:groupId/unlink",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);
      const { actorId } = req.body;
      const og = __makeOffspringGroupsService({ prisma: (app as any).prisma ?? prisma, authorizer: __og_authorizer });
      try {
        const out = await og.unlinkGroup({ tenantId, groupId, actorId });
        reply.send(out);
      } catch (err: any) {
        if (err.code === "BUSINESS_RULE_VIOLATION") {
          return reply.code(err.statusCode ?? 400).send({
            error: err.message,
            detail: err.detail,
          });
        }
        throw err;
      }
    }
  );

  app.get<{ Params: { groupId: string }; Querystring: { limit?: string } }>(
    "/offspring/groups/:groupId/link-suggestions",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);
      const limit = (req as any).query?.limit ? Number((req as any).query.limit) : undefined;
      const og = __makeOffspringGroupsService({ prisma: (app as any).prisma ?? prisma, authorizer: __og_authorizer });
      const out = await og.getLinkSuggestions({ tenantId, groupId, limit });
      reply.send(out);
    }
  );

  // --------------------------------------------------------------------------
  // Marketplace Listing Control Endpoints
  // --------------------------------------------------------------------------

  // POST /offspring/groups/:groupId/marketplace/publish
  // Publish entire group with default price, marking all eligible offspring as listed
  app.post<{
    Params: { groupId: string };
    Body: { marketplaceDefaultPriceCents?: number | null }
  }>(
    "/offspring/groups/:groupId/marketplace/publish",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);
      const { marketplaceDefaultPriceCents } = req.body;

      // Verify group exists and belongs to tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        include: { Offspring: { where: { lifeState: "ALIVE" } } },
      });

      if (!group) {
        return reply.code(404).send({ error: "group_not_found" });
      }

      // Update group with default price
      await prisma.offspringGroup.update({
        where: { id: groupId },
        data: { marketplaceDefaultPriceCents: marketplaceDefaultPriceCents ?? null },
      });

      // Mark all eligible offspring as listed (alive offspring only)
      const eligibleOffspringIds = group.Offspring.map((o) => o.id);
      if (eligibleOffspringIds.length > 0) {
        await prisma.offspring.updateMany({
          where: { id: { in: eligibleOffspringIds } },
          data: { marketplaceListed: true },
        });
      }

      reply.send({
        ok: true,
        groupId,
        defaultPriceCents: marketplaceDefaultPriceCents ?? null,
        listedCount: eligibleOffspringIds.length
      });
    }
  );

  // POST /offspring/groups/:groupId/marketplace/unpublish
  // Unpublish entire group, marking all offspring as not listed
  app.post<{ Params: { groupId: string } }>(
    "/offspring/groups/:groupId/marketplace/unpublish",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);

      // Verify group exists and belongs to tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
      });

      if (!group) {
        return reply.code(404).send({ error: "group_not_found" });
      }

      // Remove default price from group
      await prisma.offspringGroup.update({
        where: { id: groupId },
        data: { marketplaceDefaultPriceCents: null },
      });

      // Mark all offspring as not listed
      await prisma.offspring.updateMany({
        where: { groupId },
        data: { marketplaceListed: false },
      });

      reply.send({ ok: true, groupId });
    }
  );

  // PATCH /offspring/:offspringId/marketplace
  // Update individual offspring listing status and price
  app.patch<{
    Params: { offspringId: string };
    Body: { marketplaceListed?: boolean; marketplacePriceCents?: number | null }
  }>(
    "/offspring/:offspringId/marketplace",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const offspringId = Number(req.params.offspringId);
      const { marketplaceListed, marketplacePriceCents } = req.body;

      // Verify offspring exists and belongs to tenant
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, tenantId },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "offspring_not_found" });
      }

      // Build update data
      const updateData: any = {};
      if (typeof marketplaceListed === "boolean") {
        updateData.marketplaceListed = marketplaceListed;
      }
      if (marketplacePriceCents !== undefined) {
        updateData.marketplacePriceCents = marketplacePriceCents;
      }

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ error: "no_fields_to_update" });
      }

      // Update offspring
      const updated = await prisma.offspring.update({
        where: { id: offspringId },
        data: updateData,
      });

      reply.send({
        ok: true,
        offspringId,
        marketplaceListed: updated.marketplaceListed,
        marketplacePriceCents: updated.marketplacePriceCents
      });
    }
  );

  // ========== Phase 6: Placement Scheduling Policy ==========

  /**
   * GET /offspring/:id/placement-scheduling-policy
   * Get placement scheduling policy for an offspring group.
   */
  app.get<{ Params: { id: string } }>(
    "/offspring/:id/placement-scheduling-policy",
    async (req, reply) => {
      const tenantId = getTenantId(req);
      if (!tenantId) return reply.code(401).send({ error: "missing_tenant" });

      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return reply.code(400).send({ error: "invalid_group_id" });

      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true, placementSchedulingPolicy: true },
      });

      if (!group) {
        return reply.code(404).send({ error: "offspring_group_not_found" });
      }

      const policy = parsePlacementSchedulingPolicy(group.placementSchedulingPolicy);

      reply.send({
        groupId,
        policy: policy ?? { enabled: false },
      });
    }
  );

  /**
   * PUT /offspring/:id/placement-scheduling-policy
   * Update placement scheduling policy for an offspring group.
   */
  app.put<{ Params: { id: string }; Body: PlacementSchedulingPolicy }>(
    "/offspring/:id/placement-scheduling-policy",
    async (req, reply) => {
      const tenantId = getTenantId(req);
      if (!tenantId) return reply.code(401).send({ error: "missing_tenant" });

      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return reply.code(400).send({ error: "invalid_group_id" });

      // Verify group exists
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });

      if (!group) {
        return reply.code(404).send({ error: "offspring_group_not_found" });
      }

      const inputPolicy = req.body as PlacementSchedulingPolicy;

      // Validate policy
      const errors = validatePlacementSchedulingPolicy(inputPolicy);
      if (errors.length > 0) {
        return reply.code(400).send({ error: "validation_failed", details: errors });
      }

      // If disabled, store minimal object
      const policyToStore = inputPolicy.enabled
        ? inputPolicy
        : { enabled: false };

      await prisma.offspringGroup.update({
        where: { id: groupId },
        data: { placementSchedulingPolicy: policyToStore as any },
      });

      reply.send({
        ok: true,
        groupId,
        policy: policyToStore,
      });
    }
  );

  /**
   * GET /offspring/:id/placement-status
   * Get placement status for all buyers in an offspring group, including their windows.
   */
  app.get<{ Params: { id: string } }>(
    "/offspring/:id/placement-status",
    async (req, reply) => {
      const tenantId = getTenantId(req);
      if (!tenantId) return reply.code(401).send({ error: "missing_tenant" });

      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return reply.code(400).send({ error: "invalid_group_id" });

      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true, placementSchedulingPolicy: true },
      });

      if (!group) {
        return reply.code(404).send({ error: "offspring_group_not_found" });
      }

      const policy = parsePlacementSchedulingPolicy(group.placementSchedulingPolicy);

      // Get all buyers with their placement ranks
      const buyers = await prisma.offspringGroupBuyer.findMany({
        where: { groupId, tenantId },
        include: {
          buyerParty: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { placementRank: { sort: "asc", nulls: "last" } },
      });

      const now = new Date();

      // Import computePlacementWindow dynamically to avoid circular deps
      const { computePlacementWindow, checkPlacementGating } = await import("../services/placement-scheduling.js");

      const buyerStatus = buyers.map((b) => {
        const window = policy?.enabled && b.placementRank
          ? computePlacementWindow(policy, b.placementRank)
          : null;

        const gating = policy?.enabled
          ? checkPlacementGating(policy, b.placementRank, now)
          : { allowed: true, code: null };

        return {
          buyerId: b.id,
          partyId: b.buyerPartyId,
          partyName: b.buyerParty?.name ?? null,
          partyEmail: b.buyerParty?.email ?? null,
          placementRank: b.placementRank,
          window: window
            ? {
                windowStartAt: window.windowStartAt.toISOString(),
                windowEndAt: window.windowEndAt.toISOString(),
                graceEndAt: window.graceEndAt.toISOString(),
                timezone: window.timezone,
              }
            : null,
          status: gating.allowed
            ? "eligible"
            : gating.code === "PLACEMENT_WINDOW_NOT_OPEN"
            ? "pending"
            : gating.code === "PLACEMENT_WINDOW_CLOSED"
            ? "expired"
            : "no_rank",
        };
      });

      reply.send({
        groupId,
        policyEnabled: policy?.enabled ?? false,
        serverNow: now.toISOString(),
        buyers: buyerStatus,
      });
    }
  );

  /**
   * PATCH /offspring/:id/buyers/:buyerId/placement-rank
   * Update placement rank for a specific buyer in an offspring group.
   */
  app.patch<{ Params: { id: string; buyerId: string }; Body: { placementRank: number | null } }>(
    "/offspring/:id/buyers/:buyerId/placement-rank",
    async (req, reply) => {
      const tenantId = getTenantId(req);
      if (!tenantId) return reply.code(401).send({ error: "missing_tenant" });

      const groupId = parseInt(req.params.id, 10);
      const buyerId = parseInt(req.params.buyerId, 10);

      if (isNaN(groupId)) return reply.code(400).send({ error: "invalid_group_id" });
      if (isNaN(buyerId)) return reply.code(400).send({ error: "invalid_buyer_id" });

      const { placementRank } = req.body;

      if (placementRank !== null && (typeof placementRank !== "number" || placementRank < 1)) {
        return reply.code(400).send({ error: "invalid_placement_rank", message: "Rank must be a positive integer or null" });
      }

      // Verify buyer exists in this group
      const buyer = await prisma.offspringGroupBuyer.findFirst({
        where: { id: buyerId, groupId, tenantId },
      });

      if (!buyer) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      // Update placement rank
      await prisma.offspringGroupBuyer.update({
        where: { id: buyerId },
        data: { placementRank },
      });

      reply.send({
        ok: true,
        buyerId,
        placementRank,
      });
    }
  );
};

export default offspringRoutes;
