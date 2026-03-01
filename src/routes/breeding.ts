import { Prisma, type PrismaClient, BreedingPlan, Animal, BreedingPlanStatus } from "@prisma/client";
import { resolvePartyId } from "../services/party-resolver.js";

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
  // Species-generic birth milestone functions (all species)
  createSpeciesBirthMilestones,
  getBirthTimeline,
  deleteBirthMilestones,
} from "../services/breeding-foaling-service.js";
import {
  getAnimalReproductiveHistory,
  getAnimalDetailedBirthHistory,
  recalculateAnimalHistory,
  getBirthAnalytics,
  // Backward-compat re-exports for old route handlers
  getMareReproductiveHistory,
  getMareDetailedFoalingHistory,
  recalculateMareHistory,
  getFoalingAnalytics,
} from "../services/animal-reproductive-history-service.js";
import { getPlacementTrends } from "../services/placement-trend-service.js";
import {
  createNeonatalCareEntry,
  getNeonatalCareEntries,
  deleteNeonatalCareEntry,
  createNeonatalIntervention,
  getNeonatalInterventions,
  updateNeonatalIntervention,
  getNeonatalDashboard,
  updateOffspringNeonatalStatus,
  batchRecordWeights,
} from "../services/neonatal-care-service.js";
import { checkArchiveReadiness } from "../services/archive-validation-service.js";
import { checkBreedingPlanCarrierRisk } from "../services/genetics/carrier-detection.js";
import { generateETCertificatePdf, type ETCertificateData } from "../services/et-certificate-pdf-builder.js";
import { auditCreate, auditUpdate, auditDelete, type AuditContext } from "../services/audit-trail.js";
import { logEntityActivity } from "../services/activity-log.js";
import { resolveOffspringPrice } from "../services/commerce-pricing.js";
import {
  advancePlanLifecycle,
  rewindPlanLifecycle,
  dissolvePlan,
  autoAdvancePlanIfReady,
  LifecycleError,
} from "../services/breeding-plan-lifecycle-service.js";

/* ───────────────────────── audit helper ───────────────────────── */

