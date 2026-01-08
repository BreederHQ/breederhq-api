// src/routes/animals.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { checkQuota } from "../middleware/quota-enforcement.js";
import { updateUsageSnapshot } from "../services/subscription/usage-service.js";
import * as lineageService from "../services/lineage-service.js";

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
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
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
    where: { id: animalId, tenantId },
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
      if (!["DOG", "CAT", "HORSE"].includes(species)) return reply.code(400).send({ error: "species_invalid" });
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

    const [rawItems, total] = await prisma.$transaction([
      prisma.animal.findMany({
        where,
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

          reproductiveCycles: {
            select: { cycleStart: true },
          },
        },
      }),
      prisma.animal.count({ where }),
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
      where: { id, tenantId },
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

    const rec = await prisma.animal.findFirst({
      where: { id, tenantId },
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
    }>;


    const name = String(b.name || "").trim();
    if (!name) return reply.code(400).send({ error: "name_required" });
    if (!b.species || !["DOG", "CAT", "HORSE"].includes(b.species)) {
      return reply.code(400).send({ error: "species_required" });
    }
    if (!b.sex || !["FEMALE", "MALE"].includes(b.sex)) {
      return reply.code(400).send({ error: "sex_required" });
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

    const existing = await prisma.animal.findFirst({ where: { id, tenantId }, select: { id: true } });
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

    // POST /animals/:id/photo
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

    const resized = await sharp(buf)
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const uploadDir = path.join(process.cwd(), "uploads", "animals", String(tenantId));
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `animal-${id}.jpg`;
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, resized);

    const photoUrl = `/uploads/animals/${tenantId}/${filename}`;

    const updated = await prisma.animal.update({
      where: { id },
      data: { photoUrl },
      select: { photoUrl: true },
    });

    reply.send(updated);
  });

    // DELETE /animals/:id/photo
  app.delete("/animals/:id/photo", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);

    // optional: also delete file from disk if you want to reclaim space

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
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }),
      total: rows.length,
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
    };

    const partyId = parseIntStrict(b.partyId);
    if (!partyId) {
      return reply.code(400).send({ error: "partyId_invalid" });
    }

    const percent = Number(b.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return reply.code(400).send({ error: "percent_invalid" });
    }

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
        },
        select: {
          id: true,
          partyId: true,
          percent: true,
          isPrimary: true,
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
    }>;

    const data: any = {};
    if (b.percent !== undefined) {
      const pct = Number(b.percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return reply.code(400).send({ error: "percent_invalid" });
      data.percent = pct;
    }
    if (b.isPrimary !== undefined) data.isPrimary = !!b.isPrimary;

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

    const a = await prisma.animal.findFirst({ where: { id: animalId, tenantId }, select: { id: true, species: true } });
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
  // Animal Public Listing Management
  // ==========================================================================

  /**
   * GET /animals/:id/public-listing
   * Get the public listing for an animal (if exists)
   */
  app.get("/animals/:id/public-listing", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const listing = await prisma.animalPublicListing.findUnique({
      where: { animalId },
      select: {
        id: true,
        urlSlug: true,
        intent: true,
        status: true,
        headline: true,
        title: true,
        summary: true,
        description: true,
        priceCents: true,
        priceMinCents: true,
        priceMaxCents: true,
        priceText: true,
        priceModel: true,
        locationCity: true,
        locationRegion: true,
        locationCountry: true,
        detailsJson: true,
        publishedAt: true,
        pausedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!listing) {
      return reply.code(404).send({ error: "no_listing" });
    }

    reply.send(listing);
  });

  /**
   * PUT /animals/:id/public-listing
   * Create or update the public listing for an animal
   */
  app.put("/animals/:id/public-listing", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const body = req.body as {
      urlSlug?: string;
      intent?: "STUD" | "BROOD_PLACEMENT" | "REHOME" | "SHOWCASE";
      headline?: string;
      title?: string;
      summary?: string;
      description?: string;
      priceCents?: number;
      priceMinCents?: number;
      priceMaxCents?: number;
      priceText?: string;
      priceModel?: string;
      locationCity?: string;
      locationRegion?: string;
      locationCountry?: string;
      detailsJson?: any;
    };

    // Validate intent if provided
    const validIntents = ["STUD", "BROOD_PLACEMENT", "REHOME", "SHOWCASE"];
    if (body.intent && !validIntents.includes(body.intent)) {
      return reply.code(400).send({ error: "invalid_intent", validIntents });
    }

    // Validate priceModel if provided
    const validPriceModels = ["fixed", "range", "negotiable", "inquire"];
    if (body.priceModel && !validPriceModels.includes(body.priceModel)) {
      return reply.code(400).send({ error: "invalid_price_model", validPriceModels });
    }

    const data = {
      urlSlug: body.urlSlug ?? undefined,
      intent: body.intent ?? undefined,
      headline: body.headline ?? undefined,
      title: body.title ?? undefined,
      summary: body.summary ?? undefined,
      description: body.description ?? undefined,
      priceCents: body.priceCents ?? undefined,
      priceMinCents: body.priceMinCents ?? undefined,
      priceMaxCents: body.priceMaxCents ?? undefined,
      priceText: body.priceText ?? undefined,
      priceModel: body.priceModel ?? undefined,
      locationCity: body.locationCity ?? undefined,
      locationRegion: body.locationRegion ?? undefined,
      locationCountry: body.locationCountry ?? undefined,
      detailsJson: body.detailsJson ?? undefined,
    };

    const listing = await prisma.animalPublicListing.upsert({
      where: { animalId },
      create: {
        animalId,
        tenantId,
        status: "DRAFT",
        ...data,
      },
      update: data,
      select: {
        id: true,
        urlSlug: true,
        intent: true,
        status: true,
        headline: true,
        title: true,
        summary: true,
        description: true,
        priceCents: true,
        priceMinCents: true,
        priceMaxCents: true,
        priceText: true,
        priceModel: true,
        locationCity: true,
        locationRegion: true,
        locationCountry: true,
        detailsJson: true,
        publishedAt: true,
        pausedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    reply.send(listing);
  });

  /**
   * PATCH /animals/:id/public-listing/status
   * Update listing status (DRAFT -> LIVE, LIVE -> PAUSED, etc.)
   */
  app.patch("/animals/:id/public-listing/status", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const { status } = req.body as { status?: string };
    const validStatuses = ["DRAFT", "LIVE", "PAUSED"];
    if (!status || !validStatuses.includes(status)) {
      return reply.code(400).send({ error: "invalid_status", validStatuses });
    }

    const existing = await prisma.animalPublicListing.findUnique({
      where: { animalId },
      select: { id: true, status: true, intent: true, urlSlug: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "no_listing" });
    }

    // Require intent and urlSlug to publish
    if (status === "LIVE") {
      if (!existing.intent) {
        return reply.code(400).send({ error: "intent_required", message: "Set intent before publishing" });
      }
      if (!existing.urlSlug) {
        return reply.code(400).send({ error: "url_slug_required", message: "Set urlSlug before publishing" });
      }
    }

    const now = new Date();
    const updateData: any = { status };

    if (status === "LIVE" && existing.status !== "LIVE") {
      updateData.publishedAt = now;
      updateData.pausedAt = null;
    } else if (status === "PAUSED" && existing.status === "LIVE") {
      updateData.pausedAt = now;
    } else if (status === "DRAFT") {
      updateData.publishedAt = null;
      updateData.pausedAt = null;
    }

    const listing = await prisma.animalPublicListing.update({
      where: { animalId },
      data: updateData,
      select: {
        id: true,
        status: true,
        publishedAt: true,
        pausedAt: true,
        updatedAt: true,
      },
    });

    reply.send(listing);
  });

  /**
   * DELETE /animals/:id/public-listing
   * Delete the public listing for an animal
   */
  app.delete("/animals/:id/public-listing", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalPublicListing.findUnique({
      where: { animalId },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({ error: "no_listing" });
    }

    await prisma.animalPublicListing.delete({ where: { animalId } });
    reply.send({ ok: true });
  });

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
};

export default animalsRoutes;
