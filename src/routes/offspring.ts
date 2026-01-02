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
const __og_authorizer: __OG_Authorizer = { async ensureAdmin() { } }; // replace with real check

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

  async function ensureGroupForCommittedPlan(args: { tenantId: number; planId: number; actorId: string }): Promise<OffspringGroup> {
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
          notes: "Group ensured for committed plan",
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

  return { ensureGroupForCommittedPlan, linkGroupToPlan, unlinkGroup, getLinkSuggestions };
}
// [OG-SERVICE-END]

// src/routes/offspring.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

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

    // expose real group species, not only plan.species
    species: G.species ?? null,

    // expose a breed name for convenience, derived from the plan for now
    breedName: G.plan?.breedText ?? null,

    published: !!G.published,
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
      expectedPlacementStart: G.plan.expectedPlacementStart,
      expectedPlacementCompleted: G.plan.expectedPlacementCompleted,
    },
    statusOverride: G.statusOverride ?? null,
    statusOverrideReason: G.statusOverrideReason ?? null,
    createdAt: G.createdAt?.toISOString?.() ?? null,
    updatedAt: G.updatedAt?.toISOString?.() ?? null,
  };
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
    published: !!G.published,
    coverImageUrl: G.coverImageUrl ?? null,
    themeName: G.themeName ?? null,

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
    const limit = Math.min(250, Math.max(1, Number((req as any).query?.limit ?? 25)));
    const cursorId = (req as any).query?.cursor ? Number((req as any).query.cursor) : undefined;
    const published = asBool((req as any).query?.published);
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

    const groups = await prisma.offspringGroup.findMany({
      where,
      orderBy: { id: "desc" },
      take: limit + 1,
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            species: true,
            breedText: true,
            dam: { select: { id: true, name: true } },
            sire: { select: { id: true, name: true } },
            expectedPlacementStart: true,
            expectedPlacementCompleted: true,
            placementStartDateActual: true,
            placementCompletedDateActual: true,
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
    const nextCursor = groups.length > limit ? String(rows[rows.length - 1].id) : null;

    reply.send({ items, nextCursor });
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
            select: {
              id: true,
              code: true,
              name: true,
              species: true,
              breedText: true,
              dam: { select: { id: true, name: true } },
              sire: { select: { id: true, name: true } },
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
    const { planId, identifier, notes, published, dates, counts, publishedMeta, statusOverride, statusOverrideReason, data } = (req.body as any) ?? {};
    if (!planId) return reply.code(400).send({ error: "planId required" });

    const plan = await prisma.breedingPlan.findFirst({ where: { id: Number(planId), tenantId } });
    if (!plan) return reply.code(404).send({ error: "plan not found" });
    if ((plan as any).status && (plan as any).status !== "COMMITTED") return reply.code(409).send({ error: "plan must be COMMITTED" });

    const existing = await prisma.offspringGroup.findFirst({ where: { planId: plan.id, tenantId } });

    const payload: Prisma.OffspringGroupUncheckedCreateInput | Prisma.OffspringGroupUncheckedUpdateInput = {
      tenantId,
      planId: plan.id,
      name: identifier ?? null,
      notes: notes ?? null,
      published: Boolean(published ?? false),
      data: data ?? null,
    };

    if (publishedMeta) {
      if ("coverImageUrl" in publishedMeta) (payload as any).coverImageUrl = publishedMeta.coverImageUrl ?? null;
      if ("themeName" in publishedMeta) (payload as any).themeName = publishedMeta.themeName ?? null;
    }

    if (dates) {
      (payload as any).weanedAt = parseISO(dates.weanedAt);
      (payload as any).placementStartAt = parseISO(dates.placementStartAt) ?? ((plan as any).lockedPlacementStartDate ?? null);
      (payload as any).placementCompletedAt = parseISO(dates.placementCompletedAt);
    } else {
      (payload as any).placementStartAt = (plan as any).lockedPlacementStartDate ?? null;
    }

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

    // return detail payload
    const fresh = await prisma.offspringGroup.findFirst({
      where: { id: created.id, tenantId },
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            species: true,
            breedText: true,
            dam: { select: { id: true, name: true } },
            sire: { select: { id: true, name: true } },
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
    if ("published" in body) data.published = !!body.published;
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
          select: {
            id: true,
            code: true,
            name: true,
            species: true,
            breedText: true,
            dam: { select: { id: true, name: true } },
            sire: { select: { id: true, name: true } },
          },
        },
      },
    });

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
  app.delete("/offspring/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.offspringGroup.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    await prisma.offspringGroup.delete({ where: { id } });
    reply.send({ ok: true, id });
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
        plan: true,
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

    const name: string | null =
      typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;

    const sex =
      body.sex === "MALE" || body.sex === "FEMALE"
        ? body.sex
        : null;

    const bornAt = body.birthDate ? parseISO(body.birthDate) : null;

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
            plan: true,
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
            plan: true,
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
      data.promotedAnimalId = promotedId;
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
        },
      });
    } catch (err) {
      req.log?.error?.(
        { route: "offspring.individuals.update", requestId: (req as any).id, error: err },
        "Database update failed",
      );
      return reply.code(500).send({ error: "database_error" });
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
    });
    if (!existing) return reply.code(404).send({ error: "not found" });

    await prisma.offspring.delete({ where: { id } });
    reply.send({ ok: true, deleted: id });
  });

  /* ===== OFFSPRING ANIMALS: CREATE ===== */
  app.post("/offspring/:id/animals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    const G = await prisma.offspringGroup.findFirst({
      where: { id, tenantId },
      include: { plan: { select: { species: true } } },
    });
    if (!G) return reply.code(404).send({ error: "group not found" });

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
        // collar fields
        collarColorId: body.collarColorId ?? null,
        collarColorName: body.collarColorName ?? null,
        collarColorHex: body.collarColorHex ?? null,
        collarAssignedAt: (body.collarColorId || body.collarColorHex || body.collarColorName) ? new Date() : null,
        collarLocked: body.collarLocked === true ? true : false,
      },
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
      return reply.send({ ok: true, deleted: animalId });
    }

    await prisma.animal.update({ where: { id: animalId }, data: { offspringGroupId: null } });
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
      return reply.send({ ok: true, deleted: wid });
    }

    await prisma.waitlistEntry.update({ where: { id: wid }, data: { offspringGroupId: null } });
    reply.send({ ok: true, unlinked: wid });
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
    reply.send({ ok: true, deleted: aid });
  });

  // [OG-ROUTES-START] Offspring Group linking endpoints

  app.post<{
    Params: { groupId: string };
    Body: {
      buyerPartyId?: number | null;
      waitlistEntryId?: number | null;
      actorId?: string | null; // currently ignored, reserved for future event logging
    };
  }>(
    "/offspring/groups/:groupId/buyers",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);
      const { buyerPartyId, waitlistEntryId } = req.body ?? {};

      if (!buyerPartyId && !waitlistEntryId) {
        return reply
          .code(400)
          .send({ error: "buyerPartyId or waitlistEntryId required" });
      }

      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });
      if (!group) return reply.code(404).send({ error: "group not found" });

      try {
        await prisma.offspringGroupBuyer.create({
          data: {
            tenantId,
            groupId: group.id,
            waitlistEntryId: waitlistEntryId ?? null,
            buyerPartyId: buyerPartyId ?? null,
          },
        });
      } catch (err: any) {
        if (err && err.code === "P2002") {
          // Link already exists, treat as success and fall through to fetch updated group
        } else {
          req.log?.error?.({ err }, "Failed to create offspring group buyer");
          return reply.status(500).send({ error: "internal_error" });
        }
      }

      const updatedGroup = await prisma.offspringGroup.findFirst({
        where: { id: group.id, tenantId },
        include: {
          groupBuyerLinks: {
            include: {
              waitlistEntry: true,
            },
          },
        },
      });

      if (!updatedGroup) {
        return reply.status(500).send({ error: "group_reload_failed" });
      }

      return reply.status(200).send({
        ok: true,
        duplicate: false,
        group: updatedGroup,
      });
    }
  );

  app.delete<{ Params: { groupId: string; buyerId: string } }>(
    "/offspring/groups/:groupId/buyers/:buyerId",
    async (req, reply) => {
      const tenantId = (req as any).tenantId as number;
      const groupId = Number(req.params.groupId);
      const buyerId = Number(req.params.buyerId);

      if (!Number.isFinite(groupId) || !Number.isFinite(buyerId)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Make sure the group exists for this tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId },
        select: { id: true },
      });

      if (!group) {
        return reply.code(404).send({ error: "group_not_found" });
      }

      // Remove the buyer link
      await prisma.offspringGroupBuyer.deleteMany({
        where: {
          id: buyerId,
          groupId: group.id,
          tenantId,
        },
      });

      // Reload full group detail so UI gets buyers and linked offspring in the same shape as GET /offspring/:id
      const G = await prisma.offspringGroup.findFirst({
        where: { id: group.id, tenantId },
        include: {
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              species: true,
              breedText: true,
              dam: { select: { id: true, name: true } },
              sire: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!G) {
        return reply.code(404).send({ error: "group not found after buyer create" });
      }

      const [animals, waitlist, attachments, buyers, offspring] = await Promise.all([
        prisma.animal.findMany({
          where: {
            offspringGroupId: group.id,
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
            offspringGroupId: group.id,
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
            { createdAt: "asc" },
            { id: "asc" },
          ],
        }),
        prisma.attachment.findMany({
          where: {
            offspringGroupId: group.id,
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
            groupId: group.id,
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
            groupId: group.id,
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

      reply.code(200).send(
        groupDetail(
          G as any,
          animals as any,
          waitlist as any,
          attachments as any,
          mappedBuyers as any,
          offspring as any,
        ),
      );
    }
  );

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
      const out = await og.unlinkGroup({ tenantId, groupId, actorId });
      reply.send(out);
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
};

export default offspringRoutes;
