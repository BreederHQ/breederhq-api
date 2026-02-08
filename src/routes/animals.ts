// src/routes/animals.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { checkQuota } from "../middleware/quota-enforcement.js";
import { updateUsageSnapshot } from "../services/subscription/usage-service.js";
import * as lineageService from "../services/lineage-service.js";
import * as identityMatchingService from "../services/identity-matching-service.js";
import type { IdentifierType, OwnerRole } from "@prisma/client";
import { activeOnly } from "../utils/query-helpers.js";
import { calculateCycleAnalysis } from "../services/cycle-analysis-service.js";
import { uploadBuffer, deleteFile } from "../services/media-storage.js";

const AVATAR_SIZE = 256;

/* Keep these in sync with Prisma enums */
type Species = "DOG" | "CAT" | "HORSE" | "GOAT" | "SHEEP" | "RABBIT";
type Sex = "FEMALE" | "MALE";
type AnimalStatus = "ACTIVE" | "BREEDING" | "UNAVAILABLE" | "RETIRED" | "DECEASED" | "PROSPECT";

/* ───────── utils ───────── */

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function parseDateIso(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}
function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(1000, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function normalizeIsoDateOnly(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(+d)) return null;
  // truncate to YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks for potential duplicate animals within a tenant.
 * Returns matching animals if duplicates are found.
 */
async function findPotentialDuplicates(
  tenantId: number,
  name: string,
  species: Species,
  sex: Sex,
  birthDate?: Date | null,
  microchip?: string | null,
  excludeId?: number | null
): Promise<Array<{ id: number; name: string; species: string; sex: string; birthDate: Date | null; microchip: string | null }>> {
  const normalizedName = name.trim().toLowerCase();

  // Build query conditions
  const conditions: any[] = [
    { tenantId },
    { archived: false },
    { species },
    { sex },
  ];

  // Exclude specific animal (for updates)
  if (excludeId) {
    conditions.push({ id: { not: excludeId } });
  }

  // Find animals with same name (case-insensitive)
  const candidates = await prisma.animal.findMany({
    where: {
      AND: conditions,
    },
    select: {
      id: true,
      name: true,
      species: true,
      sex: true,
      birthDate: true,
      microchip: true,
    },
  });

  // Filter to those with matching names (case-insensitive)
  const matches = candidates.filter((a) => {
    const candidateName = a.name.trim().toLowerCase();

    // Exact name match
    if (candidateName === normalizedName) {
      return true;
    }

    // Also check for very similar names (one contains the other, for kennel name variations)
    // e.g., "Padfoot's Pride" vs "Padfoots Pride" (apostrophe difference)
    const normalizedCandidate = candidateName.replace(/[''`]/g, "").replace(/\s+/g, " ");
    const normalizedInput = normalizedName.replace(/[''`]/g, "").replace(/\s+/g, " ");
    if (normalizedCandidate === normalizedInput) {
      return true;
    }

    return false;
  });

  return matches;
}

type ReproEventKind = "heat_start" | "ovulation" | "insemination" | "birth";

type ReproEvent = {
  kind: ReproEventKind;
  date: string; // ISO yyyy mm dd
};

function buildReproFromCycles(cycles: Array<{
  cycleStart: Date | string;
  ovulation?: Date | string | null;
  dueDate?: Date | string | null;
  placementStartDate?: Date | string | null;
}>): { cycleStartDates: string[]; repro: ReproEvent[]; last_heat: string | null } {
  const dates: string[] = [];
  const events: ReproEvent[] = [];

  for (const c of cycles) {
    const heatIso = normalizeIsoDateOnly(c.cycleStart);
    if (heatIso) {
      dates.push(heatIso);
      events.push({ kind: "heat_start", date: heatIso });
    }

    const ovIso = normalizeIsoDateOnly(c.ovulation ?? null);
    if (ovIso) {
      events.push({ kind: "ovulation", date: ovIso });
    }

    const dueIso = normalizeIsoDateOnly(c.dueDate ?? null);
    if (dueIso) {
      events.push({ kind: "birth", date: dueIso });
    }
  }

  const uniqueDates = Array.from(new Set(dates)).sort();
  events.sort((a, b) => a.date.localeCompare(b.date));
  const last_heat = uniqueDates.length ? uniqueDates[uniqueDates.length - 1] : null;

  return { cycleStartDates: uniqueDates, repro: events, last_heat };
}

function extractCycleStartDates(rec: any): string[] {
  const cycles = Array.isArray(rec?.reproductiveCycles) ? rec.reproductiveCycles : [];
  const dates = cycles
    .map((c: any) => {
      const raw = c.cycleStart ?? c.cycle_start ?? null;
      if (!raw) return null;
      const d = new Date(raw);
      if (Number.isNaN(+d)) return null;
      return d.toISOString().slice(0, 10);
    })
    .filter(Boolean) as string[];

  // dedupe and sort ascending
  return Array.from(new Set(dates)).sort();
}

function parseSort(sortParam?: string) {
  // allow: "createdAt", "-createdAt", "name", "-name", "updatedAt", "birthDate"
  const allowed = new Set(["createdAt", "updatedAt", "name", "birthDate"]);
  if (!sortParam) return [{ createdAt: "desc" } as const];
  const parts = String(sortParam).split(",").map(s => s.trim()).filter(Boolean);
  const orderBy: any[] = [];
  for (const p of parts) {
    const desc = p.startsWith("-");
    const key = p.replace(/^-/, "");
    if (allowed.has(key)) orderBy.push({ [key]: desc ? "desc" : "asc" });
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" }];
}


function cycleDatesFromCycles(cycles: Array<{ cycleStart: Date }>): string[] {
  const dates: string[] = [];
  for (const c of cycles) {
    const iso = normalizeIsoDateOnly(c.cycleStart);
    if (iso) dates.push(iso);
  }
  return Array.from(new Set(dates)).sort();
}

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

/* Guards */
async function assertOrgInTenant(orgId: number, tenantId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, tenantId: true },
  });
  if (!org) throw Object.assign(new Error("not_found"), { statusCode: 404 });
  if (org.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return org;
}
async function assertContactInTenant(contactId: number, tenantId: number) {
  const c = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, tenantId: true },
  });
  if (!c) throw Object.assign(new Error("contact_not_found"), { statusCode: 404 });
  if (c.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return c;
}
async function assertAnimalInTenant(animalId: number, tenantId: number) {
  const a = await prisma.animal.findFirst({
    where: activeOnly({ id: animalId, tenantId }),
    select: { id: true, tenantId: true },
  });
  if (!a) throw Object.assign(new Error("not_found"), { statusCode: 404 });
  return a;
}

