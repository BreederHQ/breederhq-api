// [OG-SERVICE-START] Offspring Groups domain logic, inline factory to avoid extra files.
import { Prisma, type PrismaClient, OffspringGroup, BreedingPlan, Animal, BreedingPlanStatus } from "@prisma/client";
import { resolvePartyId } from "../services/party-resolver.js";

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
const __og_authorizer: __OG_Authorizer = { async ensureAdmin() { } }; // replace with real check

export function __makeOffspringGroupsService({
  prisma,
  authorizer,
}: { prisma: PrismaClient | Prisma.TransactionClient; authorizer?: __OG_Authorizer }) {
  const db = prisma as Prisma.TransactionClient;

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

    const plan = await db.breedingPlan.findFirst({
      where: { id: planId, tenantId },
      include: { dam: { select: { id: true, name: true, species: true } }, sire: { select: { id: true, name: true } } },
    });
    if (!plan) throw new Error("plan not found for tenant");

    const existing = await db.offspringGroup.findFirst({ where: { tenantId, planId } });
    if (existing) return existing;

    const expectedBirthOn = expectedBirthFromPlan(plan);
    const name = buildTentativeGroupName({ name: plan.name, dam: plan.dam }, expectedBirthOn ?? new Date());

    const created = await db.offspringGroup.create({
      data: {
        tenantId,
        planId: plan.id,
        species: (plan.dam as any)?.species ?? (plan as any).species ?? "DOG",
        damId: plan.damId ?? null,
        sireId: plan.sireId ?? null,
        linkState: "linked",
        expectedBirthOn,
        name,
      },
    });

    await db.offspringGroupEvent.create({
      data: {
        tenantId,
        offspringGroupId: created.id,
        type: "LINK",
        occurredAt: new Date(),
        field: "planId",
        before: Prisma.DbNull,
        after: { planId: plan.id },
        notes: `Group ensured for bred plan${actorId ? ` by ${actorId}` : ""}`,
        recordedByUserId: null,
      },
    });

    // Auto-populate offspring group buyers from assigned plan buyers
    const planBuyers = await db.breedingPlanBuyer.findMany({
      where: { planId, tenantId, stage: "ASSIGNED" },
      orderBy: { priority: "asc" },
    });

    for (const buyer of planBuyers) {
      try {
        const groupBuyer = await db.offspringGroupBuyer.create({
          data: {
            tenantId,
            groupId: created.id,
            buyerPartyId: buyer.partyId,
            waitlistEntryId: buyer.waitlistEntryId,
            placementRank: buyer.priority,
          },
        });

        // Update plan buyer with the link
        await db.breedingPlanBuyer.update({
          where: { id: buyer.id },
          data: {
            offspringGroupBuyerId: groupBuyer.id,
            stage: "MATCHED_TO_OFFSPRING",
          },
        });
      } catch (err) {
        // Skip if buyer already exists in group (unique constraint)
        console.warn(`[ensureGroupForBredPlan] Could not copy buyer ${buyer.id} to group: ${err}`);
      }
    }

    return created;
  }

  async function linkGroupToPlan(args: { tenantId: number; groupId: number; planId: number; actorId: string }): Promise<OffspringGroup> {
    const { tenantId, groupId, planId, actorId } = args;

    const [group, plan] = await Promise.all([
      db.offspringGroup.findFirst({ where: { id: groupId, tenantId } }),
      db.breedingPlan.findFirst({
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

    const updated = await db.offspringGroup.update({ where: { id: group.id }, data: patch });

    await db.offspringGroupEvent.create({
      data: {
        tenantId,
        offspringGroupId: group.id,
        type: "LINK",
        occurredAt: new Date(),
        field: "planId",
        before,
        after: { ...updated },
        notes: `Group linked to plan${actorId ? ` by ${actorId}` : ""}`,
        recordedByUserId: null,
      },
    });

    return updated;
  }

  async function unlinkGroup(args: { tenantId: number; groupId: number; actorId: string }): Promise<OffspringGroup> {
    const { tenantId, groupId, actorId } = args;
    if (authorizer) await authorizer.ensureAdmin(tenantId, actorId);

    const group = await db.offspringGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new Error("group not found for tenant");

    const updated = await db.offspringGroup.update({
      where: { id: group.id },
      data: { planId: null, linkState: "orphan" },
    });

    await db.offspringGroupEvent.create({
      data: {
        tenantId,
        offspringGroupId: group.id,
        type: "UNLINK",
        occurredAt: new Date(),
        field: "planId",
        before: { ...group },
        after: { ...updated },
        notes: "Group manually unlinked from plan",
        recordedByUserId: null,
      },
    });

    return updated;
  }

  async function getLinkSuggestions(args: { tenantId: number; groupId: number; limit?: number }) {
    const { tenantId, groupId, limit = 10 } = args;

    const [group, plans] = await Promise.all([
      db.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        include: { dam: { select: { id: true, name: true, species: true } }, sire: { select: { id: true, name: true } } },
      }),
      db.breedingPlan.findMany({
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
// src/routes/breeding.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession, Surface } from "../utils/session.js";
import { deriveSurface } from "../middleware/actor-context.js";
import { checkQuota } from "../middleware/quota-enforcement.js";
import { updateUsageSnapshot } from "../services/subscription/usage-service.js";
import {
  getFoalingTimeline,
  recordFoaling,
  addFoalingOutcome,
  getFoalingCalendar,
  createBreedingMilestones,
  deleteBreedingMilestones,
  recalculateMilestones,
} from "../services/breeding-foaling-service.js";
import {
  getMareReproductiveHistory,
  getMareDetailedFoalingHistory,
  recalculateMareHistory,
  getFoalingAnalytics,
} from "../services/mare-reproductive-history-service.js";
import { checkArchiveReadiness } from "../services/archive-validation-service.js";
import { checkBreedingPlanCarrierRisk } from "../services/genetics/carrier-detection.js";

/* ───────────────────────── tenant resolution (plugin-scoped) ───────────────────────── */

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ───────────────────────── animal breeding status sync ───────────────────────── */

/**
 * Sync animal breeding status based on active breeding plans.
 *
 * Rules:
 * - If animal is linked to ANY non-archived plan with status in active breeding phases,
 *   set animal status to BREEDING
 * - If animal is not linked to any active breeding plans and current status is BREEDING,
 *   revert to ACTIVE
 * - Never downgrade from RETIRED, DECEASED, or manually set statuses
 *
 * Active breeding phases: CYCLE, COMMITTED (deprecated), CYCLE_EXPECTED, HORMONE_TESTING, BRED, PREGNANT, BIRTHED, WEANED, PLACEMENT
 */
const ACTIVE_BREEDING_STATUSES = new Set([
  "CYCLE",       // New: renamed from COMMITTED
  "COMMITTED",   // Deprecated: kept for backward compatibility
  "CYCLE_EXPECTED",
  "HORMONE_TESTING",
  "BRED",
  "PREGNANT",
  "BIRTHED",
  "WEANED",
  "PLACEMENT",
]);

async function syncAnimalBreedingStatus(
  animalId: number,
  tenantId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;

  // Get the animal's current status
  const animal = await db.animal.findFirst({
    where: { id: animalId, tenantId },
    select: { id: true, status: true, sex: true },
  });

  if (!animal) return;

  // Never auto-change RETIRED, DECEASED, or UNAVAILABLE statuses
  const protectedStatuses = ["RETIRED", "DECEASED", "UNAVAILABLE"];
  if (protectedStatuses.includes(String(animal.status))) return;

  // Check if animal is linked to any active breeding plans
  const whereClause: any = {
    tenantId,
    archived: false,
    status: { in: Array.from(ACTIVE_BREEDING_STATUSES) },
  };

  // Check both dam and sire based on animal's sex
  if (animal.sex === "FEMALE") {
    whereClause.damId = animalId;
  } else {
    whereClause.sireId = animalId;
  }

  const activeBreedingPlan = await db.breedingPlan.findFirst({
    where: whereClause,
    select: { id: true, status: true },
  });

  const currentStatus = String(animal.status);

  if (activeBreedingPlan) {
    // Animal is in an active breeding plan - set to BREEDING if not already
    if (currentStatus !== "BREEDING") {
      await db.animal.update({
        where: { id: animalId },
        data: { status: "BREEDING" },
      });
    }
  } else {
    // Animal is not in any active breeding plan
    // Only revert from BREEDING to ACTIVE (don't touch other statuses)
    if (currentStatus === "BREEDING") {
      await db.animal.update({
        where: { id: animalId },
        data: { status: "ACTIVE" },
      });
    }
  }
}

/**
 * Sync breeding status for both dam and sire of a plan
 */
async function syncPlanAnimalsBreedingStatus(
  planId: number,
  tenantId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;

  const plan = await db.breedingPlan.findFirst({
    where: { id: planId, tenantId },
    select: { damId: true, sireId: true },
  });

  if (!plan) return;

  const syncPromises: Promise<void>[] = [];
  if (plan.damId) syncPromises.push(syncAnimalBreedingStatus(plan.damId, tenantId, tx));
  if (plan.sireId) syncPromises.push(syncAnimalBreedingStatus(plan.sireId, tenantId, tx));

  await Promise.all(syncPromises);
}

/**
 * When dam/sire changes on a plan, sync both the old and new animals
 */
async function syncAnimalChangeOnPlan(
  oldAnimalId: number | null,
  newAnimalId: number | null,
  tenantId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const syncPromises: Promise<void>[] = [];

  // Sync old animal (may need to revert from BREEDING)
  if (oldAnimalId) {
    syncPromises.push(syncAnimalBreedingStatus(oldAnimalId, tenantId, tx));
  }

  // Sync new animal (may need to set to BREEDING)
  if (newAnimalId && newAnimalId !== oldAnimalId) {
    syncPromises.push(syncAnimalBreedingStatus(newAnimalId, tenantId, tx));
  }

  await Promise.all(syncPromises);
}

function resolveTenantIdFromRequest(req: any): number | null {
  const h = req.headers || {};
  const headerTenant =
    toNum(h["x-tenant-id"]) ??
    toNum(h["X-Tenant-Id"]) ??
    toNum(h["x-tenantid"]) ??
    null;
  if (headerTenant) return headerTenant;

  // Use signature-verified session parsing with surface-specific cookie
  const surface = deriveSurface(req) as Surface;
  const sess = parseVerifiedSession(req, surface);
  if (sess?.tenantId) return sess.tenantId;

  const fromReq =
    toNum(req.tenantId) ??
    toNum(req.session?.tenantId) ??
    toNum(req.user?.tenantId) ??
    toNum(req.user?.defaultTenantId) ??
    null;
  if (fromReq) return fromReq;

  const memberships =
    req.user?.memberships ||
    req.user?.tenantMemberships ||
    req.session?.memberships ||
    [];
  if (Array.isArray(memberships) && memberships.length) {
    const scored = [...memberships].sort((a: any, b: any) => {
      const score = (m: any) =>
        (m?.isDefault || m?.default ? 3 : 0) +
        (m?.isPrimary ? 2 : 0) +
        (String(m?.role || "").toUpperCase() === "OWNER" ? 1 : 0);
      return score(b) - score(a);
    });
    for (const m of scored) {
      const t = toNum(m?.tenantId ?? m?.id);
      if (t) return t;
    }
  }

  return null;
}

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseArchivedMode(q: any): "exclude" | "include" | "only" {
  const s = String(q?.archived ?? "").toLowerCase();
  if (s === "include" || s === "only" || s === "exclude") return s;

  const truthy =
    q?.includeArchived === "true" ||
    q?.include_archived === "true" ||
    q?.withArchived === "true" ||
    q?.showArchived === "true" ||
    q?.includeArchived === true ||
    q?.include_archived === true ||
    q?.withArchived === true ||
    q?.showArchived === true;

  return truthy ? "include" : "exclude";
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function includeFlags(qInclude: any) {
  const list = String(qInclude || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const has = (k: string) => list.includes(k) || list.includes("all");
  const wantsWaitlist = has("waitlist") || has("reservations");

  return {
    Litter: has("litter") ? true : false,
    Waitlist: wantsWaitlist
      ? {
        orderBy: [
          { depositPaidAt: "desc" as const },
          { createdAt: "asc" as const },
        ],
        take: 200,
      }
      : false,
    Events: has("events") ? { orderBy: { occurredAt: "asc" as const }, take: 200 } : false,
    TestResults: has("tests") ? { orderBy: { collectedAt: "asc" as const }, take: 200 } : false,
    BreedingAttempts: has("attempts")
      ? { orderBy: [{ attemptAt: "asc" as const }, { windowStart: "asc" as const }], take: 50 }
      : false,
    PregnancyChecks: has("pregchecks") ? { orderBy: { checkedAt: "asc" as const }, take: 20 } : false,
    Parties: has("parties") ? true : false,
    Attachments: has("attachments") ? { orderBy: { id: "desc" as const }, take: 100 } : false,
    dam: has("parents") ? true : false,
    sire: has("parents") ? true : false,
    organization: has("org") ? true : false,
    program: has("program") ? true : false,
    offspringGroup: has("offspringgroup") || has("offspring") ? true : false,
    breedingMilestones: has("milestones") ? { orderBy: { scheduledDate: "asc" as const } } : false,
  };
}

/* ───────────────────────── normalization ───────────────────────── */

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}


function validateAndNormalizeLockPayload(body: any) {
  const provided = {
    start: body.hasOwnProperty("lockedCycleStart") ? toDateOrNull(body.lockedCycleStart) : undefined,
    ov: body.hasOwnProperty("lockedOvulationDate") ? toDateOrNull(body.lockedOvulationDate) : undefined,
    due: body.hasOwnProperty("lockedDueDate") ? toDateOrNull(body.lockedDueDate) : undefined,
    placement: body.hasOwnProperty("lockedPlacementStartDate") ? toDateOrNull(body.lockedPlacementStartDate) : undefined,
  };

  const touched = [provided.start, provided.ov, provided.due, provided.placement].some((v) => v !== undefined);
  if (!touched) return { touched: false as const };

  const nonNullCount = [provided.start, provided.ov, provided.due, provided.placement].filter(
    (v) => v instanceof Date
  ).length;
  const providedCount = [provided.start, provided.ov, provided.due, provided.placement].filter(
    (v) => v !== undefined
  ).length;

  const allProvidedNull = providedCount > 0 && nonNullCount === 0;
  if (allProvidedNull) {
    return {
      touched: true as const,
      lockedCycleStart: null,
      lockedOvulationDate: null,
      lockedDueDate: null,
      lockedPlacementStartDate: null,
    };
  }

  const allProvidedAndNonNull = providedCount === 4 && nonNullCount === 4;
  if (!allProvidedAndNonNull) {
    const missing = [];
    if (provided.start === undefined || provided.start === null) missing.push("lockedCycleStart");
    if (provided.ov === undefined || provided.ov === null) missing.push("lockedOvulationDate");
    if (provided.due === undefined || provided.due === null) missing.push("lockedDueDate");
    if (provided.placement === undefined || provided.placement === null) missing.push("lockedPlacementStartDate");
    const msg = `lock_invariant: when locking a cycle you must provide all of: lockedCycleStart, lockedOvulationDate, lockedDueDate, lockedPlacementStartDate. Missing/empty: ${missing.join(", ")}`;
    const err: any = new Error(msg);
    err.statusCode = 400;
    throw err;
  }

  return {
    touched: true as const,
    lockedCycleStart: provided.start!,
    lockedOvulationDate: provided.ov!,
    lockedDueDate: provided.due!,
    lockedPlacementStartDate: provided.placement!,
  };
}

async function getPlanInTenant(planId: number, tenantId: number) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
    select: { id: true, species: true, damId: true, sireId: true },
  });
  if (!plan) {
    const exists = await prisma.breedingPlan.findUnique({ where: { id: planId } });
    if (!exists) throw Object.assign(new Error("not_found"), { statusCode: 404 });
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return plan;
}

async function getLitterInTenant(litterId: number, tenantId: number) {
  const litter = await prisma.litter.findFirst({
    where: { id: litterId, tenantId },
    select: { id: true, tenantId: true, planId: true },
  });
  if (!litter) {
    const exists = await prisma.litter.findUnique({ where: { id: litterId } });
    if (!exists) throw Object.assign(new Error("not_found"), { statusCode: 404 });
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return litter;
}

function errorReply(err: any) {
  if (err?.code === "P2002") return { status: 409, payload: { error: "duplicate", detail: err?.meta?.target } };
  if (err?.code === "P2003") return { status: 409, payload: { error: "foreign_key_conflict", meta: err?.meta } };
  if (err instanceof ImmutabilityError) {
    return { status: 400, payload: { error: "immutability_violation", field: err.field, detail: err.message } };
  }
  if (err?.statusCode) return { status: err.statusCode, payload: { error: err.message } };

  // Show details when not in production
  const dev = String(process.env.NODE_ENV || "").toLowerCase() !== "production";
  return {
    status: 500,
    payload: dev
      ? { error: "internal_error", code: err?.code, message: err?.message, meta: err?.meta, stack: err?.stack }
      : { error: "internal_error" },
  };
}

/* ───────────────────────── Anchor Mode System Types & Validation ───────────────────────── */

type ReproAnchorMode = "CYCLE_START" | "OVULATION" | "BREEDING_DATE";
type OvulationMethod = "CALCULATED" | "PROGESTERONE_TEST" | "LH_TEST" | "ULTRASOUND" | "VAGINAL_CYTOLOGY" | "PALPATION" | "AT_HOME_TEST" | "VETERINARY_EXAM" | "BREEDING_INDUCED";
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

const VALID_ANCHOR_MODES = new Set<ReproAnchorMode>(["CYCLE_START", "OVULATION", "BREEDING_DATE"]);
const VALID_OVULATION_METHODS = new Set<OvulationMethod>([
  "PROGESTERONE_TEST", "LH_TEST", "ULTRASOUND", "VAGINAL_CYTOLOGY",
  "PALPATION", "AT_HOME_TEST", "VETERINARY_EXAM", "BREEDING_INDUCED"
]);

// Species defaults for timeline calculations (subset of reproEngine defaults)
const SPECIES_DEFAULTS: Record<string, { ovulationOffsetDays: number; gestationDays: number; offspringCareDurationWeeks: number; placementStartWeeksDefault: number; placementExtendedWeeks: number }> = {
  DOG: { ovulationOffsetDays: 12, gestationDays: 63, offspringCareDurationWeeks: 8, placementStartWeeksDefault: 8, placementExtendedWeeks: 4 },
  CAT: { ovulationOffsetDays: 0, gestationDays: 63, offspringCareDurationWeeks: 8, placementStartWeeksDefault: 12, placementExtendedWeeks: 4 },
  HORSE: { ovulationOffsetDays: 5, gestationDays: 340, offspringCareDurationWeeks: 20, placementStartWeeksDefault: 24, placementExtendedWeeks: 8 },
  RABBIT: { ovulationOffsetDays: 0, gestationDays: 31, offspringCareDurationWeeks: 4, placementStartWeeksDefault: 8, placementExtendedWeeks: 2 },
  GOAT: { ovulationOffsetDays: 2, gestationDays: 150, offspringCareDurationWeeks: 8, placementStartWeeksDefault: 8, placementExtendedWeeks: 4 },
  SHEEP: { ovulationOffsetDays: 2, gestationDays: 147, offspringCareDurationWeeks: 8, placementStartWeeksDefault: 8, placementExtendedWeeks: 4 },
};

function getSpeciesDefaults(species: string) {
  return SPECIES_DEFAULTS[String(species).toUpperCase()] || SPECIES_DEFAULTS.DOG;
}

// Check if species is an induced ovulator (breeding triggers ovulation)
// These species skip the CYCLE phase - ovulation is triggered by breeding itself
function isInducedOvulator(species: string): boolean {
  const s = String(species).toUpperCase();
  return s === "CAT" || s === "RABBIT" || s === "ALPACA" || s === "LLAMA";
}

// Check if species supports ovulation upgrade (cycle start -> ovulation)
function supportsOvulationUpgrade(species: string): boolean {
  const s = String(species).toUpperCase();
  return s === "DOG" || s === "HORSE";
}

// Check if species supports ovulation testing/anchor
// GOAT and SHEEP don't have commercial ovulation testing available
function supportsOvulationTesting(species: string): boolean {
  const s = String(species).toUpperCase();
  return s === "DOG" || s === "HORSE";
}

/**
 * ImmutabilityError - thrown when attempting to modify locked fields
 */
class ImmutabilityError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ImmutabilityError";
  }
}

/**
 * Validate immutability rules for breeding plan updates.
 * Enforces the immutability matrix from Phase 1.4 of the anchor mode spec.
 */
function validateImmutability(existingPlan: any, updates: any): void {
  const status = String(existingPlan.status);
  const lockedStatuses = ["BRED", "PREGNANT", "BIRTHED", "WEANED", "PLACEMENT", "COMPLETE"];
  // CYCLE is the new name, COMMITTED is deprecated but still supported
  const postCycleStatuses = ["CYCLE", "COMMITTED", ...lockedStatuses];
  const isCyclePhase = status === "CYCLE" || status === "COMMITTED";

  // RESET OPERATION: When status is being changed to PLANNING, skip immutability checks
  // This allows the Reset Plan feature to clear all dates and start fresh
  if (updates.status === "PLANNING") {
    return; // Allow all date clears when resetting to PLANNING
  }

  // CANCELED status - no date changes allowed
  if (status === "CANCELED") {
    const dateFields = [
      "cycleStartObserved", "ovulationConfirmed", "breedDateActual",
      "birthDateActual", "weanedDateActual", "cycleStartDateActual",
      "hormoneTestingStartDateActual", "placementStartDateActual",
      "placementCompletedDateActual",
    ];
    for (const field of dateFields) {
      if (updates[field] !== undefined) {
        throw new ImmutabilityError(field, "Cannot modify dates on a CANCELED breeding plan. The plan is permanently locked.");
      }
    }
  }

  // reproAnchorMode validation
  // Anchor mode cannot be changed directly via PATCH in CYCLE or later statuses.
  // Upgrades (CYCLE_START -> OVULATION) must go through the /upgrade-to-ovulation endpoint.
  if (updates.reproAnchorMode !== undefined && updates.reproAnchorMode !== existingPlan.reproAnchorMode) {
    if (lockedStatuses.includes(status)) {
      throw new ImmutabilityError("reproAnchorMode", "Cannot change anchor mode after breeding has begun");
    }
    // In CYCLE status, anchor mode changes must use upgrade endpoint
    if (isCyclePhase) {
      throw new ImmutabilityError("reproAnchorMode", "Anchor mode locked in CYCLE status. Use the upgrade endpoint to upgrade from CYCLE_START to OVULATION.");
    }
  }

  // cycleStartObserved validation
  // Tolerance is measured from the ORIGINAL locked value (lockedCycleStart), not the current value
  if (updates.cycleStartObserved !== undefined && existingPlan.cycleStartObserved) {
    // Check if value is actually changing (allow same-value passthrough)
    const existingDate = new Date(existingPlan.cycleStartObserved).toISOString().split("T")[0];
    const newDate = new Date(updates.cycleStartObserved).toISOString().split("T")[0];
    if (existingDate !== newDate) {
      if (lockedStatuses.includes(status)) {
        throw new ImmutabilityError("cycleStartObserved", "Cycle start date is locked after CYCLE status");
      }
      if (isCyclePhase) {
        // Use lockedCycleStart as reference if available, otherwise fall back to current value
        const referenceDate = existingPlan.lockedCycleStart || existingPlan.cycleStartObserved;
        const oldDate = new Date(referenceDate);
        const diffDays = Math.abs((new Date(updates.cycleStartObserved).getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 3) {
          throw new ImmutabilityError("cycleStartObserved", `Cannot change cycle start by more than 3 days in CYCLE status (attempted ${Math.round(diffDays)} days)`);
        }
      }
    }
  }

  // ovulationConfirmed validation
  // Tolerance is measured from the ORIGINAL locked value (lockedOvulationDate), not the current value
  // Allow clearing (null) in CYCLE phase - this is for the "Change" button flow
  if (updates.ovulationConfirmed !== undefined && existingPlan.ovulationConfirmed) {
    // Allow clearing the date in CYCLE phase (user wants to re-enter it)
    if (updates.ovulationConfirmed === null) {
      if (lockedStatuses.includes(status)) {
        throw new ImmutabilityError("ovulationConfirmed", "Ovulation date cannot be cleared after CYCLE status");
      }
      // Allow clearing in CYCLE phase - skip further validation
    } else {
      // Check if value is actually changing (allow same-value passthrough)
      const existingDate = new Date(existingPlan.ovulationConfirmed).toISOString().split("T")[0];
      const newDate = new Date(updates.ovulationConfirmed).toISOString().split("T")[0];
      if (existingDate !== newDate) {
        if (lockedStatuses.includes(status)) {
          throw new ImmutabilityError("ovulationConfirmed", "Ovulation date is locked after CYCLE status");
        }
        if (isCyclePhase) {
          // Use lockedOvulationDate as reference if available, otherwise fall back to current value
          const referenceDate = existingPlan.lockedOvulationDate || existingPlan.ovulationConfirmed;
          const oldDate = new Date(referenceDate);
          const diffDays = Math.abs((new Date(updates.ovulationConfirmed).getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 2) {
            throw new ImmutabilityError("ovulationConfirmed", `Cannot change ovulation date by more than 2 days in CYCLE status (attempted ${Math.round(diffDays)} days)`);
          }
        }
      }
    }
  }

  // breedDateActual validation
  // Allow clearing (null) in BRED phase - this is for the "Change" button flow
  if (updates.breedDateActual !== undefined && existingPlan.breedDateActual) {
    // Allow clearing the date in BRED phase (user wants to re-enter it)
    if (updates.breedDateActual === null) {
      const postBreedStatuses = ["BIRTHED", "WEANED", "PLACEMENT", "COMPLETE"];
      if (postBreedStatuses.includes(status)) {
        throw new ImmutabilityError("breedDateActual", "Breeding date cannot be cleared after BRED status");
      }
      // Allow clearing in BRED phase - skip further validation
    } else {
      // Check if value is actually changing (allow same-value passthrough)
      const existingDate = new Date(existingPlan.breedDateActual).toISOString().split("T")[0];
      const newDate = new Date(updates.breedDateActual).toISOString().split("T")[0];
      if (existingDate !== newDate) {
        const postBreedStatuses = ["BIRTHED", "WEANED", "PLACEMENT", "COMPLETE"];
        if (postBreedStatuses.includes(status)) {
          throw new ImmutabilityError("breedDateActual", "Breeding date is locked after BRED status");
        }
        if (status === "BRED") {
          const oldDate = new Date(existingPlan.breedDateActual);
          const diffDays = Math.abs((new Date(updates.breedDateActual).getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 2) {
            throw new ImmutabilityError("breedDateActual", `Cannot change breeding date by more than 2 days in BRED status (attempted ${Math.round(diffDays)} days)`);
          }
        }
      }
    }
  }

  // birthDateActual validation
  // Allow clearing (null) in BIRTHED phase - this is for the "Change" button flow
  if (updates.birthDateActual !== undefined && existingPlan.birthDateActual) {
    // Allow clearing the date in BIRTHED phase (user wants to re-enter it)
    if (updates.birthDateActual === null) {
      const postBirthStatuses = ["WEANED", "PLACEMENT", "COMPLETE"];
      if (postBirthStatuses.includes(status)) {
        throw new ImmutabilityError("birthDateActual", "Birth date cannot be cleared after BIRTHED status");
      }
      // Allow clearing in BIRTHED phase - skip further validation
    } else {
      // Allow sending the same value (no actual change) - only error if actually changing
      const existingDate = new Date(existingPlan.birthDateActual).toISOString().split("T")[0];
      const newDate = new Date(updates.birthDateActual).toISOString().split("T")[0];
      if (existingDate !== newDate) {
        // Birth date cannot be changed once set (except via admin override)
        throw new ImmutabilityError("birthDateActual", "Birth date is strictly immutable once set. Contact support if correction needed.");
      }
    }
  }

  // weanedDateActual validation
  if (updates.weanedDateActual !== undefined && existingPlan.weanedDateActual) {
    const postWeenStatuses = ["PLACEMENT", "COMPLETE"];
    if (postWeenStatuses.includes(status)) {
      const oldDate = new Date(existingPlan.weanedDateActual);
      const newDate = new Date(updates.weanedDateActual);
      const diffDays = Math.abs((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        throw new ImmutabilityError("weanedDateActual", `Cannot change weaning date by more than 7 days after WEANED status (attempted ${Math.round(diffDays)} days)`);
      }
    }
  }
}

/**
 * Calculate expected dates from an anchor date using species defaults.
 * Used by unified lock and upgrade endpoints.
 */
function calculateExpectedDatesFromAnchor(
  anchorMode: ReproAnchorMode,
  anchorDate: Date,
  species: string
): {
  cycleStart: Date;
  ovulation: Date;
  dueDate: Date;
  weanedDate: Date;
  placementStart: Date;
  placementCompleted: Date;
} {
  const d = getSpeciesDefaults(species);

  let cycleStart: Date;
  let ovulation: Date;

  if (anchorMode === "OVULATION" || anchorMode === "BREEDING_DATE") {
    // Ovulation is the anchor - work backward for cycle start
    ovulation = new Date(anchorDate);
    cycleStart = new Date(anchorDate);
    cycleStart.setUTCDate(cycleStart.getUTCDate() - d.ovulationOffsetDays);
  } else {
    // Cycle start is the anchor - work forward for ovulation
    cycleStart = new Date(anchorDate);
    ovulation = new Date(anchorDate);
    ovulation.setUTCDate(ovulation.getUTCDate() + d.ovulationOffsetDays);
  }

  // Calculate birth from ovulation (gestation days)
  const dueDate = new Date(ovulation);
  dueDate.setUTCDate(dueDate.getUTCDate() + d.gestationDays);

  // Calculate weaned from birth
  const weanedDate = new Date(dueDate);
  weanedDate.setUTCDate(weanedDate.getUTCDate() + (d.offspringCareDurationWeeks * 7));

  // Calculate placement start from birth
  const placementStart = new Date(dueDate);
  placementStart.setUTCDate(placementStart.getUTCDate() + (d.placementStartWeeksDefault * 7));

  // Calculate placement completed
  const placementCompleted = new Date(placementStart);
  placementCompleted.setUTCDate(placementCompleted.getUTCDate() + (d.placementExtendedWeeks * 7));

  return { cycleStart, ovulation, dueDate, weanedDate, placementStart, placementCompleted };
}

function buildCodeFromId(planId: number, d = new Date()) {
  const yyyy = d.getFullYear();
  return `PLN-${yyyy}-${String(planId).padStart(5, "0")}`;
}

function ymd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function buildFriendlyPlanCode(tenantId: number, planId: number) {
  const plan = await prisma.breedingPlan.findFirst({
    where: { id: planId, tenantId },
    include: { dam: { select: { name: true } } },
  });
  const damFirst =
    String(plan?.dam?.name || "")
      .trim()
      .split(/\s+/)[0]
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 12) || "DAM";

  const commitYmd = ymd(new Date());
  const dueYmd = plan?.lockedDueDate
    ? ymd(new Date(plan.lockedDueDate))
    : plan?.expectedBirthDate
      ? ymd(new Date(plan.expectedBirthDate))
      : commitYmd;

  const base = `PLN-${damFirst}-${commitYmd}-${dueYmd}`;

  let candidate = base;
  let suffix = 2;
  while (
    await prisma.breedingPlan.findFirst({ where: { tenantId, code: candidate }, select: { id: true } })
  ) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

/* ───────────────────────── enums & guards ───────────────────────── */

const PlanStatus = new Set<string>([
  "PLANNING",
  "CYCLE",         // New: renamed from COMMITTED
  "COMMITTED",     // Deprecated: kept for backward compatibility
  "CYCLE_EXPECTED",
  "HORMONE_TESTING",
  "BRED",
  "PREGNANT",
  "BIRTHED",
  "WEANED",
  "PLACEMENT",
  "COMPLETE",
  "CANCELED",
  "UNSUCCESSFUL",  // Terminal: breeding was attempted but failed
  "ON_HOLD",       // Semi-terminal: plan is paused but can be resumed
]);

function normalizePlanStatus(s: any) {
  if (s == null) return null;
  const up = String(s).toUpperCase();
  return PlanStatus.has(up) ? up : null;
}

const HEX3_4_6_8 = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/* ───────────────────────── routes ───────────────────────── */

const breedingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context
  app.addHook("preHandler", async (req, reply) => {
    let tenantId: number | null = toNum((req as any).tenantId);
    if (!tenantId) {
      tenantId = resolveTenantIdFromRequest(req);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /* ───────────── Breeding Plans ───────────── */

  app.get("/breeding/plans", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      const q = (req.query || {}) as Partial<{
        status: string;
        damId: string;
        sireId: string;
        q: string;
        include: string;
        page: string;
        limit: string;
        archived: "include" | "only" | "exclude";
        includeArchived: string | boolean;
        include_archived: string | boolean;
        withArchived: string | boolean;
        showArchived: string | boolean;
      }>;

      const archivedMode = parseArchivedMode(q);
      const where: any = { tenantId };
      if (archivedMode === "exclude") where.archived = false;
      if (archivedMode === "only") where.archived = true;

      if (q.status) {
        const s = normalizePlanStatus(q.status);
        if (!s) return reply.code(400).send({ error: "bad_status" });
        where.status = s as any;
      }

      if (q.damId) where.damId = Number(q.damId);
      if (q.sireId) where.sireId = Number(q.sireId);
      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { nickname: { contains: search, mode: "insensitive" } },
          { breedText: { contains: search, mode: "insensitive" } },
        ];
      }
      const { page, limit, skip } = parsePaging(q);
      const expand = includeFlags(q.include);

      const [items, total] = await prisma.$transaction([
        prisma.breedingPlan.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: expand,
        }),
        prisma.breedingPlan.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.get("/breeding/plans/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const query = req.query as any;
      const expand = includeFlags(query?.include);
      const checkCarrierRisk = query?.checkCarrierRisk === "true";

      const plan = await prisma.breedingPlan.findFirst({ where: { id, tenantId }, include: expand });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Optionally check for carrier warnings (add ?checkCarrierRisk=true)
      if (checkCarrierRisk && plan.damId && plan.sireId) {
        const carrierRisk = await checkBreedingPlanCarrierRisk(prisma, plan.id, tenantId, null, false);
        reply.send({
          ...plan,
          carrierWarnings: carrierRisk.warnings,
          hasLethalRisk: carrierRisk.hasLethalRisk,
        });
      } else {
        reply.send(plan);
      }
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post(
    "/breeding/plans",
    {
      preHandler: [checkQuota("BREEDING_PLAN_COUNT")],
    },
    async (req, reply) => {
      try {
        const tenantId = Number((req as any).tenantId);

      const b = (req.body || {}) as any;

      const name = String(b.name || "").trim();
      if (!name) return reply.code(400).send({ error: "name_required" });
      if (!b.species) return reply.code(400).send({ error: "species_required" });

      if (b.organizationId != null) {
        const org = await prisma.organization.findFirst({
          where: { id: Number(b.organizationId), tenantId },
          select: { id: true },
        });
        if (!org) return reply.code(400).send({ error: "organization_not_in_tenant" });
      }

      // damId is optional in PLANNING status (required at commit time)
      const damId = idNum(b.damId);
      if (damId) {
        const dam = await prisma.animal.findFirst({
          where: { id: damId, tenantId },
          select: { species: true, sex: true },
        });
        if (!dam) return reply.code(400).send({ error: "dam_not_found" });
        if (String(dam.species) !== String(b.species)) {
          return reply.code(400).send({ error: "dam_species_mismatch" });
        }
        if (String(dam.sex) !== "FEMALE") {
          return reply.code(400).send({ error: "dam_sex_mismatch" });
        }
      }

      if (b.sireId) {
        const sire = await prisma.animal.findFirst({
          where: { id: Number(b.sireId), tenantId },
          select: { species: true, sex: true },
        });
        if (!sire) return reply.code(400).send({ error: "sire_not_found" });
        if (String(sire.species) !== String(b.species)) {
          return reply.code(400).send({ error: "sire_species_mismatch" });
        }
        if (String(sire.sex) !== "MALE") {
          return reply.code(400).send({ error: "sire_sex_mismatch" });
        }
      }

      // Validate programId if provided (links plan to a BreedingProgram for marketplace)
      if (b.programId) {
        const program = await prisma.mktListingBreedingProgram.findFirst({
          where: { id: Number(b.programId), tenantId },
          select: { id: true },
        });
        if (!program) return reply.code(400).send({ error: "program_not_found" });
      }

      const normalizedStatus = normalizePlanStatus(b.status ?? "PLANNING");
      if (!normalizedStatus) return reply.code(400).send({ error: "bad_status" });

      let lockNorm:
        | { touched: false }
        | {
          touched: true;
          lockedCycleStart: Date | null;
          lockedOvulationDate: Date | null;
          lockedDueDate: Date | null;
          lockedPlacementStartDate: Date | null;
        };

      try {
        lockNorm = validateAndNormalizeLockPayload(b);
      } catch (e) {
        const { status, payload } = errorReply(e);
        return reply.status(status).send(payload);
      }

      const data: any = {
        tenantId,
        organizationId: b.organizationId ?? null,
        // allow explicit code from caller, otherwise we will generate below
        code: b.code ?? null,
        name,
        nickname: b.nickname ?? null,
        species: b.species,
        breedText: b.breedText ?? null,
        damId: damId ?? null,
        sireId: b.sireId ?? null,
        programId: b.programId ? Number(b.programId) : null, // Breeding Program (marketplace)
        expectedCycleStart: b.expectedCycleStart ? new Date(b.expectedCycleStart) : null,
        expectedHormoneTestingStart: b.expectedHormoneTestingStart ? new Date(b.expectedHormoneTestingStart) : null,
        expectedBreedDate: b.expectedBreedDate ? new Date(b.expectedBreedDate) : null,
        expectedBirthDate: b.expectedBirthDate ? new Date(b.expectedBirthDate) : null,
        expectedPlacementStart: b.expectedPlacementStart ? new Date(b.expectedPlacementStart) : null,
        expectedWeaned: b.expectedWeaned ? new Date(b.expectedWeaned) : null,
        expectedPlacementCompleted: b.expectedPlacementCompleted ? new Date(b.expectedPlacementCompleted) : null,

        cycleStartDateActual: b.cycleStartDateActual ? new Date(b.cycleStartDateActual) : null,
        hormoneTestingStartDateActual: b.hormoneTestingStartDateActual
          ? new Date(b.hormoneTestingStartDateActual)
          : null,
        breedDateActual: b.breedDateActual ? new Date(b.breedDateActual) : null,
        birthDateActual: b.birthDateActual ? new Date(b.birthDateActual) : null,
        weanedDateActual: b.weanedDateActual ? new Date(b.weanedDateActual) : null,
        placementStartDateActual: b.placementStartDateActual ? new Date(b.placementStartDateActual) : null,
        placementCompletedDateActual: b.placementCompletedDateActual
          ? new Date(b.placementCompletedDateActual)
          : null,
        completedDateActual: b.completedDateActual ? new Date(b.completedDateActual) : null,

        status: normalizedStatus,
        notes: b.notes ?? null,
        depositsCommittedCents: b.depositsCommittedCents ?? null,
        depositsPaidCents: b.depositsPaidCents ?? null,
        depositRiskScore: b.depositRiskScore ?? null,
      };

      const userId = (req as any).user?.id ?? null;

      let created = await prisma.$transaction(async (tx) => {
        const plan = await tx.breedingPlan.create({ data });

        const lockedOnCreate =
          lockNorm.touched &&
          (lockNorm as any).lockedCycleStart &&
          (lockNorm as any).lockedOvulationDate &&
          (lockNorm as any).lockedDueDate &&
          (lockNorm as any).lockedPlacementStartDate;

        if (lockedOnCreate) {
          await tx.breedingPlanEvent.create({
            data: {
              tenantId,
              planId: plan.id,
              type: "CYCLE_LOCKED",
              occurredAt: new Date(),
              label: "Cycle locked on plan creation",
              recordedByUserId: userId,
              data: {
                lockedCycleStart: ( lockNorm as any).lockedCycleStart,
                lockedOvulationDate: ( lockNorm as any).lockedOvulationDate,
                lockedDueDate: ( lockNorm as any).lockedDueDate,
                lockedPlacementStartDate: ( lockNorm as any).lockedPlacementStartDate,
                expectedBirthDate: plan.expectedBirthDate,
                expectedPlacementStart: plan.expectedPlacementStart,
                expectedWeaned: plan.expectedWeaned,
                expectedPlacementCompleted: plan.expectedPlacementCompleted,
              },
            },
          });
        }

        return plan;
      });

      // new part: ensure every new plan has a code if caller did not provide one
      if (!created.code) {
        const code = await buildFriendlyPlanCode(tenantId, created.id);
        created = await prisma.breedingPlan.update({
          where: { id: created.id },
          data: { code },
        });
      }

      // Update usage snapshot after successful creation
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      // Check for carrier × carrier lethal pairings (creates notification if found)
      let carrierRisk: { hasLethalRisk: boolean; hasWarnings: boolean; warnings: any[] } | null = null;
      if (created.damId && created.sireId) {
        carrierRisk = await checkBreedingPlanCarrierRisk(prisma, created.id, tenantId, userId, true);
      }

      reply.code(201).send({
        ...created,
        carrierWarnings: carrierRisk?.warnings ?? [],
        hasLethalRisk: carrierRisk?.hasLethalRisk ?? false,
      });
    } catch (err) {
      const { status, payload} = errorReply(err);
      reply.status(status).send(payload);
    }
    }
  );

  app.patch("/breeding/plans/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          species: true,
          code: true,
          status: true,
          damId: true,
          sireId: true,
          // Fields needed for immutability validation
          reproAnchorMode: true,
          lockedCycleStart: true,
          lockedOvulationDate: true,
          cycleStartObserved: true,
          ovulationConfirmed: true,
          breedDateActual: true,
          birthDateActual: true,
          weanedDateActual: true,
        },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};

      if (b.name !== undefined) {
        const n = String(b.name || "").trim();
        if (!n) return reply.code(400).send({ error: "name_required" });
        data.name = n;
      }

      if (b.organizationId !== undefined) {
        if (b.organizationId === null) {
          data.organizationId = null;
        } else {
          const org = await prisma.organization.findFirst({
            where: { id: Number(b.organizationId), tenantId },
            select: { id: true },
          });
          if (!org) return reply.code(400).send({ error: "organization_not_in_tenant" });
          data.organizationId = Number(b.organizationId);
        }
      }

      if (b.code !== undefined) {
        if (existing.code && b.code !== existing.code) {
          return reply.code(409).send({ error: "code_immutable" });
        }
        if (!existing.code && b.code) {
          data.code = String(b.code).trim();
        } else if (!existing.code && (b.code === null || b.code === "")) {
          data.code = null;
        }
      }

      if (b.nickname !== undefined) data.nickname = b.nickname ?? null;
      if (b.species !== undefined) data.species = b.species;
      if (b.breedText !== undefined) data.breedText = b.breedText ?? null;
      if (b.notes !== undefined) data.notes = b.notes ?? null;

      // Expected litter/offspring size for capacity tracking
      if (b.expectedLitterSize !== undefined) {
        if (b.expectedLitterSize === null) {
          data.expectedLitterSize = null;
        } else {
          const size = Number(b.expectedLitterSize);
          if (!Number.isInteger(size) || size < 0) {
            return reply.code(400).send({ error: "invalid_expected_litter_size" });
          }
          data.expectedLitterSize = size;
        }
      }

      // Committed intent flag - breeder has mentally committed to this plan (PLANNING phase feature)
      if (b.isCommittedIntent !== undefined) data.isCommittedIntent = Boolean(b.isCommittedIntent);

      // Unknown date flags - for surprise pregnancies where breeder doesn't know exact dates
      if (b.cycleStartDateUnknown !== undefined) data.cycleStartDateUnknown = Boolean(b.cycleStartDateUnknown);
      if (b.ovulationDateUnknown !== undefined) data.ovulationDateUnknown = Boolean(b.ovulationDateUnknown);
      if (b.breedDateUnknown !== undefined) data.breedDateUnknown = Boolean(b.breedDateUnknown);

      // Ovulation confirmation method - can be set independently of ovulationConfirmed date
      // Both are required to advance from CYCLE phase, but can be entered in any order
      if (b.ovulationConfirmedMethod !== undefined) data.ovulationConfirmedMethod = b.ovulationConfirmedMethod ?? null;

      const targetSpecies = (b.species ?? existing.species) as string;
      if (b.damId !== undefined) {
        // Allow null to clear dam (only valid in PLANNING status - enforced at commit)
        if (b.damId === null) {
          data.damId = null;
        } else {
          const damId = idNum(b.damId);
          if (!damId) return reply.code(400).send({ error: "bad_damId" });
          const dam = await prisma.animal.findFirst({
            where: { id: damId, tenantId },
            select: { species: true, sex: true },
          });
          if (!dam) return reply.code(400).send({ error: "dam_not_found" });
          if (String(dam.species) !== String(targetSpecies)) return reply.code(400).send({ error: "dam_species_mismatch" });
          if (String(dam.sex) !== "FEMALE") return reply.code(400).send({ error: "dam_sex_mismatch" });
          data.damId = damId;
        }
      }
      if (b.sireId !== undefined) {
        if (b.sireId === null) data.sireId = null;
        else {
          const sireId = idNum(b.sireId);
          if (!sireId) return reply.code(400).send({ error: "bad_sireId" });
          const sire = await prisma.animal.findFirst({
            where: { id: sireId, tenantId },
            select: { species: true, sex: true },
          });
          if (!sire) return reply.code(400).send({ error: "sire_not_found" });
          if (String(sire.species) !== String(targetSpecies)) return reply.code(400).send({ error: "sire_species_mismatch" });
          if (String(sire.sex) !== "MALE") return reply.code(400).send({ error: "sire_sex_mismatch" });
          data.sireId = sireId;
        }
      }

      // Prevent changing dam if there are existing breeding attempts or follicle exams for a different dam
      if (data.damId !== undefined && existing.damId && data.damId !== existing.damId) {
        // Check for breeding attempts linked to this plan with the old dam
        const existingAttempts = await prisma.breedingAttempt.count({
          where: { planId: id, damId: existing.damId },
        });
        if (existingAttempts > 0) {
          return reply.code(409).send({
            error: "dam_change_blocked_by_attempts",
            message: `Cannot change dam: ${existingAttempts} breeding attempt(s) recorded for this plan. Delete the attempts first or create a new plan.`,
          });
        }

        // Check for follicle exams linked to this plan for the old dam
        const existingExams = await prisma.testResult.count({
          where: { planId: id, animalId: existing.damId, kind: "FOLLICLE_EXAM" },
        });
        if (existingExams > 0) {
          return reply.code(409).send({
            error: "dam_change_blocked_by_exams",
            message: `Cannot change dam: ${existingExams} follicle exam(s) recorded for this plan. Delete the exams first or create a new plan.`,
          });
        }
      }

      // Prevent changing sire if there are existing breeding attempts for a different sire
      if (data.sireId !== undefined && existing.sireId && data.sireId !== existing.sireId) {
        const existingAttempts = await prisma.breedingAttempt.count({
          where: { planId: id, sireId: existing.sireId },
        });
        if (existingAttempts > 0) {
          return reply.code(409).send({
            error: "sire_change_blocked_by_attempts",
            message: `Cannot change sire: ${existingAttempts} breeding attempt(s) recorded for this plan. Delete the attempts first or create a new plan.`,
          });
        }
      }

      const dateKeys = [
        "lockedCycleStart",
        "lockedOvulationDate",
        "lockedDueDate",
        "lockedPlacementStartDate",
        "expectedCycleStart",
        "expectedHormoneTestingStart",
        "expectedBreedDate",
        "expectedBirthDate",
        "expectedPlacementStart",
        "expectedWeaned",
        "expectedPlacementCompleted",
        "cycleStartObserved",
        "ovulationConfirmed",
        "cycleStartDateActual",
        "hormoneTestingStartDateActual",
        "breedDateActual",
        "birthDateActual",
        "weanedDateActual",
        "placementStartDateActual",
        "placementCompletedDateActual",
        "completedDateActual",
      ] as const;

      for (const k of dateKeys) {
        if (b[k] !== undefined) (data as any)[k] = b[k] ? new Date(b[k]) : null;
      }

      // Fetch existing plan dates once for all validations
      const existingPlanDates = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          cycleStartDateActual: true,
          hormoneTestingStartDateActual: true,
          breedDateActual: true,
          birthDateActual: true,
          weanedDateActual: true,
          placementStartDateActual: true,
          placementCompletedDateActual: true,
        },
      });

      // Determine if birthDateActual will remain set after this update
      const birthDateWillBeSet = b.birthDateActual !== null &&
        (b.birthDateActual !== undefined || existingPlanDates?.birthDateActual);

      // ═══════════════════════════════════════════════════════════════════════════
      // BUSINESS RULE: Birth Date Actual is a "LOCK POINT"
      // Once birthDateActual is recorded, ALL upstream dates become immutable.
      // This protects the integrity of the breeding record - birth is a real-world
      // event that validates the entire upstream breeding history.
      // ═══════════════════════════════════════════════════════════════════════════

      const UPSTREAM_DATE_FIELDS = [
        "cycleStartDateActual",
        "hormoneTestingStartDateActual",
        "breedDateActual",
      ] as const;

      if (birthDateWillBeSet) {
        // Check if any upstream date is being cleared
        for (const field of UPSTREAM_DATE_FIELDS) {
          if (b[field] === null && (existingPlanDates as any)?.[field]) {
            return reply.code(400).send({
              error: "upstream_dates_locked_by_birth",
              detail: `Cannot clear ${field} because the actual birth date has been recorded. Once birth occurs, the breeding history is locked to preserve data integrity for lineage and genetics tracking.`,
            });
          }
        }

        // Check if any upstream date is being modified (changed to a different value)
        for (const field of UPSTREAM_DATE_FIELDS) {
          const existingValue = (existingPlanDates as any)?.[field];
          const newValue = b[field];
          if (existingValue && newValue !== undefined && newValue !== null) {
            const existingDate = new Date(existingValue).toISOString().slice(0, 10);
            const newDate = new Date(newValue).toISOString().slice(0, 10);
            if (existingDate !== newDate) {
              return reply.code(400).send({
                error: "upstream_dates_locked_by_birth",
                detail: `Cannot modify ${field} because the actual birth date has been recorded. Once birth occurs, the breeding history is locked to preserve data integrity for lineage and genetics tracking.`,
              });
            }
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // BUSINESS RULE: Cannot clear date if downstream date is recorded
      // Each date in the breeding timeline depends on previous dates existing
      // ═══════════════════════════════════════════════════════════════════════════

      // Cannot clear cycleStartDateActual if breedDateActual is set
      if (b.cycleStartDateActual === null) {
        const breedDateWillExist = b.breedDateActual !== null &&
          (b.breedDateActual !== undefined || existingPlanDates?.breedDateActual);
        if (breedDateWillExist) {
          return reply.code(400).send({
            error: "cannot_clear_date_with_downstream_date",
            detail: "Cannot clear the actual cycle start date because the actual breeding date is recorded. Clear the downstream date first.",
          });
        }
      }

      // Cannot clear breedDateActual if birthDateActual is set
      if (b.breedDateActual === null) {
        const birthDateWillExist = b.birthDateActual !== null &&
          (b.birthDateActual !== undefined || existingPlanDates?.birthDateActual);
        if (birthDateWillExist) {
          return reply.code(400).send({
            error: "cannot_clear_date_with_downstream_date",
            detail: "Cannot clear the actual breeding date because the actual birth date is recorded. Clear the downstream date first.",
          });
        }
      }

      // BUSINESS RULE: Cannot clear birthDateActual if offspring exist in linked offspring group
      if (b.birthDateActual === null) {
        const linkedGroup = await prisma.offspringGroup.findFirst({
          where: { planId: id, tenantId },
          select: { id: true },
        });
        if (linkedGroup) {
          // Check for offspring in the Animal table (legacy)
          const animalCount = await prisma.animal.count({
            where: { tenantId, offspringGroupId: linkedGroup.id },
          });
          // Check for offspring in the Offspring table
          const offspringCount = await prisma.offspring.count({
            where: { tenantId, groupId: linkedGroup.id },
          });
          if (animalCount > 0 || offspringCount > 0) {
            return reply.code(400).send({
              error: "cannot_clear_birth_date_with_offspring",
              detail: "Cannot clear the actual birth date because offspring have already been added to the linked offspring group. Remove all offspring first before clearing this date.",
            });
          }
        }
      }

      // BUSINESS RULE: Cannot clear weanedDateActual if placementStartDateActual is set
      if (b.weanedDateActual === null) {
        const placementStartWillBeSet = b.placementStartDateActual !== null &&
          (b.placementStartDateActual !== undefined || existingPlanDates?.placementStartDateActual);
        if (placementStartWillBeSet) {
          return reply.code(400).send({
            error: "cannot_clear_date_with_downstream_date",
            detail: "Cannot clear the actual weaned date because the actual placement start date is recorded. Clear the placement start date first.",
          });
        }
      }

      // BUSINESS RULE: Cannot clear placementStartDateActual if placementCompletedDateActual is set
      if (b.placementStartDateActual === null) {
        const placementCompletedWillBeSet = b.placementCompletedDateActual !== null &&
          (b.placementCompletedDateActual !== undefined || existingPlanDates?.placementCompletedDateActual);
        if (placementCompletedWillBeSet) {
          return reply.code(400).send({
            error: "cannot_clear_date_with_downstream_date",
            detail: "Cannot clear the actual placement start date because the actual placement completed date is recorded. Clear the placement completed date first.",
          });
        }
      }

      if (b.status !== undefined) {
        const s = normalizePlanStatus(b.status);
        if (!s) return reply.code(400).send({ error: "bad_status" });

        // VALIDATION: Ensure required dates are present when advancing to certain phases
        // Merge existing data with incoming data to check effective values
        // Use undefined as fallback when date not in payload, so we fall back to existingPlan values
        const effectiveCycleStart = data.cycleStartDateActual !== undefined
          ? data.cycleStartDateActual
          : (b.cycleStartDateActual !== undefined ? (b.cycleStartDateActual ? new Date(b.cycleStartDateActual) : null) : undefined);
        const effectiveBreedDate = data.breedDateActual !== undefined
          ? data.breedDateActual
          : (b.breedDateActual !== undefined ? (b.breedDateActual ? new Date(b.breedDateActual) : null) : undefined);
        const effectiveBirthDate = data.birthDateActual !== undefined
          ? data.birthDateActual
          : (b.birthDateActual !== undefined ? (b.birthDateActual ? new Date(b.birthDateActual) : null) : undefined);
        const effectiveWeanedDate = data.weanedDateActual !== undefined
          ? data.weanedDateActual
          : (b.weanedDateActual !== undefined ? (b.weanedDateActual ? new Date(b.weanedDateActual) : null) : undefined);
        const effectivePlacementStart = data.placementStartDateActual !== undefined
          ? data.placementStartDateActual
          : (b.placementStartDateActual !== undefined ? (b.placementStartDateActual ? new Date(b.placementStartDateActual) : null) : undefined);
        const effectivePlacementCompleted = data.placementCompletedDateActual !== undefined
          ? data.placementCompletedDateActual
          : (b.placementCompletedDateActual !== undefined ? (b.placementCompletedDateActual ? new Date(b.placementCompletedDateActual) : null) : undefined);

        // For status transitions, we need to check existing DB values too
        const existingPlan = await prisma.breedingPlan.findFirst({
          where: { id, tenantId },
          select: {
            cycleStartDateActual: true,
            breedDateActual: true,
            birthDateActual: true,
            weanedDateActual: true,
            placementStartDateActual: true,
            placementCompletedDateActual: true,
            ovulationConfirmed: true,
            reproAnchorMode: true,
          },
        });

        // Use undefined check instead of ?? so explicit null values are preserved
        // (null ?? x returns x, but we want null to mean "clear this date")
        const finalCycleStart = effectiveCycleStart !== undefined ? effectiveCycleStart : existingPlan?.cycleStartDateActual;
        const finalBreedDate = effectiveBreedDate !== undefined ? effectiveBreedDate : existingPlan?.breedDateActual;
        const finalBirthDate = effectiveBirthDate !== undefined ? effectiveBirthDate : existingPlan?.birthDateActual;
        const finalWeanedDate = effectiveWeanedDate !== undefined ? effectiveWeanedDate : existingPlan?.weanedDateActual;
        const finalPlacementStart = effectivePlacementStart !== undefined ? effectivePlacementStart : existingPlan?.placementStartDateActual;
        const finalPlacementCompleted = effectivePlacementCompleted !== undefined ? effectivePlacementCompleted : existingPlan?.placementCompletedDateActual;
        const finalOvulationConfirmed = existingPlan?.ovulationConfirmed;
        const isOvulationAnchor = existingPlan?.reproAnchorMode === "OVULATION";

        // Validate required dates for each status
        // When using ovulation anchors, ovulation confirmed date can substitute for cycle start
        // Induced ovulators (CAT, RABBIT, ALPACA, LLAMA) skip CYCLE phase and don't require cycle data for BRED
        const hasRequiredCycleData = finalCycleStart || (isOvulationAnchor && finalOvulationConfirmed);
        const speciesIsInducedOvulator = isInducedOvulator(existing.species ?? "");
        if (s === "BRED" && !speciesIsInducedOvulator && !hasRequiredCycleData) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: isOvulationAnchor
              ? "ovulationConfirmed date is required to set status to BRED when using ovulation anchor mode"
              : "cycleStartDateActual is required to set status to BRED"
          });
        }
        if (s === "BIRTHED" && !finalBreedDate) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: "breedDateActual is required to set status to BIRTHED"
          });
        }
        if (s === "WEANED" && !finalBirthDate) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: "birthDateActual is required to set status to WEANED"
          });
        }
        if (s === "PLACEMENT" && !finalWeanedDate) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: "weanedDateActual is required to set status to PLACEMENT"
          });
        }
        if (s === "COMPLETE" && !finalPlacementCompleted) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: "placementCompletedDateActual is required to set status to COMPLETE"
          });
        }

        // BUSINESS RULE: Status regression validation
        // Define the progression order of statuses (index = progression level)
        // Note: CANCELED, UNSUCCESSFUL, ON_HOLD are terminal/semi-terminal statuses that can be set from any phase
        const STATUS_ORDER = [
          "PLANNING", "CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
          "BRED", "PREGNANT", "BIRTHED", "WEANED", "PLACEMENT", "COMPLETE"
        ];
        const TERMINAL_STATUSES = ["CANCELED", "UNSUCCESSFUL", "ON_HOLD"];
        const currentStatusIndex = STATUS_ORDER.indexOf(String(existing.status));
        const newStatusIndex = STATUS_ORDER.indexOf(s);

        // Allow transitions to terminal/semi-terminal statuses from any phase
        const isMovingToTerminal = TERMINAL_STATUSES.includes(s);
        const isCurrentlyTerminal = TERMINAL_STATUSES.includes(String(existing.status));

        // Handle resuming from ON_HOLD - can only resume to the phase that was active before hold
        // The statusBeforeHold field should be set when transitioning to ON_HOLD
        if (isCurrentlyTerminal && !isMovingToTerminal) {
          // Resuming from a terminal/semi-terminal status
          if (String(existing.status) === "ON_HOLD") {
            // ON_HOLD can resume - clear the statusBeforeHold and statusReason fields
            data.statusBeforeHold = null;
            data.statusReason = null;
            // Status validation is handled by the normal flow below
          } else {
            // CANCELED and UNSUCCESSFUL are truly terminal - cannot resume
            return reply.code(400).send({
              error: "cannot_resume_terminal_status",
              detail: `Cannot change status from ${existing.status} to ${s}. ${existing.status} is a terminal status and cannot be resumed.`,
            });
          }
        }

        // Skip regression validation when moving to terminal statuses
        // (they can be set from any phase)
        if (isMovingToTerminal) {
          // No date validation needed for terminal statuses
          data.status = s as any;

          // When moving to ON_HOLD, store the current status so we can resume
          if (s === "ON_HOLD") {
            data.statusBeforeHold = existing.status;
          }

          // Store status reason if provided
          if (b.statusReason !== undefined) {
            data.statusReason = b.statusReason || null;
          }
        } else if (currentStatusIndex > -1 && newStatusIndex > -1 && newStatusIndex < currentStatusIndex) {
          // Regression detected - validate data consistency

          // Cannot regress past BIRTHED if offspring exist
          if (currentStatusIndex >= STATUS_ORDER.indexOf("BIRTHED") && newStatusIndex < STATUS_ORDER.indexOf("BIRTHED")) {
            const linkedGroup = await prisma.offspringGroup.findFirst({
              where: { planId: id, tenantId },
              select: { id: true },
            });
            if (linkedGroup) {
              const animalCount = await prisma.animal.count({
                where: { tenantId, offspringGroupId: linkedGroup.id },
              });
              const offspringCount = await prisma.offspring.count({
                where: { tenantId, groupId: linkedGroup.id },
              });
              if (animalCount > 0 || offspringCount > 0) {
                return reply.code(400).send({
                  error: "cannot_regress_status_with_offspring",
                  detail: `Cannot change status from ${existing.status} to ${s} because offspring have already been added. Remove all offspring first before regressing the plan status.`,
                });
              }
            }
          }

          // Cannot regress if the status has corresponding actual dates recorded
          // E.g., cannot go back to BRED if birthDateActual is still set
          if (newStatusIndex < STATUS_ORDER.indexOf("BIRTHED") && finalBirthDate) {
            return reply.code(400).send({
              error: "cannot_regress_status_with_date",
              detail: `Cannot change status to ${s} while birthDateActual is recorded. Clear the birth date first.`,
            });
          }
          if (newStatusIndex < STATUS_ORDER.indexOf("WEANED") && finalWeanedDate) {
            return reply.code(400).send({
              error: "cannot_regress_status_with_date",
              detail: `Cannot change status to ${s} while weanedDateActual is recorded. Clear the weaned date first.`,
            });
          }
          if (newStatusIndex < STATUS_ORDER.indexOf("PLACEMENT") && finalPlacementStart) {
            return reply.code(400).send({
              error: "cannot_regress_status_with_date",
              detail: `Cannot change status to ${s} while placementStartDateActual is recorded. Clear the placement start date first.`,
            });
          }
          if (newStatusIndex < STATUS_ORDER.indexOf("COMPLETE") && finalPlacementCompleted) {
            return reply.code(400).send({
              error: "cannot_regress_status_with_date",
              detail: `Cannot change status to ${s} while placementCompletedDateActual is recorded. Clear the placement completed date first.`,
            });
          }
        }

        data.status = s as any;
      }

      const passthrough = [
        "breedText",
        "lockedCycleKey",
        "notes",
        "depositsCommittedCents",
        "depositsPaidCents",
        "depositRiskScore",
        "archived",
      ];
      for (const k of passthrough) if (b[k] !== undefined) (data as any)[k] = b[k];

      // Handle programId updates (links plan to a BreedingProgram for marketplace)
      if (b.programId !== undefined) {
        if (b.programId === null) {
          // Allow unlinking from a program
          data.programId = null;
        } else {
          // Validate program exists and belongs to tenant
          const program = await prisma.mktListingBreedingProgram.findFirst({
            where: { id: Number(b.programId), tenantId },
            select: { id: true },
          });
          if (!program) return reply.code(400).send({ error: "program_not_found" });
          data.programId = Number(b.programId);
        }
      }

      try {
        const lockNorm = validateAndNormalizeLockPayload(b);
        if (lockNorm.touched) {
          data.lockedCycleStart = lockNorm.lockedCycleStart;
          data.lockedOvulationDate = lockNorm.lockedOvulationDate;
          data.lockedDueDate = lockNorm.lockedDueDate;
          data.lockedPlacementStartDate = lockNorm.lockedPlacementStartDate;

          if (lockNorm.lockedDueDate === null && lockNorm.lockedPlacementStartDate === null) {
            data.expectedBirthDate = null;
            data.expectedPlacementStart = null;
            data.expectedWeaned = null;
            data.expectedPlacementCompleted = null;
          } else {
            if (!b.hasOwnProperty("expectedBirthDate")) data.expectedBirthDate = lockNorm.lockedDueDate;
            if (!b.hasOwnProperty("expectedPlacementStart"))
              data.expectedPlacementStart = lockNorm.lockedPlacementStartDate;
            // Safeguard: preserve expectedWeaned and expectedPlacementCompleted unless explicitly provided
            if (!b.hasOwnProperty("expectedWeaned") && !b.hasOwnProperty("expectedPlacementCompleted")) {
              // Don't modify these fields if not explicitly provided in update payload
              delete (data as any).expectedWeaned;
              delete (data as any).expectedPlacementCompleted;
            }
          }
        }
      } catch (e) {
        const { status, payload } = errorReply(e);
        return reply.status(status).send(payload);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // IMMUTABILITY VALIDATION (Phase 1.4 of anchor mode spec)
      // Validates that fields can be modified based on current status
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        validateImmutability(existing, b);
      } catch (err) {
        if (err instanceof ImmutabilityError) {
          return reply.code(400).send({
            error: "immutable_field",
            field: err.field,
            detail: err.message,
          });
        }
        throw err;
      }

      // Track dam/sire changes for status sync
      const damChanged = data.damId !== undefined;
      const sireChanged = data.sireId !== undefined;
      const statusChanged = data.status !== undefined;

      const updated = await prisma.breedingPlan.update({ where: { id }, data });

      // Sync animal breeding statuses if dam, sire, or plan status changed
      if (damChanged || sireChanged || statusChanged) {
        // If dam changed, sync both old and new dam
        if (damChanged) {
          await syncAnimalChangeOnPlan(existing.damId ?? null, data.damId ?? null, tenantId);
        }

        // If sire changed, sync both old and new sire
        if (sireChanged) {
          await syncAnimalChangeOnPlan(existing.sireId ?? null, data.sireId ?? null, tenantId);
        }

        // If status changed (but not dam/sire), sync current dam and sire
        if (statusChanged && !damChanged && !sireChanged) {
          await syncPlanAnimalsBreedingStatus(id, tenantId);
        }
      }

      // Ensure offspring group exists when plan reaches BRED status
      // This is when breeding has actually occurred and offspring are expected
      const isBredStatus = String(updated.status) === "BRED";
      if (isBredStatus) {
        try {
          const ogSvc = __makeOffspringGroupsService({ prisma, authorizer: __og_authorizer });
          await ogSvc.ensureGroupForBredPlan({
            tenantId,
            planId: id,
            actorId: (req as any).user?.id ?? "system",
          });
        } catch (ogErr) {
          // Log but don't fail the update - offspring group creation is secondary
          req.log?.warn?.({ err: ogErr, planId: id }, "Failed to ensure offspring group for bred plan");
        }
      }

      // Delete offspring group when plan status changes to terminal state or resets to CYCLE
      // These actions indicate the breeding attempt is over and the offspring group is no longer relevant
      const isTerminalOrReset = ["UNSUCCESSFUL", "CANCELED", "CYCLE"].includes(String(updated.status));
      if (isTerminalOrReset && statusChanged) {
        try {
          const group = await prisma.offspringGroup.findFirst({
            where: { tenantId, planId: id },
            select: { id: true },
          });
          if (group) {
            // Delete events first (foreign key constraint)
            await prisma.offspringGroupEvent.deleteMany({
              where: { tenantId, offspringGroupId: group.id },
            });
            // Delete the group
            await prisma.offspringGroup.delete({
              where: { id: group.id },
            });
            req.log?.info?.({ planId: id, groupId: group.id }, "Deleted offspring group due to plan status change");
          }
        } catch (ogErr) {
          // Log but don't fail the update
          req.log?.warn?.({ err: ogErr, planId: id }, "Failed to delete offspring group on status change");
        }
      }

      // Check for carrier × carrier lethal pairings when dam or sire changes
      let carrierRisk: { hasLethalRisk: boolean; hasWarnings: boolean; warnings: any[] } | null = null;
      if ((damChanged || sireChanged) && updated.damId && updated.sireId) {
        const userId = (req as any).user?.id ?? null;
        carrierRisk = await checkBreedingPlanCarrierRisk(prisma, updated.id, tenantId, userId, true);
      }

      reply.send({
        ...updated,
        carrierWarnings: carrierRisk?.warnings ?? [],
        hasLethalRisk: carrierRisk?.hasLethalRisk ?? false,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/commit", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as Partial<{ codeHint: string; actorId: string }>;

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          code: true,
          status: true,
          damId: true,
          sireId: true,
          // Anchor mode system fields
          reproAnchorMode: true,
          ovulationConfirmed: true,
          cycleStartObserved: true,
          dateConfidenceLevel: true,
          // Legacy locked fields
          lockedCycleStart: true,
          lockedOvulationDate: true,
          lockedDueDate: true,
          lockedPlacementStartDate: true,
          expectedBirthDate: true,
          expectedPlacementStart: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      const terminal = new Set<string>([
        "CYCLE",       // New: renamed from COMMITTED
        "COMMITTED",   // Deprecated: kept for backward compatibility
        "BRED",
        "PREGNANT",
        "BIRTHED",
        "WEANED",
        "PLACEMENT",
        "COMPLETE",
        "CANCELED",
        "UNSUCCESSFUL",
        "ON_HOLD",
      ]);
      if (terminal.has(String(plan.status))) {
        return reply.code(409).send({ error: "already_in_terminal_state" });
      }

      if (!plan.damId || !plan.sireId) {
        return reply.code(400).send({ error: "dam_sire_required" });
      }

      // Validate locked dates - anchor mode system populates all of these via /lock endpoint
      const missingLock: string[] = [];
      if (!plan.lockedCycleStart) missingLock.push("lockedCycleStart");
      if (!plan.lockedOvulationDate) missingLock.push("lockedOvulationDate");
      if (!plan.lockedDueDate) missingLock.push("lockedDueDate");
      if (!plan.lockedPlacementStartDate) missingLock.push("lockedPlacementStartDate");
      if (missingLock.length) {
        return reply.code(400).send({
          error: "full_lock_required",
          detail: `Commit requires a locked cycle with all fields present. Use POST /breeding/plans/:id/lock to lock the plan first. Missing: ${missingLock.join(", ")}`,
        });
      }

      const userId = (req as any).user?.id ?? null;

      const result = await prisma.$transaction(async (tx) => {
        // build final code and expected dates
        let code = plan.code;
        if (!code) code = await buildFriendlyPlanCode(plan.tenantId, plan.id);
        const expectedBirthDate = plan.expectedBirthDate ?? plan.lockedDueDate ?? null;
        const expectedPlacementStart = plan.expectedPlacementStart ?? plan.lockedPlacementStartDate ?? null;

        const saved = await tx.breedingPlan.update({
          where: { id: plan.id },
          data: {
            code,
            status: BreedingPlanStatus.CYCLE,
            expectedBirthDate,
            expectedPlacementStart,
            committedAt: new Date(),
            committedByUserId: userId,
          },
        });

        await tx.breedingPlanEvent.create({
          data: {
            tenantId: plan.tenantId,
            planId: plan.id,
            type: "PLAN_CYCLE_STARTED",
            occurredAt: new Date(),
            label: "Plan cycle started",
            data: {
              code,
              fromStatus: String(plan.status),
              // Anchor mode system data
              anchorMode: plan.reproAnchorMode ?? "CYCLE_START",
              confidenceLevel: plan.dateConfidenceLevel ?? "MEDIUM",
              ovulationConfirmed: plan.ovulationConfirmed,
              cycleStartObserved: plan.cycleStartObserved,
              // Legacy locked dates
              lockedCycleStart: plan.lockedCycleStart,
              lockedOvulationDate: plan.lockedOvulationDate,
              lockedDueDate: plan.lockedDueDate,
              lockedPlacementStartDate: plan.lockedPlacementStartDate,
              expectedBirthDate,
              expectedPlacementStart,
            },
            recordedByUserId: userId,
          },
        });

        // NOTE: Offspring group creation has been moved to BRED phase (when breedDateActual is set)
        // This commit endpoint only locks the cycle timeline; offspring groups are created when breeding occurs

        // Sync animal breeding statuses for dam and sire
        if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId, tx);
        if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId, tx);

        return saved;
      });

      return reply.send(result);
    } catch (err) {
      req.log.error({ err }, "commit failed");
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/uncommit", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as Partial<{ actorId: string }>;
      const userId = (req as any).user?.id ?? null;

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          damId: true,
          sireId: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Only allow uncommit if status is CYCLE (or deprecated COMMITTED)
      const planStatus = String(plan.status);
      if (planStatus !== "CYCLE" && planStatus !== "COMMITTED") {
        return reply.code(409).send({
          error: "not_in_cycle",
          detail: `Plan must be in CYCLE status to uncommit. Current status: ${plan.status}`
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Check for linked offspring group
        const group = await tx.offspringGroup.findFirst({
          where: { tenantId, planId: plan.id },
          select: { id: true },
        });

        if (group) {
          // Check for blockers in the offspring group
          const blockers: any = {};

          // Check for offspring
          try {
            const offspringCount = await tx.animal.count({
              where: { tenantId, offspringGroupId: group.id },
            });
            if (offspringCount > 0) blockers.hasOffspring = true;
          } catch (e) {
            // Field may not exist, skip this check
          }

          // Check for buyers (via waitlist/reservations)
          // Try both litterId (old) and offspringGroupId (new) for compatibility
          try {
            const buyersCount = await tx.waitlistEntry.count({
              where: {
                tenantId,
                OR: [
                  { offspringGroupId: group.id },
                  { planId: plan.id },
                ]
              },
            });
            if (buyersCount > 0) blockers.hasBuyers = true;
          } catch (e) {
            // Table or field may not exist, skip this check
          }

          // If any blockers exist, return 409
          if (Object.keys(blockers).length > 0) {
            return { blocked: true, blockers };
          }

          // No blockers - safe to delete the group
          try {
            await tx.offspringGroupEvent.deleteMany({
              where: { tenantId, offspringGroupId: group.id },
            });
          } catch (e) {
            // Events may not exist, continue
          }

          await tx.offspringGroup.delete({
            where: { id: group.id },
          });
        }

        // Revert plan to PLANNING status
        const updated = await tx.breedingPlan.update({
          where: { id: plan.id },
          data: {
            status: BreedingPlanStatus.PLANNING,
            committedAt: null,
            committedByUserId: null,
          },
        });

        // Create event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId: plan.tenantId,
            planId: plan.id,
            type: "PLAN_UNCOMMITTED",
            occurredAt: new Date(),
            label: "Plan uncommitted",
            data: {
              fromStatus: String(plan.status),
              deletedGroupId: group?.id ?? null,
            },
            recordedByUserId: userId,
          },
        });

        return { blocked: false, plan: updated, damId: plan.damId, sireId: plan.sireId };
      });

      if (result.blocked) {
        return reply.code(409).send({ blockers: result.blockers });
      }

      // Sync animal breeding statuses after uncommit (they may revert from BREEDING)
      // Note: We need to get damId/sireId from before the plan status changed
      const planForSync = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { damId: true, sireId: true },
      });
      if (planForSync?.damId) await syncAnimalBreedingStatus(planForSync.damId, tenantId);
      if (planForSync?.sireId) await syncAnimalBreedingStatus(planForSync.sireId, tenantId);

      reply.send({ ok: true });
    } catch (err) {
      req.log.error({ err }, "uncommit failed");
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────────────────── Phase Rewind Endpoint ───────────────────────── */

  /**
   * POST /breeding/plans/:id/rewind
   *
   * Rewinds a breeding plan back one phase by clearing the date(s) that
   * advanced it to the current phase. Includes validation to prevent
   * data integrity issues (e.g., can't rewind past birth if offspring exist).
   *
   * Body:
   * - actorId?: string (for audit trail)
   *
   * Returns:
   * - { ok: true, fromPhase, toPhase } on success
   * - 400 with error code if validation fails
   * - 409 with blockers if blocked by downstream data
   */
  app.post("/breeding/plans/:id/rewind", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as Partial<{ actorId: string }>;
      const userId = (req as any).user?.id ?? null;

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          damId: true,
          sireId: true,
          // Lock fields (CYCLE phase)
          lockedCycleStart: true,
          lockedOvulationDate: true,
          lockedDueDate: true,
          lockedPlacementStartDate: true,
          committedAt: true,
          committedByUserId: true,
          ovulationConfirmed: true,
          ovulationConfirmedMethod: true,
          // Actual dates
          cycleStartDateActual: true,
          hormoneTestingStartDateActual: true,
          breedDateActual: true,
          birthDateActual: true,
          weanedDateActual: true,
          placementStartDateActual: true,
          placementCompletedDateActual: true,
          completedDateActual: true,
          // Unknown flags
          cycleStartDateUnknown: true,
          ovulationDateUnknown: true,
          breedDateUnknown: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Determine current phase based on dates (working backward from most advanced)
      // Phase order: PLANNING -> CYCLE -> BRED -> BIRTHED -> WEANED -> PLACEMENT_STARTED -> PLACEMENT_COMPLETED -> COMPLETE
      //
      // The phase represents where the plan currently IS (what milestone has been reached):
      // - PLANNING: Basic info only, not yet committed
      // - CYCLE: Plan is committed (locked dates), waiting for cycle start actual
      // - BRED: Cycle start actual entered, waiting for breed date actual
      // - BIRTHED: Breed date actual entered, waiting for birth date actual
      // - WEANED: Birth date actual entered, waiting for weaned date actual
      // - PLACEMENT_STARTED: Weaned date entered, waiting for placement start date
      // - PLACEMENT_COMPLETED: Placement start date entered, waiting for placement completed
      // - COMPLETE: All dates recorded, plan is complete
      //
      // Note: Unknown flags (cycleStartDateUnknown, breedDateUnknown) act as placeholders
      // that allow advancing without the actual date (for surprise pregnancies)
      type Phase = "PLANNING" | "CYCLE" | "BRED" | "BIRTHED" | "WEANED" | "PLACEMENT_STARTED" | "PLACEMENT_COMPLETED" | "COMPLETE";
      const PHASE_ORDER: Phase[] = ["PLANNING", "CYCLE", "BRED", "BIRTHED", "WEANED", "PLACEMENT_STARTED", "PLACEMENT_COMPLETED", "COMPLETE"];

      const derivePhaseFromDates = (): Phase => {
        // Work backward from most advanced phase
        // Each check asks: "Has this milestone been completed?" If yes, we're in the NEXT phase
        // Phase names represent what task you're working on, not what you've completed
        if (plan.completedDateActual && plan.placementCompletedDateActual) return "COMPLETE";
        if (plan.placementCompletedDateActual) return "COMPLETE"; // Has placement completed, working on plan completion
        if (plan.placementStartDateActual) return "PLACEMENT_COMPLETED"; // Has placement start, working on placement completed
        if (plan.weanedDateActual) return "PLACEMENT_STARTED"; // Has weaned, working on placement start
        if (plan.birthDateActual) return "WEANED"; // Has birth, working on weaned date
        // Has breed date (or unknown), working on birth date → BIRTHED phase
        if (plan.breedDateActual || plan.breedDateUnknown) return "BIRTHED";
        // Has cycle start (or unknown), working on breed date → BRED phase
        // For ovulation-anchored plans: status=BRED means we advanced via ovulation (cycle start may be null)
        if (plan.cycleStartDateActual || plan.cycleStartDateUnknown) return "BRED";
        // Check if plan was advanced to BRED via ovulation confirmation (ovulation-anchored workflow)
        // In this case, cycleStartDateActual may be null but status is BRED
        if (String(plan.status) === "BRED" && plan.ovulationConfirmed) return "BRED";
        // Plan is committed/locked (via cycle start lock OR ovulation confirmation), working on cycle start actual → CYCLE phase
        if (plan.lockedCycleStart || plan.lockedOvulationDate || plan.ovulationConfirmed) return "CYCLE";
        return "PLANNING";
      };

      const derivedPhase = derivePhaseFromDates();
      let storedStatus = String(plan.status) as Phase;

      // Map database PLACEMENT status to frontend PLACEMENT_STARTED or PLACEMENT_COMPLETED
      // The database uses a single PLACEMENT status, but we differentiate by dates
      if (storedStatus === ("PLACEMENT" as Phase)) {
        // If placementStartDateActual exists, we're in PLACEMENT_COMPLETED (working on completed date)
        // Otherwise, we're in PLACEMENT_STARTED (working on start date)
        storedStatus = plan.placementStartDateActual ? "PLACEMENT_COMPLETED" : "PLACEMENT_STARTED";
      }

      // Use the stored status as the authoritative phase for rewind purposes.
      // The derived phase tells us what dates have been entered, but the user may not have
      // explicitly advanced yet (e.g., entered breed date but still in BRED status).
      // Rewind should respect where the user actually IS (stored status), not where they
      // COULD be based on entered data.
      // However, if derived phase is LESS than stored status, use derived (data was cleared somehow).
      const storedIdx = PHASE_ORDER.indexOf(storedStatus);
      const derivedIdx = PHASE_ORDER.indexOf(derivedPhase);
      const currentPhase = storedIdx >= 0 && storedIdx <= derivedIdx ? storedStatus : derivedPhase;

      // Cannot rewind from PLANNING - nothing to rewind
      if (currentPhase === "PLANNING") {
        return reply.code(400).send({
          error: "cannot_rewind_planning",
          detail: "Plan is already in PLANNING phase. Nothing to rewind.",
        });
      }

      // Define what each rewind operation clears and its target phase
      const rewindConfig: Record<Phase, {
        targetPhase: Phase;
        clearFields: Record<string, null | false | string | BreedingPlanStatus>;
        validation?: () => Promise<{ blocked: boolean; error?: string; detail?: string; blockers?: any }>;
      } | null> = {
        PLANNING: null, // Can't rewind from PLANNING

        CYCLE: {
          // Rewind CYCLE -> PLANNING: Clear lock fields, reset anchor mode, delete offspring group if exists
          targetPhase: "PLANNING",
          clearFields: {
            lockedCycleStart: null,
            lockedOvulationDate: null,
            lockedDueDate: null,
            lockedPlacementStartDate: null,
            committedAt: null,
            committedByUserId: null,
            ovulationConfirmed: null,
            ovulationConfirmedMethod: null,
            // Reset anchor mode back to default - breeder must re-enable ovulation anchors if desired
            reproAnchorMode: "CYCLE_START",
            primaryAnchor: "CYCLE_START",
            dateConfidenceLevel: null,
            dateSourceNotes: null,
            // Clear all downstream actual dates in case they were entered ahead of status
            cycleStartDateActual: null,
            cycleStartDateUnknown: false,
            hormoneTestingStartDateActual: null,
            ovulationDateUnknown: false,
            breedDateActual: null,
            breedDateUnknown: false,
            birthDateActual: null,
            weanedDateActual: null,
            placementStartDateActual: null,
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.PLANNING,
          },
          validation: async () => {
            // Check for offspring group blockers (same as uncommit)
            const group = await prisma.offspringGroup.findFirst({
              where: { tenantId, planId: plan.id },
              select: { id: true },
            });
            if (group) {
              const blockers: any = {};
              const offspringCount = await prisma.animal.count({
                where: { tenantId, offspringGroupId: group.id },
              });
              if (offspringCount > 0) blockers.hasOffspring = true;

              try {
                const buyersCount = await prisma.waitlistEntry.count({
                  where: {
                    tenantId,
                    OR: [{ offspringGroupId: group.id }, { planId: plan.id }],
                  },
                });
                if (buyersCount > 0) blockers.hasBuyers = true;
              } catch (e) {
                // Table may not exist
              }

              if (Object.keys(blockers).length > 0) {
                return { blocked: true, blockers };
              }
            }
            return { blocked: false };
          },
        },

        BRED: {
          // Rewind BRED -> CYCLE: Clear cycle start date and/or ovulation data that advanced us to BRED
          // BRED phase = has cycle start OR ovulation confirmed, working on breed date
          // Also clear any breed date that may have been entered but not yet advanced
          // NOTE: Offspring group is NOT deleted here - only when rewinding all the way to PLANNING
          // This allows user to continue with the plan and use the existing offspring group
          targetPhase: "CYCLE",
          clearFields: {
            cycleStartDateActual: null,
            hormoneTestingStartDateActual: null,
            cycleStartDateUnknown: false,
            ovulationDateUnknown: false,
            breedDateActual: null, // Clear any entered breed date
            breedDateUnknown: false,
            // Clear ovulation anchor data (plan may have been advanced via ovulation confirmation)
            ovulationConfirmed: null,
            ovulationConfirmedMethod: null,
            ovulationConfidence: null,
            ovulationTestResultId: null,
            // Reset anchor mode back to CYCLE_START - breeder must re-enable ovulation anchors if desired
            reproAnchorMode: "CYCLE_START",
            primaryAnchor: "CYCLE_START",
            dateConfidenceLevel: null,
            dateSourceNotes: null,
            // Clear downstream dates in case they were entered ahead of status
            birthDateActual: null,
            weanedDateActual: null,
            placementStartDateActual: null,
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.CYCLE,
          },
        },

        BIRTHED: {
          // Rewind BIRTHED -> BRED: Clear breed date that advanced us to BIRTHED
          // BIRTHED phase = has breed date, working on birth date
          // Also clear any downstream dates that may have been entered but not yet advanced
          targetPhase: "BRED",
          clearFields: {
            breedDateActual: null,
            breedDateUnknown: false,
            // Clear downstream dates in case they were entered ahead of status
            birthDateActual: null,
            weanedDateActual: null,
            placementStartDateActual: null,
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.BRED,
          },
        },

        WEANED: {
          // Rewind WEANED -> BIRTHED: Clear birth date that advanced us to WEANED
          // WEANED phase = has birth date, working on weaned date
          // Also clear any downstream dates that may have been entered but not yet advanced
          targetPhase: "BIRTHED",
          clearFields: {
            birthDateActual: null,
            // Clear downstream dates in case they were entered ahead of status
            weanedDateActual: null,
            placementStartDateActual: null,
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.BIRTHED,
          },
          validation: async () => {
            // Cannot rewind if offspring exist in linked group
            const linkedGroup = await prisma.offspringGroup.findFirst({
              where: { planId: id, tenantId },
              select: { id: true },
            });
            if (linkedGroup) {
              const animalCount = await prisma.animal.count({
                where: { tenantId, offspringGroupId: linkedGroup.id },
              });
              const offspringCount = await prisma.offspring.count({
                where: { tenantId, groupId: linkedGroup.id },
              });
              if (animalCount > 0 || offspringCount > 0) {
                return {
                  blocked: true,
                  error: "offspring_exist",
                  detail: "Cannot rewind because offspring have been recorded in the linked offspring group. Remove all offspring first.",
                  blockers: { hasOffspring: true },
                };
              }
            }
            return { blocked: false };
          },
        },

        PLACEMENT_STARTED: {
          // Rewind PLACEMENT_STARTED -> WEANED: Clear weaned date that advanced us to PLACEMENT_STARTED
          // PLACEMENT_STARTED phase = has weaned date, working on placement start date
          // Also clear any downstream dates that may have been entered but not yet advanced
          targetPhase: "WEANED",
          clearFields: {
            weanedDateActual: null,
            // Clear downstream dates in case they were entered ahead of status
            placementStartDateActual: null,
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.WEANED,
          },
        },

        PLACEMENT_COMPLETED: {
          // Rewind PLACEMENT_COMPLETED -> PLACEMENT_STARTED: Clear placement start date that advanced us
          // PLACEMENT_COMPLETED phase = has placement start date, working on placement completed date
          // Also clear any downstream dates that may have been entered but not yet advanced
          targetPhase: "PLACEMENT_STARTED",
          clearFields: {
            placementStartDateActual: null,
            // Clear downstream dates in case they were entered ahead of status
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.PLACEMENT,
          },
        },

        COMPLETE: {
          // Rewind COMPLETE -> PLACEMENT_COMPLETED: Clear placement completed date that advanced us
          // COMPLETE phase = has placement completed date, plan is done
          targetPhase: "PLACEMENT_COMPLETED",
          clearFields: {
            placementCompletedDateActual: null,
            completedDateActual: null,
            status: BreedingPlanStatus.PLACEMENT,
          },
        },
      };

      const config = rewindConfig[currentPhase];
      if (!config) {
        return reply.code(400).send({
          error: "cannot_rewind",
          detail: `Cannot rewind from phase: ${currentPhase}`,
        });
      }

      // Run validation if defined
      if (config.validation) {
        const validationResult = await config.validation();
        if (validationResult.blocked) {
          if (validationResult.blockers) {
            return reply.code(409).send({ blockers: validationResult.blockers });
          }
          return reply.code(400).send({
            error: validationResult.error || "validation_failed",
            detail: validationResult.detail,
          });
        }
      }

      // Execute the rewind in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Special handling: Only delete offspring group when rewinding all the way to PLANNING
        // For other rewinds, keep the group - user will likely continue with the plan
        if (currentPhase === "CYCLE") {
          const group = await tx.offspringGroup.findFirst({
            where: { tenantId, planId: plan.id },
            select: { id: true },
          });
          if (group) {
            try {
              await tx.offspringGroupEvent.deleteMany({
                where: { tenantId, offspringGroupId: group.id },
              });
            } catch (e) {
              // Events may not exist
            }
            await tx.offspringGroup.delete({
              where: { id: group.id },
            });
          }
        }

        // Update plan with cleared fields
        const updated = await tx.breedingPlan.update({
          where: { id: plan.id },
          data: config.clearFields as any,
        });

        // Create audit event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId: plan.tenantId,
            planId: plan.id,
            type: "PLAN_PHASE_REWOUND",
            occurredAt: new Date(),
            label: `Phase rewound from ${currentPhase} to ${config.targetPhase}`,
            data: {
              fromPhase: currentPhase,
              toPhase: config.targetPhase,
              clearedFields: Object.keys(config.clearFields),
            },
            recordedByUserId: userId,
          },
        });

        return { plan: updated, targetPhase: config.targetPhase };
      });

      // Sync animal breeding statuses after rewind
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      reply.send({
        ok: true,
        fromPhase: currentPhase,
        toPhase: result.targetPhase,
      });
    } catch (err) {
      req.log.error({ err }, "rewind failed");
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────────────────── Anchor Mode System Endpoints ───────────────────────── */

  /**
   * POST /breeding/plans/:id/lock
   *
   * Unified lock endpoint for the anchor mode system.
   * Locks a plan using the specified anchor mode and date.
   * Replaces separate cycle/ovulation lock methods.
   *
   * Body:
   * - anchorMode: "CYCLE_START" | "OVULATION" | "BREEDING_DATE"
   * - anchorDate: ISO date string (YYYY-MM-DD)
   * - confirmationMethod?: OvulationMethod (required for OVULATION mode)
   * - testResultId?: number (optional link to TestResult for ovulation)
   * - notes?: string
   */
  app.post("/breeding/plans/:id/lock", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as {
        anchorMode: string;
        anchorDate: string;
        confirmationMethod?: string;
        testResultId?: number;
        notes?: string;
      };

      // Validate required fields
      if (!b.anchorMode) {
        return reply.code(400).send({ error: "anchor_mode_required", detail: "anchorMode is required" });
      }
      if (!b.anchorDate) {
        return reply.code(400).send({ error: "anchor_date_required", detail: "anchorDate is required" });
      }

      // Validate anchor mode
      const anchorMode = String(b.anchorMode).toUpperCase() as ReproAnchorMode;
      if (!VALID_ANCHOR_MODES.has(anchorMode)) {
        return reply.code(400).send({
          error: "invalid_anchor_mode",
          detail: `anchorMode must be one of: ${Array.from(VALID_ANCHOR_MODES).join(", ")}`
        });
      }

      // Parse anchor date
      const anchorDate = toDateOrNull(b.anchorDate);
      if (!anchorDate) {
        return reply.code(400).send({
          error: "invalid_anchor_date",
          detail: "anchorDate must be a valid date in YYYY-MM-DD format"
        });
      }

      // Get existing plan
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          species: true,
          status: true,
          damId: true,
          sireId: true,
          reproAnchorMode: true,
          lockedCycleStart: true,
          lockedOvulationDate: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Validate: Plan must be in PLANNING status to lock (use upgrade endpoint for COMMITTED plans)
      if (String(plan.status) !== "PLANNING") {
        return reply.code(400).send({
          error: "plan_already_locked",
          detail: `Plan is in ${plan.status} status. Use /upgrade-to-ovulation to upgrade an already-locked plan.`
        });
      }

      // Validate: Dam and Sire required for locking
      if (!plan.damId || !plan.sireId) {
        return reply.code(400).send({
          error: "dam_sire_required",
          detail: "Both dam and sire must be set before locking a plan"
        });
      }

      const species = String(plan.species);

      // Species-specific anchor mode validation
      if (anchorMode === "BREEDING_DATE" && !isInducedOvulator(species)) {
        return reply.code(400).send({
          error: "invalid_anchor_for_species",
          detail: `BREEDING_DATE anchor mode is only valid for induced ovulators (CAT, RABBIT). ${species} should use CYCLE_START or OVULATION.`
        });
      }

      if (anchorMode === "OVULATION" && isInducedOvulator(species)) {
        return reply.code(400).send({
          error: "invalid_anchor_for_species",
          detail: `OVULATION anchor mode is not valid for induced ovulators. ${species} uses BREEDING_DATE (breeding triggers ovulation).`
        });
      }

      // GOAT and SHEEP don't support ovulation testing
      if (anchorMode === "OVULATION" && !supportsOvulationTesting(species)) {
        return reply.code(400).send({
          error: "ovulation_not_supported",
          detail: `OVULATION anchor mode is not available for ${species}. Commercial ovulation testing is not available for this species. Use CYCLE_START instead.`
        });
      }

      // Validate confirmation method for OVULATION mode
      let confirmationMethod: OvulationMethod | null = null;
      if (anchorMode === "OVULATION") {
        if (!b.confirmationMethod) {
          return reply.code(400).send({
            error: "confirmation_method_required",
            detail: "confirmationMethod is required when anchorMode is OVULATION"
          });
        }
        confirmationMethod = String(b.confirmationMethod).toUpperCase() as OvulationMethod;
        if (!VALID_OVULATION_METHODS.has(confirmationMethod)) {
          return reply.code(400).send({
            error: "invalid_confirmation_method",
            detail: `confirmationMethod must be one of: ${Array.from(VALID_OVULATION_METHODS).join(", ")}`
          });
        }
      }

      // Validate test result if provided
      if (b.testResultId) {
        const testResult = await prisma.testResult.findFirst({
          where: { id: Number(b.testResultId), tenantId },
          select: { id: true },
        });
        if (!testResult) {
          return reply.code(400).send({
            error: "test_result_not_found",
            detail: "Specified testResultId not found or does not belong to this tenant"
          });
        }
      }

      // Calculate all expected dates from the anchor
      const calculated = calculateExpectedDatesFromAnchor(anchorMode, anchorDate, species);

      // Determine confidence level based on anchor mode
      const confidence: ConfidenceLevel = anchorMode === "OVULATION" ? "HIGH" : "MEDIUM";

      const userId = (req as any).user?.id ?? null;

      // Build update payload
      const updateData: any = {
        // Lock the plan (change status to CYCLE)
        status: BreedingPlanStatus.CYCLE,
        committedAt: new Date(),
        committedByUserId: userId,

        // Anchor mode system fields
        reproAnchorMode: anchorMode,
        primaryAnchor: anchorMode,
        dateConfidenceLevel: confidence,
        dateSourceNotes: b.notes ?? null,

        // Set anchor-specific observed/confirmed dates
        ...(anchorMode === "CYCLE_START" && {
          cycleStartObserved: anchorDate,
          cycleStartSource: "OBSERVED",
          cycleStartConfidence: confidence,
          ovulationConfirmedMethod: "CALCULATED",
        }),

        ...(anchorMode === "OVULATION" && {
          ovulationConfirmed: anchorDate,
          ovulationConfirmedMethod: confirmationMethod,
          ovulationConfidence: "HIGH",
          ovulationTestResultId: b.testResultId ?? null,
          // Derive cycle start from ovulation (estimated)
          cycleStartObserved: calculated.cycleStart,
          cycleStartSource: "DERIVED",
          cycleStartConfidence: "MEDIUM",
        }),

        ...(anchorMode === "BREEDING_DATE" && {
          // For induced ovulators, breeding date = ovulation date
          breedDateActual: anchorDate,
          ovulationConfirmed: anchorDate,
          ovulationConfirmedMethod: "BREEDING_INDUCED",
          ovulationConfidence: "MEDIUM",
        }),

        // Locked dates (backward compatibility with existing system)
        lockedCycleStart: calculated.cycleStart,
        lockedOvulationDate: calculated.ovulation,
        lockedDueDate: calculated.dueDate,
        lockedPlacementStartDate: calculated.placementStart,

        // Expected dates
        expectedCycleStart: calculated.cycleStart,
        expectedBreedDate: calculated.ovulation,
        expectedBirthDate: calculated.dueDate,
        expectedWeaned: calculated.weanedDate,
        expectedPlacementStart: calculated.placementStart,
        expectedPlacementCompleted: calculated.placementCompleted,
      };

      // Perform update within transaction
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.breedingPlan.update({
          where: { id },
          data: updateData,
        });

        // Create audit event for anchor lock
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: `${anchorMode}_LOCKED`,
            occurredAt: new Date(),
            label: `Plan locked with ${anchorMode.toLowerCase().replace("_", " ")} anchor`,
            data: {
              anchorMode,
              anchorDate: anchorDate.toISOString().slice(0, 10),
              confirmationMethod,
              testResultId: b.testResultId ?? null,
              confidence,
              calculatedDates: {
                cycleStart: calculated.cycleStart.toISOString().slice(0, 10),
                ovulation: calculated.ovulation.toISOString().slice(0, 10),
                dueDate: calculated.dueDate.toISOString().slice(0, 10),
                weanedDate: calculated.weanedDate.toISOString().slice(0, 10),
                placementStart: calculated.placementStart.toISOString().slice(0, 10),
                placementCompleted: calculated.placementCompleted.toISOString().slice(0, 10),
              },
            },
            recordedByUserId: userId,
          },
        });

        // Create audit event for plan cycle start (status change to CYCLE)
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: "PLAN_CYCLE_STARTED",
            occurredAt: new Date(),
            label: "Plan cycle started",
            data: {
              previousStatus: "PLANNING",
              newStatus: "CYCLE",
            },
            recordedByUserId: userId,
          },
        });

        return updated;
      });

      reply.send({
        success: true,
        plan: result,
        anchorMode,
        anchorDate: anchorDate.toISOString().slice(0, 10),
        confidence,
        calculatedDates: {
          cycleStart: calculated.cycleStart.toISOString().slice(0, 10),
          ovulation: calculated.ovulation.toISOString().slice(0, 10),
          dueDate: calculated.dueDate.toISOString().slice(0, 10),
          weanedDate: calculated.weanedDate.toISOString().slice(0, 10),
          placementStart: calculated.placementStart.toISOString().slice(0, 10),
          placementCompleted: calculated.placementCompleted.toISOString().slice(0, 10),
        },
      });
    } catch (err) {
      req.log.error({ err }, "lock failed");
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /**
   * POST /breeding/plans/:id/upgrade-to-ovulation
   *
   * Progressive enhancement: upgrade from CYCLE_START to OVULATION anchor.
   * Used when breeder obtains hormone test results after initially locking with cycle start.
   *
   * Body:
   * - ovulationDate: ISO date string (YYYY-MM-DD)
   * - confirmationMethod: OvulationMethod (required)
   * - testResultId?: number (optional link to TestResult)
   * - notes?: string
   */
  app.post("/breeding/plans/:id/upgrade-to-ovulation", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as {
        ovulationDate: string;
        confirmationMethod: string;
        testResultId?: number;
        notes?: string;
      };

      // Validate required fields
      if (!b.ovulationDate) {
        return reply.code(400).send({ error: "ovulation_date_required", detail: "ovulationDate is required" });
      }

      // Parse ovulation date
      const ovulationDate = toDateOrNull(b.ovulationDate);
      if (!ovulationDate) {
        return reply.code(400).send({
          error: "invalid_ovulation_date",
          detail: "ovulationDate must be a valid date in YYYY-MM-DD format"
        });
      }

      // Validate confirmation method (required)
      if (!b.confirmationMethod) {
        return reply.code(400).send({
          error: "confirmation_method_required",
          detail: "confirmationMethod is required for ovulation confirmation"
        });
      }
      const confirmationMethod = String(b.confirmationMethod).toUpperCase() as OvulationMethod;
      if (!VALID_OVULATION_METHODS.has(confirmationMethod)) {
        return reply.code(400).send({
          error: "invalid_confirmation_method",
          detail: `confirmationMethod must be one of: ${Array.from(VALID_OVULATION_METHODS).join(", ")}`
        });
      }

      // Get existing plan with all needed fields
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          species: true,
          status: true,
          reproAnchorMode: true,
          cycleStartObserved: true,
          lockedCycleStart: true,
          ovulationConfirmed: true,
          expectedPlacementStart: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      const species = String(plan.species);

      // Validate: Can only upgrade from CYCLE_START mode
      if (plan.reproAnchorMode !== "CYCLE_START") {
        return reply.code(400).send({
          error: "cannot_upgrade",
          detail: `Plan is using ${plan.reproAnchorMode} anchor mode. Only CYCLE_START plans can be upgraded to OVULATION.`
        });
      }

      // Validate: Species must support ovulation upgrade
      if (!supportsOvulationUpgrade(species)) {
        return reply.code(400).send({
          error: "species_not_supported",
          detail: `${species} does not support ovulation upgrade. Only DOG and HORSE support this feature.`
        });
      }

      // Validate: Plan must be CYCLE or later (not PLANNING)
      if (String(plan.status) === "PLANNING") {
        return reply.code(400).send({
          error: "plan_not_locked",
          detail: "Plan must be locked (CYCLE or later) before upgrading to ovulation anchor. Use /lock endpoint first."
        });
      }

      // Validate: Cannot upgrade plans that have progressed past BRED
      const postBreedStatuses = ["BIRTHED", "WEANED", "PLACEMENT", "COMPLETE"];
      if (postBreedStatuses.includes(String(plan.status))) {
        return reply.code(400).send({
          error: "plan_too_advanced",
          detail: `Plan is in ${plan.status} status. Cannot upgrade to ovulation anchor after breeding outcome is recorded.`
        });
      }

      // Validate: Ovulation date must be after cycle start
      const cycleStart = plan.cycleStartObserved || plan.lockedCycleStart;
      if (cycleStart) {
        const cycleDate = new Date(cycleStart);
        if (ovulationDate <= cycleDate) {
          return reply.code(400).send({
            error: "invalid_ovulation_date",
            detail: "Ovulation date must be after cycle start date"
          });
        }
      }

      // Validate test result if provided
      if (b.testResultId) {
        const testResult = await prisma.testResult.findFirst({
          where: { id: Number(b.testResultId), tenantId },
          select: { id: true },
        });
        if (!testResult) {
          return reply.code(400).send({
            error: "test_result_not_found",
            detail: "Specified testResultId not found or does not belong to this tenant"
          });
        }
      }

      // Calculate new expected dates from ovulation
      const calculated = calculateExpectedDatesFromAnchor("OVULATION", ovulationDate, species);

      // Calculate variance from expected (for ML tracking)
      let actualOffset: number | null = null;
      let expectedOffset: number | null = null;
      let variance: number | null = null;

      if (cycleStart) {
        const cycleDate = new Date(cycleStart);
        actualOffset = Math.floor((ovulationDate.getTime() - cycleDate.getTime()) / (1000 * 60 * 60 * 24));
        expectedOffset = getSpeciesDefaults(species).ovulationOffsetDays;
        variance = actualOffset - expectedOffset;
      }

      // Calculate placement window shift
      let placementShift = 0;
      if (plan.expectedPlacementStart) {
        const oldPlacement = new Date(plan.expectedPlacementStart);
        placementShift = Math.abs(Math.floor((calculated.placementStart.getTime() - oldPlacement.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const userId = (req as any).user?.id ?? null;

      // Build update payload
      const updateData: any = {
        // Upgrade anchor mode
        reproAnchorMode: "OVULATION",
        primaryAnchor: "OVULATION",
        dateConfidenceLevel: "HIGH",
        dateSourceNotes: b.notes ?? null,

        // Ovulation confirmed data
        ovulationConfirmed: ovulationDate,
        ovulationConfirmedMethod: confirmationMethod,
        ovulationConfidence: "HIGH",
        ovulationTestResultId: b.testResultId ?? null,

        // Variance tracking (for ML)
        actualOvulationOffset: actualOffset,
        expectedOvulationOffset: expectedOffset,
        varianceFromExpected: variance,

        // Update locked dates
        lockedOvulationDate: ovulationDate,
        lockedDueDate: calculated.dueDate,
        lockedPlacementStartDate: calculated.placementStart,

        // Update expected dates
        expectedBreedDate: ovulationDate,
        expectedBirthDate: calculated.dueDate,
        expectedWeaned: calculated.weanedDate,
        expectedPlacementStart: calculated.placementStart,
        expectedPlacementCompleted: calculated.placementCompleted,
      };

      // Perform update within transaction
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.breedingPlan.update({
          where: { id },
          data: updateData,
        });

        // Create audit event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: "ANCHOR_UPGRADED",
            occurredAt: new Date(),
            label: "Upgraded to ovulation anchor",
            data: {
              from: "CYCLE_START",
              to: "OVULATION",
              ovulationDate: ovulationDate.toISOString().slice(0, 10),
              confirmationMethod,
              testResultId: b.testResultId ?? null,
              cycleStartDate: cycleStart ? new Date(cycleStart).toISOString().slice(0, 10) : null,
              actualOffset,
              expectedOffset,
              variance,
              placementShift,
              calculatedDates: {
                dueDate: calculated.dueDate.toISOString().slice(0, 10),
                weanedDate: calculated.weanedDate.toISOString().slice(0, 10),
                placementStart: calculated.placementStart.toISOString().slice(0, 10),
                placementCompleted: calculated.placementCompleted.toISOString().slice(0, 10),
              },
            },
            recordedByUserId: userId,
          },
        });

        return updated;
      });

      reply.send({
        success: true,
        plan: result,
        upgrade: {
          from: "CYCLE_START",
          to: "OVULATION",
        },
        ovulationDate: ovulationDate.toISOString().slice(0, 10),
        confirmationMethod,
        confidence: "HIGH",
        variance: variance !== null ? {
          actualOffset,
          expectedOffset,
          variance,
          analysis: variance === 0 ? "on-time" : variance > 0 ? "late" : "early",
        } : null,
        placementShift,
        calculatedDates: {
          dueDate: calculated.dueDate.toISOString().slice(0, 10),
          weanedDate: calculated.weanedDate.toISOString().slice(0, 10),
          placementStart: calculated.placementStart.toISOString().slice(0, 10),
          placementCompleted: calculated.placementCompleted.toISOString().slice(0, 10),
        },
      });
    } catch (err) {
      req.log.error({ err }, "upgrade-to-ovulation failed");
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /**
   * POST /breeding/plans/:id/clear-ovulation
   *
   * Clears ovulation confirmation and reverts plan back to CYCLE_START anchor mode.
   * Used when breeder entered an incorrect ovulation date by mistake.
   *
   * Only allowed when:
   * - Plan is in CYCLE status (hasn't advanced to BRED yet)
   * - Plan currently has OVULATION anchor mode
   */
  app.post("/breeding/plans/:id/clear-ovulation", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Only allow clearing ovulation in CYCLE phase
      if (String(plan.status) !== "CYCLE") {
        return reply.code(400).send({
          error: "invalid_status",
          detail: `Can only clear ovulation in CYCLE phase. Current status: ${plan.status}`,
        });
      }

      // Must currently be in OVULATION anchor mode
      if (plan.reproAnchorMode !== "OVULATION") {
        return reply.code(400).send({
          error: "not_ovulation_mode",
          detail: "Plan is not using ovulation anchors. Nothing to clear.",
        });
      }

      // Clear ovulation fields and revert to CYCLE_START
      const updated = await prisma.breedingPlan.update({
        where: { id },
        data: {
          ovulationConfirmed: null,
          ovulationConfirmedMethod: null,
          reproAnchorMode: "CYCLE_START",
          // Note: We keep lockedOvulationDate as it was calculated from cycle start
          // and can still be useful as an estimate
        },
      });

      return reply.send({
        ok: true,
        plan: updated,
      });
    } catch (err) {
      req.log.error({ err }, "clear-ovulation failed");
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/archive", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      // Get plan with dam/sire before archiving
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { id: true, damId: true, sireId: true },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      await prisma.breedingPlan.update({ where: { id }, data: { archived: true } });

      // Sync animal breeding statuses (they may revert from BREEDING if no other active plans)
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot after archiving (decreases count)
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/restore", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const userId = (req as any).user?.id ?? null;

      // Get plan with dam/sire, status, and offspring group before restoring
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          damId: true,
          sireId: true,
          status: true,
          offspringGroup: { select: { id: true } },
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      const now = new Date();

      // Restore both plan and offspring group in a transaction
      await prisma.$transaction(async (tx) => {
        // Restore the plan - always revert status to PLACEMENT
        await tx.breedingPlan.update({
          where: { id },
          data: {
            archived: false,
            archiveReason: null,
            status: "PLACEMENT",
          },
        });

        // Restore the offspring group if it exists
        if (plan.offspringGroup?.id) {
          await tx.offspringGroup.update({
            where: { id: plan.offspringGroup.id },
            data: { archivedAt: null },
          });
        }

        // Create audit event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: "UNARCHIVED",
            occurredAt: now,
            label: "Plan Restored",
            notes: "Plan and offspring group restored from archive",
            data: {
              groupId: plan.offspringGroup?.id ?? null,
              previousStatus: plan.status,
              restoredToStatus: "PLACEMENT_COMPLETED",
            },
            recordedByUserId: userId,
          },
        });
      });

      // Sync animal breeding statuses (they may need to be set to BREEDING if plan is active)
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot after restoring (increases count)
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      reply.send({
        ok: true,
        groupRestored: !!plan.offspringGroup?.id,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Archive Readiness Check ───────────── */

  /**
   * GET /breeding/plans/:id/archive-readiness
   *
   * Checks if a plan is ready for archival by running validation checks.
   * Returns blockers (must fix) and warnings (advisory).
   */
  app.get("/breeding/plans/:id/archive-readiness", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const result = await checkArchiveReadiness(prisma, tenantId, id);
      return reply.send(result);
    } catch (err: any) {
      req.log.error({ err }, "archive-readiness check failed");
      if (err.message === "Plan not found") {
        return reply.code(404).send({ error: "not_found" });
      }
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Complete Archive Workflow ───────────── */

  /**
   * POST /breeding/plans/:id/complete-archive
   *
   * Validates and archives a breeding plan along with its linked offspring group.
   * This is the "complete" archival workflow that:
   * 1. Runs validation checks
   * 2. Blocks if there are blockers (unless force=true)
   * 3. Archives both plan and offspring group together
   * 4. Creates audit trail via BreedingPlanEvent
   */
  app.post("/breeding/plans/:id/complete-archive", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as {
        reason?: string;
        force?: boolean;
        acknowledgeWarnings?: boolean;
      };
      const userId = (req as any).user?.id ?? null;

      // Run validation
      const validation = await checkArchiveReadiness(prisma, tenantId, id);

      // Block if there are blockers (unless force is true)
      if (!body.force && !validation.canArchive) {
        return reply.code(409).send({
          error: "archive_blocked",
          detail: "Plan cannot be archived due to unresolved blockers",
          blockers: validation.checks.filter((c) => !c.passed && c.severity === "blocker"),
          warnings: validation.checks.filter((c) => !c.passed && c.severity === "warning"),
        });
      }

      // Get plan with offspring group
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          damId: true,
          sireId: true,
          status: true,
          offspringGroup: { select: { id: true } },
        },
      });

      if (!plan) return reply.code(404).send({ error: "not_found" });

      const now = new Date();
      const archiveReason = body.reason || null;

      // Archive both plan and offspring group in a transaction
      await prisma.$transaction(async (tx) => {
        // Archive the plan and set status to COMPLETE
        await tx.breedingPlan.update({
          where: { id },
          data: {
            archived: true,
            archiveReason,
            status: "COMPLETE",
            completedDateActual: now,
          },
        });

        // Archive the offspring group if it exists
        if (plan.offspringGroup?.id) {
          await tx.offspringGroup.update({
            where: { id: plan.offspringGroup.id },
            data: { archivedAt: now },
          });
        }

        // Create audit event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: "ARCHIVED",
            occurredAt: now,
            label: "Plan Completed and Archived",
            notes: archiveReason
              ? `Plan and offspring group archived. Reason: ${archiveReason}`
              : "Plan and offspring group archived",
            data: {
              archiveReason,
              groupId: plan.offspringGroup?.id ?? null,
              previousStatus: plan.status,
              blockerCount: validation.summary.blockers,
              warningCount: validation.summary.warnings,
              forced: body.force ?? false,
              acknowledgedWarnings: body.acknowledgeWarnings ?? false,
            },
            recordedByUserId: userId,
          },
        });
      });

      // Sync animal breeding statuses
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      return reply.send({
        ok: true,
        archived: true,
        groupArchived: !!plan.offspringGroup?.id,
        validation,
      });
    } catch (err: any) {
      req.log.error({ err }, "complete-archive failed");
      if (err.message === "Plan not found") {
        return reply.code(404).send({ error: "not_found" });
      }
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/delete", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      // Get plan with all fields needed for business rule validation
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          damId: true,
          sireId: true,
          archived: true,
          deletedAt: true,
          breedDateActual: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Already deleted - idempotent
      if (plan.deletedAt) {
        return reply.send({ ok: true });
      }

      // UPDATED BUSINESS RULE: Allow deletion even after breed date IF no real dependencies exist
      // Old rule blocked deletion after breedDateActual - now we check for actual data usage
      // This allows breeders to delete plans they were just testing/experimenting with

      const blockers: any = {};
      const blockerDetails: string[] = [];

      // Check for linked offspring group and its dependencies
      const group = await prisma.offspringGroup.findFirst({
        where: { tenantId, planId: plan.id, deletedAt: null },
        select: { id: true, actualBirthOn: true },
      });

      if (group) {
        // 1. Check for offspring records (modern Offspring table)
        try {
          const offspringCount = await prisma.offspring.count({
            where: { tenantId, groupId: group.id },
          });
          if (offspringCount > 0) {
            blockers.hasOffspring = true;
            blockerDetails.push(`${offspringCount} offspring record(s) exist in the linked offspring group`);
          }
        } catch (e) {
          // Table may not exist in older schemas
        }

        // 2. Check for legacy Animal offspring linked to the group
        try {
          const legacyOffspringCount = await prisma.animal.count({
            where: { tenantId, offspringGroupId: group.id },
          });
          if (legacyOffspringCount > 0) {
            blockers.hasLegacyOffspring = true;
            blockerDetails.push(`${legacyOffspringCount} legacy animal offspring record(s) exist`);
          }
        } catch (e) {
          // Field may not exist in schema
        }

        // 3. Check for offspring group buyers (NOT plan buyers - those are different)
        try {
          const groupBuyersCount = await prisma.offspringGroupBuyer.count({
            where: { tenantId, groupId: group.id },
          });
          if (groupBuyersCount > 0) {
            blockers.hasOffspringGroupBuyers = true;
            blockerDetails.push(`${groupBuyersCount} buyer(s) assigned to the offspring group`);
          }
        } catch (e) {
          // Table may not exist
        }

        // 4. Check for waitlist entries linked to offspring group
        try {
          const waitlistCount = await prisma.waitlistEntry.count({
            where: { tenantId, offspringGroupId: group.id },
          });
          if (waitlistCount > 0) {
            blockers.hasWaitlistEntries = true;
            blockerDetails.push(`${waitlistCount} waitlist entry/entries linked to offspring group`);
          }
        } catch (e) {
          // Field may not exist
        }

        // 5. Check for invoices linked to offspring group or offspring
        try {
          const invoiceCount = await prisma.invoice.count({
            where: {
              tenantId,
              OR: [
                { groupId: group.id },
                {
                  offspring: {
                    groupId: group.id
                  }
                }
              ]
            },
          });
          if (invoiceCount > 0) {
            blockers.hasInvoices = true;
            blockerDetails.push(`${invoiceCount} invoice(s) linked to offspring or group`);
          }
        } catch (e) {
          // Fields may not exist
        }

        // 6. Check for contracts/documents
        try {
          const contractCount = await prisma.offspringContract.count({
            where: {
              tenantId,
              offspring: { groupId: group.id }
            },
          });
          if (contractCount > 0) {
            blockers.hasContracts = true;
            blockerDetails.push(`${contractCount} contract(s) exist for offspring`);
          }
        } catch (e) {
          // Table may not exist
        }

        try {
          const documentCount = await prisma.offspringDocument.count({
            where: {
              tenantId,
              offspring: { groupId: group.id }
            },
          });
          if (documentCount > 0) {
            blockers.hasDocuments = true;
            blockerDetails.push(`${documentCount} document(s) exist for offspring`);
          }
        } catch (e) {
          // Table may not exist
        }

        // 7. Check for actual birth date recorded (permanent milestone)
        if (group.actualBirthOn) {
          blockers.hasBirthDate = true;
          blockerDetails.push('Actual birth date has been recorded');
        }
      }

      // 8. Check for breeding plan buyers (BreedingPlanBuyer table)
      try {
        const planBuyersCount = await prisma.breedingPlanBuyer.count({
          where: { tenantId, planId: plan.id },
        });
        if (planBuyersCount > 0) {
          blockers.hasPlanBuyers = true;
          blockerDetails.push(`${planBuyersCount} buyer(s) linked to breeding plan`);
        }
      } catch (e) {
        // Table may not exist
      }

      // 9. Check for waitlist entries directly linked to plan (older pattern)
      try {
        const planWaitlistCount = await prisma.waitlistEntry.count({
          where: { tenantId, planId: plan.id },
        });
        if (planWaitlistCount > 0) {
          blockers.hasPlanWaitlist = true;
          blockerDetails.push(`${planWaitlistCount} waitlist entry/entries linked directly to plan`);
        }
      } catch (e) {
        // Field may not exist
      }

      // If any blockers exist, return detailed error
      if (Object.keys(blockers).length > 0) {
        return reply.code(409).send({
          error: "delete_blocked",
          blockers,
          detail: "Plan cannot be deleted because linked data exists that would be orphaned or lost.",
          reasons: blockerDetails,
        });
      }

      const now = new Date();

      // Safe to delete - no dependencies exist
      await prisma.$transaction(async (tx) => {
        // Soft delete the plan
        await tx.breedingPlan.update({
          where: { id },
          data: { deletedAt: now, archived: true },
        });

        // Cascade soft delete to linked offspring groups (should be empty/unused)
        await tx.offspringGroup.updateMany({
          where: { planId: id, tenantId, deletedAt: null },
          data: { deletedAt: now },
        });
      });

      // Sync animal breeding statuses (they may revert from BREEDING if no other active plans)
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot after deleting (decreases count)
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Reproductive Cycles ───────────── */

  app.get("/breeding/cycles", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      const q = (req.query || {}) as Partial<{ femaleId: string; from: string; to: string; page: string; limit: string }>;
      const femaleId = q.femaleId ? idNum(q.femaleId) : null;
      const from = q.from ? new Date(q.from) : undefined;
      const to = q.to ? new Date(q.to) : undefined;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { tenantId };
      if (femaleId) where.femaleId = femaleId;
      if (from || to) where.cycleStart = { gte: from, lte: to };

      const [items, total] = await prisma.$transaction([
        prisma.reproductiveCycle.findMany({ where, orderBy: { cycleStart: "desc" }, skip, take: limit }),
        prisma.reproductiveCycle.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/cycles", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      const b = (req.body || {}) as any;
      const femaleId = idNum(b.femaleId);
      if (!femaleId) return reply.code(400).send({ error: "femaleId_required" });
      if (!b.cycleStart) return reply.code(400).send({ error: "cycleStart_required" });

      const female = await prisma.animal.findFirst({ where: { id: femaleId, tenantId }, select: { id: true } });
      if (!female) return reply.code(400).send({ error: "female_not_found" });

      const placementStartDate =
        b.placementStartDate ?? b.goHomeDate ?? null;

      const created = await prisma.reproductiveCycle.create({
        data: {
          tenantId,
          femaleId,
          cycleStart: new Date(b.cycleStart),
          ovulation: b.ovulation ? new Date(b.ovulation) : null,
          dueDate: b.dueDate ? new Date(b.dueDate) : null,
          placementStartDate: placementStartDate ? new Date(placementStartDate) : null,
          status: b.status ?? null,
          notes: b.notes ?? null,
        },
      });

      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.patch("/breeding/cycles/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const exists = await prisma.reproductiveCycle.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: "not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};
      if (b.femaleId !== undefined) {
        const fid = idNum(b.femaleId);
        if (!fid) return reply.code(400).send({ error: "bad_femaleId" });
        const f = await prisma.animal.findFirst({ where: { id: fid, tenantId }, select: { id: true } });
        if (!f) return reply.code(400).send({ error: "female_not_found" });
        data.femaleId = fid;
      }
      if (b.goHomeDate !== undefined && b.placementStartDate === undefined) {
        b.placementStartDate = b.goHomeDate;
      }

      for (const k of ["cycleStart", "ovulation", "dueDate", "placementStartDate"] as const) {
        if (b[k] !== undefined) data[k] = b[k] ? new Date(b[k]) : null;
      }
      if (b.status !== undefined) data.status = b.status;
      if (b.notes !== undefined) data.notes = b.notes;

      const updated = await prisma.reproductiveCycle.update({ where: { id }, data });
      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Events / Tests / Attempts / Pregnancy Checks / etc. ───────────── */

  app.get("/breeding/plans/:id/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);
      const items = await prisma.breedingPlanEvent.findMany({
        where: { tenantId, planId },
        orderBy: { occurredAt: "asc" },
      });
      reply.send(items);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.type || !b.occurredAt) return reply.code(400).send({ error: "type_and_occurredAt_required" });

      await getPlanInTenant(planId, tenantId);
      if (b.animalId) {
        const a = await prisma.animal.findFirst({ where: { id: Number(b.animalId), tenantId }, select: { id: true } });
        if (!a) return reply.code(400).send({ error: "animal_not_in_tenant" });
      }

      const created = await prisma.breedingPlanEvent.create({
        data: {
          tenantId,
          planId,
          type: b.type,
          occurredAt: new Date(b.occurredAt),
          label: b.label ?? null,
          notes: b.notes ?? null,
          data: b.data ?? null,
          recordedByUserId: (req as any).user?.id ?? null,
        },
      });
      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/tests", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.kind || !b.collectedAt) return reply.code(400).send({ error: "kind_and_collectedAt_required" });

      await getPlanInTenant(planId, tenantId);
      if (b.animalId) {
        const a = await prisma.animal.findFirst({ where: { id: Number(b.animalId), tenantId }, select: { id: true } });
        if (!a) return reply.code(400).send({ error: "animal_not_in_tenant" });
      }

      const created = await prisma.testResult.create({
        data: {
          tenantId,
          planId,
          animalId: b.animalId ?? null,
          kind: b.kind,
          method: b.method ?? null,
          labName: b.labName ?? null,
          valueNumber: b.valueNumber ?? null,
          valueText: b.valueText ?? null,
          units: b.units ?? null,
          referenceRange: b.referenceRange ?? null,
          collectedAt: new Date(b.collectedAt),
          resultAt: b.resultAt ? new Date(b.resultAt) : null,
          notes: b.notes ?? null,
          data: b.data ?? null,
        },
      });
      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/attempts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.method) return reply.code(400).send({ error: "method_required" });

      // Get the plan to extract damId and sireId for historical persistence
      const plan = await getPlanInTenant(planId, tenantId);

      const created = await prisma.breedingAttempt.create({
        data: {
          tenantId,
          planId,
          // Store animal IDs for historical persistence (survives plan deletion)
          damId: plan.damId ?? null,
          sireId: plan.sireId ?? null,
          method: b.method,
          attemptAt: b.attemptAt ? new Date(b.attemptAt) : null,
          windowStart: b.windowStart ? new Date(b.windowStart) : null,
          windowEnd: b.windowEnd ? new Date(b.windowEnd) : null,
          studOwnerPartyId: b.studOwnerPartyId ?? null,
          semenBatchId: b.semenBatchId ?? null,
          success: b.success ?? null,
          notes: b.notes ?? null,
          data: b.data ?? null,
        },
      });

      // Also update breedDateActual on the plan if attemptAt is provided
      if (b.attemptAt) {
        await prisma.breedingPlan.update({
          where: { id: planId },
          data: { breedDateActual: new Date(b.attemptAt) },
        });
      }

      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // Get all breeding attempts for a plan
  app.get("/breeding/plans/:id/attempts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);

      const attempts = await prisma.breedingAttempt.findMany({
        where: { planId, tenantId },
        orderBy: { attemptAt: "desc" },
        include: {
          dam: { select: { id: true, name: true } },
          sire: { select: { id: true, name: true } },
        },
      });

      reply.send(attempts);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // Delete the most recent breeding attempt for a plan (used to "undo" a recorded breeding)
  app.delete("/breeding/plans/:id/attempts/latest", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);

      // Find the most recent attempt for this plan
      const latestAttempt = await prisma.breedingAttempt.findFirst({
        where: { planId, tenantId },
        orderBy: { createdAt: "desc" },
      });

      // Delete the attempt if one exists
      if (latestAttempt) {
        await prisma.breedingAttempt.delete({
          where: { id: latestAttempt.id },
        });
      }

      // Clear the breedDateActual on the plan since we're undoing the breeding record
      // (do this even if no attempt existed - handles legacy data)
      await prisma.breedingPlan.update({
        where: { id: planId },
        data: { breedDateActual: null },
      });

      reply.code(200).send({ success: true, deletedAttemptId: latestAttempt?.id ?? null });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /**
   * PATCH /breeding/attempts/:id
   * Update a specific breeding attempt
   */
  app.patch("/breeding/attempts/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const attemptId = idNum((req.params as any).id);
      if (!attemptId) return reply.code(400).send({ error: "bad_id" });

      // Verify attempt belongs to tenant
      const existing = await prisma.breedingAttempt.findFirst({
        where: { id: attemptId, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "attempt_not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};

      if (b.method !== undefined) data.method = b.method;
      if (b.attemptAt !== undefined) data.attemptAt = b.attemptAt ? new Date(b.attemptAt) : null;
      if (b.notes !== undefined) data.notes = b.notes || null;
      if (b.data !== undefined) data.data = b.data || null;
      if (b.success !== undefined) data.success = b.success;

      const updated = await prisma.breedingAttempt.update({
        where: { id: attemptId },
        data,
        include: {
          dam: { select: { id: true, name: true } },
          sire: { select: { id: true, name: true } },
          plan: { select: { id: true, code: true, name: true, status: true } },
        },
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /**
   * DELETE /breeding/attempts/:id
   * Delete a specific breeding attempt
   */
  app.delete("/breeding/attempts/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const attemptId = idNum((req.params as any).id);
      if (!attemptId) return reply.code(400).send({ error: "bad_id" });

      // Verify attempt belongs to tenant
      const existing = await prisma.breedingAttempt.findFirst({
        where: { id: attemptId, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "attempt_not_found" });

      await prisma.breedingAttempt.delete({
        where: { id: attemptId },
      });

      reply.code(200).send({ success: true, deletedAttemptId: attemptId });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/pregnancy-checks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (typeof b.result !== "boolean" || !b.method || !b.checkedAt)
        return reply.code(400).send({ error: "method_result_checkedAt_required" });

      await getPlanInTenant(planId, tenantId);
      const created = await prisma.pregnancyCheck.create({
        data: {
          tenantId,
          planId,
          method: b.method,
          result: !!b.result,
          checkedAt: new Date(b.checkedAt),
          notes: b.notes ?? null,
          data: b.data ?? null,
        },
      });
      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Litters ───────────── */

  app.get("/breeding/litters", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const q = (req.query || {}) as Partial<{
        planId: string;
        from: string;
        to: string;
        include: string;
        page: string;
        limit: string;
      }>;

      const where: any = { tenantId };
      if (q.planId) where.planId = Number(q.planId);
      if (q.from || q.to) {
        const from = q.from ? new Date(q.from) : undefined;
        const to = q.to ? new Date(q.to) : undefined;
        where.birthedStartAt = { gte: from, lte: to };
      }

      const { page, limit, skip } = parsePaging(q);
      const expand: any = {};
      const list = String(q.include || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const has = (k: string) => list.includes(k) || list.includes("all");

      if (has("plan")) expand.plan = true;
      if (has("animals")) expand.Animals = { orderBy: { id: "asc" as const } };
      if (has("waitlist")) expand.Waitlist = { orderBy: [{ depositPaidAt: "desc" as const }, { createdAt: "asc" as const }] };
      if (has("events")) expand.Events = { orderBy: { occurredAt: "asc" as const } };
      if (has("attachments")) expand.Attachment = { orderBy: { id: "desc" as const } };

      const [items, total] = await prisma.$transaction([
        prisma.litter.findMany({
          where,
          orderBy: [{ birthedStartAt: "desc" as const }, { id: "desc" as const }],
          skip,
          take: limit,
          include: expand,
        }),
        prisma.litter.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.get("/breeding/litters/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const list = String((req.query as any)?.include || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const has = (k: string) => list.includes(k) || list.includes("all");

      const expand: any = {};
      if (has("plan")) expand.plan = true;
      if (has("animals")) expand.Animals = { orderBy: { id: "asc" as const } };
      if (has("waitlist")) expand.Waitlist = { orderBy: [{ depositPaidAt: "desc" as const }, { createdAt: "asc" as const }] };
      if (has("events")) expand.Events = { orderBy: { occurredAt: "asc" as const } };
      if (has("attachments")) expand.Attachment = { orderBy: { id: "desc" as const } };

      const litter = await prisma.litter.findFirst({
        where: { id, tenantId },
        include: expand,
      });
      if (!litter) return reply.code(404).send({ error: "not_found" });

      reply.send(litter);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/litters", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const b = (req.body || {}) as any;

      const planId = idNum(b.planId);
      if (!planId) return reply.code(400).send({ error: "planId_required" });
      await getPlanInTenant(planId, tenantId);

      const created = await prisma.litter.create({
        data: {
          tenantId,
          planId,
          identifier: b.identifier ?? null,
          birthedStartAt: b.birthedStartAt ? new Date(b.birthedStartAt) : null,
          birthedEndAt: b.birthedEndAt ? new Date(b.birthedEndAt) : null,
          countBorn: b.countBorn ?? null,
          countLive: b.countLive ?? null,
          countStillborn: b.countStillborn ?? null,
          countMale: b.countMale ?? null,
          countFemale: b.countFemale ?? null,
          countWeaned: b.countWeaned ?? null,
          countPlaced: b.countPlaced ?? null,
          weanedAt: b.weanedAt ? new Date(b.weanedAt) : null,
          placementStartAt: b.placementStartAt ? new Date(b.placementStartAt) : null,
          placementCompletedAt: b.placementCompletedAt ? new Date(b.placementCompletedAt) : null,
          statusOverride: b.statusOverride ?? null,
          statusOverrideReason: b.statusOverrideReason ?? null,
          marketplaceStatus: (b.published ?? false) ? "LIVE" : "DRAFT",
          coverImageUrl: b.coverImageUrl ?? null,
          themeName: b.themeName ?? null,
          notes: b.notes ?? null,
          data: b.data ?? null,
        },
      });

      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.patch("/breeding/litters/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getLitterInTenant(id, tenantId);

      const b = (req.body || {}) as any;
      const data: any = {};

      const dateKeys = [
        "birthedStartAt",
        "birthedEndAt",
        "weanedAt",
        "placementStartAt",
        "placementCompletedAt",
      ] as const;

      for (const k of dateKeys) if (b[k] !== undefined) data[k] = b[k] ? new Date(b[k]) : null;

      const passthrough = [
        "identifier",
        "countBorn",
        "countLive",
        "countStillborn",
        "countMale",
        "countFemale",
        "countWeaned",
        "countPlaced",
        "statusOverride",
        "statusOverrideReason",
        "published",
        "coverImageUrl",
        "themeName",
        "notes",
        "data",
      ];
      for (const k of passthrough) if (b[k] !== undefined) data[k] = b[k];

      const updated = await prisma.litter.update({ where: { id }, data });
      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Litter Events ───────────── */

  app.get("/breeding/litters/:id/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const litterId = idNum((req.params as any).id);
      if (!litterId) return reply.code(400).send({ error: "bad_id" });

      await getLitterInTenant(litterId, tenantId);
      const items = await prisma.litterEvent.findMany({
        where: { tenantId, litterId },
        orderBy: { occurredAt: "asc" },
      });
      reply.send(items);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/litters/:id/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const litterId = idNum((req.params as any).id);
      if (!litterId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.type || !b.occurredAt) return reply.code(400).send({ error: "type_and_occurredAt_required" });

      await getLitterInTenant(litterId, tenantId);

      const created = await prisma.litterEvent.create({
        data: {
          tenantId,
          litterId,
          type: String(b.type),
          occurredAt: new Date(b.occurredAt),
          field: b.field ?? null,
          before: b.before ?? null,
          after: b.after ?? null,
          notes: b.notes ?? null,
          recordedByUserId: (req as any).user?.id ?? null,
        },
      });
      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Batch collar assignment ─────────────
     Body: {
       force?: boolean; // override collarLocked
       assignments: Array<{ animalId: number, colorId?: string, colorName?: string, colorHex?: string, lock?: boolean }>
     }
     Rules:
     - All animals must belong to the litter and tenant.
     - If an animal has collarLocked=true and force!==true, reject.
     - Within this request, colorId/colorHex must be unique (ignoring blanks).
     - colorHex (if present) must be valid hex (#rgb/#rgba/#rrggbb/#rrggbbaa).
  */
  app.post("/breeding/litters/:id/assign-collars", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const litterId = idNum((req.params as any).id);
      if (!litterId) return reply.code(400).send({ error: "bad_id" });

      await getLitterInTenant(litterId, tenantId);

      const b = (req.body || {}) as any;
      const force = !!b.force;
      const assignments = Array.isArray(b.assignments) ? b.assignments : [];

      if (!assignments.length) {
        return reply.code(400).send({ error: "assignments_required" });
      }

      // Validate uniqueness of colorId/colorHex within the batch
      const seenId = new Set<string>();
      const seenHex = new Set<string>();
      for (const a of assignments) {
        if (!idNum(a.animalId)) return reply.code(400).send({ error: "bad_animalId" });
        if (a.colorHex && !HEX3_4_6_8.test(a.colorHex)) {
          return reply.code(400).send({ error: "invalid_color_hex", detail: a.colorHex });
        }
        const idKey = (a.colorId || "").trim();
        const hexKey = (a.colorHex || "").trim().toLowerCase();
        if (idKey) {
          if (seenId.has(idKey)) return reply.code(400).send({ error: "duplicate_color_id_in_batch", detail: idKey });
          seenId.add(idKey);
        }
        if (hexKey) {
          if (seenHex.has(hexKey)) return reply.code(400).send({ error: "duplicate_color_hex_in_batch", detail: hexKey });
          seenHex.add(hexKey);
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Pull all animals for verification
        const animals = await tx.animal.findMany({
          where: { tenantId, litterId, id: { in: assignments.map((a: any) => Number(a.animalId)) } },
          select: { id: true, collarLocked: true },
        });

        const foundIds = new Set(animals.map((a) => a.id));
        const missing = assignments.map((a: any) => Number(a.animalId)).filter((id: number) => !foundIds.has(id));
        if (missing.length) {
          const err: any = new Error(`animals_not_in_litter_or_tenant: ${missing.join(", ")}`);
          err.statusCode = 400;
          throw err;
        }

        // Respect lock
        const lockedIds = animals.filter((a) => a.collarLocked).map((a) => a.id);
        if (!force && lockedIds.length) {
          const err: any = new Error(`locked_animals: ${lockedIds.join(", ")}`);
          err.statusCode = 409;
          throw err;
        }

        // Optional uniqueness across the litter (current DB state): enforce that no two litter mates share the same colorId or colorHex (non-empty)
        const current = await tx.animal.findMany({
          where: { tenantId, litterId },
          select: { id: true, collarColorId: true, collarColorHex: true },
        });

        const currentById = new Map<string, number>();
        const currentByHex = new Map<string, number>();
        for (const a of current) {
          if (a.collarColorId) currentById.set(a.collarColorId, a.id);
          if (a.collarColorHex) currentByHex.set(a.collarColorHex.toLowerCase(), a.id);
        }

        for (const a of assignments) {
          const idKey = (a.colorId || "").trim();
          const hexKey = (a.colorHex || "").trim().toLowerCase();
          if (idKey) {
            const holder = currentById.get(idKey);
            if (holder && holder !== Number(a.animalId)) {
              const err: any = new Error(`color_id_in_use:${idKey}`);
              err.statusCode = 409;
              throw err;
            }
          }
          if (hexKey) {
            const holder = currentByHex.get(hexKey);
            if (holder && holder !== Number(a.animalId)) {
              const err: any = new Error(`color_hex_in_use:${hexKey}`);
              err.statusCode = 409;
              throw err;
            }
          }
        }

        // Apply updates
        const updates = [];
        for (const a of assignments) {
          updates.push(
            tx.animal.update({
              where: { id: Number(a.animalId) },
              data: {
                collarColorId: a.colorId ?? null,
                collarColorName: a.colorName ?? null,
                collarColorHex: a.colorHex ?? null,
                collarAssignedAt: new Date(),
                collarLocked: a.lock === true ? true : a.lock === false ? false : undefined,
              },
              select: { id: true, collarColorId: true, collarColorName: true, collarColorHex: true, collarLocked: true },
            })
          );
        }

        const updated = await Promise.all(updates);

        // Litter event
        await tx.litterEvent.create({
          data: {
            tenantId,
            litterId,
            type: "CHANGE",
            occurredAt: new Date(),
            field: "collars",
            before: Prisma.DbNull,
            after: { assigned: assignments.map((a: any) => ({ animalId: Number(a.animalId), colorId: a.colorId, colorName: a.colorName, colorHex: a.colorHex, lock: !!a.lock })) },
            notes: force ? "Collars assigned (force override locks)" : "Collars assigned",
            recordedByUserId: (req as any).user?.id ?? null,
          },
        });

        return updated;
      });

      reply.send({ updated: result });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Foaling Automation Endpoints ───────────── */

  // GET /breeding/plans/:id/foaling-timeline
  app.get("/breeding/plans/:id/foaling-timeline", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const timeline = await getFoalingTimeline(Number(id), tenantId);
      reply.send(timeline);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/record-foaling
  app.post("/breeding/plans/:id/record-foaling", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;

      const result = await recordFoaling({
        breedingPlanId: Number(id),
        tenantId,
        actualBirthDate: new Date(body.actualBirthDate),
        foals: body.foals,
        userId,
      });

      reply.status(201).send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/foaling-outcome
  app.post("/breeding/plans/:id/foaling-outcome", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;

      const outcome = await addFoalingOutcome({
        breedingPlanId: Number(id),
        tenantId,
        userId,
        ...body,
      });

      reply.status(201).send(outcome);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/foaling-calendar
  app.get("/breeding/foaling-calendar", async (req, reply) => {
    try {
      const query = req.query as any;
      const tenantId = (req as any).tenantId;

      const calendar = await getFoalingCalendar({
        tenantId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      reply.send(calendar);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/milestones
  app.post("/breeding/plans/:id/milestones", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const milestones = await createBreedingMilestones(Number(id), tenantId);
      reply.status(201).send(milestones);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /breeding/milestones/:id/complete
  app.patch("/breeding/milestones/:id/complete", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const milestone = await prisma.breedingMilestone.update({
        where: { id: Number(id), tenantId },
        data: {
          isCompleted: true,
          completedDate: new Date(),
        },
      });

      reply.send(milestone);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /breeding/milestones/:id/uncomplete
  app.patch("/breeding/milestones/:id/uncomplete", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const milestone = await prisma.breedingMilestone.update({
        where: { id: Number(id), tenantId },
        data: {
          isCompleted: false,
          completedDate: null,
        },
      });

      reply.send(milestone);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/mares/:mareId/reproductive-history
  app.get("/breeding/mares/:mareId/reproductive-history", async (req, reply) => {
    try {
      const { mareId } = req.params as { mareId: string };
      const tenantId = (req as any).tenantId;

      const history = await getMareReproductiveHistory(Number(mareId), tenantId);

      if (!history) {
        reply.status(404).send({ error: "Reproductive history not found for this mare" });
        return;
      }

      reply.send(history);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/mares/:mareId/foaling-history
  app.get("/breeding/mares/:mareId/foaling-history", async (req, reply) => {
    try {
      const { mareId } = req.params as { mareId: string };
      const tenantId = (req as any).tenantId;

      const history = await getMareDetailedFoalingHistory(Number(mareId), tenantId);
      reply.send(history);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/mares/:mareId/reproductive-history/recalculate
  app.post("/breeding/mares/:mareId/reproductive-history/recalculate", async (req, reply) => {
    try {
      const { mareId } = req.params as { mareId: string };
      const tenantId = (req as any).tenantId;

      const history = await recalculateMareHistory(Number(mareId), tenantId);

      if (!history) {
        reply.status(404).send({ error: "No foaling history found for this mare" });
        return;
      }

      reply.send(history);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/foaling-analytics - Get aggregate foaling analytics
  app.get("/breeding/foaling-analytics", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      const { year } = req.query as { year?: string };

      const analytics = await getFoalingAnalytics(tenantId, {
        year: year ? parseInt(year, 10) : undefined,
      });
      reply.send(analytics);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DELETE /breeding/plans/:id/milestones - Delete all milestones for a plan
  app.delete("/breeding/plans/:id/milestones", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const result = await deleteBreedingMilestones(Number(id), tenantId);
      reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/milestones/recalculate - Recalculate milestone dates from breed date
  app.post("/breeding/plans/:id/milestones/recalculate", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const milestones = await recalculateMilestones(Number(id), tenantId);
      reply.send(milestones);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });
};

export default breedingRoutes;
