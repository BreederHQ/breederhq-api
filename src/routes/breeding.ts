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

  async function ensureGroupForCommittedPlan(args: { tenantId: number; planId: number; actorId: string }): Promise<OffspringGroup> {
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
        notes: `Group ensured for committed plan${actorId ? ` by ${actorId}` : ""}`,
        recordedByUserId: null,
      },
    });

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

  return { ensureGroupForCommittedPlan, linkGroupToPlan, unlinkGroup, getLinkSuggestions };
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
} from "../services/breeding-foaling-service.js";

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
 * Active breeding phases: COMMITTED, CYCLE_EXPECTED, HORMONE_TESTING, BRED, PREGNANT, BIRTHED, WEANED, PLACEMENT
 */
const ACTIVE_BREEDING_STATUSES = new Set([
  "COMMITTED",
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
    select: { id: true, species: true },
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
  "COMMITTED",
  "CYCLE_EXPECTED",
  "HORMONE_TESTING",
  "BRED",
  "PREGNANT",
  "BIRTHED",
  "WEANED",
  "PLACEMENT",
  "COMPLETE",
  "CANCELED",
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

      const expand = includeFlags((req.query as any)?.include);
      const plan = await prisma.breedingPlan.findFirst({ where: { id, tenantId }, include: expand });
      if (!plan) return reply.code(404).send({ error: "not_found" });
      reply.send(plan);
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
        const program = await prisma.breedingProgram.findFirst({
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

      reply.code(201).send(created);
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
        select: { species: true, code: true, status: true, damId: true, sireId: true },
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
        const effectiveCycleStart = data.cycleStartDateActual !== undefined
          ? data.cycleStartDateActual
          : (b.cycleStartDateActual !== undefined ? (b.cycleStartDateActual ? new Date(b.cycleStartDateActual) : null) : null);
        const effectiveBreedDate = data.breedDateActual !== undefined
          ? data.breedDateActual
          : (b.breedDateActual !== undefined ? (b.breedDateActual ? new Date(b.breedDateActual) : null) : null);
        const effectiveBirthDate = data.birthDateActual !== undefined
          ? data.birthDateActual
          : (b.birthDateActual !== undefined ? (b.birthDateActual ? new Date(b.birthDateActual) : null) : null);
        const effectiveWeanedDate = data.weanedDateActual !== undefined
          ? data.weanedDateActual
          : (b.weanedDateActual !== undefined ? (b.weanedDateActual ? new Date(b.weanedDateActual) : null) : null);
        const effectivePlacementStart = data.placementStartDateActual !== undefined
          ? data.placementStartDateActual
          : (b.placementStartDateActual !== undefined ? (b.placementStartDateActual ? new Date(b.placementStartDateActual) : null) : null);
        const effectivePlacementCompleted = data.placementCompletedDateActual !== undefined
          ? data.placementCompletedDateActual
          : (b.placementCompletedDateActual !== undefined ? (b.placementCompletedDateActual ? new Date(b.placementCompletedDateActual) : null) : null);

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
          },
        });

        const finalCycleStart = effectiveCycleStart ?? existingPlan?.cycleStartDateActual;
        const finalBreedDate = effectiveBreedDate ?? existingPlan?.breedDateActual;
        const finalBirthDate = effectiveBirthDate ?? existingPlan?.birthDateActual;
        const finalWeanedDate = effectiveWeanedDate ?? existingPlan?.weanedDateActual;
        const finalPlacementStart = effectivePlacementStart ?? existingPlan?.placementStartDateActual;
        const finalPlacementCompleted = effectivePlacementCompleted ?? existingPlan?.placementCompletedDateActual;

        // Validate required dates for each status
        if (s === "BRED" && !finalCycleStart) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: "cycleStartDateActual is required to set status to BRED"
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
        const STATUS_ORDER = [
          "PLANNING", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
          "BRED", "PREGNANT", "BIRTHED", "WEANED", "PLACEMENT", "COMPLETE"
        ];
        const currentStatusIndex = STATUS_ORDER.indexOf(String(existing.status));
        const newStatusIndex = STATUS_ORDER.indexOf(s);

        // Check if this is a regression (moving backwards in the lifecycle)
        if (currentStatusIndex > -1 && newStatusIndex > -1 && newStatusIndex < currentStatusIndex) {
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

      // Ensure offspring group exists when plan reaches COMMITTED status
      // This handles cases where the plan was committed before offspring group auto-creation was added
      const isCommitted = String(updated.status) === "COMMITTED";
      if (isCommitted) {
        try {
          const ogSvc = __makeOffspringGroupsService({ prisma, authorizer: __og_authorizer });
          await ogSvc.ensureGroupForCommittedPlan({
            tenantId,
            planId: id,
            actorId: (req as any).user?.id ?? "system",
          });
        } catch (ogErr) {
          // Log but don't fail the update - offspring group creation is secondary
          req.log?.warn?.({ err: ogErr, planId: id }, "Failed to ensure offspring group for committed plan");
        }
      }

      reply.send(updated);
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
        "COMMITTED",
        "BRED",
        "PREGNANT",
        "BIRTHED",
        "WEANED",
        "PLACEMENT",
        "COMPLETE",
        "CANCELED",
      ]);
      if (terminal.has(String(plan.status))) {
        return reply.code(409).send({ error: "already_in_terminal_state" });
      }

      if (!plan.damId || !plan.sireId) {
        return reply.code(400).send({ error: "dam_sire_required" });
      }

      const missingLock: string[] = [];
      if (!plan.lockedCycleStart) missingLock.push("lockedCycleStart");
      if (!plan.lockedOvulationDate) missingLock.push("lockedOvulationDate");
      if (!plan.lockedDueDate) missingLock.push("lockedDueDate");
      if (!plan.lockedPlacementStartDate) missingLock.push("lockedPlacementStartDate");
      if (missingLock.length) {
        return reply.code(400).send({
          error: "full_lock_required",
          detail: `Commit requires a locked cycle with all fields present. Missing: ${missingLock.join(", ")}`,
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
            status: BreedingPlanStatus.COMMITTED,
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
            type: "PLAN_COMMITTED",
            occurredAt: new Date(),
            label: "Plan committed",
            data: {
              code,
              fromStatus: String(plan.status),
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

        // If actorId is provided, also ensure an offspring group and return that payload
        if (b.actorId) {
          const ogSvc = __makeOffspringGroupsService({ prisma: tx as any, authorizer: __og_authorizer });
          const group = await ogSvc.ensureGroupForCommittedPlan({
            tenantId,
            planId: plan.id,
            actorId: b.actorId,
          });
          return { mode: "ensure", payload: { planId: plan.id, group } };
        }

        // Sync animal breeding statuses for dam and sire
        if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId, tx);
        if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId, tx);

        // Legacy response, return the updated plan
        return { mode: "legacy", payload: saved };
      });

      if (result.mode === "ensure") return reply.send(result.payload);
      return reply.send(result.payload);
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

      // Only allow uncommit if status is COMMITTED
      if (String(plan.status) !== "COMMITTED") {
        return reply.code(409).send({
          error: "not_committed",
          detail: `Plan must be in COMMITTED status to uncommit. Current status: ${plan.status}`
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

      // Get plan with dam/sire and status before restoring
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { id: true, damId: true, sireId: true, status: true },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      await prisma.breedingPlan.update({ where: { id }, data: { archived: false } });

      // Sync animal breeding statuses (they may need to be set to BREEDING if plan is active)
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot after restoring (increases count)
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      reply.send({ ok: true });
    } catch (err) {
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

      // BUSINESS RULE: Cannot delete plan after breed actual date is entered
      // This protects breeding data integrity - once breeding has occurred,
      // the plan becomes part of the breeding record and cannot be deleted
      if (plan.breedDateActual) {
        return reply.code(400).send({
          error: "cannot_delete_bred_plan",
          detail: "Plans cannot be deleted after the Breed Date (Actual) has been entered. This is a permanent business rule to protect breeding data integrity.",
        });
      }

      // Check for blockers (same logic as uncommit)
      const blockers: any = {};

      // Check for linked offspring group and its blockers
      const group = await prisma.offspringGroup.findFirst({
        where: { tenantId, planId: plan.id, deletedAt: null },
        select: { id: true },
      });

      if (group) {
        // Check for offspring animals linked to the group
        try {
          const offspringCount = await prisma.animal.count({
            where: { tenantId, offspringGroupId: group.id },
          });
          if (offspringCount > 0) blockers.hasOffspring = true;
        } catch (e) {
          // Field may not exist, skip this check
        }

        // Check for buyers (via waitlist/reservations)
        try {
          const buyersCount = await prisma.waitlistEntry.count({
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
      }

      // Also check for waitlist entries directly linked to the plan (without offspring group)
      if (!blockers.hasBuyers) {
        try {
          const planBuyersCount = await prisma.waitlistEntry.count({
            where: { tenantId, planId: plan.id },
          });
          if (planBuyersCount > 0) blockers.hasBuyers = true;
        } catch (e) {
          // Skip if field doesn't exist
        }
      }

      // If any blockers exist, return 409
      if (Object.keys(blockers).length > 0) {
        return reply.code(409).send({
          error: "delete_blocked",
          blockers,
          detail: "Plan cannot be deleted due to linked data.",
        });
      }

      const now = new Date();

      // Use transaction to soft delete plan and cascade to offspring groups
      await prisma.$transaction(async (tx) => {
        // Soft delete the plan
        await tx.breedingPlan.update({
          where: { id },
          data: { deletedAt: now, archived: true },
        });

        // Cascade soft delete to linked offspring groups
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

      await getPlanInTenant(planId, tenantId);

      const created = await prisma.breedingAttempt.create({
        data: {
          tenantId,
          planId,
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
      reply.code(201).send(created);
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
          published: b.published ?? false,
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
};

export default breedingRoutes;