/* Tenant default owner party helper */
async function getTenantDefaultOwnerParty(tenantId: number): Promise<{ partyId: number; displayName: string } | null> {
  // Strategy 1: Find the first organization in the tenant (most common case for breeders)
  const org = await prisma.organization.findFirst({
    where: { tenantId, archived: false },
    orderBy: { id: "asc" },
    select: {
      partyId: true,
      name: true,
    },
  });
  if (org) {
    return { partyId: org.partyId, displayName: org.name };
  }

  // Strategy 2: Find the tenant owner user's party
  const user = await prisma.user.findFirst({
    where: {
      tenantMemberships: {
        some: { tenantId, role: "OWNER" },
      },
      partyId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      partyId: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });
  if (user?.partyId) {
    const displayName = user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Tenant Owner";
    return { partyId: user.partyId, displayName };
  }

  // Strategy 3: Find any contact in the tenant (fallback)
  const contact = await prisma.contact.findFirst({
    where: { tenantId, archived: false },
    orderBy: { id: "asc" },
    select: {
      partyId: true,
      display_name: true,
    },
  });
  if (contact && contact.partyId) {
    return { partyId: contact.partyId, displayName: contact.display_name || "Contact" };
  }

  return null;
}

/* Cross refs validation matching schema relations */
async function validateCanonicalBreedId(canonicalBreedId: number | null | undefined) {
  if (canonicalBreedId == null) return;
  const exists = await prisma.breed.findUnique({ where: { id: canonicalBreedId }, select: { id: true } });
  if (!exists) throw Object.assign(new Error("canonical_breed_not_found"), { statusCode: 404 });
}
async function validateCustomBreedId(customBreedId: number | null | undefined, tenantId: number) {
  if (customBreedId == null) return;
  const exists = await prisma.customBreed.findFirst({
    where: { id: customBreedId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!exists) throw Object.assign(new Error("custom_breed_not_in_tenant"), { statusCode: 404 });
}

/* ───────── routes ───────── */


const animalsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /animals?q=&species=&sex=&status=&organizationId=&includeArchived=&page=&limit=&sort=
  app.get("/animals", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const {
      q = "",
      species = "",
      sex = "",
      status = "",
      organizationId = "",
      includeArchived = "",
      page = "1",
      limit = "25",
      sort = "-createdAt",
    } = (req.query || {}) as {
      q?: string;
      species?: Species | "";
      sex?: Sex | "";
      status?: AnimalStatus | "";
      organizationId?: string;
      includeArchived?: string | "1" | "true";
      page?: string;
      limit?: string;
      sort?: string;
    };

    const { page: pageNum, limit: take, skip } = parsePaging({ page, limit });
    const orderBy = parseSort(sort);

    const where: any = { tenantId };

    if (!includeArchived || includeArchived === "0" || includeArchived === "false") {
      where.archived = false;
    }
    if (species) {
      if (!["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"].includes(species)) return reply.code(400).send({ error: "species_invalid" });
      where.species = species;
    }
    if (sex) {
      if (!["FEMALE", "MALE"].includes(sex)) return reply.code(400).send({ error: "sex_invalid" });
      where.sex = sex;
    }
    if (status) {
      if (!["ACTIVE", "BREEDING", "UNAVAILABLE", "RETIRED", "DECEASED", "PROSPECT"].includes(status)) {
        return reply.code(400).send({ error: "status_invalid" });
      }
      where.status = status;
    }

    if (organizationId) {
      const orgId = parseIntStrict(organizationId);
      if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
      await assertOrgInTenant(orgId, tenantId);
      where.organizationId = orgId;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { microchip: { contains: q, mode: "insensitive" } },
        { breed: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ];
    }

    const whereWithActive = activeOnly(where);
    const [rawItems, total] = await prisma.$transaction([
      prisma.animal.findMany({
        where: whereWithActive,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          name: true,
          species: true,
          sex: true,
          status: true,
          birthDate: true,
          microchip: true,
          notes: true,
          breed: true,
          canonicalBreedId: true,
          customBreedId: true,
          litterId: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
          photoUrl: true,
          femaleCycleLenOverrideDays: true,
          // Title display fields
          titlePrefix: true,
          titleSuffix: true,
          // Achievement counts
          _count: {
            select: {
              titles: true,
              competitionEntries: true,
            },
          },

          reproductiveCycles: {
            select: { cycleStart: true },
          },
        },
      }),
      prisma.animal.count({ where: whereWithActive }),
    ]);

    const items = rawItems.map((rec) => ({
      ...rec,
      cycleStartDates: extractCycleStartDates(rec),
    }));

    reply.send({ items, total, page: pageNum, limit: take });
  });

  // PUT /animals/:id/cycle-start-dates
  app.put("/animals/:id/cycle-start-dates", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    const body = (req.body || {}) as { dates?: string[] };
    const input = Array.isArray(body.dates) ? body.dates : [];

    const normalized = Array.from(
      new Set(
        input
          .map((d) => normalizeIsoDateOnly(d))
          .filter((d): d is string => !!d)
      )
    ).sort();

    // Blow away existing cycles for this female in this tenant and recreate
    await prisma.reproductiveCycle.deleteMany({
      where: { tenantId, femaleId: id },
    });

    if (normalized.length) {
      await prisma.reproductiveCycle.createMany({
        data: normalized.map((iso) => ({
          tenantId,
          femaleId: id,
          cycleStart: new Date(iso),
        })),
      });
    }

    // Return updated animal with computed cycleStartDates
    const rec = await prisma.animal.findFirst({
      where: activeOnly({ id, tenantId }),
      select: {
        id: true,
        tenantId: true,
        organizationId: true,
        name: true,
        species: true,
        sex: true,
        status: true,
        birthDate: true,
        microchip: true,
        notes: true,
        breed: true,
        canonicalBreedId: true,
        customBreedId: true,
        litterId: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
        photoUrl: true,
        reproductiveCycles: {
          select: { cycleStart: true },
        },
      },
    });

    if (!rec) return reply.code(404).send({ error: "not_found" });

    const cycleStartDates = extractCycleStartDates(rec);
    reply.send({ ...rec, cycleStartDates });
  });

  // GET /animals/:id/cycle-analysis
  // Returns ovulation pattern analysis and cycle history for a female
  app.get("/animals/:id/cycle-analysis", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    try {
      const analysis = await calculateCycleAnalysis(id, tenantId);
      reply.send(analysis);
    } catch (err: any) {
      if (err.message === "Animal not found") {
        return reply.code(404).send({ error: "not_found" });
      }
      throw err;
    }
  });


  // GET /animals/:id
  app.get("/animals/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    const { include = "" } = (req.query || {}) as { include?: string };
    const includeParts = String(include || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const wantRepro = includeParts.includes("repro") || includeParts.includes("last_heat");
    const wantProgramParticipants = includeParts.includes("programParticipants") || includeParts.includes("marketplace");

    const rec = await prisma.animal.findFirst({
      where: activeOnly({ id, tenantId }),
      select: {
        id: true,
        tenantId: true,
        organizationId: true,
        name: true,
        species: true,
        sex: true,
        status: true,
        birthDate: true,
        microchip: true,
        notes: true,
        breed: true,
        canonicalBreedId: true,
        customBreedId: true,
        litterId: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
        femaleCycleLenOverrideDays: true,
        // Parent IDs for pedigree
        sireId: true,
        damId: true,
        // Valuation fields (primarily for horses)
        intendedUse: true,
        declaredValueCents: true,
        declaredValueCurrency: true,
        valuationDate: true,
        valuationSource: true,
        forSale: true,
        inSyndication: true,
        isLeased: true,
        // Marketplace program participants (conditional)
        ...(wantProgramParticipants && {
          programParticipants: {
            select: {
              id: true,
              programId: true,
              status: true,
              listed: true,
              featured: true,
              program: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  templateType: true,
                  status: true,
                },
              },
            },
          },
        }),
      },
    });
    if (!rec) return reply.code(404).send({ error: "not_found" });

    const cycles = await prisma.reproductiveCycle.findMany({
      where: { tenantId, femaleId: id },
      select: {
        cycleStart: true,
        ovulation: true,
        dueDate: true,
        placementStartDate: true,
      },
      orderBy: { cycleStart: "asc" },
    });

    const info = buildReproFromCycles(cycles);

    const result: any = {
      ...rec,
      cycleStartDates: info.cycleStartDates,
    };

    if (wantRepro) {
      result.repro = info.repro;
      result.last_heat = info.last_heat;
    }

    reply.send(result);
  });

  // POST /animals
  app.post(
    "/animals",
    {
      preHandler: [checkQuota("ANIMAL_COUNT")],
    },
    async (req, reply) => {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;

    const b = (req.body || {}) as Partial<{
      name: string;
      species: Species;
      sex: Sex;
      status: AnimalStatus;
      birthDate: string | null;
      microchip: string | null;
      notes: string | null;
      breed: string | null;
      canonicalBreedId: number | null;
      customBreedId: number | null;
      organizationId: number | null;
      photoUrl: string | null;
      // Lineage fields
      damId: number | null;
      sireId: number | null;
      // Duplicate check bypass
      skipDuplicateCheck: boolean;
    }>;


    const name = String(b.name || "").trim();
    if (!name) return reply.code(400).send({ error: "name_required" });
    if (!b.species || !["DOG", "CAT", "HORSE"].includes(b.species)) {
      return reply.code(400).send({ error: "species_required" });
    }
    if (!b.sex || !["FEMALE", "MALE"].includes(b.sex)) {
      return reply.code(400).send({ error: "sex_required" });
    }

    // Check for potential duplicates unless explicitly bypassed
    if (!b.skipDuplicateCheck) {
      const parsedBirthDate = b.birthDate ? new Date(b.birthDate) : null;
      const duplicates = await findPotentialDuplicates(
        tenantId,
        name,
        b.species,
        b.sex,
        parsedBirthDate,
        b.microchip?.trim() || null
      );

      if (duplicates.length > 0) {
        return reply.code(409).send({
          error: "potential_duplicate",
          message: "An animal with the same name, species, and sex already exists",
          duplicates: duplicates.map((d) => ({
            id: d.id,
            name: d.name,
            species: d.species,
            sex: d.sex,
            birthDate: d.birthDate,
            microchip: d.microchip,
          })),
        });
      }
    }

    const data: any = {
      tenantId,
      name,
      species: b.species,
      sex: b.sex,
      status: b.status || "ACTIVE",
    };

    if (b.birthDate) {
      const d = new Date(b.birthDate);
      if (Number.isNaN(+d)) return reply.code(400).send({ error: "birthDate_invalid" });
      data.birthDate = d;
    }

    if (typeof b.microchip === "string") {
      data.microchip = b.microchip.trim() || null;
    }
    if (typeof b.notes === "string") {
      data.notes = b.notes.trim() || null;
    }

    // NEW: normalise photoUrl in create
    if (typeof b.photoUrl === "string") {
      const u = b.photoUrl.trim();
      data.photoUrl = u || null;
    }

    if (typeof b.breed === "string") {
      data.breed = b.breed.trim() || null;
    }
    if (typeof b.canonicalBreedId === "number") {
      data.canonicalBreedId = b.canonicalBreedId || null;
    }
    if (typeof b.customBreedId === "number") {
      data.customBreedId = b.customBreedId || null;
    }
    if (b.organizationId != null) {
      const orgId = parseIntStrict(b.organizationId);
      if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
      await assertOrgInTenant(orgId, tenantId);
      data.organizationId = orgId;
    }

    // Lineage: set parents if provided (must be animals in same tenant)
    if (b.damId != null) {
      const damId = typeof b.damId === "number" ? b.damId : parseInt(String(b.damId), 10);
      if (!Number.isNaN(damId)) {
        const dam = await prisma.animal.findFirst({ where: activeOnly({ id: damId, tenantId }) });
        if (!dam) return reply.code(400).send({ error: "damId_not_found" });
        if (dam.sex !== "FEMALE") return reply.code(400).send({ error: "dam_must_be_female" });
        data.damId = damId;
      }
    }
    if (b.sireId != null) {
      const sireId = typeof b.sireId === "number" ? b.sireId : parseInt(String(b.sireId), 10);
      if (!Number.isNaN(sireId)) {
        const sire = await prisma.animal.findFirst({ where: activeOnly({ id: sireId, tenantId }) });
        if (!sire) return reply.code(400).send({ error: "sireId_not_found" });
        if (sire.sex !== "MALE") return reply.code(400).send({ error: "sire_must_be_male" });
        data.sireId = sireId;
      }
    }

    try {
      const created = await prisma.animal.create({
        data,
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          name: true,
          species: true,
          sex: true,
          status: true,
          birthDate: true,
          microchip: true,
          notes: true,
          breed: true,
          canonicalBreedId: true,
          customBreedId: true,
          litterId: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
          photoUrl: true,
          // Lineage
          damId: true,
          sireId: true,
        },
      });

      // Automatically create default owner (tenant's primary organization/user party)
      // This ensures every animal has an owner, defaulting to 100% owned by the tenant
      const defaultOwner = await getTenantDefaultOwnerParty(tenantId);
      if (defaultOwner) {
        try {
          await prisma.animalOwner.create({
            data: {
              animalId: created.id,
              partyId: defaultOwner.partyId,
              percent: 100,
              isPrimary: true,
              // P2.1-P2.5: Enhanced ownership fields for default owner
              role: "SOLE_OWNER",
              effectiveDate: new Date(),
              isPrimaryContact: true,
              receiveNotifications: true,
            },
          });
        } catch (ownerErr) {
          // Log but don't fail the animal creation if owner creation fails
          // This allows the animal to be created even if there's an issue with ownership
        }
      }

      // Update usage snapshot after successful creation
      await updateUsageSnapshot(tenantId, "ANIMAL_COUNT");

      return reply.code(201).send(created);
    } catch (e: any) {
      if (e?.code === "P2002") {
        // @@unique([tenantId, microchip])
        return reply
          .code(409)
          .send({ error: "duplicate_microchip", detail: "microchip_must_be_unique_within_tenant" });
      }
      if (e?.code === "P2003") {
        return reply.code(409).send({ error: "foreign_key_conflict" });
      }
      throw e;
    }
    }
  );

  // PATCH /animals/:id
  app.patch("/animals/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    const existing = await prisma.animal.findFirst({ where: activeOnly({ id, tenantId }), select: { id: true } });
    if (!existing) return reply.code(404).send({ error: "not_found" });

    const b = (req.body || {}) as Partial<{
      organizationId: number | null;
      name: string;
      species: Species;
      sex: Sex;
      status: AnimalStatus;
      birthDate: string | null;
      microchip: string | null;
      notes: string | null;
      breed: string | null;
      canonicalBreedId: number | null;
      customBreedId: number | null;
      archived: boolean;
      photoUrl: string | null;
      femaleCycleLenOverrideDays: number | null;
      // Valuation fields
      intendedUse: string | null;
      declaredValueCents: number | null;
      declaredValueCurrency: string | null;
      valuationDate: string | null;
      valuationSource: string | null;
      forSale: boolean;
      inSyndication: boolean;
      isLeased: boolean;
    }>;


    // Pre-validate cross refs to match schema constraints
    if (b.canonicalBreedId !== undefined && b.canonicalBreedId !== null) {
      await validateCanonicalBreedId(b.canonicalBreedId);
    }
    if (b.customBreedId !== undefined && b.customBreedId !== null) {
      await validateCustomBreedId(b.customBreedId, tenantId);
    }

    const data: any = {};
    if (b.name !== undefined) {
      const n = String(b.name || "").trim();
      if (!n) return reply.code(400).send({ error: "name_required" });
      data.name = n;
    }
    if (b.species !== undefined) {
      if (!["DOG", "CAT", "HORSE"].includes(b.species)) return reply.code(400).send({ error: "species_invalid" });
      data.species = b.species;
    }
    if (b.sex !== undefined) {
      if (!["FEMALE", "MALE"].includes(b.sex)) return reply.code(400).send({ error: "sex_invalid" });
      data.sex = b.sex;
    }
    if (b.status !== undefined) {
      if (!["ACTIVE", "BREEDING", "UNAVAILABLE", "RETIRED", "DECEASED", "PROSPECT"].includes(b.status)) {
        return reply.code(400).send({ error: "status_invalid" });
      }
      data.status = b.status;
    }
    if (b.birthDate !== undefined) {
      const d = parseDateIso(b.birthDate);
      if (d === null) return reply.code(400).send({ error: "birthDate_invalid" });
      data.birthDate = d;
    }
    if (b.microchip !== undefined) data.microchip = b.microchip;
    if (b.notes !== undefined) data.notes = b.notes;
    if (b.breed !== undefined) data.breed = b.breed;
    if (b.photoUrl !== undefined) data.photoUrl = b.photoUrl;
    if (b.canonicalBreedId !== undefined) data.canonicalBreedId = b.canonicalBreedId;
    if (b.customBreedId !== undefined) data.customBreedId = b.customBreedId;
    if (b.archived !== undefined) data.archived = !!b.archived;

    if (b.organizationId !== undefined) {
      if (b.organizationId === null) {
        data.organizationId = null;
      } else {
        const orgId = parseIntStrict(b.organizationId);
        if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
        await assertOrgInTenant(orgId, tenantId);
        data.organizationId = orgId;
      }
    }

    // Cycle Length Override v1: Validate femaleCycleLenOverrideDays
    if (b.femaleCycleLenOverrideDays !== undefined) {
      const value = b.femaleCycleLenOverrideDays;
      // Allow null to clear override
      if (value !== null) {
        // Must be an integer
        if (!Number.isInteger(value)) {
          return reply.code(400).send({
            error: "invalid_cycle_len_override",
            detail: "must be an integer between 30 and 730 days"
          });
        }
        // Range validation: 30-730 days
        if (value < 30 || value > 730) {
          return reply.code(400).send({
            error: "invalid_cycle_len_override",
            detail: "must be an integer between 30 and 730 days"
          });
        }
      }
      data.femaleCycleLenOverrideDays = value;
    }

    // Valuation fields
    if (b.intendedUse !== undefined) {
      if (b.intendedUse !== null && !["BREEDING", "SHOW", "RACING"].includes(b.intendedUse)) {
        return reply.code(400).send({ error: "intendedUse_invalid", detail: "must be BREEDING, SHOW, or RACING" });
      }
      data.intendedUse = b.intendedUse;
    }
    if (b.declaredValueCents !== undefined) {
      if (b.declaredValueCents !== null) {
        if (!Number.isInteger(b.declaredValueCents) || b.declaredValueCents < 0) {
          return reply.code(400).send({ error: "declaredValueCents_invalid", detail: "must be a non-negative integer" });
        }
      }
      data.declaredValueCents = b.declaredValueCents;
    }
    if (b.declaredValueCurrency !== undefined) {
      if (b.declaredValueCurrency !== null) {
        const currency = String(b.declaredValueCurrency).toUpperCase().trim();
        if (currency.length !== 3) {
          return reply.code(400).send({ error: "declaredValueCurrency_invalid", detail: "must be a 3-character ISO 4217 currency code" });
        }
        data.declaredValueCurrency = currency;
      } else {
        data.declaredValueCurrency = null;
      }
    }
    if (b.valuationDate !== undefined) {
      if (b.valuationDate !== null) {
        const d = parseDateIso(b.valuationDate);
        if (d === null) return reply.code(400).send({ error: "valuationDate_invalid" });
        data.valuationDate = d;
      } else {
        data.valuationDate = null;
      }
    }
    if (b.valuationSource !== undefined) {
      if (b.valuationSource !== null && !["PRIVATE_SALE", "AUCTION", "APPRAISAL", "INSURANCE", "OTHER"].includes(b.valuationSource)) {
        return reply.code(400).send({ error: "valuationSource_invalid", detail: "must be PRIVATE_SALE, AUCTION, APPRAISAL, INSURANCE, or OTHER" });
      }
      data.valuationSource = b.valuationSource;
    }
    if (b.forSale !== undefined) data.forSale = !!b.forSale;
    if (b.inSyndication !== undefined) data.inSyndication = !!b.inSyndication;
    if (b.isLeased !== undefined) data.isLeased = !!b.isLeased;

    try {
      const updated = await prisma.animal.update({
        where: { id },
        data,
        select: {
          id: true,
          tenantId: true,
          organizationId: true,
          name: true,
          species: true,
          sex: true,
          status: true,
          birthDate: true,
          microchip: true,
          notes: true,
          breed: true,
          canonicalBreedId: true,
          customBreedId: true,
          litterId: true,
          archived: true,
          createdAt: true,
          updatedAt: true,
          photoUrl: true,
          femaleCycleLenOverrideDays: true,
          // Valuation fields
          intendedUse: true,
          declaredValueCents: true,
          declaredValueCurrency: true,
          valuationDate: true,
          valuationSource: true,
          forSale: true,
          inSyndication: true,
          isLeased: true,
        },
      });
      reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply
          .code(409)
          .send({ error: "duplicate_microchip", detail: "microchip_must_be_unique_within_tenant" });
      }
      if (e?.code === "P2025") {
        return reply.code(404).send({ error: "not_found" });
      }
      if (e?.code === "P2003") {
        return reply.code(409).send({ error: "foreign_key_conflict" });
      }
      throw e;
    }
  });

  // PATCH /animals/:id/breeding-availability
  // Toggle breeding availability: "open" (available) or "resting" (not available)
  app.patch("/animals/:id/breeding-availability", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    const body = (req.body || {}) as { status?: string; notes?: string };
    const { status } = body;

    // Validate status - only "open" or "resting" allowed
    if (!status || !["open", "resting"].includes(status)) {
      return reply.code(400).send({
        error: "invalid_status",
        message: "Status must be 'open' or 'resting'",
      });
    }

    // Verify animal exists and belongs to tenant
    const existing = await prisma.animal.findFirst({
      where: activeOnly({ id, tenantId }),
      select: { id: true, name: true, species: true, sex: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Update the breeding availability
    const updated = await prisma.animal.update({
      where: { id },
      data: { breedingAvailability: status },
      select: {
        id: true,
        name: true,
        species: true,
        sex: true,
        breedingAvailability: true,
        updatedAt: true,
      },
    });

    reply.send({
      id: updated.id,
      name: updated.name,
      species: updated.species,
      sex: updated.sex,
      breedingAvailability: updated.breedingAvailability,
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

    // POST /animals/:id/photo
  // Uploads animal photo to S3, resizes to 256x256 avatar
  // Max upload size: 10MB (images are resized anyway)
  const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

  app.post("/animals/:id/photo", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    const mpReq = req as any;
    const file = await mpReq.file();
    if (!file) return reply.code(400).send({ error: "file_required" });

    const buf = await file.toBuffer();

    // Validate file size before processing
    if (buf.length > MAX_PHOTO_SIZE) {
      return reply.code(400).send({
        error: "file_too_large",
        message: "Photo must be less than 10MB",
      });
    }

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return reply.code(400).send({
        error: "invalid_content_type",
        message: "Photo must be JPEG, PNG, WebP, or HEIC format",
      });
    }

    // Resize to avatar size
    const resized = await sharp(buf)
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload to S3: tenants/{tenantId}/animal/{animalId}/photos/{uuid}.jpg
    const { storageKey, cdnUrl } = await uploadBuffer(
      {
        ownerType: "tenant",
        ownerId: tenantId,
        purpose: "animal",
        resourceId: String(id),
        subPath: "photos",
      },
      "photo.jpg",
      resized,
      "image/jpeg"
    );

    // Get old photoUrl to delete from S3 if it's an S3 URL
    const oldAnimal = await prisma.animal.findUnique({
      where: { id },
      select: { photoUrl: true },
    });

    // Update animal with new CDN URL
    const updated = await prisma.animal.update({
      where: { id },
      data: { photoUrl: cdnUrl },
      select: { photoUrl: true },
    });

    // Clean up old S3 photo if it was an S3 URL (not legacy local path)
    if (oldAnimal?.photoUrl?.includes("tenants/") || oldAnimal?.photoUrl?.includes("s3.")) {
      try {
        // Extract storage key from CDN URL
        const urlParts = oldAnimal.photoUrl.split("/");
        const keyIndex = urlParts.findIndex(p => p === "tenants");
        if (keyIndex >= 0) {
          const oldKey = urlParts.slice(keyIndex).join("/");
          await deleteFile(oldKey);
        }
      } catch (e) {
        // Ignore delete failures for old photos
        req.log.warn({ error: e, oldUrl: oldAnimal.photoUrl }, "Failed to delete old photo");
      }
    }

    reply.send({ photoUrl: updated.photoUrl, storageKey });
  });

    // DELETE /animals/:id/photo
  app.delete("/animals/:id/photo", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    // Get current photo URL to delete from S3
    const animal = await prisma.animal.findUnique({
      where: { id },
      select: { photoUrl: true },
    });

    // Delete from S3 if it's an S3 URL
    if (animal?.photoUrl?.includes("tenants/") || animal?.photoUrl?.includes("s3.")) {
      try {
        const urlParts = animal.photoUrl.split("/");
        const keyIndex = urlParts.findIndex(p => p === "tenants");
        if (keyIndex >= 0) {
          const storageKey = urlParts.slice(keyIndex).join("/");
          await deleteFile(storageKey);
        }
      } catch (e) {
        req.log.warn({ error: e, photoUrl: animal.photoUrl }, "Failed to delete photo from S3");
      }
    }

    const updated = await prisma.animal.update({
      where: { id },
      data: { photoUrl: null },
      select: { photoUrl: true },
    });

    reply.send(updated);
  });


  // POST /animals/:id/archive
  app.post("/animals/:id/archive", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);
    await prisma.animal.update({ where: { id }, data: { archived: true } });
    reply.send({ ok: true });
  });

  // POST /animals/:id/restore
  app.post("/animals/:id/restore", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);
    await prisma.animal.update({ where: { id }, data: { archived: false } });
    reply.send({ ok: true });
  });

  // DELETE /animals/:id
  app.delete("/animals/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);
    await prisma.animal.delete({ where: { id } });

    // Update usage snapshot after deletion
    await updateUsageSnapshot(tenantId, "ANIMAL_COUNT");

    reply.send({ ok: true });
  });

  // GET /animals/:id/can-delete
  // Check if an animal can be safely deleted and return any blockers
  // Deletion is ONLY allowed if the animal has essentially no real data
  app.get("/animals/:id/can-delete", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    try {
      // Verify animal exists in tenant
      const animal = await prisma.animal.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!animal) return reply.code(404).send({ error: "animal_not_found" });

      const blockers: Record<string, boolean> = {};
      const details: Record<string, number> = {};

      // Check for offspring (this animal is a parent via Animal table damId/sireId)
      const offspringCount = await prisma.animal.count({
        where: {
          OR: [{ damId: id }, { sireId: id }],
        },
      });
      if (offspringCount > 0) {
        blockers.hasOffspring = true;
        blockers.isParentInPedigree = true;
        details.offspringCount = offspringCount;
      }

      // Check for offspring via Offspring table
      const offspringTableCount = await prisma.offspring.count({
        where: {
          OR: [{ damId: id }, { sireId: id }],
        },
      });
      if (offspringTableCount > 0) {
        blockers.hasOffspring = true;
        details.offspringCount = (details.offspringCount || 0) + offspringTableCount;
      }

      // Check for cross-tenant identity links
      const identityLinkCount = await prisma.animalIdentityLink.count({
        where: { animalId: id },
      });
      if (identityLinkCount > 0) {
        blockers.hasCrossTenantLinks = true;
        details.crossTenantLinkCount = identityLinkCount;
      }

      // Check for breeding plans
      const breedingPlanCount = await prisma.breedingPlan.count({
        where: {
          tenantId,
          OR: [{ damId: id }, { sireId: id }],
        },
      });
      if (breedingPlanCount > 0) {
        blockers.hasBreedingPlans = true;
        details.breedingPlanCount = breedingPlanCount;
      }

      // Check for waitlist entries (allocations and preferences)
      const waitlistCount = await prisma.waitlistEntry.count({
        where: {
          tenantId,
          OR: [{ animalId: id }, { sirePrefId: id }, { damPrefId: id }],
        },
      });
      if (waitlistCount > 0) {
        blockers.hasWaitlistEntries = true;
        details.waitlistEntryCount = waitlistCount;
      }

      // Check for invoices linked to this animal
      const invoiceCount = await prisma.invoice.count({
        where: { tenantId, animalId: id },
      });
      if (invoiceCount > 0) {
        blockers.hasInvoices = true;
        details.invoiceCount = invoiceCount;
      }

      // Check for payments linked to this animal (via invoices)
      const paymentCount = await prisma.payment.count({
        where: {
          tenantId,
          invoice: { animalId: id },
        },
      });
      if (paymentCount > 0) {
        blockers.hasPayments = true;
        details.paymentCount = paymentCount;
      }

      // Check for documents
      const documentCount = await prisma.document.count({
        where: { tenantId, animalId: id },
      });
      if (documentCount > 0) {
        blockers.hasDocuments = true;
        details.documentCount = documentCount;
      }

      // Check for health records (vaccination records)
      const healthRecordCount = await prisma.vaccinationRecord.count({
        where: { tenantId, animalId: id },
      });
      if (healthRecordCount > 0) {
        blockers.hasHealthRecords = true;
        details.healthRecordCount = healthRecordCount;
      }

      // Check for registry identifiers
      const registrationCount = await prisma.animalRegistryIdentifier.count({
        where: { animalId: id },
      });
      if (registrationCount > 0) {
        blockers.hasRegistrations = true;
        details.registrationCount = registrationCount;
      }

      // Check for titles
      const titleCount = await prisma.animalTitle.count({
        where: { tenantId, animalId: id },
      });
      if (titleCount > 0) {
        blockers.hasTitles = true;
        details.titleCount = titleCount;
      }

      // Check for competition entries
      const competitionCount = await prisma.competitionEntry.count({
        where: { tenantId, animalId: id },
      });
      if (competitionCount > 0) {
        blockers.hasCompetitions = true;
        details.competitionCount = competitionCount;
      }

      // Check for ownership history
      const ownershipTransferCount = await prisma.animalOwnershipChange.count({
        where: { tenantId, animalId: id },
      });
      if (ownershipTransferCount > 0) {
        blockers.hasOwnershipHistory = true;
        details.ownershipTransferCount = ownershipTransferCount;
      }

      // Check for public listing
      const publicListingCount = await prisma.mktListingIndividualAnimal.count({
        where: { animalId: id },
      });
      if (publicListingCount > 0) {
        blockers.hasPublicListing = true;
      }

      // Check for media (trait value documents, animal shares, etc)
      const mediaCount = await prisma.animalTraitValueDocument.count({
        where: { tenantId, animalId: id },
      });
      if (mediaCount > 0) {
        blockers.hasMedia = true;
        details.mediaCount = mediaCount;
      }

      const canDelete = Object.keys(blockers).length === 0;

      return reply.send({
        canDelete,
        blockers,
        details: Object.keys(details).length > 0 ? details : undefined,
      });
    } catch (err) {
      console.error("[animals/can-delete] Error checking delete eligibility:", err);
      return reply.code(500).send({ error: "internal_error", message: String(err) });
    }
  });

  /* TAGS */
  // GET /animals/:id/tags
  app.get("/animals/:id/tags", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    const assignments = await prisma.tagAssignment.findMany({
      where: { animalId: id, tag: { tenantId, module: "ANIMAL" } },
      select: { tagId: true, tag: { select: { id: true, name: true, module: true, color: true } } },
      orderBy: { tag: { name: "asc" } },
    });

    reply.send({
      items: assignments.map(a => a.tag),
      total: assignments.length,
    });
  });

  // POST /animals/:id/tags { tagId }
  app.post("/animals/:id/tags", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    const { tagId } = (req.body || {}) as { tagId?: number };
    const tId = parseIntStrict(tagId);
    if (!tId) return reply.code(400).send({ error: "tagId_invalid" });

    const tag = await prisma.tag.findFirst({
      where: { id: tId, tenantId, module: "ANIMAL" },
      select: { id: true },
    });
    if (!tag) return reply.code(404).send({ error: "tag_not_found" });

    try {
      await prisma.tagAssignment.create({ data: { tagId: tId, animalId: id } });
      return reply.code(201).send({ ok: true });
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "already_assigned" });
      throw e;
    }
  });

  // DELETE /animals/:id/tags/:tagId
  app.delete("/animals/:id/tags/:tagId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    const tagId = parseIntStrict((req.params as { tagId: string }).tagId);
    if (!id || !tagId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    await prisma.tagAssignment.deleteMany({ where: { animalId: id, tagId } });
    reply.send({ ok: true });
  });

  /* OWNERS */
  // GET /animals/:id/owners
  app.get("/animals/:id/owners", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const rows = await prisma.animalOwner.findMany({
      where: { animalId },
      orderBy: [{ isPrimary: "desc" }, { percent: "desc" }, { id: "asc" }],
      select: {
        id: true,
        animalId: true,
        partyId: true,
        percent: true,
        isPrimary: true,
        role: true,
        effectiveDate: true,
        endDate: true,
        isPrimaryContact: true,
        receiveNotifications: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        party: {
          select: {
            id: true,
            type: true,
            contact: { select: { id: true, display_name: true, tenantId: true } },
            organization: { select: { id: true, name: true, tenantId: true } },
          },
        },
      },
    });

    // Calculate aggregate info
    const totalPercent = rows.reduce((sum, r) => sum + r.percent, 0);
    const hasMultipleOwners = rows.length > 1;

    reply.send({
      items: rows.map((r) => {
        return {
          id: r.id,
          partyId: r.partyId,
          kind: r.party?.type ?? null,
          displayName: r.party?.type === "CONTACT"
            ? r.party?.contact?.display_name
            : r.party?.organization?.name ?? null,
          percent: r.percent,
          isPrimary: r.isPrimary,
          role: r.role,
          effectiveDate: r.effectiveDate,
          endDate: r.endDate,
          isPrimaryContact: r.isPrimaryContact,
          receiveNotifications: r.receiveNotifications,
          notes: r.notes,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }),
      total: rows.length,
      totalPercent,
      hasMultipleOwners,
    });
  });

  // POST /animals/:id/owners
  app.post("/animals/:id/owners", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const b = (req.body || {}) as {
      partyId: number;
      percent: number;
      isPrimary?: boolean;
      role?: OwnerRole;
      effectiveDate?: string;
      isPrimaryContact?: boolean;
      receiveNotifications?: boolean;
      notes?: string;
    };

    const partyId = parseIntStrict(b.partyId);
    if (!partyId) {
      return reply.code(400).send({ error: "partyId_invalid" });
    }

    const percent = Number(b.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return reply.code(400).send({ error: "percent_invalid" });
    }

    // Validate role if provided
    const validRoles: OwnerRole[] = ["SOLE_OWNER", "CO_OWNER", "MANAGING_PARTNER", "SILENT_PARTNER", "BREEDING_RIGHTS", "INVESTOR"];
    if (b.role && !validRoles.includes(b.role)) {
      return reply.code(400).send({ error: "role_invalid" });
    }

    // Parse effectiveDate if provided
    const effectiveDate = b.effectiveDate ? parseDateIso(b.effectiveDate) : undefined;

    // Verify party exists and belongs to tenant
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      select: { tenantId: true },
    });
    if (!party || party.tenantId !== tenantId) {
      return reply.code(404).send({ error: "party_not_found" });
    }

    try {
      const created = await prisma.animalOwner.create({
        data: {
          animalId,
          partyId,
          percent,
          isPrimary: !!b.isPrimary,
          role: b.role ?? "CO_OWNER",
          effectiveDate: effectiveDate ?? new Date(),
          isPrimaryContact: b.isPrimaryContact ?? false,
          receiveNotifications: b.receiveNotifications ?? true,
          notes: b.notes ?? null,
        },
        select: {
          id: true,
          partyId: true,
          percent: true,
          isPrimary: true,
          role: true,
          effectiveDate: true,
          endDate: true,
          isPrimaryContact: true,
          receiveNotifications: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          party: {
            select: {
              id: true,
              type: true,
              contact: { select: { id: true, display_name: true } },
              organization: { select: { id: true, name: true } },
            },
          },
        },
      });

      return reply.code(201).send({
        id: created.id,
        partyId: created.partyId,
        kind: created.party?.type ?? null,
        displayName: created.party?.type === "CONTACT"
          ? created.party?.contact?.display_name
          : created.party?.organization?.name ?? null,
        percent: created.percent,
        isPrimary: created.isPrimary,
        role: created.role,
        effectiveDate: created.effectiveDate,
        endDate: created.endDate,
        isPrimaryContact: created.isPrimaryContact,
        receiveNotifications: created.receiveNotifications,
        notes: created.notes,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        // @@unique([animalId, partyId])
        return reply.code(409).send({ error: "duplicate_owner" });
      }
      throw e;
    }
  });

  // PATCH /animals/:id/owners/:ownerId
  app.patch("/animals/:id/owners/:ownerId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    const ownerId = parseIntStrict((req.params as { ownerId: string }).ownerId);
    if (!animalId || !ownerId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalOwner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        animalId: true,
        partyId: true,
        party: {
          select: {
            id: true,
            type: true,
            contact: { select: { id: true } },
            organization: { select: { id: true } },
          },
        },
      },
    });
    if (!existing || existing.animalId !== animalId) {
      return reply.code(404).send({ error: "not_found" });
    }

    const b = (req.body || {}) as Partial<{
      percent: number;
      isPrimary: boolean;
      partyId: number;
      role: OwnerRole;
      effectiveDate: string;
      endDate: string | null;
      isPrimaryContact: boolean;
      receiveNotifications: boolean;
      notes: string | null;
    }>;

    // Validate role if provided
    const validRoles: OwnerRole[] = ["SOLE_OWNER", "CO_OWNER", "MANAGING_PARTNER", "SILENT_PARTNER", "BREEDING_RIGHTS", "INVESTOR"];
    if (b.role !== undefined && !validRoles.includes(b.role)) {
      return reply.code(400).send({ error: "role_invalid" });
    }

    const data: any = {};
    if (b.percent !== undefined) {
      const pct = Number(b.percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return reply.code(400).send({ error: "percent_invalid" });
      data.percent = pct;
    }
    if (b.isPrimary !== undefined) data.isPrimary = !!b.isPrimary;
    if (b.role !== undefined) data.role = b.role;
    if (b.effectiveDate !== undefined) {
      const dt = parseDateIso(b.effectiveDate);
      if (dt) data.effectiveDate = dt;
    }
    if (b.endDate !== undefined) {
      data.endDate = b.endDate ? parseDateIso(b.endDate) : null;
    }
    if (b.isPrimaryContact !== undefined) data.isPrimaryContact = !!b.isPrimaryContact;
    if (b.receiveNotifications !== undefined) data.receiveNotifications = !!b.receiveNotifications;
    if (b.notes !== undefined) data.notes = b.notes;

    if (b.partyId !== undefined) {
      const partyId = parseIntStrict(b.partyId);
      if (!partyId) return reply.code(400).send({ error: "partyId_invalid" });

      // Verify party exists and belongs to tenant
      const party = await prisma.party.findUnique({
        where: { id: partyId },
        select: { tenantId: true },
      });
      if (!party || party.tenantId !== tenantId) {
        return reply.code(404).send({ error: "party_not_found" });
      }

      data.partyId = partyId;
    }

    try {
      const updated = await prisma.animalOwner.update({
        where: { id: ownerId },
        data,
        select: {
          id: true,
          partyId: true,
          percent: true,
          isPrimary: true,
          role: true,
          effectiveDate: true,
          endDate: true,
          isPrimaryContact: true,
          receiveNotifications: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          party: {
            select: {
              id: true,
              type: true,
              contact: { select: { id: true, display_name: true } },
              organization: { select: { id: true, name: true } },
            },
          },
        },
      });

      reply.send({
        id: updated.id,
        partyId: updated.partyId,
        kind: updated.party?.type ?? null,
        displayName: updated.party?.type === "CONTACT"
          ? updated.party?.contact?.display_name
          : updated.party?.organization?.name ?? null,
        percent: updated.percent,
        isPrimary: updated.isPrimary,
        role: updated.role,
        effectiveDate: updated.effectiveDate,
        endDate: updated.endDate,
        isPrimaryContact: updated.isPrimaryContact,
        receiveNotifications: updated.receiveNotifications,
        notes: updated.notes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "duplicate_owner" });
      throw e;
    }
  });

  // DELETE /animals/:id/owners/:ownerId
  app.delete("/animals/:id/owners/:ownerId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    const ownerId = parseIntStrict((req.params as { ownerId: string }).ownerId);
    if (!animalId || !ownerId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalOwner.findUnique({
      where: { id: ownerId },
      select: { id: true, animalId: true },
    });
    if (!existing || existing.animalId !== animalId) {
      return reply.code(404).send({ error: "not_found" });
    }

    await prisma.animalOwner.delete({ where: { id: ownerId } });
    reply.send({ ok: true });
  });

  // GET /animals/:id/owners/history - Ownership history with current, past, and changes
  app.get("/animals/:id/owners/history", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Helper function to map owner row to DTO
    const mapOwnerToDto = (r: {
      id: number;
      partyId: number;
      percent: number;
      isPrimary: boolean;
      role: OwnerRole;
      effectiveDate: Date;
      endDate: Date | null;
      isPrimaryContact: boolean;
      receiveNotifications: boolean;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      party: {
        type: string;
        contact: { display_name: string | null } | null;
        organization: { name: string | null } | null;
      } | null;
    }) => ({
      id: r.id,
      partyId: r.partyId,
      kind: r.party?.type ?? null,
      displayName: r.party?.type === "CONTACT"
        ? r.party?.contact?.display_name
        : r.party?.organization?.name ?? null,
      percent: r.percent,
      isPrimary: r.isPrimary,
      role: r.role,
      effectiveDate: r.effectiveDate,
      endDate: r.endDate,
      isPrimaryContact: r.isPrimaryContact,
      receiveNotifications: r.receiveNotifications,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });

    // Fetch all owners (current and past)
    const allOwners = await prisma.animalOwner.findMany({
      where: { animalId },
      orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        partyId: true,
        percent: true,
        isPrimary: true,
        role: true,
        effectiveDate: true,
        endDate: true,
        isPrimaryContact: true,
        receiveNotifications: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        party: {
          select: {
            type: true,
            contact: { select: { display_name: true } },
            organization: { select: { name: true } },
          },
        },
      },
    });

    // Separate current owners (endDate is null) from past owners
    const currentOwners = allOwners.filter((o) => o.endDate === null).map(mapOwnerToDto);
    const pastOwners = allOwners.filter((o) => o.endDate !== null).map(mapOwnerToDto);

    // Fetch ownership changes from audit table
    const changes = await prisma.animalOwnershipChange.findMany({
      where: { animalId, tenantId },
      orderBy: { occurredAt: "desc" },
      take: 50, // Limit to recent changes
      select: {
        id: true,
        kind: true,
        effectiveDate: true,
        occurredAt: true,
        valueCents: true,
        currency: true,
        fromOwners: true,
        toOwners: true,
        fromOwnerParties: true,
        toOwnerParties: true,
        notes: true,
        createdAt: true,
      },
    });

    reply.send({
      currentOwners,
      pastOwners,
      changes: changes.map((c) => ({
        id: c.id,
        kind: c.kind,
        effectiveDate: c.effectiveDate,
        occurredAt: c.occurredAt,
        valueCents: c.valueCents,
        currency: c.currency,
        fromOwners: c.fromOwnerParties ?? c.fromOwners,
        toOwners: c.toOwnerParties ?? c.toOwners,
        notes: c.notes,
        createdAt: c.createdAt,
      })),
    });
  });

  /* REGISTRY MASTER DATA */
  // GET /registries - List all registries, optionally filtered by species
  app.get("/registries", async (req, reply) => {
    try {
      const q = (req.query || {}) as { species?: string };
      const speciesFilter = q.species ? String(q.species).toUpperCase().trim() : null;

      // Validate species against enum if provided
      const validSpecies = ["DOG", "CAT", "HORSE", "GOAT", "RABBIT", "SHEEP"];
      if (speciesFilter && !validSpecies.includes(speciesFilter)) {
        return reply.code(400).send({
          error: "bad_request",
          message: "Invalid species",
        });
      }

      // Build where clause: if species provided, match exact OR null (global registries)
      // If species omitted, return all registries
      const where: any = {};
      if (speciesFilter) {
        where.OR = [
          { species: speciesFilter as Species },
          { species: null },
        ];
      }

      const rows = await prisma.registry.findMany({
        where,
        orderBy: [{ name: "asc" }], // Alphabetical by name for consistency
        select: {
          id: true,
          name: true,
          code: true,
          species: true,
          country: true,
          url: true,
        },
      });

      // COMPATIBILITY BRIDGE: Dual-key response envelope.
      // Both 'items' (canonical) and 'registries' (legacy) are provided
      // to ensure zero client breakage during transition. The authoritative
      // key is 'items'. Remove 'registries' key after one full release cycle.
      const response = {
        items: rows,
        registries: rows,
        total: rows.length,
      };

      // REGRESSION GUARD: Log contract invariants but do not throw
      if (!Array.isArray(response.items) || !Array.isArray(response.registries)) {
        req.log.error(
          {
            response,
            route: "GET /registries",
            requestId: req.id,
          },
          "[GET /registries] Contract violation: missing array keys"
        );
      }
      if (response.items.length !== response.registries.length) {
        req.log.error(
          {
            itemsLength: response.items.length,
            registriesLength: response.registries.length,
            route: "GET /registries",
            requestId: req.id,
          },
          "[GET /registries] Contract violation: key length mismatch"
        );
      }

      reply.send(response);
    } catch (err: any) {
      req.log.error(
        {
          err: { message: err?.message, stack: err?.stack },
          query: req.query,
          route: "GET /registries",
          requestId: req.id,
        },
        "[GET /registries] Failed to fetch registries"
      );
      reply.code(500).send({
        error: "internal_error",
        message: "Failed to load registries",
      });
    }
  });

  /* REGISTRY IDENTIFIERS */
  // GET /animals/:id/registries
  app.get("/animals/:id/registries", async (req, reply) => {
    try {
      const tenantId = await assertTenant(req, reply);
      if (!tenantId) return;
      const animalId = parseIntStrict((req.params as { id: string }).id);
      if (!animalId) return reply.code(400).send({ error: "id_invalid" });

      await assertAnimalInTenant(animalId, tenantId);

      const rows = await prisma.animalRegistryIdentifier.findMany({
        where: { animalId },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          registryId: true,
          identifier: true,
          registrarOfRecord: true,
          issuedAt: true,
          createdAt: true,
          updatedAt: true,
          registry: { select: { id: true, name: true, code: true, species: true } },
        },
      });

      // COMPATIBILITY BRIDGE: Dual-key response envelope.
      // Both 'items' (canonical) and 'registrations' (legacy) are provided
      // to ensure zero client breakage during transition. The authoritative
      // key is 'items'. Remove 'registrations' key after one full release cycle.
      // Safe to return empty arrays when animal has zero registrations.
      const response = {
        items: rows,
        registrations: rows,
        total: rows.length,
      };

      // REGRESSION GUARD: Log contract invariants but do not throw
      if (!Array.isArray(response.items) || !Array.isArray(response.registrations)) {
        req.log.error(
          {
            response,
            route: "GET /animals/:id/registries",
            requestId: req.id,
            animalId,
          },
          "[GET /animals/:id/registries] Contract violation: missing array keys"
        );
      }
      if (response.items.length !== response.registrations.length) {
        req.log.error(
          {
            itemsLength: response.items.length,
            registrationsLength: response.registrations.length,
            route: "GET /animals/:id/registries",
            requestId: req.id,
            animalId,
          },
          "[GET /animals/:id/registries] Contract violation: key length mismatch"
        );
      }

      reply.send(response);
    } catch (err: any) {
      req.log.error(
        {
          err: { message: err?.message, stack: err?.stack },
          params: req.params,
          route: "GET /animals/:id/registries",
          requestId: req.id,
        },
        "[GET /animals/:id/registries] Failed to fetch animal registrations"
      );
      reply.code(500).send({
        error: "internal_error",
        message: "Failed to load registrations",
      });
    }
  });

  // POST /animals/:id/registries
  app.post("/animals/:id/registries", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    const a = await prisma.animal.findFirst({ where: activeOnly({ id: animalId, tenantId }), select: { id: true, species: true } });
    if (!a) return reply.code(404).send({ error: "not_found" });

    const b = (req.body || {}) as {
      registryId?: number;
      identifier?: string;
      registrarOfRecord?: string | null;
      issuedAt?: string | null;
    };

    const registryId = parseIntStrict(b.registryId);
    if (!registryId) return reply.code(400).send({ error: "registryId_invalid" });
    const registry = await prisma.registry.findUnique({ where: { id: registryId }, select: { id: true, species: true } });
    if (!registry) return reply.code(404).send({ error: "registry_not_found" });
    if (registry.species && registry.species !== a.species) {
      return reply.code(400).send({ error: "registry_species_mismatch" });
    }

    const identifier = String(b.identifier || "").trim();
    if (!identifier) return reply.code(400).send({ error: "identifier_required" });

    const issuedAtDate = b.issuedAt == null ? null : parseDateIso(b.issuedAt);
    if (b.issuedAt != null && issuedAtDate === null) return reply.code(400).send({ error: "issuedAt_invalid" });

    try {
      const created = await prisma.animalRegistryIdentifier.create({
        data: {
          animalId,
          registryId,
          identifier,
          registrarOfRecord: b.registrarOfRecord ?? null,
          issuedAt: issuedAtDate,
        },
      });
      return reply.code(201).send(created);
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "identifier_conflict" }); // @@unique([registryId, identifier])
      throw e;
    }
  });

  // PATCH /animals/:id/registries/:identifierId
  app.patch("/animals/:id/registries/:identifierId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    const identifierId = parseIntStrict((req.params as { identifierId: string }).identifierId);
    if (!animalId || !identifierId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalRegistryIdentifier.findUnique({
      where: { id: identifierId },
      select: { id: true, animalId: true, registryId: true },
    });
    if (!existing || existing.animalId !== animalId) return reply.code(404).send({ error: "not_found" });

    const b = (req.body || {}) as Partial<{
      identifier: string;
      registrarOfRecord: string | null;
      issuedAt: string | null;
      registryId: number;
    }>;

    const data: any = {};
    if (b.identifier !== undefined) {
      const ident = String(b.identifier || "").trim();
      if (!ident) return reply.code(400).send({ error: "identifier_required" });
      data.identifier = ident;
    }
    if (b.registrarOfRecord !== undefined) data.registrarOfRecord = b.registrarOfRecord;
    if (b.issuedAt !== undefined) {
      const d = b.issuedAt == null ? null : parseDateIso(b.issuedAt);
      if (b.issuedAt != null && d === null) return reply.code(400).send({ error: "issuedAt_invalid" });
      data.issuedAt = d;
    }
    if (b.registryId !== undefined) {
      const regId = parseIntStrict(b.registryId);
      if (!regId) return reply.code(400).send({ error: "registryId_invalid" });
      const reg = await prisma.registry.findUnique({ where: { id: regId }, select: { id: true } });
      if (!reg) return reply.code(404).send({ error: "registry_not_found" });
      data.registryId = regId;
    }

    try {
      const updated = await prisma.animalRegistryIdentifier.update({
        where: { id: identifierId },
        data,
      });
      reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "identifier_conflict" });
      throw e;
    }
  });

  // DELETE /animals/:id/registries/:identifierId
  app.delete("/animals/:id/registries/:identifierId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    const identifierId = parseIntStrict((req.params as { identifierId: string }).identifierId);
    if (!animalId || !identifierId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalRegistryIdentifier.findUnique({
      where: { id: identifierId },
      select: { id: true, animalId: true },
    });
    if (!existing || existing.animalId !== animalId) return reply.code(404).send({ error: "not_found" });

    await prisma.animalRegistryIdentifier.delete({ where: { id: identifierId } });
    reply.send({ ok: true });
  });

  // ==========================================================================
  // Animal Public Listing Management (DEPRECATED)
  // ==========================================================================
  // NOTE: These endpoints are deprecated and no longer functional.
  // They were designed for an older model that had animalId as @unique.
  // Use the V2 API at /api/v1/marketplace/v2/direct-listings instead,
  // which supports multiple listings per animal with different template types.
  // ==========================================================================

  // ──────────────────────────────────────────────────────────────────────────
  // Genetics endpoints
  // ──────────────────────────────────────────────────────────────────────────

  app.get("/animals/:id/genetics", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });


    await assertAnimalInTenant(animalId, tenantId);

    const genetics = await prisma.animalGenetics.findUnique({
      where: { animalId },
      select: {
        id: true,
        testProvider: true,
        testDate: true,
        testId: true,
        coatColorData: true,
        healthGeneticsData: true,
        coatTypeData: true,
        physicalTraitsData: true,
        eyeColorData: true,
        otherTraitsData: true,
      },
    });

    if (!genetics) {
      return reply.send({
        testProvider: null,
        testDate: null,
        testId: null,
        coatColor: [],
        health: [],
        coatType: [],
        physicalTraits: [],
        eyeColor: [],
        otherTraits: [],
      });
    }

    reply.send({
      testProvider: genetics.testProvider,
      testDate: genetics.testDate,
      testId: genetics.testId,
      coatColor: genetics.coatColorData || [],
      health: genetics.healthGeneticsData || [],
      coatType: genetics.coatTypeData || [],
      physicalTraits: genetics.physicalTraitsData || [],
      eyeColor: genetics.eyeColorData || [],
      otherTraits: genetics.otherTraitsData || [],
    });
  });

  app.put("/animals/:id/genetics", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as any;

    const data = {
      testProvider: body.testProvider || null,
      testDate: body.testDate ? new Date(body.testDate) : null,
      testId: body.testId || null,
      coatColorData: body.coatColor || [],
      healthGeneticsData: body.health || [],
      coatTypeData: body.coatType || [],
      physicalTraitsData: body.physicalTraits || [],
      eyeColorData: body.eyeColor || [],
      otherTraitsData: body.otherTraits || [],
    };

    const genetics = await prisma.animalGenetics.upsert({
      where: { animalId },
      create: {
        animalId,
        ...data,
      },
      update: data,
    });

    reply.send({
      testProvider: genetics.testProvider,
      testDate: genetics.testDate,
      testId: genetics.testId,
      coatColor: genetics.coatColorData || [],
      health: genetics.healthGeneticsData || [],
      coatType: genetics.coatTypeData || [],
      physicalTraits: genetics.physicalTraitsData || [],
      eyeColor: genetics.eyeColorData || [],
      otherTraits: genetics.otherTraitsData || [],
    });
  });

  /**
   * GET /animals/:id/genetic-test-status
   * Returns genetic test status for an animal
   * Used by GeneticAlertsBanner to determine if banner should show
   */
  app.get("/animals/:id/genetic-test-status", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    // Fetch animal with genetics data
    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: {
        id: true,
        species: true,
        breed: true,
        genetics: {
          select: {
            healthGeneticsData: true,
            coatColorData: true,
          },
        },
      },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal_not_found" });
    }

    const hasGenetics = !!animal.genetics;
    const hasHealthGenetics =
      hasGenetics &&
      animal.genetics?.healthGeneticsData != null &&
      Array.isArray(animal.genetics.healthGeneticsData) &&
      animal.genetics.healthGeneticsData.length > 0;

    // Determine required tests based on species (simplified for now)
    // In future, this could be expanded based on breed-specific requirements
    const requiredTestsBySpecies: Record<string, string[]> = {
      HORSE: ["HYPP", "GBED", "PSSM1", "MH", "HERDA"],
      DOG: ["MDR1", "DM", "vWD"],
      CAT: ["PKD", "PRA", "HCM"],
      GOAT: [],
      SHEEP: [],
      RABBIT: [],
    };

    const species = animal.species?.toUpperCase() || "HORSE";
    const requiredTests = requiredTestsBySpecies[species] || [];

    // Get completed tests from health genetics data
    const completedTests: string[] = [];
    if (hasHealthGenetics && Array.isArray(animal.genetics?.healthGeneticsData)) {
      for (const item of animal.genetics.healthGeneticsData as Array<{ locus?: string }>) {
        if (item.locus) {
          completedTests.push(item.locus);
        }
      }
    }

    // Calculate missing tests
    const missingTests = requiredTests.filter(
      (test) => !completedTests.some((completed) => completed.toUpperCase() === test.toUpperCase())
    );

    return reply.send({
      hasMissingTests: !hasGenetics || !hasHealthGenetics || missingTests.length > 0,
      missingTests: !hasGenetics || !hasHealthGenetics ? requiredTests : missingTests,
      completedTests,
      hasFullPanel: hasHealthGenetics && missingTests.length === 0,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Stallion Breeding Revenue endpoint
  // Per spec: P9-STALLION-FINANCES-TAB-PROMPT.md
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /animals/:id/breeding-revenue
   * Returns breeding revenue data for a stallion (male horse)
   * Only valid for animals with species=HORSE and sex=MALE
   */
  app.get("/animals/:id/breeding-revenue", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    const query = (req.query || {}) as { year?: string };
    const year = query.year ? Number(query.year) : new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > 2100) {
      return reply.code(400).send({ error: "year_invalid" });
    }

    // Get the animal and verify it's a male horse
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId, archived: false },
      select: { id: true, species: true, sex: true, name: true },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal_not_found" });
    }

    if (animal.species !== "HORSE") {
      return reply.code(400).send({ error: "not_horse_species" });
    }

    if (animal.sex !== "MALE") {
      return reply.code(400).send({ error: "not_male_animal" });
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const now = new Date();

    // Get breeding attempts for this stallion
    const attempts = await prisma.breedingAttempt.findMany({
      where: {
        tenantId,
        sireId: animalId,
      },
      include: {
        plan: {
          select: {
            id: true,
            status: true,
          },
        },
        dam: {
          select: { id: true, name: true },
        },
        studOwnerParty: {
          select: { id: true, name: true },
        },
      },
      orderBy: { attemptAt: "desc" },
    });

    // Get breeding bookings for this animal
    const bookings = await prisma.breedingBooking.findMany({
      where: {
        offeringTenantId: tenantId,
        offeringAnimalId: animalId,
      },
      include: {
        seekingAnimal: {
          select: { id: true, name: true },
        },
        seekingParty: {
          select: { id: true, name: true },
        },
        sourceListing: {
          select: { id: true, listingNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Active listing feature removed (old marketplace listing system deprecated)
    const activeListing = null;

    // Calculate summary stats
    let totalRevenueCents = 0;
    let totalRevenueYTDCents = 0;
    let totalBreedings = 0;
    let completedBreedings = 0;
    let successfulBreedings = 0;

    // From breeding attempts
    for (const attempt of attempts) {
      totalBreedings++;
      const feePaid = attempt.feePaidCents || 0;
      totalRevenueCents += feePaid;

      // Check if in current year
      if (attempt.attemptAt && attempt.attemptAt >= yearStart && attempt.attemptAt < yearEnd) {
        totalRevenueYTDCents += feePaid;
      }

      if (attempt.success !== null) {
        completedBreedings++;
        if (attempt.success === true) {
          successfulBreedings++;
        }
      }
    }

    // From stallion bookings (may overlap with attempts, but bookings have better payment tracking)
    for (const booking of bookings) {
      const paid = booking.totalPaidCents || 0;
      // Avoid double counting if this booking links to an attempt
      // For now, we prioritize booking data if it has payments
      if (paid > 0 && booking.status !== "CANCELLED") {
        // Check if booking is in current year
        if (booking.createdAt >= yearStart && booking.createdAt < yearEnd) {
          // Add to YTD if not already counted via attempts
          totalRevenueYTDCents += paid;
        }
        totalRevenueCents += paid;
      }
    }

    // Calculate averages and rates
    const averageFeeCents = totalBreedings > 0 ? Math.round(totalRevenueCents / totalBreedings) : 0;
    const successRate = completedBreedings > 0 ? Math.round((successfulBreedings / completedBreedings) * 100) : 0;

    // Build yearly breakdown (from attempts)
    const yearlyMap = new Map<number, { revenueCents: number; breedingCount: number; successCount: number; completedCount: number }>();
    for (const attempt of attempts) {
      const attemptYear = attempt.attemptAt?.getFullYear() || new Date().getFullYear();
      if (!yearlyMap.has(attemptYear)) {
        yearlyMap.set(attemptYear, { revenueCents: 0, breedingCount: 0, successCount: 0, completedCount: 0 });
      }
      const yearData = yearlyMap.get(attemptYear)!;
      yearData.breedingCount++;
      yearData.revenueCents += attempt.feePaidCents || 0;
      if (attempt.success !== null) {
        yearData.completedCount++;
        if (attempt.success === true) {
          yearData.successCount++;
        }
      }
    }

    const byYear = Array.from(yearlyMap.entries())
      .map(([y, data]) => ({
        year: y,
        revenueCents: data.revenueCents,
        breedingCount: data.breedingCount,
        successRate: data.completedCount > 0 ? Math.round((data.successCount / data.completedCount) * 100) : 0,
      }))
      .sort((a, b) => b.year - a.year);

    // Build recent payments list (from bookings with payments)
    const recentPayments = bookings
      .filter((b) => b.totalPaidCents && b.totalPaidCents > 0 && b.status !== "CANCELLED")
      .slice(0, 10)
      .map((b) => ({
        id: b.id,
        breedingPlanId: 0, // Bookings don't directly link to plans
        mareOwnerName: (b as any).mareOwnerParty?.name || "Unknown",
        mareName: (b as any).mare?.name || b.externalAnimalName || undefined,
        amountCents: b.totalPaidCents || 0,
        paidAt: b.statusChangedAt?.toISOString() || b.createdAt.toISOString(),
        status: "PAID" as const,
      }));

    // Build outstanding payments (bookings where totalPaidCents < agreedFeeCents)
    const outstandingBookings = bookings.filter(
      (b) => b.status !== "CANCELLED" && (b.totalPaidCents || 0) < b.agreedFeeCents
    );

    const outstandingItems = outstandingBookings.map((b) => {
      const amountDue = b.agreedFeeCents - (b.totalPaidCents || 0);
      const dueDate = b.scheduledDate;
      const daysOverdue = dueDate && dueDate < now ? daysBetween(dueDate, now) : undefined;
      const status: "PENDING" | "OVERDUE" = daysOverdue && daysOverdue > 0 ? "OVERDUE" : "PENDING";

      return {
        id: b.id,
        breedingPlanId: 0,
        mareOwnerName: (b as any).mareOwnerParty?.name || "Unknown",
        mareName: (b as any).mare?.name || b.externalAnimalName || undefined,
        amountCents: amountDue,
        dueDate: dueDate?.toISOString(),
        daysOverdue: daysOverdue && daysOverdue > 0 ? daysOverdue : undefined,
        status,
      };
    });

    const outstandingTotalCents = outstandingItems.reduce((sum, item) => sum + item.amountCents, 0);

    // Build response
    const response = {
      summary: {
        totalRevenueCents,
        totalRevenueYTDCents,
        totalBreedings,
        completedBreedings,
        averageFeeCents,
        successRate,
      },
      byYear,
      recentPayments,
      outstanding: {
        totalCents: outstandingTotalCents,
        count: outstandingItems.length,
        items: outstandingItems,
      },
      activeListing: undefined, // Feature removed (old marketplace listing system deprecated)
    };

    reply.send(response);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Genetics Import endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /animals/:id/genetics/import/preview
   * Preview/validate an import file without saving
   * Returns parsed data + warnings for user review before final import
   */
  app.post("/animals/:id/genetics/import/preview", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      provider: string;
      fileContent: string;
    };

    if (!body.provider) {
      return reply.code(400).send({ error: "provider_required" });
    }
    if (!body.fileContent) {
      return reply.code(400).send({ error: "file_content_required" });
    }

    // Import parser dynamically to avoid circular dependencies
    const { parseEmbarkCSV, toDatabaseFormat, GENETICS_PROVIDERS, getProviderById } = await import("../lib/genetics-import/index.js");

    const provider = getProviderById(body.provider as any);
    if (!provider) {
      return reply.code(400).send({ error: "unknown_provider", message: `Unknown provider: ${body.provider}` });
    }
    if (!provider.isSupported) {
      return reply.code(400).send({ error: "provider_not_supported", message: `Provider ${provider.name} is not yet supported` });
    }

    // Parse based on provider
    let parseResult;
    if (body.provider === "embark") {
      parseResult = parseEmbarkCSV(body.fileContent);
    } else {
      return reply.code(400).send({ error: "unsupported_provider", message: `Import for ${body.provider} is not implemented yet` });
    }

    if (!parseResult.success) {
      return reply.code(400).send({
        error: "parse_failed",
        errors: parseResult.errors,
      });
    }

    // Convert to database format for preview
    const dbFormat = toDatabaseFormat(parseResult.genetics);

    // Get summary counts
    const summary = {
      coatColor: parseResult.genetics.coatColor.length,
      coatType: parseResult.genetics.coatType.length,
      physicalTraits: parseResult.genetics.physicalTraits.length,
      eyeColor: parseResult.genetics.eyeColor.length,
      health: parseResult.genetics.health.length,
      otherTraits: parseResult.genetics.otherTraits.length,
      unmapped: parseResult.genetics.unmapped.length,
      total: parseResult.genetics.coatColor.length +
        parseResult.genetics.coatType.length +
        parseResult.genetics.physicalTraits.length +
        parseResult.genetics.eyeColor.length +
        parseResult.genetics.health.length +
        parseResult.genetics.otherTraits.length,
    };

    reply.send({
      success: true,
      provider: provider.name,
      summary,
      preview: {
        coatColor: dbFormat.coatColorData,
        coatType: dbFormat.coatTypeData,
        physicalTraits: dbFormat.physicalTraitsData,
        eyeColor: dbFormat.eyeColorData,
        health: dbFormat.healthGeneticsData,
        otherTraits: dbFormat.otherTraitsData,
      },
      unmapped: parseResult.genetics.unmapped,
      warnings: parseResult.warnings,
    });
  });

  /**
   * POST /animals/:id/genetics/import
   * Import genetics from a lab test file
   * Body: { provider: string, fileContent: string, mergeStrategy?: 'replace' | 'merge' }
   */
  app.post("/animals/:id/genetics/import", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      provider: string;
      fileContent: string;
      mergeStrategy?: "replace" | "merge";
      testDate?: string;
      testId?: string;
    };

    if (!body.provider) {
      return reply.code(400).send({ error: "provider_required" });
    }
    if (!body.fileContent) {
      return reply.code(400).send({ error: "file_content_required" });
    }

    const mergeStrategy = body.mergeStrategy || "replace";

    // Import parser
    const { parseEmbarkCSV, toDatabaseFormat, getProviderById } = await import("../lib/genetics-import/index.js");

    const provider = getProviderById(body.provider as any);
    if (!provider) {
      return reply.code(400).send({ error: "unknown_provider" });
    }
    if (!provider.isSupported) {
      return reply.code(400).send({ error: "provider_not_supported" });
    }

    // Parse the file
    let parseResult;
    if (body.provider === "embark") {
      parseResult = parseEmbarkCSV(body.fileContent);
    } else {
      return reply.code(400).send({ error: "unsupported_provider" });
    }

    if (!parseResult.success) {
      return reply.code(400).send({
        error: "parse_failed",
        errors: parseResult.errors,
      });
    }

    const dbFormat = toDatabaseFormat(parseResult.genetics);

    // Get existing genetics if merge strategy
    let existingGenetics = null;
    if (mergeStrategy === "merge") {
      existingGenetics = await prisma.animalGenetics.findUnique({
        where: { animalId },
      });
    }

    // Merge or replace
    const mergeArrays = (existing: any[] | null, imported: any[]) => {
      if (!existing || mergeStrategy === "replace") return imported;
      // Merge by locus - imported takes precedence
      const locusMap = new Map();
      for (const item of existing) {
        if (item.locus) locusMap.set(item.locus, item);
      }
      for (const item of imported) {
        if (item.locus) locusMap.set(item.locus, item);
      }
      return Array.from(locusMap.values());
    };

    const data = {
      testProvider: provider.name,
      testDate: body.testDate ? new Date(body.testDate) : new Date(),
      testId: body.testId || null,
      coatColorData: mergeArrays(existingGenetics?.coatColorData as any, dbFormat.coatColorData),
      healthGeneticsData: mergeArrays(existingGenetics?.healthGeneticsData as any, dbFormat.healthGeneticsData),
      coatTypeData: mergeArrays(existingGenetics?.coatTypeData as any, dbFormat.coatTypeData),
      physicalTraitsData: mergeArrays(existingGenetics?.physicalTraitsData as any, dbFormat.physicalTraitsData),
      eyeColorData: mergeArrays(existingGenetics?.eyeColorData as any, dbFormat.eyeColorData),
      otherTraitsData: mergeArrays(existingGenetics?.otherTraitsData as any, dbFormat.otherTraitsData),
    };

    const genetics = await prisma.animalGenetics.upsert({
      where: { animalId },
      create: {
        animalId,
        ...data,
      },
      update: data,
    });

    reply.send({
      success: true,
      imported: {
        coatColor: (dbFormat.coatColorData || []).length,
        health: (dbFormat.healthGeneticsData || []).length,
        coatType: (dbFormat.coatTypeData || []).length,
        physicalTraits: (dbFormat.physicalTraitsData || []).length,
        eyeColor: (dbFormat.eyeColorData || []).length,
        otherTraits: (dbFormat.otherTraitsData || []).length,
      },
      warnings: parseResult.warnings,
      genetics: {
        testProvider: genetics.testProvider,
        testDate: genetics.testDate,
        testId: genetics.testId,
        coatColor: genetics.coatColorData || [],
        health: genetics.healthGeneticsData || [],
        coatType: genetics.coatTypeData || [],
        physicalTraits: genetics.physicalTraitsData || [],
        eyeColor: genetics.eyeColorData || [],
        otherTraits: genetics.otherTraitsData || [],
      },
    });
  });

  /**
   * GET /genetics/providers
   * Get list of supported genetics providers
   */
  app.get("/genetics/providers", async (req, reply) => {
    const { GENETICS_PROVIDERS } = await import("../lib/genetics-import/index.js");
    reply.send({ providers: GENETICS_PROVIDERS });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CSV Import/Export endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /animals/templates/csv
   * Download CSV template for animal imports
   */
  app.get("/animals/templates/csv", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { generateAnimalCsvTemplate } = await import("../lib/csv-import/template.js");
    const csv = generateAnimalCsvTemplate(true); // Include examples

    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="animals-import-template.csv"')
      .send(csv);
  });

  /**
   * POST /animals/import/preview
   * Preview/validate an animal CSV import without saving
   * Body: { fileContent: string (base64 encoded CSV) }
   */
  app.post("/animals/import/preview", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as { fileContent?: string };
    if (!body?.fileContent) {
      return reply.code(400).send({ error: "file_content_required" });
    }

    try {
      // Decode base64 CSV content
      const csvContent = Buffer.from(body.fileContent, "base64").toString("utf-8");

      // Parse and validate CSV
      const { parseAnimalCSV } = await import("../lib/csv-import/parser.js");
      const parsedRows = parseAnimalCSV(csvContent);

      // Enhance with database checks (duplicates, parent matching)
      const { enhanceWithDatabaseChecks, generatePreviewResponse } = await import(
        "../services/animal-import-service.js"
      );
      const enhancedRows = await enhanceWithDatabaseChecks(tenantId, parsedRows);
      const previewResponse = generatePreviewResponse(enhancedRows);

      reply.send(previewResponse);
    } catch (error) {
      console.error("CSV import preview error:", error);
      return reply.code(400).send({
        error: "parse_failed",
        message: (error as Error).message,
      });
    }
  });

  /**
   * POST /animals/import
   * Execute animal CSV import with user resolutions
   * Body: { fileContent: string, resolutions: RowResolution[] }
   */
  app.post("/animals/import", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const body = req.body as {
      fileContent?: string;
      resolutions?: any[];
    };

    if (!body?.fileContent) {
      return reply.code(400).send({ error: "file_content_required" });
    }

    try {
      // Decode base64 CSV content
      const csvContent = Buffer.from(body.fileContent, "base64").toString("utf-8");

      // Parse and validate CSV
      const { parseAnimalCSV } = await import("../lib/csv-import/parser.js");
      const parsedRows = parseAnimalCSV(csvContent);

      // Get organization ID for this tenant
      const org = await prisma.organization.findFirst({
        where: { tenantId },
        select: { id: true },
      });

      // Execute import with resolutions
      const { executeImport } = await import("../services/animal-import-service.js");
      const result = await executeImport(
        tenantId,
        org?.id ?? null,
        parsedRows,
        body.resolutions || []
      );

      // Update usage snapshot after import
      await updateUsageSnapshot(tenantId, "ANIMAL_COUNT");

      reply.send(result);
    } catch (error) {
      console.error("CSV import execution error:", error);
      return reply.code(400).send({
        error: "import_failed",
        message: (error as Error).message,
      });
    }
  });

  /**
   * GET /animals/export/csv
   * Export animals to CSV
   * Query params:
   *   - includeExtended: boolean (include genetics, documents, etc.)
   *   - species: filter by species
   *   - status: filter by status
   */
  app.get("/animals/export/csv", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const q = req.query as {
      includeExtended?: string;
      species?: string;
      status?: string;
    };

    try {
      // Build filters
      const filters: any = {
        tenantId,
        archived: false,
      };

      if (q.species) {
        filters.species = q.species.toUpperCase();
      }

      if (q.status) {
        filters.status = q.status.toUpperCase();
      }

      const includeExtended = q.includeExtended === "true";

      // Fetch animals with relationships
      const animals = await prisma.animal.findMany({
        where: filters,
        include: {
          dam: { select: { name: true } },
          sire: { select: { name: true } },
          registryIds: {
            select: {
              identifier: true,
              registry: {
                select: { name: true },
              },
            },
          },
          owners: {
            include: {
              party: {
                select: { name: true },
              },
            },
          },
          genetics: includeExtended
            ? {
                select: {
                  testProvider: true,
                },
              }
            : undefined,
        },
        orderBy: { createdAt: "asc" },
      });

      // Build CSV rows
      const csvRows: string[][] = [];

      // Header row
      const headers = [
        "ID",
        "Name",
        "Species",
        "Sex",
        "Birth Date",
        "Age",
        "Microchip",
        "Breed",
        "Dam Name",
        "Sire Name",
        "Status",
        "Registry Numbers",
        "Owner(s)",
        "COI %",
        "Last Updated",
        "Notes",
      ];

      if (includeExtended) {
        headers.push("Genetics Provider");
      }

      csvRows.push(headers);

      // Data rows
      for (const animal of animals) {
        // Calculate age
        let age = "";
        if (animal.birthDate) {
          const now = new Date();
          const birth = new Date(animal.birthDate);
          const years = now.getFullYear() - birth.getFullYear();
          const months = now.getMonth() - birth.getMonth();
          const totalMonths = years * 12 + months;
          const displayYears = Math.floor(totalMonths / 12);
          const displayMonths = totalMonths % 12;

          if (displayYears > 0) {
            age = `${displayYears} year${displayYears > 1 ? "s" : ""}`;
            if (displayMonths > 0) {
              age += ` ${displayMonths} month${displayMonths > 1 ? "s" : ""}`;
            }
          } else {
            age = `${displayMonths} month${displayMonths > 1 ? "s" : ""}`;
          }
        }

        // Format breeds
        const breeds = animal.breed || "";

        // Format registry numbers
        const registries = animal.registryIds
          .map((r: any) => `${r.registry.name}: ${r.identifier}`)
          .join(", ");

        // Format owners
        const owners = animal.owners.map((o: any) => o.party.name).join(", ");

        // Format dates
        const birthDate = animal.birthDate
          ? new Date(animal.birthDate).toISOString().split("T")[0]
          : "";
        const updatedAt = new Date(animal.updatedAt).toISOString().split("T")[0];

        const row = [
          String(animal.id),
          animal.name,
          animal.species,
          animal.sex,
          birthDate,
          age,
          animal.microchip || "",
          breeds,
          animal.dam?.name || "",
          animal.sire?.name || "",
          animal.status,
          registries,
          owners,
          animal.coiPercent ? String(animal.coiPercent) : "",
          updatedAt,
          animal.notes || "",
        ];

        if (includeExtended && animal.genetics) {
          row.push(animal.genetics.testProvider || "");
        }

        csvRows.push(row);
      }

      // Generate CSV content
      const escapeCsvField = (value: string): string => {
        if (!value) return "";
        if (value.includes(",") || value.includes("\n") || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csv = csvRows.map((row) => row.map(escapeCsvField).join(",")).join("\n");

      // Generate filename with date
      const today = new Date().toISOString().split("T")[0];
      const filename = `animals-export-${today}.csv`;

      reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    } catch (error) {
      console.error("CSV export error:", error);
      return reply.code(500).send({
        error: "export_failed",
        message: (error as Error).message,
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Lineage / Pedigree endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /animals/:id/pedigree
   * Get the pedigree (ancestor tree) for an animal
   * Query params:
   *   - generations: number of generations to fetch (default 5, max 10)
   */
  app.get("/animals/:id/pedigree", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const { generations = "5" } = (req.query || {}) as { generations?: string };
    const gen = Math.min(10, Math.max(1, parseInt(generations, 10) || 5));

    const result = await lineageService.getPedigree(animalId, tenantId, gen);
    reply.send(result);
  });

  /**
   * GET /animals/:id/offspring
   * Get offspring (from Offspring table) where this animal is the dam or sire
   * Returns offspring records, not Animal records
   */
  app.get("/animals/:id/offspring", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      select: { id: true, name: true, sex: true },
    });
    if (!animal) return reply.code(404).send({ error: "animal_not_found" });

    // Query Offspring table where this animal is dam or sire
    const offspring = await prisma.offspring.findMany({
      where: {
        tenantId,
        OR: [
          { damId: animalId },
          { sireId: animalId },
        ],
      },
      select: {
        id: true,
        name: true,
        sex: true,
        species: true,
        breed: true,
        bornAt: true,
        lifeState: true,
        placementState: true,
        keeperIntent: true,
        damId: true,
        sireId: true,
        dam: { select: { id: true, name: true } },
        sire: { select: { id: true, name: true } },
        group: {
          select: {
            id: true,
            name: true,
            actualBirthOn: true,
            expectedBirthOn: true,
          },
        },
        collarColorName: true,
        collarColorHex: true,
      },
      orderBy: { bornAt: "desc" },
    });

    reply.send({
      animal: { id: animal.id, name: animal.name, sex: animal.sex },
      offspring: offspring.map((o) => ({
        id: o.id,
        name: o.name,
        sex: o.sex,
        species: o.species,
        breed: o.breed,
        birthDate: o.bornAt?.toISOString() ?? null,
        lifeState: o.lifeState,
        placementState: o.placementState,
        keeperIntent: o.keeperIntent,
        otherParent: animal.sex === "FEMALE"
          ? (o.sire ? { id: o.sire.id, name: o.sire.name } : null)
          : (o.dam ? { id: o.dam.id, name: o.dam.name } : null),
        group: o.group ? {
          id: o.group.id,
          name: o.group.name,
          birthDate: o.group.actualBirthOn?.toISOString() ?? o.group.expectedBirthOn?.toISOString() ?? null,
        } : null,
        collarColor: o.collarColorName || o.collarColorHex || null,
      })),
    });
  });

  /**
   * GET /animals/:id/descendants
   * Get the descendants (offspring tree) for an animal
   * Query params:
   *   - generations: number of generations to fetch (default 3, max 5)
   */
  app.get("/animals/:id/descendants", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const { generations = "3" } = (req.query || {}) as { generations?: string };
    const gen = Math.min(5, Math.max(1, parseInt(generations, 10) || 3));

    const result = await lineageService.getDescendants(animalId, tenantId, gen);
    reply.send(result);
  });

  /**
   * PUT /animals/:id/parents
   * Set the dam and/or sire for an animal
   * Body: { damId?: number | null, sireId?: number | null }
   */
  app.put("/animals/:id/parents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = (req.body || {}) as { damId?: number | null; sireId?: number | null };

    // Parse damId - allow null to clear
    let damId: number | null = null;
    if (body.damId !== undefined) {
      damId = body.damId === null ? null : parseIntStrict(body.damId);
      if (body.damId !== null && !damId) {
        return reply.code(400).send({ error: "damId_invalid" });
      }
    } else {
      // If not provided, keep existing
      const existing = await prisma.animal.findFirst({
        where: { id: animalId, tenantId },
        select: { damId: true },
      });
      damId = existing?.damId ?? null;
    }

    // Parse sireId - allow null to clear
    let sireId: number | null = null;
    if (body.sireId !== undefined) {
      sireId = body.sireId === null ? null : parseIntStrict(body.sireId);
      if (body.sireId !== null && !sireId) {
        return reply.code(400).send({ error: "sireId_invalid" });
      }
    } else {
      // If not provided, keep existing
      const existing = await prisma.animal.findFirst({
        where: { id: animalId, tenantId },
        select: { sireId: true },
      });
      sireId = existing?.sireId ?? null;
    }

    try {
      await lineageService.setParents(animalId, tenantId, damId, sireId);

      // Return updated animal with parent info
      const updated = await prisma.animal.findFirst({
        where: { id: animalId, tenantId },
        select: {
          id: true,
          name: true,
          damId: true,
          sireId: true,
          coiPercent: true,
          coiGenerations: true,
          coiCalculatedAt: true,
          dam: { select: { id: true, name: true } },
          sire: { select: { id: true, name: true } },
        },
      });

      reply.send(updated);
    } catch (e: any) {
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw e;
    }
  });

  /**
   * GET /animals/:id/parents
   * Get the parents for an animal
   */
  app.get("/animals/:id/parents", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      select: {
        id: true,
        name: true,
        damId: true,
        sireId: true,
        coiPercent: true,
        coiGenerations: true,
        coiCalculatedAt: true,
        dam: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            photoUrl: true,
            birthDate: true,
          },
        },
        sire: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            photoUrl: true,
            birthDate: true,
          },
        },
      },
    });

    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }

    reply.send({
      dam: animal.dam,
      sire: animal.sire,
      coi: animal.coiPercent
        ? {
            percent: animal.coiPercent,
            generations: animal.coiGenerations,
            calculatedAt: animal.coiCalculatedAt,
          }
        : null,
    });
  });

  /**
   * GET /lineage/coi
   * Calculate prospective COI for a hypothetical breeding
   * Query params:
   *   - damId: ID of the female
   *   - sireId: ID of the male
   *   - generations: number of generations to analyze (default 10)
   */
  app.get("/lineage/coi", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { damId, sireId, generations = "10" } = (req.query || {}) as {
      damId?: string;
      sireId?: string;
      generations?: string;
    };

    const dam = parseIntStrict(damId);
    const sire = parseIntStrict(sireId);

    if (!dam) return reply.code(400).send({ error: "damId_required" });
    if (!sire) return reply.code(400).send({ error: "sireId_required" });

    const gen = Math.min(15, Math.max(1, parseInt(generations, 10) || 10));

    try {
      const result = await lineageService.getProspectiveCOI(dam, sire, tenantId, gen);
      reply.send(result);
    } catch (e: any) {
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw e;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * PRIVACY SETTINGS - Per-animal cross-tenant sharing controls
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * GET /animals/:id/privacy
   * Get privacy settings for an animal
   */
  app.get("/animals/:id/privacy", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    // Verify animal belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
    });
    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    // Get or create default privacy settings
    let settings = await prisma.animalPrivacySettings.findUnique({
      where: { animalId },
    });

    if (!settings) {
      // Return defaults (don't create until explicitly saved)
      return reply.send({
        animalId,
        allowCrossTenantMatching: true,
        showName: true,
        showPhoto: true,
        showFullDob: true,
        showRegistryFull: false,
        showBreeder: true,
        enableHealthSharing: false,
        enableGeneticsSharing: false,
        enableDocumentSharing: false,
        enableMediaSharing: false,
        showBreedingHistory: false,
        showTitles: true,
        showTitleDetails: false,
        showCompetitions: false,
        showCompetitionDetails: false,
        allowInfoRequests: true,
        allowDirectContact: false,
      });
    }

    reply.send(settings);
  });

  /**
   * PUT /animals/:id/privacy
   * Update privacy settings for an animal
   */
  app.put("/animals/:id/privacy", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    // Verify animal belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
    });
    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    const body = (req.body || {}) as Partial<{
      allowCrossTenantMatching: boolean;
      showName: boolean;
      showPhoto: boolean;
      showFullDob: boolean;
      showRegistryFull: boolean;
      showBreeder: boolean;
      // Gate toggles for granular sharing
      enableHealthSharing: boolean;
      enableGeneticsSharing: boolean;
      enableDocumentSharing: boolean;
      enableMediaSharing: boolean;
      // Breeding
      showBreedingHistory: boolean;
      // Achievements
      showTitles: boolean;
      showTitleDetails: boolean;
      showCompetitions: boolean;
      showCompetitionDetails: boolean;
      // Contact
      allowInfoRequests: boolean;
      allowDirectContact: boolean;
    }>;

    // Upsert settings
    const settings = await prisma.animalPrivacySettings.upsert({
      where: { animalId },
      create: {
        animalId,
        allowCrossTenantMatching: body.allowCrossTenantMatching ?? true,
        showName: body.showName ?? true,
        showPhoto: body.showPhoto ?? true,
        showFullDob: body.showFullDob ?? true,
        showRegistryFull: body.showRegistryFull ?? false,
        showBreeder: body.showBreeder ?? true,
        enableHealthSharing: body.enableHealthSharing ?? false,
        enableGeneticsSharing: body.enableGeneticsSharing ?? false,
        enableDocumentSharing: body.enableDocumentSharing ?? false,
        enableMediaSharing: body.enableMediaSharing ?? false,
        showBreedingHistory: body.showBreedingHistory ?? false,
        showTitles: body.showTitles ?? true,
        showTitleDetails: body.showTitleDetails ?? false,
        showCompetitions: body.showCompetitions ?? false,
        showCompetitionDetails: body.showCompetitionDetails ?? false,
        allowInfoRequests: body.allowInfoRequests ?? true,
        allowDirectContact: body.allowDirectContact ?? false,
      },
      update: {
        ...(body.allowCrossTenantMatching !== undefined && { allowCrossTenantMatching: body.allowCrossTenantMatching }),
        ...(body.showName !== undefined && { showName: body.showName }),
        ...(body.showPhoto !== undefined && { showPhoto: body.showPhoto }),
        ...(body.showFullDob !== undefined && { showFullDob: body.showFullDob }),
        ...(body.showRegistryFull !== undefined && { showRegistryFull: body.showRegistryFull }),
        ...(body.showBreeder !== undefined && { showBreeder: body.showBreeder }),
        ...(body.enableHealthSharing !== undefined && { enableHealthSharing: body.enableHealthSharing }),
        ...(body.enableGeneticsSharing !== undefined && { enableGeneticsSharing: body.enableGeneticsSharing }),
        ...(body.enableDocumentSharing !== undefined && { enableDocumentSharing: body.enableDocumentSharing }),
        ...(body.enableMediaSharing !== undefined && { enableMediaSharing: body.enableMediaSharing }),
        ...(body.showBreedingHistory !== undefined && { showBreedingHistory: body.showBreedingHistory }),
        ...(body.showTitles !== undefined && { showTitles: body.showTitles }),
        ...(body.showTitleDetails !== undefined && { showTitleDetails: body.showTitleDetails }),
        ...(body.showCompetitions !== undefined && { showCompetitions: body.showCompetitions }),
        ...(body.showCompetitionDetails !== undefined && { showCompetitionDetails: body.showCompetitionDetails }),
        ...(body.allowInfoRequests !== undefined && { allowInfoRequests: body.allowInfoRequests }),
        ...(body.allowDirectContact !== undefined && { allowDirectContact: body.allowDirectContact }),
      },
    });

    reply.send(settings);
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * IDENTITY MATCHING - Cross-tenant animal identity resolution
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * GET /animals/:id/identity
   * Get global identity info for an animal (if linked)
   */
  app.get("/animals/:id/identity", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    // Verify animal belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      include: {
        identityLink: {
          include: {
            identity: {
              include: {
                identifiers: true,
                linkedAnimals: {
                  include: {
                    animal: {
                      select: {
                        id: true,
                        tenantId: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    if (!animal.identityLink) {
      return reply.send({
        linked: false,
        globalIdentityId: null,
        identifiers: [],
        linkedTenants: 0,
      });
    }

    const identity = animal.identityLink.identity;
    const otherTenants = new Set(
      identity.linkedAnimals
        .map((l) => l.animal.tenantId)
        .filter((t) => t !== tenantId)
    );

    reply.send({
      linked: true,
      globalIdentityId: identity.id,
      confidence: animal.identityLink.confidence,
      matchedOn: animal.identityLink.matchedOn,
      autoMatched: animal.identityLink.autoMatched,
      confirmedAt: animal.identityLink.confirmedAt,
      identifiers: identity.identifiers.map((i) => ({
        type: i.type,
        value: i.sourceTenantId === tenantId ? i.rawValue || i.value : maskIdentifier(i.type, i.value),
        isOwn: i.sourceTenantId === tenantId,
      })),
      linkedTenants: otherTenants.size,
      globalPedigree: {
        damId: identity.damId,
        sireId: identity.sireId,
      },
    });
  });

  /**
   * POST /animals/:id/identity/match
   * Find potential global identity matches for an animal
   */
  app.post("/animals/:id/identity/match", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    // Get identifiers from request body or from animal record
    const body = (req.body || {}) as {
      microchip?: string;
      registrations?: Array<{ type: IdentifierType; value: string }>;
      dnaProfileId?: string;
    };

    const identifiers = {
      microchip: body.microchip || animal.microchip,
      registrations: body.registrations || [],
      dnaProfileId: body.dnaProfileId,
    };

    const result = await identityMatchingService.processAnimalForMatching(
      {
        id: animal.id,
        tenantId: animal.tenantId,
        name: animal.name,
        species: animal.species,
        sex: animal.sex,
        birthDate: animal.birthDate,
        breed: animal.breed,
        microchip: animal.microchip,
      },
      identifiers
    );

    reply.send({
      matched: result.matched,
      globalIdentityId: result.globalIdentityId,
      confidence: result.confidence,
      autoLinked: result.autoLinked,
      candidates: result.candidates.map((c) => ({
        globalIdentityId: c.globalIdentityId,
        confidence: c.confidence,
        matchedIdentifiers: c.matchedIdentifiers,
        matchedFields: c.matchedFields,
      })),
    });
  });

  /**
   * POST /animals/:id/identity/link
   * Manually link an animal to a global identity
   */
  app.post("/animals/:id/identity/link", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const userId = (req as any).userId as string;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    const body = (req.body || {}) as {
      globalIdentityId: number;
    };

    if (!body.globalIdentityId) {
      return reply.code(400).send({ error: "globalIdentityId required" });
    }

    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    // Verify the global identity exists
    const identity = await prisma.globalAnimalIdentity.findUnique({
      where: { id: body.globalIdentityId },
    });

    if (!identity) {
      return reply.code(404).send({ error: "global identity not found" });
    }

    // Verify species match
    if (identity.species !== animal.species) {
      return reply.code(400).send({ error: "species mismatch" });
    }

    await identityMatchingService.linkAnimalToIdentity(
      animalId,
      body.globalIdentityId,
      ["manual_link"],
      1.0,
      false, // not auto-matched
      userId
    );

    reply.send({ success: true, globalIdentityId: body.globalIdentityId });
  });

  /**
   * DELETE /animals/:id/identity/link
   * Unlink an animal from its global identity
   */
  app.delete("/animals/:id/identity/link", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    await prisma.animalIdentityLink.deleteMany({
      where: { animalId },
    });

    reply.send({ success: true });
  });

  /**
   * POST /animals/:id/identity/identifiers
   * Add an identifier to an animal's global identity
   */
  app.post("/animals/:id/identity/identifiers", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt((req.params as any).id, 10);
    if (!animalId || Number.isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid animal id" });
    }

    const body = (req.body || {}) as {
      type: IdentifierType;
      value: string;
    };

    if (!body.type || !body.value) {
      return reply.code(400).send({ error: "type and value required" });
    }

    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      include: { identityLink: true },
    });

    if (!animal) {
      return reply.code(404).send({ error: "animal not found" });
    }

    if (!animal.identityLink) {
      return reply.code(400).send({ error: "animal not linked to global identity" });
    }

    // Normalize the identifier value
    const normalizedValue = body.value.trim().toUpperCase().replace(/[\s-]/g, "");

    try {
      const identifier = await prisma.globalAnimalIdentifier.create({
        data: {
          identityId: animal.identityLink.identityId,
          type: body.type,
          value: normalizedValue,
          rawValue: body.value.trim(),
          sourceTenantId: tenantId,
        },
      });

      reply.code(201).send({
        id: identifier.id,
        type: identifier.type,
        value: identifier.rawValue,
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "identifier already exists" });
      }
      throw e;
    }
  });

  /**
   * GET /lineage/global-pedigree/:globalIdentityId
   * Get cross-tenant pedigree from a global identity
   */
  app.get("/lineage/global-pedigree/:globalIdentityId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const globalIdentityId = parseInt((req.params as any).globalIdentityId, 10);
    if (!globalIdentityId || Number.isNaN(globalIdentityId)) {
      return reply.code(400).send({ error: "invalid globalIdentityId" });
    }

    const query = (req.query || {}) as { generations?: string };
    const generations = Math.min(10, Math.max(1, parseInt(query.generations || "5", 10)));

    const identity = await prisma.globalAnimalIdentity.findUnique({
      where: { id: globalIdentityId },
    });

    if (!identity) {
      return reply.code(404).send({ error: "global identity not found" });
    }

    // Build the global pedigree tree
    const pedigree = await buildGlobalPedigreeForApi(globalIdentityId, generations, tenantId);

    reply.send({ pedigree });
  });

  /**
   * POST /animals/:id/test-results
   * Create a test result (e.g., follicle exam) for an animal
   * If indicatesOvulationDate is set and planId is provided, automatically updates the breeding plan's ovulation date
   */
  app.post("/animals/:id/test-results", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    // Verify animal exists and belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: activeOnly({ id: animalId, tenantId }),
      select: { id: true, sex: true },
    });
    if (!animal) return reply.code(404).send({ error: "animal_not_found" });

    const b = (req.body || {}) as {
      planId?: number;
      kind: string;
      method?: string;
      labName?: string;
      valueNumber?: number;
      valueText?: string;
      units?: string;
      referenceRange?: string;
      collectedAt: string;
      resultAt?: string;
      notes?: string;
      data?: any;
      indicatesOvulationDate?: string;
    };

    // Validate required fields
    if (!b.kind) return reply.code(400).send({ error: "kind_required" });
    if (!b.collectedAt) return reply.code(400).send({ error: "collectedAt_required" });

    const collectedAt = parseDateIso(b.collectedAt);
    if (!collectedAt) return reply.code(400).send({ error: "collectedAt_invalid" });

    const resultAt = b.resultAt ? parseDateIso(b.resultAt) : null;
    if (b.resultAt && !resultAt) return reply.code(400).send({ error: "resultAt_invalid" });

    const indicatesOvulationDate = b.indicatesOvulationDate ? parseDateIso(b.indicatesOvulationDate) : null;
    if (b.indicatesOvulationDate && !indicatesOvulationDate) {
      return reply.code(400).send({ error: "indicatesOvulationDate_invalid" });
    }

    // If planId provided, verify it exists and belongs to tenant
    if (b.planId) {
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: b.planId, tenantId },
        select: { id: true, damId: true },
      });
      if (!plan) return reply.code(404).send({ error: "breeding_plan_not_found" });

      // Verify the animal is the dam on this breeding plan
      if (plan.damId !== animalId) {
        return reply.code(400).send({ error: "animal_not_dam_on_plan" });
      }
    }

    try {
      // Create the test result
      const created = await prisma.testResult.create({
        data: {
          tenantId,
          animalId,
          planId: b.planId ?? null,
          kind: b.kind,
          method: b.method ?? null,
          labName: b.labName ?? null,
          valueNumber: b.valueNumber ?? null,
          valueText: b.valueText ?? null,
          units: b.units ?? null,
          referenceRange: b.referenceRange ?? null,
          collectedAt,
          resultAt,
          notes: b.notes ?? null,
          data: b.data ?? null,
          indicatesOvulationDate,
        },
      });

      // If this test indicates ovulation and is linked to a breeding plan, update the plan
      if (indicatesOvulationDate && b.planId) {
        await prisma.breedingPlan.update({
          where: { id: b.planId },
          data: {
            ovulationConfirmed: indicatesOvulationDate,
            ovulationConfirmedMethod: "ULTRASOUND",
            ovulationTestResultId: created.id,
            ovulationConfidence: "HIGH",
          },
        });
      }

      return reply.code(201).send(created);
    } catch (err: any) {
      if (err?.code === "P2003") {
        return reply.code(400).send({ error: "foreign_key_constraint_failed" });
      }
      throw err;
    }
  });

  /**
   * GET /animals/:id/test-results
   * Get test results for an animal, optionally filtered by kind and/or planId
   */
  app.get("/animals/:id/test-results", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    // Verify animal exists and belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: activeOnly({ id: animalId, tenantId }),
      select: { id: true },
    });
    if (!animal) return reply.code(404).send({ error: "animal_not_found" });

    const query = (req.query || {}) as {
      kind?: string;
      planId?: string;
      limit?: string;
      offset?: string;
    };

    // Build where clause
    const where: any = {
      animalId,
      tenantId,
    };

    if (query.kind) {
      where.kind = query.kind;
    }

    if (query.planId) {
      const planId = parseIntStrict(query.planId);
      if (planId) {
        where.planId = planId;
      }
    }

    const limit = query.limit ? Math.min(100, Math.max(1, parseInt(query.limit))) : 50;
    const offset = query.offset ? Math.max(0, parseInt(query.offset)) : 0;

    try {
      const results = await prisma.testResult.findMany({
        where,
        orderBy: { collectedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          plan: {
            select: {
              id: true,
              dam: { select: { id: true, name: true } },
              sire: { select: { id: true, name: true } },
            },
          },
          anchoredPlans: {
            select: { id: true },
          },
        },
      });

      const total = await prisma.testResult.count({ where });

      return reply.send({
        results,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (err) {
      throw err;
    }
  });

  /**
   * PUT /animals/:id/test-results/:testResultId
   * Update a test result (e.g., follicle exam) for an animal
   * If indicatesOvulationDate is changed and planId is provided, automatically updates the breeding plan's ovulation date
   */
  app.put("/animals/:id/test-results/:testResultId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { id: string }).id);
    const testResultId = parseIntStrict((req.params as { testResultId: string }).testResultId);

    if (!animalId) return reply.code(400).send({ error: "id_invalid" });
    if (!testResultId) return reply.code(400).send({ error: "test_result_id_invalid" });

    // Verify animal exists and belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: activeOnly({ id: animalId, tenantId }),
      select: { id: true, sex: true },
    });
    if (!animal) return reply.code(404).send({ error: "animal_not_found" });

    // Verify test result exists and belongs to this animal and tenant
    const existingTestResult = await prisma.testResult.findFirst({
      where: {
        id: testResultId,
        animalId,
        tenantId,
      },
      select: {
        id: true,
        planId: true,
        indicatesOvulationDate: true,
        anchoredPlans: { select: { id: true } },
      },
    });

    if (!existingTestResult) {
      return reply.code(404).send({ error: "test_result_not_found" });
    }

    const b = (req.body || {}) as {
      planId?: number;
      kind: string;
      method?: string;
      labName?: string;
      valueNumber?: number;
      valueText?: string;
      units?: string;
      referenceRange?: string;
      collectedAt: string;
      resultAt?: string;
      notes?: string;
      data?: any;
      indicatesOvulationDate?: string;
    };

    // Validate required fields
    if (!b.kind) return reply.code(400).send({ error: "kind_required" });
    if (!b.collectedAt) return reply.code(400).send({ error: "collectedAt_required" });

    const collectedAt = parseDateIso(b.collectedAt);
    if (!collectedAt) return reply.code(400).send({ error: "collectedAt_invalid" });

    const resultAt = b.resultAt ? parseDateIso(b.resultAt) : null;
    if (b.resultAt && !resultAt) return reply.code(400).send({ error: "resultAt_invalid" });

    const indicatesOvulationDate = b.indicatesOvulationDate ? parseDateIso(b.indicatesOvulationDate) : null;
    if (b.indicatesOvulationDate && !indicatesOvulationDate) {
      return reply.code(400).send({ error: "indicatesOvulationDate_invalid" });
    }

    // If planId provided, verify it exists and belongs to tenant
    if (b.planId) {
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: b.planId, tenantId },
        select: { id: true, damId: true },
      });
      if (!plan) return reply.code(404).send({ error: "breeding_plan_not_found" });

      // Verify the animal is the dam on this breeding plan
      if (plan.damId !== animalId) {
        return reply.code(400).send({ error: "animal_not_dam_on_plan" });
      }
    }

    try {
      // Update the test result
      const updated = await prisma.testResult.update({
        where: { id: testResultId },
        data: {
          planId: b.planId ?? null,
          kind: b.kind,
          method: b.method ?? null,
          labName: b.labName ?? null,
          valueNumber: b.valueNumber ?? null,
          valueText: b.valueText ?? null,
          units: b.units ?? null,
          referenceRange: b.referenceRange ?? null,
          collectedAt,
          resultAt,
          notes: b.notes ?? null,
          data: b.data ?? null,
          indicatesOvulationDate,
        },
      });

      // Handle ovulation date changes for anchored plans
      if (existingTestResult.anchoredPlans && existingTestResult.anchoredPlans.length > 0) {
        // Update all anchored breeding plans with the new ovulation date
        for (const anchoredPlan of existingTestResult.anchoredPlans) {
          await prisma.breedingPlan.update({
            where: { id: anchoredPlan.id },
            data: {
              ovulationConfirmed: indicatesOvulationDate,
              ovulationConfirmedMethod: indicatesOvulationDate ? "ULTRASOUND" : null,
              ovulationTestResultId: indicatesOvulationDate ? testResultId : null,
              ovulationConfidence: indicatesOvulationDate ? "HIGH" : null,
            },
          });
        }
      } else if (indicatesOvulationDate && b.planId) {
        // If this test now indicates ovulation and is linked to a breeding plan, update the plan
        await prisma.breedingPlan.update({
          where: { id: b.planId },
          data: {
            ovulationConfirmed: indicatesOvulationDate,
            ovulationConfirmedMethod: "ULTRASOUND",
            ovulationTestResultId: testResultId,
            ovulationConfidence: "HIGH",
          },
        });
      }

      return reply.code(200).send(updated);
    } catch (err: any) {
      if (err?.code === "P2003") {
        return reply.code(400).send({ error: "foreign_key_constraint_failed" });
      }
      throw err;
    }
  });

  /**
   * DELETE /animals/:id/test-results/:testResultId
   * Delete a test result for an animal
   */
  app.delete("/animals/:id/test-results/:testResultId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { id: string }).id);
    const testResultId = parseIntStrict((req.params as { testResultId: string }).testResultId);

    if (!animalId) return reply.code(400).send({ error: "id_invalid" });
    if (!testResultId) return reply.code(400).send({ error: "test_result_id_invalid" });

    // Verify animal exists and belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: activeOnly({ id: animalId, tenantId }),
      select: { id: true },
    });
    if (!animal) return reply.code(404).send({ error: "animal_not_found" });

    // Verify test result exists, belongs to this animal, and tenant owns it
    const testResult = await prisma.testResult.findFirst({
      where: {
        id: testResultId,
        animalId,
        tenantId,
      },
      select: {
        id: true,
        indicatesOvulationDate: true,
        anchoredPlans: { select: { id: true } },
      },
    });

    if (!testResult) {
      return reply.code(404).send({ error: "test_result_not_found" });
    }

    // Check if this test result is being used as an ovulation anchor
    if (testResult.anchoredPlans && testResult.anchoredPlans.length > 0) {
      return reply.code(409).send({
        error: "test_result_in_use",
        detail: "Cannot delete test result that is currently anchoring breeding plans",
        anchoredPlanIds: testResult.anchoredPlans.map((p) => p.id),
      });
    }

    try {
      await prisma.testResult.delete({
        where: { id: testResultId },
      });

      return reply.code(204).send();
    } catch (err) {
      throw err;
    }
  });

  /**
   * GET /animals/:id/breeding-attempts
   * Get breeding attempts for an animal (as dam or sire)
   * Query params:
   *   - role: "dam" | "sire" | "both" (default: "both")
   *   - planId: optional filter by plan
   */
  app.get("/animals/:id/breeding-attempts", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    const q = (req.query || {}) as { role?: string; planId?: string };
    const role = q.role || "both";
    const planId = q.planId ? parseIntStrict(q.planId) : undefined;

    // Build where clause based on role
    let where: any = { tenantId };
    if (role === "dam") {
      where.damId = animalId;
    } else if (role === "sire") {
      where.sireId = animalId;
    } else {
      // both - dam OR sire
      where.OR = [{ damId: animalId }, { sireId: animalId }];
    }

    if (planId) {
      where.planId = planId;
    }

    const attempts = await prisma.breedingAttempt.findMany({
      where,
      orderBy: { attemptAt: "desc" },
      include: {
        dam: { select: { id: true, name: true } },
        sire: { select: { id: true, name: true } },
        plan: { select: { id: true, code: true, name: true, status: true } },
      },
    });

    reply.send(attempts);
  });
};