/** Build AuditContext from a Fastify request */
function auditCtx(req: any, tenantId: number): AuditContext {
  return {
    tenantId,
    userId: String((req as any).userId ?? "unknown"),
    userName: (req as any).userName ?? undefined,
    changeSource: "PLATFORM",
    ip: req.ip,
    requestId: req.id,
  };
}

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
  "PLAN_COMPLETE", // Terminal plan status
  "WEANED",        // Legacy: still supported for existing plans
  "PLACEMENT",     // Legacy: still supported for existing plans
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
      await db.animal.updateMany({
        where: { id: animalId, tenantId },
        data: { status: "BREEDING" },
      });
    }
  } else {
    // Animal is not in any active breeding plan
    // Only revert from BREEDING to ACTIVE (don't touch other statuses)
    if (currentStatus === "BREEDING") {
      await db.animal.updateMany({
        where: { id: animalId, tenantId },
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
    // ET parent relations — geneticDam and recipientDam as AnimalSummary objects
    Animal_BreedingPlan_geneticDamIdToAnimal: has("parents") ? true : false,
    Animal_BreedingPlan_recipientDamIdToAnimal: has("parents") ? true : false,
    organization: has("org") ? true : false,
    program: has("program") ? true : false,
    breedingMilestones: has("milestones") ? { orderBy: { scheduledDate: "asc" as const } } : false,
  };
}

/**
 * Remap auto-generated Prisma relation names to friendlier API field names.
 * Prisma names like "Animal_BreedingPlan_geneticDamIdToAnimal" become "geneticDam".
 */
function remapETRelations(plan: any): any {
  if (!plan) return plan;
  const out = { ...plan };
  if ("Animal_BreedingPlan_geneticDamIdToAnimal" in out) {
    out.geneticDam = out.Animal_BreedingPlan_geneticDamIdToAnimal;
    delete out.Animal_BreedingPlan_geneticDamIdToAnimal;
  }
  if ("Animal_BreedingPlan_recipientDamIdToAnimal" in out) {
    out.recipientDam = out.Animal_BreedingPlan_recipientDamIdToAnimal;
    delete out.Animal_BreedingPlan_recipientDamIdToAnimal;
  }
  return out;
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
  DOG: { ovulationOffsetDays: 12, gestationDays: 63, offspringCareDurationWeeks: 6, placementStartWeeksDefault: 8, placementExtendedWeeks: 4 },
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
  const lockedStatuses = ["BRED", "PREGNANT", "BIRTHED", "PLAN_COMPLETE", "WEANED", "PLACEMENT", "COMPLETE"];
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
      const postBreedStatuses = ["BIRTHED", "PLAN_COMPLETE", "WEANED", "PLACEMENT", "COMPLETE"];
      if (postBreedStatuses.includes(status)) {
        throw new ImmutabilityError("breedDateActual", "Breeding date cannot be cleared after BRED status");
      }
      // Allow clearing in BRED phase - skip further validation
    } else {
      // Check if value is actually changing (allow same-value passthrough)
      const existingDate = new Date(existingPlan.breedDateActual).toISOString().split("T")[0];
      const newDate = new Date(updates.breedDateActual).toISOString().split("T")[0];
      if (existingDate !== newDate) {
        const postBreedStatuses = ["BIRTHED", "PLAN_COMPLETE", "WEANED", "PLACEMENT", "COMPLETE"];
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
      const postBirthStatuses = ["PLAN_COMPLETE", "WEANED", "PLACEMENT", "COMPLETE"];
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

  // weanedDateActual validation removed — post-birth dates no longer written to plan (Phase 4 cleanup).
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
  "PLAN_COMPLETE", // Terminal plan status
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
        recipientDamId: string;
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
      // Filter by recipient dam (ET plans only)
      if (q.recipientDamId) where.recipientDamId = Number(q.recipientDamId);
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

      const [rawItems, total] = await prisma.$transaction([
        prisma.breedingPlan.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: expand,
        }),
        prisma.breedingPlan.count({ where }),
      ]);

      // Remap auto-generated Prisma ET relation names to friendly API names
      const items = rawItems.map(remapETRelations);

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

      const rawPlan = await prisma.breedingPlan.findFirst({ where: { id, tenantId }, include: expand });
      if (!rawPlan) return reply.code(404).send({ error: "not_found" });

      // Remap auto-generated Prisma ET relation names to friendly API names
      const plan = remapETRelations(rawPlan);

      // Optionally check for carrier warnings (add ?checkCarrierRisk=true)
      // Use geneticDamId for ET plans, damId for standard — genetics always uses genetic parent
      const geneticDamForCheck = plan.geneticDamId ?? plan.damId;
      if (checkCarrierRisk && geneticDamForCheck && plan.sireId) {
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

      // ═══════════════════════════════════════════════════════════════════════════
      // EMBRYO TRANSFER (ET) VALIDATION
      // When geneticDamId + recipientDamId are provided, the plan is an ET plan.
      // Both fields are required together; damId is set to geneticDamId for backward compat.
      // ═══════════════════════════════════════════════════════════════════════════
      const geneticDamIdVal = idNum(b.geneticDamId);
      const recipientDamIdVal = idNum(b.recipientDamId);
      const isET = Boolean(geneticDamIdVal || recipientDamIdVal);

      if (isET) {
        // Both geneticDamId and recipientDamId are required for ET plans
        if (!geneticDamIdVal || !recipientDamIdVal) {
          return reply.code(400).send({
            error: "et_fields_required",
            message: "Genetic dam and recipient are required for embryo transfer plans",
          });
        }

        // Donor and recipient must be different animals
        if (geneticDamIdVal === recipientDamIdVal) {
          return reply.code(409).send({
            error: "donor_recipient_same",
            message: "Donor and recipient must be different animals",
          });
        }

        // Block ET on group breeding plans (BreedingGroup link not possible at creation,
        // but defensively reject if somehow attempted)
        // Group member linking happens via BreedingGroupMember after plan creation,
        // so this is validated at update time. No-op here.

        // Validate geneticDam: must exist, be female, same species, same tenant
        const geneticDam = await prisma.animal.findFirst({
          where: { id: geneticDamIdVal, tenantId },
          select: { species: true, sex: true },
        });
        if (!geneticDam) return reply.code(400).send({ error: "genetic_dam_not_found" });
        if (String(geneticDam.species) !== String(b.species)) {
          return reply.code(400).send({ error: "genetic_dam_species_mismatch", message: "Donor and recipient must be the same species" });
        }
        if (String(geneticDam.sex) !== "FEMALE") {
          return reply.code(400).send({ error: "genetic_dam_sex_mismatch", message: "Both donor and recipient must be female" });
        }

        // Validate recipientDam: must exist, be female, same species, same tenant
        const recipientDam = await prisma.animal.findFirst({
          where: { id: recipientDamIdVal, tenantId },
          select: { species: true, sex: true },
        });
        if (!recipientDam) return reply.code(400).send({ error: "recipient_dam_not_found" });
        if (String(recipientDam.species) !== String(b.species)) {
          return reply.code(400).send({ error: "recipient_dam_species_mismatch", message: "Donor and recipient must be the same species" });
        }
        if (String(recipientDam.sex) !== "FEMALE") {
          return reply.code(400).send({ error: "recipient_dam_sex_mismatch", message: "Both donor and recipient must be female" });
        }
      } else {
        // Not an ET plan — reject ET-only fields if provided
        if (b.geneticDamId !== undefined && b.geneticDamId !== null) {
          return reply.code(400).send({ error: "et_fields_not_allowed", message: "geneticDamId is only valid for embryo transfer plans (provide both geneticDamId and recipientDamId)" });
        }
        if (b.recipientDamId !== undefined && b.recipientDamId !== null) {
          return reply.code(400).send({ error: "et_fields_not_allowed", message: "recipientDamId is only valid for embryo transfer plans (provide both geneticDamId and recipientDamId)" });
        }
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
        // For ET plans: damId = geneticDamId (backward compat — damId always = genetic dam)
        damId: isET ? geneticDamIdVal : (damId ?? null),
        sireId: b.sireId ?? null,
        programId: b.programId ? Number(b.programId) : null, // Breeding Program (marketplace)
        // Embryo Transfer fields
        geneticDamId: isET ? geneticDamIdVal : null,
        recipientDamId: isET ? recipientDamIdVal : null,
        flushDate: b.flushDate ? new Date(b.flushDate) : null,
        embryoTransferDate: b.embryoTransferDate ? new Date(b.embryoTransferDate) : null,
        embryoType: isET ? (b.embryoType ?? null) : null,
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
        // Post-birth date fields live on the plan directly.

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
          where: { id: created.id, tenantId },
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

      // Audit trail + activity log (fire-and-forget)
      const ctx = auditCtx(req, tenantId);
      auditCreate("BREEDING_PLAN", created.id, created as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: created.id,
        kind: "plan_created",
        category: "system",
        title: `Breeding plan created`,
        actorId: ctx.userId,
        actorName: ctx.userName,
      });

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
          geneticDamId: true,
          recipientDamId: true,
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

      // ═══════════════════════════════════════════════════════════════════════════
      // EMBRYO TRANSFER (ET) FIELD HANDLING
      // geneticDamId and recipientDamId together make a plan an ET plan.
      // On update, validate the same rules as create. If changing to/from ET,
      // handle the transition cleanly.
      // ═══════════════════════════════════════════════════════════════════════════
      if (b.geneticDamId !== undefined || b.recipientDamId !== undefined) {
        // Determine effective values after update
        const effectiveGeneticDamId = b.geneticDamId !== undefined
          ? idNum(b.geneticDamId)
          : existing.geneticDamId;
        const effectiveRecipientDamId = b.recipientDamId !== undefined
          ? idNum(b.recipientDamId)
          : existing.recipientDamId;

        const becomingET = Boolean(effectiveGeneticDamId || effectiveRecipientDamId);

        if (becomingET) {
          // Both must be set for ET plans
          if (!effectiveGeneticDamId || !effectiveRecipientDamId) {
            return reply.code(400).send({
              error: "et_fields_required",
              message: "Genetic dam and recipient are required for embryo transfer plans",
            });
          }

          // Donor and recipient must be different
          if (effectiveGeneticDamId === effectiveRecipientDamId) {
            return reply.code(409).send({
              error: "donor_recipient_same",
              message: "Donor and recipient must be different animals",
            });
          }

          // Block ET on group breeding plans
          const groupMember = await prisma.breedingGroupMember.findFirst({
            where: { breedingPlanId: id },
            select: { id: true },
          });
          if (groupMember) {
            return reply.code(400).send({
              error: "et_group_breeding_blocked",
              message: "Embryo transfer is not available for group breeding plans",
            });
          }

          // Validate geneticDam if being changed
          if (b.geneticDamId !== undefined && effectiveGeneticDamId) {
            const geneticDam = await prisma.animal.findFirst({
              where: { id: effectiveGeneticDamId, tenantId },
              select: { species: true, sex: true },
            });
            if (!geneticDam) return reply.code(400).send({ error: "genetic_dam_not_found" });
            if (String(geneticDam.species) !== String(targetSpecies)) {
              return reply.code(400).send({ error: "genetic_dam_species_mismatch", message: "Donor and recipient must be the same species" });
            }
            if (String(geneticDam.sex) !== "FEMALE") {
              return reply.code(400).send({ error: "genetic_dam_sex_mismatch", message: "Both donor and recipient must be female" });
            }
          }

          // Validate recipientDam if being changed
          if (b.recipientDamId !== undefined && effectiveRecipientDamId) {
            const recipientDam = await prisma.animal.findFirst({
              where: { id: effectiveRecipientDamId, tenantId },
              select: { species: true, sex: true },
            });
            if (!recipientDam) return reply.code(400).send({ error: "recipient_dam_not_found" });
            if (String(recipientDam.species) !== String(targetSpecies)) {
              return reply.code(400).send({ error: "recipient_dam_species_mismatch", message: "Donor and recipient must be the same species" });
            }
            if (String(recipientDam.sex) !== "FEMALE") {
              return reply.code(400).send({ error: "recipient_dam_sex_mismatch", message: "Both donor and recipient must be female" });
            }
          }

          // Set the fields
          if (b.geneticDamId !== undefined) {
            data.geneticDamId = effectiveGeneticDamId;
            // damId = geneticDamId for backward compat
            data.damId = effectiveGeneticDamId;
          }
          if (b.recipientDamId !== undefined) data.recipientDamId = effectiveRecipientDamId;
        } else {
          // Clearing ET fields (transitioning FROM ET to standard)
          if (b.geneticDamId === null) data.geneticDamId = null;
          if (b.recipientDamId === null) data.recipientDamId = null;
        }
      }

      // Handle ET optional date/type fields on update
      if (b.flushDate !== undefined) data.flushDate = b.flushDate ? new Date(b.flushDate) : null;
      if (b.embryoTransferDate !== undefined) data.embryoTransferDate = b.embryoTransferDate ? new Date(b.embryoTransferDate) : null;
      if (b.embryoType !== undefined) data.embryoType = b.embryoType ?? null;

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
        // Post-birth date fields on the plan.
        "weanedDateActual",
        "placementStartDateActual",
        "placementCompletedDateActual",
        "completedDateActual",
        "expectedWeaned",
        "expectedPlacementStart",
        "expectedPlacementCompleted",
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

      // BUSINESS RULE: Cannot clear birthDateActual if offspring exist for this plan
      if (b.birthDateActual === null) {
        const offspringCount = await prisma.offspring.count({
          where: { tenantId, breedingPlanId: id },
        });
        if (offspringCount > 0) {
          return reply.code(400).send({
            error: "cannot_clear_birth_date_with_offspring",
            detail: "Cannot clear the actual birth date because offspring have already been added. Remove all offspring first before clearing this date.",
          });
        }
      }

      // Post-birth date dependency validations
      // Cannot clear weanedDateActual if placementStartDateActual is set
      if (b.weanedDateActual === null) {
        const placementStartWillExist = b.placementStartDateActual !== null &&
          (b.placementStartDateActual !== undefined || (existingPlanDates as any)?.placementStartDateActual);
        if (placementStartWillExist) {
          return reply.code(400).send({
            error: "cannot_clear_date_with_downstream_date",
            detail: "Cannot clear the actual weaned date because the actual placement start date is recorded. Clear the downstream date first.",
          });
        }
      }

      // Cannot clear placementStartDateActual if placementCompletedDateActual is set
      if (b.placementStartDateActual === null) {
        const placementCompletedWillExist = b.placementCompletedDateActual !== null &&
          (b.placementCompletedDateActual !== undefined || (existingPlanDates as any)?.placementCompletedDateActual);
        if (placementCompletedWillExist) {
          return reply.code(400).send({
            error: "cannot_clear_date_with_downstream_date",
            detail: "Cannot clear the actual placement start date because the actual placement completed date is recorded. Clear the downstream date first.",
          });
        }
      }

      if (b.status !== undefined) {
        let s = normalizePlanStatus(b.status);
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
        // Post-birth effective date computations
        const effectiveWeanedDate = data.weanedDateActual !== undefined
          ? data.weanedDateActual
          : (b.weanedDateActual !== undefined ? (b.weanedDateActual ? new Date(b.weanedDateActual) : null) : undefined);
        const effectivePlacementStartDate = data.placementStartDateActual !== undefined
          ? data.placementStartDateActual
          : (b.placementStartDateActual !== undefined ? (b.placementStartDateActual ? new Date(b.placementStartDateActual) : null) : undefined);

        // For status transitions, we need to check existing DB values too
        const existingPlan = await prisma.breedingPlan.findFirst({
          where: { id, tenantId },
          select: {
            cycleStartDateActual: true,
            breedDateActual: true,
            birthDateActual: true,
            weanedDateActual: true,
            placementStartDateActual: true,
            ovulationConfirmed: true,
            ovulationConfirmedMethod: true,
            reproAnchorMode: true,
            cycleStartDateUnknown: true,
          },
        });

        // Use undefined check instead of ?? so explicit null values are preserved
        // (null ?? x returns x, but we want null to mean "clear this date")
        const finalCycleStart = effectiveCycleStart !== undefined ? effectiveCycleStart : existingPlan?.cycleStartDateActual;
        const finalBreedDate = effectiveBreedDate !== undefined ? effectiveBreedDate : existingPlan?.breedDateActual;
        const finalBirthDate = effectiveBirthDate !== undefined ? effectiveBirthDate : existingPlan?.birthDateActual;
        const finalOvulationConfirmed = existingPlan?.ovulationConfirmed;
        const isOvulationAnchor = existingPlan?.reproAnchorMode === "OVULATION";
        const isCycleStartUnknown = b.cycleStartDateUnknown ?? existingPlan?.cycleStartDateUnknown ?? false;

        // VALIDATION: Dam and Sire must be set before advancing past PLANNING
        // Check effective values (payload overrides existing)
        const effectiveDamId = data.damId !== undefined ? data.damId : existing.damId;
        const effectiveSireId = data.sireId !== undefined ? data.sireId : existing.sireId;
        // Backward compat: map COMPLETE → PLAN_COMPLETE with deprecation log.
        if (s === "COMPLETE") {
          req.log?.warn?.({ planId: id, requestedStatus: s }, "DEPRECATED: COMPLETE status requested on plan — mapping to PLAN_COMPLETE. Use PLAN_COMPLETE directly.");
          s = "PLAN_COMPLETE";
        }

        // Post-birth statuses (BORN, WEANED, PLACEMENT) are valid plan statuses.
        // For direct status changes via PATCH, recommend using the lifecycle endpoints instead.
        if (s === "BORN" || s === "WEANED" || s === "PLACEMENT") {
          req.log?.info?.({ planId: id, requestedStatus: s },
            "Post-birth status set via PATCH. Consider using POST /breeding/plans/:id/advance-lifecycle instead.");
        }

        const POST_PLANNING = ["CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
          "BRED", "PREGNANT", "BIRTHED", "BORN", "WEANED", "PLACEMENT", "PLAN_COMPLETE"];
        if (POST_PLANNING.includes(s) && (!effectiveDamId || !effectiveSireId)) {
          return reply.code(400).send({
            error: "dam_sire_required",
            detail: "Both dam and sire must be assigned before advancing past the Planning phase.",
          });
        }

        // Validate required dates for each status
        // When using ovulation anchors, ovulation confirmed date can substitute for cycle start
        // Induced ovulators (CAT, RABBIT, ALPACA, LLAMA) skip CYCLE phase and don't require cycle data for BRED
        // cycleStartDateUnknown also satisfies the cycle data requirement (surprise pregnancy workflow)
        // Also accept confirmed ovulation data (date + method) even if reproAnchorMode wasn't formally upgraded
        const hasOvulationData = finalOvulationConfirmed && existingPlan?.ovulationConfirmedMethod;
        const hasRequiredCycleData = finalCycleStart ||
          isCycleStartUnknown ||
          (isOvulationAnchor && finalOvulationConfirmed) ||
          hasOvulationData;
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
        if (s === "PLAN_COMPLETE" && !finalBirthDate) {
          return reply.code(400).send({
            error: "date_required_for_status",
            detail: "birthDateActual is required to set status to PLAN_COMPLETE"
          });
        }

        // BUSINESS RULE: Status regression validation
        // Define the progression order of statuses (index = progression level)
        // Note: CANCELED, UNSUCCESSFUL, ON_HOLD are terminal/semi-terminal statuses that can be set from any phase
        // PLAN_COMPLETE is the terminal plan status
        const STATUS_ORDER = [
          "PLANNING", "CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING",
          "BRED", "PREGNANT", "BIRTHED", "BORN", "WEANED", "PLACEMENT", "PLAN_COMPLETE"
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
            const offspringCount = await prisma.offspring.count({
              where: { tenantId, breedingPlanId: id },
            });
            if (offspringCount > 0) {
              return reply.code(400).send({
                error: "cannot_regress_status_with_offspring",
                detail: `Cannot change status from ${existing.status} to ${s} because offspring have already been added. Remove all offspring first before regressing the plan status.`,
              });
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
          // Post-birth date regression checks
          const finalWeanedDate = effectiveWeanedDate !== undefined ? effectiveWeanedDate : existingPlan?.weanedDateActual;
          const finalPlacementStartDate = effectivePlacementStartDate !== undefined ? effectivePlacementStartDate : existingPlan?.placementStartDateActual;
          if (newStatusIndex < STATUS_ORDER.indexOf("WEANED") && finalWeanedDate) {
            return reply.code(400).send({
              error: "cannot_regress_status_with_date",
              detail: `Cannot change status to ${s} while weanedDateActual is recorded. Clear the weaned date first.`,
            });
          }
          if (newStatusIndex < STATUS_ORDER.indexOf("PLACEMENT") && finalPlacementStartDate) {
            return reply.code(400).send({
              error: "cannot_regress_status_with_date",
              detail: `Cannot change status to ${s} while placementStartDateActual is recorded. Clear the placement start date first.`,
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

      // ═══════════════════════════════════════════════════════════════════════════
      // OFFSPRING GUARD: Block status changes that would orphan offspring records
      // The frontend hides these options after birth, but API must enforce independently
      // ═══════════════════════════════════════════════════════════════════════════
      const terminalStatuses = ["PLANNING", "CANCELED", "UNSUCCESSFUL"];
      if (data.status && terminalStatuses.includes(String(data.status))) {
        const offspringCount = await prisma.offspring.count({
          where: { tenantId, breedingPlanId: id },
        });
        if (offspringCount > 0) {
          return reply.code(409).send({
            error: "status_change_blocked",
            blockers: { hasOffspring: true },
            detail: `Cannot change status to ${data.status} because ${offspringCount} offspring record(s) are linked to this plan. Remove offspring first.`,
          });
        }
      }

      // Track dam/sire changes for status sync
      const damChanged = data.damId !== undefined;
      const sireChanged = data.sireId !== undefined;
      const statusChanged = data.status !== undefined;

      // Snapshot full row before update for audit trail
      const beforeSnap = await prisma.breedingPlan.findFirst({ where: { id, tenantId } });

      const updated = await prisma.breedingPlan.update({ where: { id, tenantId }, data });

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

      // ═══════════════════════════════════════════════════════════════════════════
      // AUTO-CREATE BreedingEvent records when key milestones occur
      // These events provide a timeline history for each animal's breeding profile
      // ═══════════════════════════════════════════════════════════════════════════
      try {
        const userId = (req as any).user?.id ?? "system";
        const eventsToCreate: Array<{
          tenantId: number;
          animalId: number;
          eventType: string;
          occurredAt: Date;
          outcome?: string;
          breedingPlanId?: number;
          partnerAnimalId?: number;
          title?: string;
          description?: string;
          serviceType?: string;
          totalBorn?: number;
          bornAlive?: number;
          stillborn?: number;
          deliveryType?: string;
          createdBy?: string;
        }> = [];

        // Check if breedDateActual was newly set
        const breedDateNewlySet = !existing.breedDateActual && data.breedDateActual;
        if (breedDateNewlySet) {
          const breedDate = data.breedDateActual instanceof Date
            ? data.breedDateActual
            : new Date(data.breedDateActual);

          // Create event for dam (if exists)
          if (updated.damId) {
            eventsToCreate.push({
              tenantId,
              animalId: updated.damId,
              eventType: "BREEDING_ATTEMPT",
              occurredAt: breedDate,
              outcome: "PENDING",
              breedingPlanId: id,
              partnerAnimalId: updated.sireId ?? undefined,
              title: `Breeding with plan ${updated.code || `#${id}`}`,
              description: `Auto-recorded from breeding plan update`,
              createdBy: userId,
            });
          }

          // Create event for sire (if exists)
          if (updated.sireId) {
            eventsToCreate.push({
              tenantId,
              animalId: updated.sireId,
              eventType: "BREEDING_ATTEMPT",
              occurredAt: breedDate,
              outcome: "PENDING",
              breedingPlanId: id,
              partnerAnimalId: updated.damId ?? undefined,
              title: `Breeding with plan ${updated.code || `#${id}`}`,
              description: `Auto-recorded from breeding plan update`,
              createdBy: userId,
            });
          }
        }

        // Check if status transitioned to PREGNANT
        const statusChangedToPregnant = existing.status !== "PREGNANT" && String(updated.status) === "PREGNANT";
        if (statusChangedToPregnant && updated.damId) {
          eventsToCreate.push({
            tenantId,
            animalId: updated.damId,
            eventType: "PREGNANCY_CONFIRMED",
            occurredAt: new Date(),
            outcome: "SUCCESSFUL",
            breedingPlanId: id,
            partnerAnimalId: updated.sireId ?? undefined,
            title: `Pregnancy confirmed for plan ${updated.code || `#${id}`}`,
            description: `Auto-recorded from breeding plan status change`,
            createdBy: userId,
          });
        }

        // Check if birthDateActual was newly set
        const birthDateNewlySet = !existing.birthDateActual && data.birthDateActual;
        if (birthDateNewlySet && updated.damId) {
          const birthDate = data.birthDateActual instanceof Date
            ? data.birthDateActual
            : new Date(data.birthDateActual);

          eventsToCreate.push({
            tenantId,
            animalId: updated.damId,
            eventType: "BIRTH_OUTCOME",
            occurredAt: birthDate,
            outcome: "SUCCESSFUL",
            breedingPlanId: id,
            partnerAnimalId: updated.sireId ?? undefined,
            title: `Birth recorded for plan ${updated.code || `#${id}`}`,
            description: `Auto-recorded from breeding plan update`,
            createdBy: userId,
          });
        }

        // Bulk create all events
        if (eventsToCreate.length > 0) {
          await prisma.breedingEvent.createMany({ data: eventsToCreate });
          req.log?.info?.({ planId: id, eventCount: eventsToCreate.length }, "Auto-created BreedingEvent records");
        }
      } catch (eventErr) {
        // Log but don't fail the update - event creation is secondary
        req.log?.warn?.({ err: eventErr, planId: id }, "Failed to auto-create BreedingEvent records");
      }


      // Auto-advance plan lifecycle if a date gate is now satisfied
      {
        const postBirthDateFields = [
          "weanedDateActual", "placementStartDateActual", "placementCompletedDateActual",
          "completedDateActual", "birthDateActual",
        ];
        const anyDateChanged = postBirthDateFields.some((f) => (data as any)[f] !== undefined);
        if (anyDateChanged) {
          try {
            await prisma.$transaction(async (tx) => {
              await autoAdvancePlanIfReady(tx, id, tenantId);
            });
          } catch (advanceErr) {
            req.log?.warn?.({ err: advanceErr, planId: id }, "Auto-advance check failed (non-blocking)");
          }
        }
      }

      // Check for carrier × carrier lethal pairings when dam or sire changes
      let carrierRisk: { hasLethalRisk: boolean; hasWarnings: boolean; warnings: any[] } | null = null;
      if ((damChanged || sireChanged) && updated.damId && updated.sireId) {
        const userId = (req as any).user?.id ?? null;
        carrierRisk = await checkBreedingPlanCarrierRisk(prisma, updated.id, tenantId, userId, true);
      }

      // Audit trail (fire-and-forget)
      if (beforeSnap) {
        auditUpdate("BREEDING_PLAN", id, beforeSnap as any, updated as any, auditCtx(req, tenantId));
      }

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_updated",
        category: "system",
        title: "Breeding plan updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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
        "PLAN_COMPLETE",
        "WEANED",      // Legacy (pre-migration)
        "PLACEMENT",   // Legacy (pre-migration)
        "COMPLETE",    // Legacy (pre-migration)
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
          where: { id: plan.id, tenantId },
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

        // This commit endpoint only locks the cycle timeline

        // Sync animal breeding statuses for dam and sire
        if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId, tx);
        if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId, tx);

        return saved;
      });

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_committed",
        category: "status",
        title: "Breeding plan committed to active cycle",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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
        // Check for blockers before uncommitting
        const blockers: any = {};

        // Check for offspring linked to this plan
        try {
          const offspringCount = await tx.offspring.count({
            where: { tenantId, breedingPlanId: plan.id },
          });
          if (offspringCount > 0) blockers.hasOffspring = true;
        } catch (e) {
          // Table may not exist, skip this check
        }

        // Check for buyers (via waitlist/reservations)
        try {
          const buyersCount = await tx.waitlistEntry.count({
            where: { tenantId, planId: plan.id },
          });
          if (buyersCount > 0) blockers.hasBuyers = true;
        } catch (e) {
          // Table or field may not exist, skip this check
        }

        // If any blockers exist, return 409
        if (Object.keys(blockers).length > 0) {
          return { blocked: true, blockers };
        }

        // Revert plan to PLANNING status
        const updated = await tx.breedingPlan.update({
          where: { id: plan.id, tenantId },
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_uncommitted",
        category: "status",
        title: "Breeding plan uncommitted",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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
   * Non-destructively rewinds a breeding plan back exactly one phase by
   * updating only the status field. All entered data (dates, exams, etc.)
   * is preserved so the breeder can immediately re-advance if needed.
   *
   * Blocks:
   * - COMPLETE: terminal, cannot rewind
   * - BIRTHED or WEANED with registered offspring: must Cancel instead
   * - CANCELED / UNSUCCESSFUL / ON_HOLD: terminal statuses
   *
   * Body:
   * - actorId?: string (for audit trail)
   *
   * Returns:
   * - { ok: true, fromPhase, toPhase } on success
   * - 400 with error code if validation fails
   * - 409 with error code if blocked by offspring
   */
  app.post("/breeding/plans/:id/rewind", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const userId = (req as any).user?.id ?? null;

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          damId: true,
          sireId: true,
          // Lock fields — only cleared when rewinding CYCLE/BRED → PLANNING
          lockedCycleStart: true,
          lockedOvulationDate: true,
          lockedDueDate: true,
          lockedPlacementStartDate: true,
          committedAt: true,
          committedByUserId: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      const currentStatus = String(plan.status);

      // Hard-blocked statuses: terminal or already at start
      // PLAN_COMPLETE is NOT hard-blocked — breeders can rewind from Complete to Placed.
      const HARD_BLOCKED = ["PLANNING", "COMPLETE", "CANCELED", "UNSUCCESSFUL", "ON_HOLD"];
      if (HARD_BLOCKED.includes(currentStatus)) {
        const isPlanning = currentStatus === "PLANNING";
        return reply.code(400).send({
          error: isPlanning ? "cannot_rewind_planning" : "cannot_rewind_terminal",
          detail: isPlanning
            ? "Plan is already in PLANNING phase. Nothing to rewind."
            : `Plans in ${currentStatus} status cannot be rewound.`,
        });
      }

      // One-step-back map: currentStatus → targetStatus
      // CYCLE → PLANNING also clears lock fields so the plan can be re-committed.
      type RewindTarget = {
        toStatus: string;
        extraClearFields?: Record<string, null | false>;
      };

      // Shared clear-fields for any transition that lands on PLANNING
      const CYCLE_TO_PLANNING_CLEARS: Record<string, null | false> = {
        cycleStartDateActual: null,
        cycleStartDateUnknown: false,
        lockedCycleStart: null,
        lockedOvulationDate: null,
        lockedDueDate: null,
        lockedPlacementStartDate: null,
        committedAt: null,
        committedByUserId: null,
      };

      const REWIND_MAP: Record<string, RewindTarget> = {
        // Legacy alias
        COMMITTED:           { toStatus: "PLANNING", extraClearFields: CYCLE_TO_PLANNING_CLEARS },
        CYCLE:               { toStatus: "PLANNING", extraClearFields: CYCLE_TO_PLANNING_CLEARS },
        // Rewinding from BRED (Breeding phase) goes directly to PLANNING for all species.
        //
        // For induced ovulators (CAT, RABBIT) the CYCLE status is not a visible phase
        // in the UI journey, so BRED → CYCLE → PLANNING would require two invisible clicks.
        //
        // For cyclic ovulators (HORSE, DOG, GOAT, SHEEP) CYCLE is a visible intermediate
        // phase, but breeders expect "undo a breeding attempt" to land in Planning — not
        // in an intermediate cycle-monitoring state. The cycle lock fields are cleared so
        // the plan can be fully re-committed when they advance again.
        BRED:                { toStatus: "PLANNING", extraClearFields: CYCLE_TO_PLANNING_CLEARS },
        BIRTHED:             { toStatus: "BRED" },
        BORN:                { toStatus: "BIRTHED", extraClearFields: { birthDateActual: null, expectedWeaned: null, expectedPlacementStart: null, expectedPlacementCompleted: null } },
        WEANED:              { toStatus: "BIRTHED" },
        // DB status PLACEMENT is used for both PLACEMENT_STARTED and PLACEMENT_COMPLETED display phases.
        // Clearing placementStartDateActual ensures the plan displays as PLACEMENT_STARTED after rewind.
        PLACEMENT:           { toStatus: "WEANED", extraClearFields: { placementStartDateActual: null } },
        PLACEMENT_STARTED:   { toStatus: "WEANED", extraClearFields: { placementStartDateActual: null } },   // dead code (not a real DB enum value, kept for safety)
        PLACEMENT_COMPLETED: { toStatus: "PLACEMENT_STARTED" },   // dead code (not a real DB enum value, kept for safety)
        // Rewinding from PLAN_COMPLETE goes back to PLACEMENT (displays as PLACEMENT_COMPLETED since
        // placementStartDateActual is still set). Clears completedDateActual so the date can be re-entered.
        PLAN_COMPLETE:       { toStatus: "PLACEMENT", extraClearFields: { completedDateActual: null } },
      };

      const target = REWIND_MAP[currentStatus];
      if (!target) {
        return reply.code(400).send({
          error: "cannot_rewind",
          detail: `Cannot rewind from status: ${currentStatus}`,
        });
      }

      // Build the update payload: only status changes, plus lock fields for CYCLE → PLANNING
      const updateData: Record<string, any> = {
        status: target.toStatus,
        ...(target.extraClearFields ?? {}),
      };

      await prisma.$transaction(async (tx) => {
        await tx.breedingPlan.update({
          where: { id: plan.id, tenantId },
          data: updateData,
        });

        await tx.breedingPlanEvent.create({
          data: {
            tenantId: plan.tenantId,
            planId: plan.id,
            type: "PLAN_PHASE_REWOUND",
            occurredAt: new Date(),
            label: `Phase rewound from ${currentStatus} to ${target.toStatus}`,
            data: {
              fromPhase: currentStatus,
              toPhase: target.toStatus,
              clearedFields: target.extraClearFields ? Object.keys(target.extraClearFields) : [],
            },
            recordedByUserId: userId,
          },
        });
      });

      // Sync animal breeding statuses after rewind
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_phase_rewound",
        category: "status",
        title: `Breeding plan phase rewound from ${currentStatus} to ${target.toStatus}`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send({
        ok: true,
        fromPhase: currentStatus,
        toPhase: target.toStatus,
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
          where: { id, tenantId },
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_cycle_locked",
        category: "status",
        title: "Cycle locked with anchor date",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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
      const postBreedStatuses = ["BIRTHED", "PLAN_COMPLETE", "WEANED", "PLACEMENT", "COMPLETE"];
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
          where: { id, tenantId },
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_ovulation_upgraded",
        category: "status",
        title: "Upgraded to ovulation-anchored mode",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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
        where: { id, tenantId },
        data: {
          ovulationConfirmed: null,
          ovulationConfirmedMethod: null,
          reproAnchorMode: "CYCLE_START",
          // Note: We keep lockedOvulationDate as it was calculated from cycle start
          // and can still be useful as an estimate
        },
      });

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_ovulation_cleared",
        category: "status",
        title: "Ovulation confirmation cleared",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      await prisma.breedingPlan.updateMany({ where: { id, tenantId }, data: { archived: true } });

      // Sync animal breeding statuses (they may revert from BREEDING if no other active plans)
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot after archiving (decreases count)
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_archived",
        category: "status",
        title: "Breeding plan archived",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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

      // Get plan with dam/sire and status before restoring
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          damId: true,
          sireId: true,
          status: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      const now = new Date();

      // Restore plan in a transaction
      await prisma.$transaction(async (tx) => {
        const restoreStatus = "PLAN_COMPLETE";

        await tx.breedingPlan.updateMany({
          where: { id, tenantId },
          data: {
            archived: false,
            archiveReason: null,
            status: restoreStatus as any,
          },
        });

        // Create audit event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: "UNARCHIVED",
            occurredAt: now,
            label: "Plan Restored",
            notes: "Plan restored from archive",
            data: {
              previousStatus: plan.status,
              restoredToStatus: restoreStatus,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_restored",
        category: "status",
        title: "Breeding plan restored",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send({
        ok: true,
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
   * Validates and archives a breeding plan.
   * This is the "complete" archival workflow that:
   * 1. Runs validation checks
   * 2. Blocks if there are blockers (unless force=true)
   * 3. Archives the plan
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

      // Get plan for archiving
      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          damId: true,
          sireId: true,
          status: true,
        },
      });

      if (!plan) return reply.code(404).send({ error: "not_found" });

      const now = new Date();
      const archiveReason = body.reason || null;

      // Archive the plan in a transaction
      await prisma.$transaction(async (tx) => {
        await tx.breedingPlan.updateMany({
          where: { id, tenantId },
          data: {
            archived: true,
            archiveReason,
            status: "PLAN_COMPLETE" as any,
            completedDateActual: now,
          },
        });

        // Create audit event
        await tx.breedingPlanEvent.create({
          data: {
            tenantId,
            planId: id,
            type: "ARCHIVED",
            occurredAt: now,
            label: "Plan Completed and Archived",
            notes: archiveReason
              ? `Plan archived. Reason: ${archiveReason}`
              : "Plan archived",
            data: {
              archiveReason,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_archive_completed",
        category: "status",
        title: "Breeding plan archive completed",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      return reply.send({
        ok: true,
        archived: true,
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

  /* ─────────────────────────────────────────────────────────────────────── *
   * GET /breeding/plans/:id/dependencies                                     *
   * Pre-flight check used by EndPlanModal to surface all linked data before  *
   * the user confirms Delete or Reset. Returns counts per category and a     *
   * hasHardBlocker flag when cross-tenant lineage links exist (those cannot  *
   * be deleted/reset under any circumstances).                                *
   * ─────────────────────────────────────────────────────────────────────── */
  app.get("/breeding/plans/:id/dependencies", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { id: true, birthDateActual: true },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Run all counts in parallel for performance
      const [
        offspringCount,
        buyersCount,
        invoiceCount,
        contractCount,
        documentCount,
        waitlistCount,
        examCount,
        neonatalCount,
      ] = await Promise.all([
        prisma.offspring.count({ where: { tenantId, breedingPlanId: id } }).catch(() => 0),
        prisma.breedingPlanBuyer.count({ where: { tenantId, planId: id } }).catch(() => 0),
        prisma.invoice.count({ where: { tenantId, offspring: { breedingPlanId: id } } }).catch(() => 0),
        prisma.offspringContract.count({ where: { tenantId, offspring: { breedingPlanId: id } } }).catch(() => 0),
        prisma.offspringDocument.count({ where: { tenantId, offspring: { breedingPlanId: id } } }).catch(() => 0),
        prisma.waitlistEntry.count({ where: { tenantId, planId: id } }).catch(() => 0),
        prisma.testResult.count({ where: { tenantId, planId: id } }).catch(() => 0),
        prisma.neonatalCareEntry.count({ where: { tenantId, offspring: { breedingPlanId: id } } }).catch(() => 0),
      ]);

      // Check for cross-tenant lineage on promoted offspring — this is the only hard block
      let crossTenantLinkCount = 0;
      try {
        const promotedOffspring = await prisma.offspring.findMany({
          where: { tenantId, breedingPlanId: id, promotedAnimalId: { not: null } },
          select: { promotedAnimalId: true },
        });
        const promotedAnimalIds = promotedOffspring
          .map((o) => o.promotedAnimalId)
          .filter((animalId): animalId is number => animalId !== null);

        if (promotedAnimalIds.length > 0) {
          crossTenantLinkCount = await prisma.crossTenantAnimalLink.count({
            where: {
              active: true,
              OR: [
                { childAnimalId: { in: promotedAnimalIds } },
                { parentAnimalId: { in: promotedAnimalIds } },
              ],
            },
          });
        }
      } catch {
        // CrossTenantAnimalLink table may not exist in older schemas — non-blocking
      }

      // Hard blockers (in priority order):
      // 1. Registered offspring — plan has real breeding data, delete is inappropriate
      // 2. Cross-tenant lineage — links cannot be severed
      const hasRegisteredOffspring = offspringCount > 0;
      const hasCrossTenantLinks = crossTenantLinkCount > 0;
      const hasHardBlocker = hasRegisteredOffspring || hasCrossTenantLinks;
      const hardBlockerReason = hasCrossTenantLinks
        ? "One or more offspring from this plan have cross-tenant lineage links. This plan cannot be deleted until those links are removed."
        : hasRegisteredOffspring
        ? `${offspringCount} offspring are registered on this plan. Plans with registered offspring cannot be deleted — use Cancel or Archive instead.`
        : null;

      return reply.send({
        offspring: { count: offspringCount },
        buyers: { count: buyersCount },
        invoices: { count: invoiceCount },
        contracts: { count: contractCount },
        documents: { count: documentCount },
        waitlistEntries: { count: waitlistCount },
        examResults: { count: examCount },
        neonatalCareEntries: { count: neonatalCount },
        crossTenantLineageLinks: { count: crossTenantLinkCount },
        hasHardBlocker,
        hardBlockerReason,
      });
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
          birthDateActual: true,
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

      // 1. Check for offspring records linked to this plan
      try {
        const offspringCount = await prisma.offspring.count({
          where: { tenantId, breedingPlanId: plan.id },
        });
        if (offspringCount > 0) {
          blockers.hasOffspring = true;
          blockerDetails.push(`${offspringCount} offspring record(s) linked to this plan`);
        }
      } catch (e) {
        // Table may not exist in older schemas
      }

      // 2. Check for invoices linked to offspring of this plan
      try {
        const invoiceCount = await prisma.invoice.count({
          where: {
            tenantId,
            offspring: { breedingPlanId: plan.id },
          },
        });
        if (invoiceCount > 0) {
          blockers.hasInvoices = true;
          blockerDetails.push(`${invoiceCount} invoice(s) linked to offspring`);
        }
      } catch (e) {
        // Fields may not exist
      }

      // 3. Check for contracts/documents linked to offspring of this plan
      try {
        const contractCount = await prisma.offspringContract.count({
          where: {
            tenantId,
            offspring: { breedingPlanId: plan.id },
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
            offspring: { breedingPlanId: plan.id },
          },
        });
        if (documentCount > 0) {
          blockers.hasDocuments = true;
          blockerDetails.push(`${documentCount} document(s) exist for offspring`);
        }
      } catch (e) {
        // Table may not exist
      }

      // 4. Check for actual birth date recorded on the plan
      if (plan.birthDateActual) {
        blockers.hasBirthDate = true;
        blockerDetails.push('Actual birth date has been recorded');
      }

      // 5. Check for breeding plan buyers (BreedingPlanBuyer table)
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

      // 6. Check for waitlist entries linked to plan
      try {
        const planWaitlistCount = await prisma.waitlistEntry.count({
          where: { tenantId, planId: plan.id },
        });
        if (planWaitlistCount > 0) {
          blockers.hasPlanWaitlist = true;
          blockerDetails.push(`${planWaitlistCount} waitlist entry/entries linked to plan`);
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
      await prisma.breedingPlan.updateMany({
        where: { id, tenantId },
        data: { deletedAt: now, archived: true },
      });

      // Sync animal breeding statuses (they may revert from BREEDING if no other active plans)
      if (plan.damId) await syncAnimalBreedingStatus(plan.damId, tenantId);
      if (plan.sireId) await syncAnimalBreedingStatus(plan.sireId, tenantId);

      // Update usage snapshot after deleting (decreases count)
      await updateUsageSnapshot(tenantId, "BREEDING_PLAN_COUNT");

      // Audit trail (fire-and-forget)
      auditDelete("BREEDING_PLAN", id, auditCtx(req, tenantId));

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_deleted",
        category: "system",
        title: "Breeding plan deleted",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Bulk-delete exam results for a plan ───────────── */

  /**
   * DELETE /breeding/plans/:id/exam-results
   * Deletes ALL TestResult records linked to this plan (any kind).
   * Clears ovulationTestResultId FK first to avoid constraint issues.
   */
  app.delete("/breeding/plans/:id/exam-results", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const plan = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { id: true, tenantId: true, ovulationTestResultId: true },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      const result = await prisma.$transaction(async (tx) => {
        // Clear ovulation anchor FK so the linked exam can be deleted
        if (plan.ovulationTestResultId) {
          await tx.breedingPlan.updateMany({
            where: { id: plan.id, tenantId },
            data: { ovulationTestResultId: null },
          });
        }

        // Delete all exam results linked to this plan
        const deleted = await tx.testResult.deleteMany({
          where: { planId: plan.id, tenantId },
        });

        return deleted.count;
      });

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: id,
        kind: "plan_exams_deleted",
        category: "health",
        title: `Deleted ${result} reproductive exam(s) for breeding plan`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send({ ok: true, deletedCount: result });
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

      logEntityActivity({
        tenantId,
        entityType: "ANIMAL",
        entityId: created.id,
        kind: "cycle_created",
        category: "health",
        title: "Reproductive cycle recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      const updated = await prisma.reproductiveCycle.update({ where: { id, tenantId }, data });

      logEntityActivity({
        tenantId,
        entityType: "ANIMAL",
        entityId: id,
        kind: "cycle_updated",
        category: "health",
        title: "Reproductive cycle updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "plan_event_added",
        category: "event",
        title: "Breeding event recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "plan_test_added",
        category: "health",
        title: "Test result recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      // For ET attempts: if plan has a flushEventId, auto-populate flushDate from FlushEvent
      let attemptData = b.data ?? null;
      if (b.method === "EMBRYO_TRANSFER") {
        const etPlan = await prisma.breedingPlan.findFirst({
          where: { id: planId, tenantId },
          select: { flushEventId: true },
        });
        if (etPlan?.flushEventId) {
          const flushEvent = await prisma.flushEvent.findUnique({
            where: { id: etPlan.flushEventId },
            select: { flushDate: true },
          });
          if (flushEvent && attemptData && typeof attemptData === "object") {
            if (!(attemptData as any).flushDate) {
              (attemptData as any).flushDate = flushEvent.flushDate.toISOString();
            }
          }
        }
      }

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
          location: b.location ?? null,
          data: attemptData,
        },
      });

      // Set breedDateActual to the earliest attempt date across all attempts for this plan
      const earliest = await prisma.breedingAttempt.findFirst({
        where: { planId, tenantId, attemptAt: { not: null } },
        orderBy: { attemptAt: "asc" },
        select: { attemptAt: true },
      });
      await prisma.breedingPlan.updateMany({
        where: { id: planId, tenantId },
        data: { breedDateActual: earliest?.attemptAt ?? null },
      });

      // Auto-sync ET procedure details from attempt to plan
      if (b.method === "EMBRYO_TRANSFER" && b.data) {
        const etData = b.data as { flushDate?: string; transferDate?: string; embryoType?: string };
        const planUpdate: Record<string, unknown> = {};
        if (etData.flushDate) planUpdate.flushDate = new Date(etData.flushDate);
        if (etData.transferDate) planUpdate.embryoTransferDate = new Date(etData.transferDate);
        if (etData.embryoType) planUpdate.embryoType = etData.embryoType;
        if (Object.keys(planUpdate).length > 0) {
          await prisma.breedingPlan.updateMany({
            where: { id: planId, tenantId },
            data: planUpdate,
          });
        }
      }

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "breeding_attempt_recorded",
        category: "event",
        title: "Breeding attempt recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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
        await prisma.breedingAttempt.deleteMany({
          where: { id: latestAttempt.id, tenantId },
        });
      }

      // Recalculate breedDateActual from remaining attempts (earliest date, or null if none)
      const earliest = await prisma.breedingAttempt.findFirst({
        where: { planId, tenantId, attemptAt: { not: null } },
        orderBy: { attemptAt: "asc" },
        select: { attemptAt: true },
      });
      await prisma.breedingPlan.updateMany({
        where: { id: planId, tenantId },
        data: { breedDateActual: earliest?.attemptAt ?? null },
      });

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "breeding_attempt_removed",
        category: "event",
        title: "Latest breeding attempt removed",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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
      if (b.location !== undefined) data.location = b.location || null;
      if (b.data !== undefined) data.data = b.data || null;
      if (b.success !== undefined) data.success = b.success;

      const updated = await prisma.breedingAttempt.update({
        where: { id: attemptId, tenantId },
        data,
        include: {
          dam: { select: { id: true, name: true } },
          sire: { select: { id: true, name: true } },
          plan: { select: { id: true, code: true, name: true, status: true } },
        },
      });

      // Re-sync ET procedure details if this is an ET attempt
      const finalMethod = updated.method ?? existing.method;
      if (finalMethod === "EMBRYO_TRANSFER" && updated.planId) {
        const finalData = (updated.data as any) || {};
        const planUpdate: Record<string, unknown> = {};
        if (finalData.flushDate) planUpdate.flushDate = new Date(finalData.flushDate);
        if (finalData.transferDate) planUpdate.embryoTransferDate = new Date(finalData.transferDate);
        if (finalData.embryoType) planUpdate.embryoType = finalData.embryoType;
        if (Object.keys(planUpdate).length > 0) {
          await prisma.breedingPlan.updateMany({
            where: { id: updated.planId, tenantId },
            data: planUpdate,
          });
        }
      }

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: attemptId,
        kind: "breeding_attempt_updated",
        category: "event",
        title: "Breeding attempt updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      const planId = existing.planId;

      await prisma.breedingAttempt.deleteMany({
        where: { id: attemptId, tenantId },
      });

      // Recalculate breedDateActual from remaining attempts (earliest date, or null if none)
      if (planId) {
        const earliest = await prisma.breedingAttempt.findFirst({
          where: { planId, tenantId, attemptAt: { not: null } },
          orderBy: { attemptAt: "asc" },
          select: { attemptAt: true },
        });
        await prisma.breedingPlan.updateMany({
          where: { id: planId, tenantId },
          data: { breedDateActual: earliest?.attemptAt ?? null },
        });

        // If deleted attempt was ET, check if any ET attempts remain; if not, clear plan ET fields
        if (existing.method === "EMBRYO_TRANSFER") {
          const remainingET = await prisma.breedingAttempt.count({
            where: { planId, tenantId, method: "EMBRYO_TRANSFER" },
          });
          if (remainingET === 0) {
            await prisma.breedingPlan.updateMany({
              where: { id: planId, tenantId },
              data: { flushDate: null, embryoTransferDate: null, embryoType: null },
            });
          } else {
            // Re-sync from the latest remaining ET attempt
            const latestET = await prisma.breedingAttempt.findFirst({
              where: { planId, tenantId, method: "EMBRYO_TRANSFER" },
              orderBy: { createdAt: "desc" },
              select: { data: true },
            });
            if (latestET?.data) {
              const etData = latestET.data as any;
              const planUpdate: Record<string, unknown> = {};
              if (etData.flushDate) planUpdate.flushDate = new Date(etData.flushDate);
              else planUpdate.flushDate = null;
              if (etData.transferDate) planUpdate.embryoTransferDate = new Date(etData.transferDate);
              else planUpdate.embryoTransferDate = null;
              if (etData.embryoType) planUpdate.embryoType = etData.embryoType;
              else planUpdate.embryoType = null;
              await prisma.breedingPlan.updateMany({
                where: { id: planId, tenantId },
                data: planUpdate,
              });
            }
          }
        }
      }

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: attemptId,
        kind: "breeding_attempt_deleted",
        category: "event",
        title: "Breeding attempt deleted",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.code(200).send({ success: true, deletedAttemptId: attemptId });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /**
   * GET /breeding/locations
   * Returns distinct locations used by this tenant for autocomplete
   */
  app.get("/breeding/locations", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      const locations = await prisma.breedingAttempt.findMany({
        where: {
          tenantId,
          location: { not: null },
        },
        select: { location: true },
        distinct: ["location"],
        orderBy: { location: "asc" },
        take: 50,
      });

      reply.send(locations.map((l) => l.location).filter(Boolean));
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "pregnancy_check_recorded",
        category: "health",
        title: "Pregnancy check recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: created.id,
        kind: "litter_created",
        category: "event",
        title: "Litter registered",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      const updated = await prisma.litter.update({ where: { id, tenantId }, data });

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: id,
        kind: "litter_updated",
        category: "system",
        title: "Litter details updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: litterId,
        kind: "litter_event_added",
        category: "event",
        title: "Litter event recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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
              where: { id: Number(a.animalId), tenantId },
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

      logEntityActivity({
        tenantId,
        entityType: "LITTER",
        entityId: litterId,
        kind: "litter_collars_assigned",
        category: "system",
        title: "Collar IDs assigned to litter",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "foaling_recorded",
        category: "event",
        title: "Foaling recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "foaling_outcome_recorded",
        category: "event",
        title: "Foaling outcome recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "milestone_created",
        category: "system",
        title: "Milestone created",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "milestone_completed",
        category: "status",
        title: "Milestone completed",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "milestone_uncompleted",
        category: "status",
        title: "Milestone uncompleted",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(milestone);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DEPRECATED: Use /breeding/animals/:animalId/reproductive-history instead
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

  // DEPRECATED: Use /breeding/animals/:animalId/birth-history instead
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

  // DEPRECATED: Use /breeding/animals/:animalId/reproductive-history/recalculate instead
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(mareId),
        kind: "reproductive_history_recalculated",
        category: "system",
        title: "Reproductive history recalculated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(history);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DEPRECATED: Use /breeding/birth-analytics instead
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

  // ────────────────────────────────────────────────────────────
  // NEW GENERIC ENDPOINTS (species-agnostic, female animals only)
  // ────────────────────────────────────────────────────────────

  // GET /breeding/animals/:animalId/reproductive-history
  app.get("/breeding/animals/:animalId/reproductive-history", async (req, reply) => {
    try {
      const { animalId } = req.params as { animalId: string };
      const tenantId = (req as any).tenantId;

      // Validate animal exists, belongs to tenant, and is female
      const animal = await prisma.animal.findFirst({
        where: { id: Number(animalId), tenantId },
        select: { id: true, sex: true },
      });
      if (!animal) {
        reply.status(404).send({ error: "Animal not found" });
        return;
      }
      if (animal.sex?.toUpperCase() !== "FEMALE") {
        reply.status(400).send({ error: "Reproductive history is only available for female animals" });
        return;
      }

      const history = await getAnimalReproductiveHistory(Number(animalId), tenantId);
      reply.send(history ?? null);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/animals/:animalId/birth-history
  app.get("/breeding/animals/:animalId/birth-history", async (req, reply) => {
    try {
      const { animalId } = req.params as { animalId: string };
      const tenantId = (req as any).tenantId;

      // Validate animal exists, belongs to tenant, and is female
      const animal = await prisma.animal.findFirst({
        where: { id: Number(animalId), tenantId },
        select: { id: true, sex: true },
      });
      if (!animal) {
        reply.status(404).send({ error: "Animal not found" });
        return;
      }
      if (animal.sex?.toUpperCase() !== "FEMALE") {
        reply.status(400).send({ error: "Birth history is only available for female animals" });
        return;
      }

      const history = await getAnimalDetailedBirthHistory(Number(animalId), tenantId);
      reply.send(history);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/animals/:animalId/reproductive-history/recalculate
  app.post("/breeding/animals/:animalId/reproductive-history/recalculate", async (req, reply) => {
    try {
      const { animalId } = req.params as { animalId: string };
      const tenantId = (req as any).tenantId;

      // Validate animal exists, belongs to tenant, and is female
      const animal = await prisma.animal.findFirst({
        where: { id: Number(animalId), tenantId },
        select: { id: true, sex: true },
      });
      if (!animal) {
        reply.status(404).send({ error: "Animal not found" });
        return;
      }
      if (animal.sex?.toUpperCase() !== "FEMALE") {
        reply.status(400).send({ error: "Reproductive history recalculation is only available for female animals" });
        return;
      }

      const history = await recalculateAnimalHistory(Number(animalId), tenantId);

      if (history) {
        logEntityActivity({
          tenantId,
          entityType: "BREEDING_PLAN",
          entityId: Number(animalId),
          kind: "reproductive_history_recalculated",
          category: "system",
          title: "Reproductive history recalculated",
          actorId: String((req as any).userId ?? "unknown"),
          actorName: (req as any).userName,
        });
      }

      reply.send(history ?? null);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/birth-analytics - Get aggregate birth analytics (species-aware)
  app.get("/breeding/birth-analytics", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      const { year, species } = req.query as { year?: string; species?: string };

      const analytics = await getBirthAnalytics(tenantId, {
        year: year ? parseInt(year, 10) : undefined,
        species: species || undefined,
      });
      reply.send(analytics);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/placement-trends - Per-species placement duration trends (p75)
  app.get("/breeding/placement-trends", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      const { threshold } = req.query as { threshold?: string };
      const trends = await getPlacementTrends(
        tenantId,
        threshold ? parseInt(threshold, 10) : 5,
      );
      reply.send(trends);
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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "milestones_cleared",
        category: "system",
        title: "Milestones cleared",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

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

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "milestones_recalculated",
        category: "system",
        title: "Milestones recalculated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(milestones);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ============================================================================
  // SPECIES-GENERIC BIRTH MILESTONES (all species, not just horses)
  // ============================================================================

  // POST /breeding/plans/:id/birth-milestones - Create species-appropriate birth milestones
  app.post("/breeding/plans/:id/birth-milestones", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const milestones = await createSpeciesBirthMilestones(Number(id), tenantId);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "birth_milestones_created",
        category: "system",
        title: "Birth milestones created",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.status(201).send(milestones);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/plans/:id/birth-timeline - Get species-aware birth timeline with milestones
  app.get("/breeding/plans/:id/birth-timeline", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const timeline = await getBirthTimeline(Number(id), tenantId);
      reply.send(timeline);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DELETE /breeding/plans/:id/birth-milestones - Delete all birth milestones for a plan
  app.delete("/breeding/plans/:id/birth-milestones", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const result = await deleteBirthMilestones(Number(id), tenantId);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "birth_milestones_cleared",
        category: "system",
        title: "Birth milestones cleared",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/birth-milestones/recalculate - Recalculate species-aware milestone dates
  app.post("/breeding/plans/:id/birth-milestones/recalculate", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      // Delete existing and recreate with current dates
      await deleteBirthMilestones(Number(id), tenantId);
      const milestones = await createSpeciesBirthMilestones(Number(id), tenantId);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "birth_milestones_recalculated",
        category: "system",
        title: "Birth milestones recalculated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(milestones);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ============================================================================
  // PRE-LABOR TEMPERATURE LOG (dam temperature tracking for dogs/cats)
  // ============================================================================

  // GET /breeding/plans/:id/temperature-log - List temperature readings
  app.get("/breeding/plans/:id/temperature-log", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = Number((req as any).tenantId);

      const entries = await prisma.breedingPlanTempLog.findMany({
        where: { planId: Number(id), tenantId },
        orderBy: { recordedAt: "desc" },
      });

      reply.send({ items: entries });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/temperature-log - Add a temperature reading
  app.post("/breeding/plans/:id/temperature-log", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = Number((req as any).tenantId);
      const body = req.body as {
        recordedAt: string;
        temperatureF: number;
        notes?: string | null;
      };

      if (!body.recordedAt || body.temperatureF == null) {
        return reply.status(400).send({ error: "recordedAt and temperatureF are required" });
      }
      if (body.temperatureF < 90 || body.temperatureF > 110) {
        return reply.status(400).send({ error: "temperatureF must be between 90 and 110" });
      }

      const entry = await prisma.breedingPlanTempLog.create({
        data: {
          planId: Number(id),
          tenantId,
          recordedAt: new Date(body.recordedAt),
          temperatureF: body.temperatureF,
          notes: body.notes ?? null,
          updatedAt: new Date(),
        },
      });

      // Check if temperature dropped below threshold → auto-complete milestone
      if (body.temperatureF < 99.0) {
        try {
          // Find TEMPERATURE_DROP milestone and mark it complete if not already
          const milestone = await prisma.breedingMilestone.findFirst({
            where: {
              breedingPlanId: Number(id),
              tenantId,
              milestoneType: "TEMPERATURE_DROP",
              completedDate: null,
            },
          });
          if (milestone) {
            await prisma.breedingMilestone.updateMany({
              where: { id: milestone.id, tenantId },
              data: { completedDate: new Date(), isCompleted: true, updatedAt: new Date() },
            });
          }
        } catch {
          // Non-blocking: milestone auto-complete is best-effort
        }
      }

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "temperature_reading_added",
        category: "health",
        title: `Temperature reading: ${body.temperatureF}°F`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.status(201).send(entry);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DELETE /breeding/plans/:id/temperature-log/:entryId - Delete a temperature reading
  app.delete("/breeding/plans/:id/temperature-log/:entryId", async (req, reply) => {
    try {
      const { id, entryId } = req.params as { id: string; entryId: string };
      const tenantId = Number((req as any).tenantId);

      await prisma.breedingPlanTempLog.deleteMany({
        where: {
          id: Number(entryId),
          planId: Number(id),
          tenantId,
        },
      });

      reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ============================================================================
  // NEONATAL CARE TRACKING (litter species - dogs, cats, rabbits, etc.)
  // ============================================================================

  // GET /breeding/plans/:id/neonatal-dashboard - Get neonatal care dashboard for a plan
  app.get("/breeding/plans/:id/neonatal-dashboard", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const dashboard = await getNeonatalDashboard(Number(id), tenantId);
      reply.send(dashboard);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/offspring/:id/care-entries - Get care entries for an offspring
  app.get("/breeding/offspring/:id/care-entries", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const query = req.query as { limit?: string; offset?: string };
      const tenantId = (req as any).tenantId;

      const result = await getNeonatalCareEntries(Number(id), tenantId, {
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });
      reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/offspring/:id/care-entries - Create a care entry
  app.post("/breeding/offspring/:id/care-entries", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;

      const entry = await createNeonatalCareEntry({
        offspringId: Number(id),
        tenantId,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
        recordedBy: body.recordedBy,
        recordedById: userId,
        weightOz: body.weightOz,
        temperatureF: body.temperatureF,
        feedingMethod: body.feedingMethod,
        feedingVolumeMl: body.feedingVolumeMl,
        feedingNotes: body.feedingNotes,
        urinated: body.urinated,
        stoolQuality: body.stoolQuality,
        activityLevel: body.activityLevel,
        notes: body.notes,
      });

      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: Number(id),
        kind: "neonatal_care_entry_added",
        category: "health",
        title: "Neonatal care entry added",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.status(201).send(entry);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // DELETE /breeding/care-entries/:id - Delete a care entry
  app.delete("/breeding/care-entries/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const result = await deleteNeonatalCareEntry(Number(id), tenantId);

      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: Number(id),
        kind: "neonatal_care_entry_deleted",
        category: "health",
        title: "Neonatal care entry deleted",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /breeding/offspring/:id/interventions - Get interventions for an offspring
  app.get("/breeding/offspring/:id/interventions", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const query = req.query as { limit?: string; offset?: string };
      const tenantId = (req as any).tenantId;

      const result = await getNeonatalInterventions(Number(id), tenantId, {
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });
      reply.send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/offspring/:id/interventions - Create an intervention
  app.post("/breeding/offspring/:id/interventions", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;

      const intervention = await createNeonatalIntervention({
        offspringId: Number(id),
        tenantId,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        type: body.type,
        route: body.route,
        dose: body.dose,
        administeredBy: body.administeredBy,
        vetClinic: body.vetClinic,
        reason: body.reason,
        response: body.response,
        followUpNeeded: body.followUpNeeded,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
        cost: body.cost,
        notes: body.notes,
        recordedById: userId,
      });

      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: Number(id),
        kind: "neonatal_intervention_added",
        category: "health",
        title: "Neonatal intervention recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.status(201).send(intervention);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /breeding/interventions/:id - Update an intervention
  app.patch("/breeding/interventions/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;

      const intervention = await updateNeonatalIntervention(Number(id), tenantId, {
        response: body.response,
        followUpNeeded: body.followUpNeeded,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
        notes: body.notes,
      });

      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: Number(id),
        kind: "neonatal_intervention_updated",
        category: "health",
        title: "Neonatal intervention updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(intervention);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /breeding/offspring/:id/neonatal-status - Update offspring neonatal status
  app.patch("/breeding/offspring/:id/neonatal-status", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;

      const offspring = await updateOffspringNeonatalStatus(Number(id), tenantId, {
        isExtraNeeds: body.isExtraNeeds,
        neonatalHealthStatus: body.neonatalHealthStatus,
        neonatalFeedingMethod: body.neonatalFeedingMethod,
      });

      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: Number(id),
        kind: "neonatal_status_updated",
        category: "health",
        title: "Neonatal status updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(offspring);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ─── Plan Lifecycle Endpoints ─────────────────────────────────

  // POST /breeding/plans/:id/advance-lifecycle
  // Advances plan through post-birth statuses (BIRTHED → BORN → ... → PLAN_COMPLETE)
  app.post("/breeding/plans/:id/advance-lifecycle", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as { targetStatus?: string };
      const targetStatus = body.targetStatus?.toUpperCase() as any;

      const updated = await advancePlanLifecycle(prisma, planId, tenantId, targetStatus || undefined);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "lifecycle_advanced",
        category: "status",
        title: `Plan lifecycle advanced to ${updated.status}`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(updated);
    } catch (err) {
      if (err instanceof LifecycleError) {
        const statusMap: Record<string, number> = {
          GROUP_NOT_FOUND: 404,
          CANNOT_ADVANCE_DISSOLVED: 409,
          ALREADY_COMPLETE: 409,
          INVALID_STATUS: 400,
          NO_NEXT_STATUS: 400,
          INVALID_TARGET: 400,
          BIRTH_DATE_REQUIRED: 400,
          NO_LIVE_OFFSPRING: 400,
          WEANED_DATE_REQUIRED: 400,
          PLACEMENT_START_REQUIRED: 400,
          OFFSPRING_NOT_PLACED: 409,
          INVALID_TRANSITION: 400,
        };
        return reply.status(statusMap[err.code] ?? 400).send({ error: err.code, detail: err.message });
      }
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/rewind-lifecycle
  // Rewinds plan to previous status
  app.post("/breeding/plans/:id/rewind-lifecycle", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const updated = await rewindPlanLifecycle(prisma, planId, tenantId);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "lifecycle_rewound",
        category: "status",
        title: `Plan lifecycle rewound to ${updated.status}`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(updated);
    } catch (err) {
      if (err instanceof LifecycleError) {
        const statusMap: Record<string, number> = {
          GROUP_NOT_FOUND: 404,
          CANNOT_REWIND_PENDING: 400,
          CANNOT_REWIND_DISSOLVED: 409,
          CANNOT_REWIND: 400,
        };
        return reply.status(statusMap[err.code] ?? 400).send({ error: err.code, detail: err.message });
      }
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/dissolve
  // Sets plan to DISSOLVED (all offspring deceased)
  app.post("/breeding/plans/:id/dissolve", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const updated = await dissolvePlan(prisma, planId, tenantId);

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "lifecycle_dissolved",
        category: "status",
        title: "Plan dissolved — all offspring deceased",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(updated);
    } catch (err) {
      if (err instanceof LifecycleError) {
        const statusMap: Record<string, number> = {
          GROUP_NOT_FOUND: 404,
          LIVE_OFFSPRING_EXIST: 409,
        };
        return reply.status(statusMap[err.code] ?? 400).send({ error: err.code, detail: err.message });
      }
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ─── Plan Marketplace Endpoints ─────────────────────────────

  // POST /breeding/plans/:id/marketplace/publish
  // Sets plan marketplaceStatus = 'LIVE' and all offspring marketplaceListed = true
  app.post("/breeding/plans/:id/marketplace/publish", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const body = (req.body || {}) as { marketplaceDefaultPriceCents?: number | null };

      // Verify plan exists
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Update plan marketplace status
      await prisma.breedingPlan.updateMany({
        where: { id: planId, tenantId },
        data: { marketplaceStatus: "LIVE" },
      });

      // Find offspring linked to this plan, mark as listed, and resolve pricing
      const eligibleOffspring = await prisma.offspring.findMany({
        where: { tenantId, breedingPlanId: planId, lifeState: "ALIVE" },
        select: { id: true },
      });

      let listedCount = 0;
      if (eligibleOffspring.length > 0) {
        // Resolve price for each offspring via the pricing cascade and
        // batch-update in a transaction to set both listing flag and price.
        const updates = await Promise.all(
          eligibleOffspring.map(async (o) => {
            const resolved = await resolveOffspringPrice(o.id, prisma);
            return { id: o.id, ...resolved };
          }),
        );

        await prisma.$transaction(
          updates.map(({ id, priceCents }) =>
            prisma.offspring.update({
              where: { id, tenantId },
              data: {
                marketplaceListed: true,
                marketplacePriceCents: priceCents,
              },
            }),
          ),
        );
        listedCount = eligibleOffspring.length;
      }

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "marketplace_published",
        category: "system",
        title: `Plan published to marketplace (${listedCount} offspring listed)`,
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send({
        ok: true,
        planId,
        defaultPriceCents: body.marketplaceDefaultPriceCents ?? null,
        listedCount,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/marketplace/unpublish
  // Sets plan marketplaceStatus = 'DRAFT' and all offspring marketplaceListed = false
  app.post("/breeding/plans/:id/marketplace/unpublish", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      // Verify plan exists
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // Update plan marketplace status
      await prisma.breedingPlan.updateMany({
        where: { id: planId, tenantId },
        data: { marketplaceStatus: "DRAFT" },
      });

      // Mark all offspring linked to this plan as not listed
      await prisma.offspring.updateMany({
        where: { tenantId, breedingPlanId: planId },
        data: { marketplaceListed: false },
      });

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: planId,
        kind: "marketplace_unpublished",
        category: "system",
        title: "Plan unpublished from marketplace",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send({ ok: true, planId });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/batch-weights - Batch record weights for multiple offspring
  app.post("/breeding/plans/:id/batch-weights", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { entries: Array<{ offspringId: number; weightOz: number; recordedAt?: string }> };
      const tenantId = (req as any).tenantId;
      const userId = (req as any).user?.id;

      const results = await batchRecordWeights(
        tenantId,
        body.entries.map((e) => ({
          offspringId: e.offspringId,
          weightOz: e.weightOz,
          recordedAt: e.recordedAt ? new Date(e.recordedAt) : undefined,
        })),
        userId
      );

      logEntityActivity({
        tenantId,
        entityType: "BREEDING_PLAN",
        entityId: Number(id),
        kind: "batch_weights_recorded",
        category: "health",
        title: "Batch weights recorded",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.status(201).send({ entries: results });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // ============================================================================
  // FOAL WEAN CHECK (horse-only foal weaning assessment)
  // ============================================================================

  // GET /breeding/plans/:id/wean-check - Get all wean check records for a plan (one per foal)
  app.get("/breeding/plans/:id/wean-check", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const records = await prisma.weanCheck.findMany({
        where: { breedingPlanId: Number(id), tenantId },
      });

      reply.send(records);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // GET /animals/:id/wean-check - Get wean check for a specific foal
  app.get("/animals/:id/wean-check", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const tenantId = (req as any).tenantId;

      const record = await prisma.weanCheck.findUnique({
        where: { animalId: Number(id) },
      });

      if (record && record.tenantId !== tenantId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      reply.send(record ?? null);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PUT /animals/:id/wean-check - Upsert wean check for a specific foal
  app.put("/animals/:id/wean-check", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as any;
      const tenantId = (req as any).tenantId;

      const data = {
        weaningMethod: body.weaningMethod ?? null,
        stressRating: body.stressRating ?? null,
        behaviorSigns: body.behaviorSigns ?? [],
        daysToSettle: body.daysToSettle != null ? Number(body.daysToSettle) : null,
        vetAssessmentDone: body.vetAssessmentDone ?? null,
        vetName: body.vetName ?? null,
        vetNotes: body.vetNotes ?? null,
        vaccinationsUpToDate: body.vaccinationsUpToDate ?? null,
        dewormingDone: body.dewormingDone ?? null,
        cogginsPulled: body.cogginsPulled ?? null,
        eatingHayIndependently: body.eatingHayIndependently ?? null,
        eatingGrainIndependently: body.eatingGrainIndependently ?? null,
        supplementStarted: body.supplementStarted ?? null,
        notes: body.notes ?? null,
        updatedAt: new Date(),
      };

      const record = await prisma.weanCheck.upsert({
        where: { animalId: Number(id) },
        create: {
          animalId: Number(id),
          breedingPlanId: Number(body.breedingPlanId),
          tenantId,
          ...data,
        },
        update: data,
      });

      logEntityActivity({
        tenantId,
        entityType: "ANIMAL",
        entityId: Number(id),
        kind: "wean_check_updated",
        category: "health",
        title: "Foal wean check updated",
        actorId: String((req as any).userId ?? "unknown"),
        actorName: (req as any).userName,
      });

      reply.send(record);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * Plan Attachments  (documents tab — health certs, registration paperwork)
   * GET    /breeding/plans/:id/attachments
   * POST   /breeding/plans/:id/attachments
   * DELETE /breeding/plans/:id/attachments/:attachmentId
   * ─────────────────────────────────────────────────────────────────────── */

  app.get("/breeding/plans/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);

      const items = await prisma.attachment.findMany({
        where: { tenantId, planId },
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, storageKey: true, filename: true, mime: true, bytes: true, createdAt: true },
      });

      reply.send(items);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/attachments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.kind || !b.storageKey || !b.filename || !b.mime) {
        return reply.code(400).send({ error: "kind, storageKey, filename, mime are required" });
      }

      await getPlanInTenant(planId, tenantId);

      const created = await prisma.attachment.create({
        data: {
          tenantId,
          planId,
          kind: b.kind,
          storageProvider: b.storageProvider ?? "s3",
          storageKey: b.storageKey,
          filename: b.filename,
          mime: b.mime,
          bytes: Number(b.bytes) || 0,
          createdByUserId: (req as any).user?.id ?? null,
        },
        select: { id: true, kind: true, storageKey: true, filename: true, mime: true, bytes: true, createdAt: true },
      });

      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.delete("/breeding/plans/:id/attachments/:attachmentId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      const attachmentId = idNum((req.params as any).attachmentId);
      if (!planId || !attachmentId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);

      const existing = await prisma.attachment.findFirst({
        where: { id: attachmentId, planId, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      await prisma.attachment.delete({ where: { id: attachmentId } });

      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * Plan Media / Documents  (media gallery tab)
   * GET    /breeding/plans/:id/documents
   * POST   /breeding/plans/:id/documents
   * DELETE /breeding/plans/:id/documents/:documentId
   * Uses the Document model (breedingPlanId FK already exists).
   * ─────────────────────────────────────────────────────────────────────── */

  const PLAN_DOC_SELECT = {
    id: true,
    title: true,
    originalFileName: true,
    mimeType: true,
    sizeBytes: true,
    bytes: true,
    storageKey: true,
    url: true,
    visibility: true,
    watermarkEnabled: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  app.get("/breeding/plans/:id/documents", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);

      const items = await prisma.document.findMany({
        where: { tenantId, breedingPlanId: planId },
        select: PLAN_DOC_SELECT,
        orderBy: { createdAt: "desc" },
      });

      reply.send(items.map(d => ({
        ...d,
        sizeBytes: d.sizeBytes ?? d.bytes ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })));
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/documents", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.storageKey || !b.title) {
        return reply.code(400).send({ error: "storageKey and title are required" });
      }

      await getPlanInTenant(planId, tenantId);

      const created = await prisma.document.create({
        data: {
          tenantId,
          breedingPlanId: planId,
          scope: "animal", // closest valid enum value; filtered via breedingPlanId
          title: b.title,
          originalFileName: b.originalFileName ?? b.title,
          mimeType: b.mimeType ?? null,
          sizeBytes: b.sizeBytes ? Number(b.sizeBytes) : null,
          storageKey: b.storageKey,
          url: b.cdnUrl ?? null,
          visibility: b.visibility ?? "PRIVATE",
          watermarkEnabled: false,
          data: { category: b.category ?? "media" },
        },
        select: PLAN_DOC_SELECT,
      });

      reply.code(201).send({
        ...created,
        sizeBytes: created.sizeBytes ?? created.bytes ?? null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────────────────── ET Registry Export ───────────────────────── */

  app.get("/breeding/plans/:id/registry-export", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId, deletedAt: null },
        include: {
          dam: { select: { id: true, name: true, breed: true } },
          sire: { select: { id: true, name: true, breed: true } },
          Animal_BreedingPlan_geneticDamIdToAnimal: { select: { id: true, name: true, breed: true } },
          Animal_BreedingPlan_recipientDamIdToAnimal: { select: { id: true, name: true } },
          FlushEvent: { select: { flushDate: true, embryoType: true } },
        },
      });

      if (!plan) return reply.code(404).send({ error: "not_found" });
      if (!plan.geneticDamId) {
        return reply.code(400).send({ error: "not_et_plan", message: "Registry export is only available for embryo transfer plans" });
      }

      const offspring = await prisma.offspring.findMany({
        where: { breedingPlanId: planId, tenantId },
        select: { name: true, sex: true, bornAt: true },
      });

      const donorDam = plan.Animal_BreedingPlan_geneticDamIdToAnimal || plan.dam;
      const recipientDam = plan.Animal_BreedingPlan_recipientDamIdToAnimal;

      reply.send({
        geneticDamName: donorDam?.name ?? "",
        geneticDamRegistration: "",
        sireName: plan.sire?.name ?? "",
        sireRegistration: "",
        recipientDamName: recipientDam?.name ?? plan.dam?.name ?? "",
        flushDate: plan.FlushEvent?.flushDate?.toISOString() ?? plan.flushDate?.toISOString() ?? "",
        transferDate: plan.embryoTransferDate?.toISOString() ?? "",
        embryoType: plan.FlushEvent?.embryoType ?? plan.embryoType ?? "FRESH",
        offspring: offspring.map((o) => ({
          name: o.name ?? "",
          sex: o.sex ?? undefined,
          dateOfBirth: o.bornAt?.toISOString() ?? undefined,
        })),
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────────────────── ET Certificate PDF ───────────────────────── */

  app.get("/breeding/plans/:id/et-certificate", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId, deletedAt: null },
        include: {
          dam: { select: { id: true, name: true, breed: true } },
          sire: { select: { id: true, name: true, breed: true } },
          Animal_BreedingPlan_geneticDamIdToAnimal: { select: { id: true, name: true, breed: true } },
          Animal_BreedingPlan_recipientDamIdToAnimal: { select: { id: true, name: true } },
          FlushEvent: { select: { flushDate: true, embryosRecovered: true, embryosViable: true, embryoType: true, vetName: true } },
          tenant: { select: { name: true } },
        },
      });

      if (!plan) return reply.code(404).send({ error: "not_found" });
      if (!plan.geneticDamId) {
        return reply.code(400).send({ error: "not_et_plan", message: "ET certificate is only available for embryo transfer plans" });
      }

      // Fetch offspring linked to this plan
      const offspring = await prisma.offspring.findMany({
        where: { breedingPlanId: planId, tenantId },
        select: { id: true, name: true, sex: true, bornAt: true },
      });

      const donorDam = plan.Animal_BreedingPlan_geneticDamIdToAnimal || plan.dam;
      const recipientDam = plan.Animal_BreedingPlan_recipientDamIdToAnimal;
      const certData: ETCertificateData = {
        organizationName: plan.tenant?.name ?? "",
        geneticDam: {
          name: donorDam?.name ?? "Unknown",
          registrationNumber: undefined,
          breed: donorDam?.breed ?? undefined,
          dnaNumber: undefined,
        },
        sire: {
          name: plan.sire?.name ?? "Unknown",
          registrationNumber: undefined,
          breed: plan.sire?.breed ?? undefined,
          dnaNumber: undefined,
        },
        recipientDam: {
          name: recipientDam?.name ?? plan.dam?.name ?? "Unknown",
          registrationNumber: undefined,
        },
        flushDate: plan.FlushEvent?.flushDate?.toISOString() ?? plan.flushDate?.toISOString() ?? undefined,
        transferDate: plan.embryoTransferDate?.toISOString() ?? undefined,
        embryoType: plan.FlushEvent?.embryoType ?? plan.embryoType ?? undefined,
        vetName: plan.FlushEvent?.vetName ?? undefined,
        offspring: offspring.map((o) => ({
          name: o.name ?? "Unnamed",
          sex: o.sex ?? undefined,
          dateOfBirth: o.bornAt?.toISOString() ?? undefined,
        })),
        flushSummary: plan.FlushEvent
          ? {
              embryosRecovered: plan.FlushEvent.embryosRecovered ?? undefined,
              embryosViable: plan.FlushEvent.embryosViable ?? undefined,
            }
          : undefined,
        planName: plan.name ?? undefined,
        generatedDate: new Date().toISOString(),
      };

      const { buffer, filename } = await generateETCertificatePdf(certData);

      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(Buffer.from(buffer));
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.delete("/breeding/plans/:id/documents/:documentId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const planId = idNum((req.params as any).id);
      const documentId = idNum((req.params as any).documentId);
      if (!planId || !documentId) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(planId, tenantId);

      const existing = await prisma.document.findFirst({
        where: { id: documentId, breedingPlanId: planId, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      await prisma.document.delete({ where: { id: documentId } });

      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });
};

export default breedingRoutes;
