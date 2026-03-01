// OGC-05: Simplified offspring routes — individual offspring CRUD only.
// Group-level endpoints removed (OffspringGroup table dropped).
import {
  OffspringLifeState,
  OffspringPlacementState,
  OffspringKeeperIntent,
  OffspringFinancialState,
  OffspringPaperworkState,
  type Offspring,
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

// src/routes/offspring.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  triggerOnOffspringCreated,
  triggerOnOffspringUpdated,
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

/**
 * Derive a breed name from a BreedingPlan + dam context.
 * Checks plan.breedText first, then dam's canonical breed, then dam's free-form breed.
 */
function deriveBreedFromPlan(plan: any): string | null {
  if (!plan) return null;

  // 1. Plan breed text
  const planBreed = plan.breedText;
  if (typeof planBreed === "string" && planBreed.trim().length > 0) {
    return planBreed.trim();
  }

  // 2. Dam canonical breed name
  const damCanonicalName = plan.dam?.canonicalBreed?.name;
  if (typeof damCanonicalName === "string" && damCanonicalName.trim().length > 0) {
    return damCanonicalName.trim();
  }

  // 3. Dam free form breed
  const damBreed = plan.dam?.breed;
  if (typeof damBreed === "string" && damBreed.trim().length > 0) {
    return damBreed.trim();
  }

  return null;
}

/* ========= serializers ========= */

function mapOffspringToAnimalLite(o: any) {
  const plan = o.BreedingPlan as any | undefined;

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
      plan?.breedText ??
      null,

    // surface core identity fields
    color:
      (o as any).color ??
      (extra && typeof extra === "object" ? (extra as any).color ?? null : null),
    pattern:
      extra && typeof extra === "object" ? (extra as any).pattern ?? null : null,

    microchip:
      (o as any).microchip ??
      (extra && typeof extra === "object" ? (extra as any).microchip ?? null : null),
    registryNumber:
      (o as any).registryNumber ??
      (o as any).registration ??
      (extra && typeof extra === "object" ? (extra as any).registrationId ?? null : null),

    breedingPlanId: o.breedingPlanId ?? null,
    // Include plan context for UI display
    plan: plan
      ? {
          id: plan.id,
          name: plan.name ?? null,
          code: plan.code ?? null,
          breedText: plan.breedText ?? null,
          birthDateActual: plan.birthDateActual
            ? (plan.birthDateActual instanceof Date
              ? plan.birthDateActual.toISOString()
              : String(plan.birthDateActual))
            : null,
          dam: plan.dam ? { id: plan.dam.id, name: plan.dam.name ?? null } : null,
          sire: plan.sire ? { id: plan.sire.id, name: plan.sire.name ?? null } : null,
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

    // Assessment types (populated when rearingAssessments is included)
    assessmentTypes: Array.isArray((o as any).rearingAssessments)
      ? (o as any).rearingAssessments.map((a: any) => a.assessmentType as string)
      : [],
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
    if (life === OffspringLifeState.DECEASED || life === OffspringLifeState.STILLBORN) deceased += 1;

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

  // Clearing diedAt while still DECEASED or STILLBORN is illegal to avoid silent resurrection.
  if ("diedAt" in patch && patch.diedAt === null) {
    const finalLifeState = patch.lifeState ?? current?.lifeState ?? OffspringLifeState.ALIVE;
    if (finalLifeState === OffspringLifeState.DECEASED || finalLifeState === OffspringLifeState.STILLBORN) {
      throw new Error("cannot clear diedAt while offspring is deceased");
    }
  }

  // A death timestamp always forces the DECEASED lifeState (but preserves STILLBORN).
  if (nextDiedAt && nextLifeState !== OffspringLifeState.STILLBORN) {
    nextLifeState = OffspringLifeState.DECEASED;
  }
  // DECEASED without diedAt: default to now. STILLBORN without diedAt: use birth date if available.
  if (nextLifeState === OffspringLifeState.DECEASED && !nextDiedAt) {
    nextDiedAt = current?.diedAt ?? new Date();
  }
  if (nextLifeState === OffspringLifeState.STILLBORN && !nextDiedAt) {
    nextDiedAt = (bornAt as Date | null) ?? current?.diedAt ?? new Date();
  }

  // Once deceased or stillborn, block any placement transitions or timestamp edits.
  const isDeadLifeState =
    nextLifeState === OffspringLifeState.DECEASED || nextLifeState === OffspringLifeState.STILLBORN;
  const placementChangedWhileDead =
    isDeadLifeState &&
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
    if (nextLifeState === OffspringLifeState.DECEASED || nextLifeState === OffspringLifeState.STILLBORN) {
      throw new Error("cannot place a deceased offspring");
    }
    nextPlacementState = OffspringPlacementState.PLACED;
  }
  if (nextPlacementState === OffspringPlacementState.PLACED) {
    if (!nextPlacedAt) {
      throw new Error("placedAt is required when placementState is PLACED");
    }
    if (nextLifeState === OffspringLifeState.DECEASED || nextLifeState === OffspringLifeState.STILLBORN) {
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
    nextLifeState !== OffspringLifeState.DECEASED &&
    nextLifeState !== OffspringLifeState.STILLBORN
  ) {
    nextPlacementState = OffspringPlacementState.RESERVED;
  }

  // Promotion locks keeper intent to KEEP permanently.
  if (nextPromotedAnimalId != null) {
    nextKeeperIntent = OffspringKeeperIntent.KEEP;
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

/* ========= Prisma include shapes ========= */

const OFFSPRING_PLAN_INCLUDE = {
  BreedingPlan: {
    select: {
      id: true,
      name: true,
      code: true,
      breedText: true,
      species: true,
      birthDateActual: true,
      damId: true,
      sireId: true,
      dam: { select: { id: true, name: true, breed: true, canonicalBreed: { select: { name: true } } } },
      sire: { select: { id: true, name: true } },
    },
  },
  buyerParty: {
    select: { id: true, type: true, name: true },
  },
} as const;

/* ========= router ========= */

const offspringRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // inject tenant
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });


  /* ===== CREATE INDIVIDUAL: POST /api/v1/offspring/individuals ===== */
  app.post("/offspring/individuals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const body = (req.body as any) ?? {};

    const planId = body.planId ?? body.breedingPlanId ?? null;
    if (!planId) {
      return reply.code(400).send({ error: "planId is required for offspring creation" });
    }

    const plan = await prisma.breedingPlan.findFirst({
      where: { id: Number(planId), tenantId, deletedAt: null },
      include: {
        dam: { include: { canonicalBreed: true } },
        sire: { select: { id: true, name: true } },
      },
    });
    if (!plan) {
      return reply.code(404).send({ error: "breeding plan not found" });
    }

    // Business rule: Cannot add offspring until the birth date actual has been recorded
    if (!plan.birthDateActual) {
      return reply.code(400).send({
        error: "birth_date_not_recorded",
        detail: "Cannot add offspring until the birth date has been recorded on the breeding plan.",
      });
    }

    const name: string | null =
      typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;

    const sex =
      body.sex === "MALE" || body.sex === "FEMALE"
        ? body.sex
        : null;

    // Default bornAt from the plan's birthDateActual if not explicitly provided
    const bornAt = body.birthDate
      ? parseISO(body.birthDate)
      : plan.birthDateActual ?? null;

    const data: any =
      typeof body.data === "object" && body.data !== null ? { ...body.data } : {};
    if (body.unlinkedOverride) {
      data.unlinkedOverride = true;
    }

    // persist color into JSON payload
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

    // enforce species match
    const childSpeciesRaw = body.species;
    if (
      childSpeciesRaw != null &&
      String(childSpeciesRaw).trim() !== "" &&
      String(childSpeciesRaw).toUpperCase() !== String(plan.species ?? "DOG").toUpperCase()
    ) {
      return reply
        .code(400)
        .send({ error: "offspring species must match breeding plan species" });
    }

    // derive breed from plan context
    const derivedBreed = deriveBreedFromPlan(plan);

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
        breedingPlanId: plan.id,

        // core identity
        name: name ?? null,
        sex,
        species: body.species ?? plan.species ?? "DOG",
        breed: derivedBreed,
        bornAt,

        // Auto-link parents from the plan
        // For ET plans: damId = geneticDamId (genetic parent, backward compat)
        damId: plan.damId ?? null,
        sireId: plan.sireId ?? null,
        // Embryo Transfer: inherit geneticDamId and recipientDamId from plan
        geneticDamId: (plan as any).geneticDamId ?? null,
        recipientDamId: (plan as any).recipientDamId ?? null,

        notes: body.notes ?? null,
        data,

        // collar fields
        collarColorName: collarName,
        collarAssignedAt: collarName ? new Date() : null,

        ...normalizedState,
      } as any,
      include: OFFSPRING_PLAN_INCLUDE,
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


  /* ===== BATCH CREATE: POST /offspring/individuals/batch ===== */
  app.post("/offspring/individuals/batch", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const body = (req.body as any) ?? {};

    const planId = body.planId ?? body.breedingPlanId ?? null;
    if (!planId) {
      return reply.code(400).send({ error: "planId is required" });
    }

    const individuals = body.individuals;
    if (!Array.isArray(individuals) || individuals.length === 0) {
      return reply
        .code(400)
        .send({ error: "individuals array is required and must not be empty" });
    }
    if (individuals.length > 25) {
      return reply
        .code(400)
        .send({ error: "Maximum 25 offspring per batch" });
    }

    const plan = await prisma.breedingPlan.findFirst({
      where: { id: Number(planId), tenantId, deletedAt: null },
      include: {
        dam: { include: { canonicalBreed: true } },
        sire: { select: { id: true, name: true } },
      },
    });
    if (!plan) {
      return reply.code(404).send({ error: "breeding plan not found" });
    }

    // Business rule: birth date must be recorded
    if (!plan.birthDateActual) {
      return reply.code(400).send({
        error: "birth_date_not_recorded",
        detail: "Cannot add offspring until the birth date has been recorded on the breeding plan.",
      });
    }

    // Derive shared values from plan
    const derivedBreed = deriveBreedFromPlan(plan);
    const defaultBornAt = plan.birthDateActual ?? null;
    const sharedSpecies = plan.species ?? "DOG";
    const sharedDamId = plan.damId ?? null;
    const sharedSireId = plan.sireId ?? null;
    // Embryo Transfer: inherit from plan
    const sharedGeneticDamId = (plan as any).geneticDamId ?? null;
    const sharedRecipientDamId = (plan as any).recipientDamId ?? null;

    // Build create operations for each individual
    const createOps = individuals.map((ind: any) => {
      const name: string | null =
        typeof ind.name === "string" && ind.name.trim().length > 0
          ? ind.name.trim()
          : null;

      const sex =
        ind.sex === "MALE" || ind.sex === "FEMALE" ? ind.sex : null;

      const bornAt = ind.birthDate
        ? parseISO(ind.birthDate)
        : defaultBornAt;

      const collarName =
        typeof ind.whelpingCollarColor === "string" &&
        ind.whelpingCollarColor.trim()
          ? ind.whelpingCollarColor.trim()
          : null;

      const notes: string | null =
        typeof ind.notes === "string" && ind.notes.trim().length > 0
          ? ind.notes.trim()
          : null;

      const dataBlob: Record<string, unknown> =
        typeof ind.data === "object" && ind.data !== null ? { ...ind.data } : {};

      if ("color" in ind) {
        const rawColor = ind.color;
        if (rawColor != null && typeof rawColor === "string" && rawColor.trim() !== "") {
          dataBlob.color = rawColor.trim();
        }
      }

      const statePatchBatch: OffspringStatePatch = { bornAt };
      if (ind.lifeState === OffspringLifeState.STILLBORN) {
        statePatchBatch.lifeState = OffspringLifeState.STILLBORN;
      }
      const normalizedState = normalizeOffspringState(null, statePatchBatch);

      return prisma.offspring.create({
        data: {
          tenantId,
          breedingPlanId: plan.id,

          name,
          sex,
          species: sharedSpecies,
          breed: derivedBreed,
          bornAt,

          damId: sharedDamId,
          sireId: sharedSireId,
          // Embryo Transfer: inherit geneticDamId and recipientDamId from plan
          geneticDamId: sharedGeneticDamId,
          recipientDamId: sharedRecipientDamId,

          notes,

          ...(ind.price != null && !isNaN(Number(ind.price))
            ? { priceCents: Math.round(Number(ind.price) * 100) }
            : {}),

          ...(ind.birthWeightOz != null && !isNaN(Number(ind.birthWeightOz))
            ? { birthWeightOz: Number(ind.birthWeightOz) }
            : {}),

          collarColorName: collarName,
          collarAssignedAt: collarName ? new Date() : null,

          ...normalizedState,

          data: dataBlob as any,
        } as any,
        include: OFFSPRING_PLAN_INCLUDE,
      });
    });

    let created: any[];
    try {
      created = await prisma.$transaction(createOps);
    } catch (err) {
      req.log.error({ err }, "Batch offspring creation transaction failed");
      return reply
        .code(500)
        .send({ error: "Failed to create offspring batch" });
    }

    // Post-create side effects (fire-and-forget)
    const ctx = auditCtx(req, tenantId);
    for (const c of created) {
      auditCreate("OFFSPRING", c.id, c as any, ctx);
      logEntityActivity({
        tenantId,
        entityType: "OFFSPRING",
        entityId: c.id,
        kind: "offspring_created",
        category: "event",
        title: `Offspring "${c.name || "unnamed"}" created (batch)`,
        actorId: ctx.userId,
        actorName: ctx.userName,
      });
      triggerOnOffspringCreated(c.id, tenantId).catch((err) =>
        req.log.error(
          { err, offspringId: c.id },
          "Failed to trigger rules on batch offspring creation",
        ),
      );
    }

    reply.code(201).send({
      created: created.map(mapOffspringToAnimalLite),
      count: created.length,
    });
  });


  /* ===== LIST INDIVIDUALS: GET /offspring/individuals ===== */
  app.get("/offspring/individuals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const query = (req as any).query ?? {};

    try {
      const qRaw = query.q;
      const q = qRaw == null ? "" : String(qRaw).trim();

      // Accept both planId and groupId (backwards compat alias)
      const planIdRaw = query.planId ?? query.breedingPlanId ?? query.groupId;
      const planId =
        planIdRaw == null || String(planIdRaw).trim() === ""
          ? undefined
          : Number(planIdRaw);

      const limitRaw = query.limit;
      const limit = Number.isFinite(Number(limitRaw))
        ? Math.min(250, Math.max(1, Number(limitRaw)))
        : 50;

      const where: any = { tenantId, archivedAt: null };
      if (planId != null && !Number.isNaN(planId)) {
        where.breedingPlanId = planId;
      }

      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.offspring.findMany({
          where,
          take: limit,
          orderBy: { id: "asc" },
          include: {
            ...OFFSPRING_PLAN_INCLUDE,
            rearingAssessments: {
              select: { assessmentType: true },
              distinct: ["assessmentType"],
            },
          },
        }),
        prisma.offspring.count({ where }),
      ]);

      reply.send({
        items: rows.map((o: any) => mapOffspringToAnimalLite(o)),
        total,
      });
    } catch (err) {
      console.error("offspring individuals list failed", err);
      reply.code(500).send({ error: "internal_error" });
    }
  });


  /* ===== GET INDIVIDUAL: GET /offspring/individuals/:id ===== */
  app.get("/offspring/individuals/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    try {
      const row = await prisma.offspring.findFirst({
        where: { id, tenantId },
        include: OFFSPRING_PLAN_INCLUDE,
      });

      if (!row) return reply.code(404).send({ error: "not found" });

      reply.send(mapOffspringToAnimalLite(row));
    } catch (err) {
      console.error("offspring individuals get failed", err);
      reply.code(500).send({ error: "internal_error" });
    }
  });


  /* ===== UPDATE INDIVIDUAL: PATCH /offspring/individuals/:id ===== */
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

    // Handle plan change
    if ("breedingPlanId" in body || "planId" in body) {
      const rawPlanId = body.breedingPlanId ?? body.planId;
      if (rawPlanId != null && String(rawPlanId).trim() !== "") {
        const targetPlanId = Number(rawPlanId);
        if (!Number.isFinite(targetPlanId)) {
          return reply.code(400).send({ error: "invalid planId" });
        }

        const targetPlan = await prisma.breedingPlan.findFirst({
          where: { id: targetPlanId, tenantId, deletedAt: null },
          include: {
            dam: { include: { canonicalBreed: true } },
          },
        });
        if (!targetPlan) {
          return reply.code(400).send({ error: "breeding plan not found for tenant" });
        }

        // Enforce species match
        const effectiveSpecies = body.species ?? existing.species;
        if (
          effectiveSpecies != null &&
          String(effectiveSpecies).toUpperCase() !== String(targetPlan.species ?? "DOG").toUpperCase()
        ) {
          return reply.code(400).send({ error: "offspring species must match breeding plan species" });
        }

        data.breedingPlanId = targetPlanId;
        data.breed = deriveBreedFromPlan(targetPlan);
      }
    }

    // Handle species field
    if ("species" in body) {
      if (existing.breedingPlanId != null && !("breedingPlanId" in data)) {
        // Plan not changed in this patch, enforce against current plan
        const plan = await prisma.breedingPlan.findFirst({
          where: { id: existing.breedingPlanId, tenantId, deletedAt: null },
          include: {
            dam: { include: { canonicalBreed: true } },
          },
        });
        if (!plan) {
          return reply.code(400).send({ error: "parent plan not found" });
        }
        if (
          body.species != null &&
          String(body.species).toUpperCase() !== String(plan.species ?? "DOG").toUpperCase()
        ) {
          return reply.code(400).send({ error: "offspring species must match breeding plan species" });
        }
        data.species = plan.species;
        data.breed = deriveBreedFromPlan(plan);
      } else if (!("breedingPlanId" in data)) {
        data.species = body.species ?? null;
      }
    }

    // Simple field updates
    if (typeof body.name === "string") {
      data.name = body.name.trim();
    }

    if ("sex" in body) {
      const sexValue = body.sex;
      if (sexValue === "MALE" || sexValue === "FEMALE") {
        data.sex = sexValue as Sex;
      } else {
        data.sex = null;
      }
    }

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

    if ("color" in body || "pattern" in body || "microchip" in body || "registrationId" in body) {
      const existingData = existing.data && typeof existing.data === "object" ? existing.data : {};
      const updatedData: Record<string, unknown> = { ...existingData };

      if ("color" in body) updatedData.color = body.color ?? null;
      if ("pattern" in body) updatedData.pattern = body.pattern ?? null;
      if ("microchip" in body) updatedData.microchip = body.microchip ?? null;
      if ("registrationId" in body) updatedData.registrationId = body.registrationId ?? null;

      data.data = updatedData;
    }

    if ("whelpingCollarColor" in body) {
      const raw =
        typeof body.whelpingCollarColor === "string"
          ? body.whelpingCollarColor.trim()
          : "";
      const collarName = raw || null;

      data.collarColorName = collarName;
      data.collarAssignedAt = collarName ? new Date() : null;
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

    // Strip relation FK fields that Prisma rejects as raw scalars in update()
    const { promotedAnimalId: _stripPromoted, ...prismaState } = normalizedState;

    let updated;
    try {
      updated = await prisma.offspring.update({
        where: { id },
        data: { ...data, ...prismaState },
        include: OFFSPRING_PLAN_INCLUDE,
      });
    } catch (err) {
      req.log?.error?.(
        { route: "offspring.individuals.update", requestId: (req as any).id, error: err },
        "Database update failed",
      );
      return reply.code(500).send({ error: "database_error" });
    }

    // Audit trail + activity log (fire-and-forget, fail-open)
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


  /* ===== DELETE INDIVIDUAL: DELETE /offspring/individuals/:id ===== */
  app.delete("/offspring/individuals/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    const existing = await prisma.offspring.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "not found" });

    // BUSINESS RULE: Offspring Deletion Protection
    const blockers: Record<string, boolean> = {};

    if (existing.buyerPartyId) blockers.hasBuyer = true;
    if (existing.placementState === "PLACED" || existing.placedAt) blockers.isPlaced = true;
    if (existing.financialState && existing.financialState !== "NONE") blockers.hasFinancialState = true;
    if (existing.paidInFullAt || existing.depositCents) blockers.hasPayments = true;
    if (existing.contractId || existing.contractSignedAt) blockers.hasContract = true;
    if (existing.promotedAnimalId) blockers.isPromoted = true;
    if (existing.lifeState === "DECEASED" || existing.lifeState === "STILLBORN" || existing.diedAt) blockers.isDeceased = true;

    // Check for related records
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
        detail: "Cannot delete this offspring because it has associated business data.",
        blockers,
      });
    }

    await prisma.offspring.delete({ where: { id } });

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


  /* ===== ARCHIVE INDIVIDUAL ===== */
  app.post("/offspring/individuals/:id/archive", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const { reason } = (req.body as any) ?? {};

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    const existing = await prisma.offspring.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    const archived = await prisma.offspring.update({
      where: { id },
      data: { archivedAt: new Date(), archiveReason: reason || null },
    });

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


  /* ===== RESTORE INDIVIDUAL ===== */
  app.post("/offspring/individuals/:id/restore", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "invalid id" });
    }

    const existing = await prisma.offspring.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    if (!existing.archivedAt) {
      return reply.code(400).send({ error: "offspring_not_archived" });
    }

    const restored = await prisma.offspring.update({
      where: { id },
      data: { archivedAt: null, archiveReason: null },
    });

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


  /* ===== PROMOTE TO ANIMAL: POST /offspring/:id/animals ===== */
  app.post("/offspring/:id/animals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const planId = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    const plan = await prisma.breedingPlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
      include: { dam: { select: { id: true, name: true } }, sire: { select: { id: true, name: true } } },
    });
    if (!plan) return reply.code(404).send({ error: "breeding plan not found" });

    // Business rule: Cannot add until birth date recorded
    if (!plan.birthDateActual) {
      return reply.code(400).send({
        error: "birth_date_not_recorded",
        detail: "Cannot add offspring until the birth date has been recorded on the breeding plan.",
      });
    }

    if (!body?.name || !body?.sex) {
      return reply.code(400).send({ error: "name and sex are required" });
    }

    const created = await prisma.animal.create({
      data: {
        tenantId,
        organizationId: null,
        name: String(body.name),
        species: body.species ?? plan.species ?? "DOG",
        sex: body.sex,
        status: body.status ?? "ACTIVE",
        birthDate: parseISO(body.birthDate),
        microchip: body.microchip ?? null,
        notes: body.notes ?? null,
        breed: body.breed ?? null,
        damId: plan.damId ?? null,
        sireId: plan.sireId ?? null,
        collarColorId: body.collarColorId ?? null,
        collarColorName: body.collarColorName ?? null,
        collarColorHex: body.collarColorHex ?? null,
        collarAssignedAt: (body.collarColorId || body.collarColorHex || body.collarColorName) ? new Date() : null,
        collarLocked: body.collarLocked === true ? true : false,
      },
    });

    logEntityActivity({
      tenantId,
      entityType: "BREEDING_PLAN",
      entityId: planId,
      kind: "offspring_animal_added",
      category: "relationship",
      title: "Animal added from breeding plan",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.code(201).send(created);
  });


  /* ===== UPDATE ANIMAL: PATCH /offspring/:id/animals/:animalId ===== */
  app.patch("/offspring/:id/animals/:animalId", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const animalId = Number((req.params as any).animalId);
    const body = (req.body as any) ?? {};

    const A = await prisma.animal.findFirst({ where: { id: animalId, tenantId } });
    if (!A) return reply.code(404).send({ error: "animal not found" });

    const data: any = {};
    if ("name" in body) data.name = body.name;
    if ("sex" in body) data.sex = body.sex;
    if ("status" in body) data.status = body.status;
    if ("species" in body) data.species = body.species;
    if ("breed" in body) data.breed = body.breed ?? null;
    if ("microchip" in body) data.microchip = body.microchip ?? null;
    if ("notes" in body) data.notes = body.notes ?? null;
    if ("birthDate" in body) data.birthDate = parseISO(body.birthDate);

    let settingAnyCollar = false;
    if ("collarColorId" in body) { data.collarColorId = body.collarColorId ?? null; settingAnyCollar = true; }
    if ("collarColorName" in body) { data.collarColorName = body.collarColorName ?? null; settingAnyCollar = true; }
    if ("collarColorHex" in body) { data.collarColorHex = body.collarColorHex ?? null; settingAnyCollar = true; }
    if ("collarLocked" in body) { data.collarLocked = !!body.collarLocked; }
    if (settingAnyCollar) { data.collarAssignedAt = new Date(); }

    const updated = await prisma.animal.update({ where: { id: animalId }, data });

    logEntityActivity({
      tenantId,
      entityType: "ANIMAL",
      entityId: animalId,
      kind: "offspring_animal_updated",
      category: "relationship",
      title: "Animal details updated",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.send(updated);
  });


  /* ===== DELETE/UNLINK ANIMAL: DELETE /offspring/:id/animals/:animalId ===== */
  app.delete("/offspring/:id/animals/:animalId", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const animalId = Number((req.params as any).animalId);
    const mode = String((req as any).query?.mode ?? "delete");

    const A = await prisma.animal.findFirst({ where: { id: animalId, tenantId } });
    if (!A) return reply.code(404).send({ error: "animal not found" });

    if (mode === "delete") {
      await prisma.animal.delete({ where: { id: animalId } });
    }
    // Note: "unlink" mode previously cleared offspringGroupId. Since that column
    // is dropped, unlink is equivalent to a no-op. Clients should use "delete".

    logEntityActivity({
      tenantId,
      entityType: "ANIMAL",
      entityId: animalId,
      kind: "offspring_animal_removed",
      category: "relationship",
      title: "Animal removed",
      actorId: String((req as any).userId ?? "unknown"),
      actorName: (req as any).userName,
    });

    reply.send({ ok: true, deleted: animalId });
  });
};

export default offspringRoutes;