/**
 * Helper to mask sensitive identifiers for non-owners
 */
function maskIdentifier(type: IdentifierType, value: string): string {
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}

/**
 * Build global pedigree tree for API response
 */
async function buildGlobalPedigreeForApi(
  identityId: number,
  depth: number,
  viewingTenantId: number
): Promise<any> {
  if (depth <= 0) return null;

  const identity = await prisma.globalAnimalIdentity.findUnique({
    where: { id: identityId },
    include: {
      linkedAnimals: {
        include: {
          animal: {
            select: {
              id: true,
              tenantId: true,
              name: true,
              photoUrl: true,
              breed: true,
            },
          },
        },
      },
    },
  });

  if (!identity) return null;

  // Find if viewer has a local animal linked to this identity
  const ownAnimal = identity.linkedAnimals.find(
    (l) => l.animal.tenantId === viewingTenantId
  )?.animal;

  // Check privacy settings for the primary owner's animal
  const primaryAnimal = identity.linkedAnimals[0]?.animal;
  let privacySettings = null;
  if (primaryAnimal) {
    privacySettings = await prisma.animalPrivacySettings.findUnique({
      where: { animalId: primaryAnimal.id },
    });
  }

  const isOwn = !!ownAnimal;
  const showName = isOwn || privacySettings?.showName !== false;
  const showPhoto = isOwn || privacySettings?.showPhoto !== false;

  const node: any = {
    globalIdentityId: identity.id,
    species: identity.species,
    sex: identity.sex,
    name: showName ? (ownAnimal?.name || identity.name) : null,
    photoUrl: showPhoto ? ownAnimal?.photoUrl : null,
    breed: ownAnimal?.breed || null,
    birthDate: identity.birthDate,
    isOwn,
    isHidden: !showName,
    localAnimalId: ownAnimal?.id || null,
  };

  // Recursively get parents
  if (identity.damId) {
    node.dam = await buildGlobalPedigreeForApi(identity.damId, depth - 1, viewingTenantId);
  }
  if (identity.sireId) {
    node.sire = await buildGlobalPedigreeForApi(identity.sireId, depth - 1, viewingTenantId);
  }

  return node;
}

export default animalsRoutes;
