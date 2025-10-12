// src/routes/animals.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// Keep these in sync with Prisma enums
type Species = "DOG" | "CAT" | "HORSE";
type Sex = "FEMALE" | "MALE";
type AnimalStatus = "ACTIVE" | "BREEDING" | "UNAVAILABLE" | "RETIRED" | "DECEASED" | "PROSPECT";

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

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

// Guard: organization must exist AND be in the active tenant
async function assertOrgInTenant(orgId: number, tenantId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, tenantId: true },
  });
  if (!org) throw Object.assign(new Error("not_found"), { statusCode: 404 });
  if (org.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return org;
}
// Guard: contact must exist AND be in the active tenant
async function assertContactInTenant(contactId: number, tenantId: number) {
  const c = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, tenantId: true },
  });
  if (!c) throw Object.assign(new Error("contact_not_found"), { statusCode: 404 });
  if (c.tenantId !== tenantId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  return c;
}
// Guard: animal must exist AND be in tenant
async function assertAnimalInTenant(animalId: number, tenantId: number) {
  const a = await prisma.animal.findFirst({
    where: { id: animalId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!a) throw Object.assign(new Error("not_found"), { statusCode: 404 });
  return a;
}

const animalsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ───────────────────────────────────────────────────────────────────────────
  // GET /animals?q=&species=&sex=&status=&organizationId=&includeArchived=&page=&limit=&sort=
  // ───────────────────────────────────────────────────────────────────────────
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

    const [items, total] = await prisma.$transaction([
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
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.animal.count({ where }),
    ]);

    reply.send({ items, total, page: pageNum, limit: take });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /animals/:id
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/animals/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

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
        archived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!rec) return reply.code(404).send({ error: "not_found" });
    reply.send(rec);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /animals
  // ───────────────────────────────────────────────────────────────────────────
  app.post("/animals", async (req, reply) => {
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
    }>;

    const name = String(b.name || "").trim();
    if (!name) return reply.code(400).send({ error: "name_required" });
    if (!b.species || !["DOG", "CAT", "HORSE"].includes(b.species)) {
      return reply.code(400).send({ error: "species_required" });
    }
    if (!b.sex || !["FEMALE", "MALE"].includes(b.sex)) {
      return reply.code(400).send({ error: "sex_required" });
    }
    const bd = b.birthDate !== undefined ? parseDateIso(b.birthDate) : undefined;
    if (b.birthDate !== undefined && bd === null) {
      return reply.code(400).send({ error: "birthDate_invalid" });
    }

    let orgId: number | null = null;
    if (b.organizationId != null) {
      const parsed = parseIntStrict(b.organizationId);
      if (!parsed) return reply.code(400).send({ error: "organizationId_invalid" });
      await assertOrgInTenant(parsed, tenantId);
      orgId = parsed;
    }

    try {
      const created = await prisma.animal.create({
        data: {
          tenantId,
          organizationId: orgId ?? undefined,
          name,
          species: b.species,
          sex: b.sex,
          status: b.status ?? "ACTIVE",
          birthDate: bd ?? null,
          microchip: b.microchip ?? null,
          notes: b.notes ?? null,
          breed: b.breed ?? null,
          canonicalBreedId: b.canonicalBreedId ?? null,
          customBreedId: b.customBreedId ?? null,
        },
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
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.code(201).send(created);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "duplicate_microchip", detail: "microchip_must_be_unique_within_tenant" });
      }
      throw e;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /animals/:id
  // ───────────────────────────────────────────────────────────────────────────
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
    }>;

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
          archived: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return reply.code(409).send({ error: "duplicate_microchip", detail: "microchip_must_be_unique_within_tenant" });
      }
      if (e?.code === "P2025") {
        return reply.code(404).send({ error: "not_found" });
      }
      throw e;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /animals/:id/archive  |  /animals/:id/restore
  // ───────────────────────────────────────────────────────────────────────────
  app.post("/animals/:id/archive", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);
    await prisma.animal.update({ where: { id }, data: { archived: true } });
    reply.send({ ok: true });
  });

  app.post("/animals/:id/restore", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);
    await prisma.animal.update({ where: { id }, data: { archived: false } });
    reply.send({ ok: true });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /animals/:id
  // ───────────────────────────────────────────────────────────────────────────
  app.delete("/animals/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseIntStrict((req.params as { id: string }).id);
    if (!id) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(id, tenantId);
    await prisma.animal.delete({ where: { id } });
    reply.send({ ok: true });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TAGS (parity with tags module from the animal side)
  // GET /animals/:id/tags
  // POST /animals/:id/tags { tagId }
  // DELETE /animals/:id/tags/:tagId
  // ───────────────────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────────────────
  // OWNERS CRUD
  // GET /animals/:id/owners
  // POST /animals/:id/owners
  // PATCH /animals/:id/owners/:ownerId
  // DELETE /animals/:id/owners/:ownerId
  // ───────────────────────────────────────────────────────────────────────────
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
        partyType: true,
        organizationId: true,
        contactId: true,
        percent: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, tenantId: true } },
        contact: { select: { id: true, display_name: true, tenantId: true } },
      },
    });

    reply.send({
      items: rows.map(r => ({
        id: r.id,
        partyType: r.partyType,
        percent: r.percent,
        isPrimary: r.isPrimary,
        organization: r.organizationId ? { id: r.organizationId, name: r.organization?.name ?? "" } : null,
        contact: r.contactId ? { id: r.contactId, name: r.contact?.display_name ?? "" } : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total: rows.length,
    });
  });

  app.post("/animals/:id/owners", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    if (!animalId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const b = (req.body || {}) as {
      partyType: "Organization" | "Contact";
      organizationId?: number | null;
      contactId?: number | null;
      percent: number;
      isPrimary?: boolean;
    };

    if (!b?.partyType || !["Organization", "Contact"].includes(b.partyType)) {
      return reply.code(400).send({ error: "partyType_invalid" });
    }

    const percent = Number(b.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return reply.code(400).send({ error: "percent_invalid" });
    }

    let orgId: number | null = null;
    let contactId: number | null = null;
    if (b.partyType === "Organization") {
      orgId = parseIntStrict(b.organizationId);
      if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
      await assertOrgInTenant(orgId, tenantId);
    } else {
      contactId = parseIntStrict(b.contactId);
      if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });
      await assertContactInTenant(contactId, tenantId);
    }

    try {
      const created = await prisma.animalOwner.create({
        data: {
          animalId,
          partyType: b.partyType,
          organizationId: orgId,
          contactId,
          percent,
          isPrimary: !!b.isPrimary,
        },
        select: {
          id: true,
          partyType: true,
          organizationId: true,
          contactId: true,
          percent: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.code(201).send(created);
    } catch (e: any) {
      if (e?.code === "P2002") {
        // @@unique([animalId, organizationId]) or @@unique([animalId, contactId])
        return reply.code(409).send({ error: "duplicate_owner" });
      }
      throw e;
    }
  });

  app.patch("/animals/:id/owners/:ownerId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;
    const animalId = parseIntStrict((req.params as { id: string }).id);
    const ownerId = parseIntStrict((req.params as { ownerId: string }).ownerId);
    if (!animalId || !ownerId) return reply.code(400).send({ error: "id_invalid" });

    await assertAnimalInTenant(animalId, tenantId);

    const existing = await prisma.animalOwner.findUnique({
      where: { id: ownerId },
      select: { id: true, animalId: true, organizationId: true, contactId: true, partyType: true },
    });
    if (!existing || existing.animalId !== animalId) {
      return reply.code(404).send({ error: "not_found" });
    }

    const b = (req.body || {}) as Partial<{
      percent: number;
      isPrimary: boolean;
      partyType: "Organization" | "Contact";
      organizationId: number | null;
      contactId: number | null;
    }>;

    const data: any = {};
    if (b.percent !== undefined) {
      const pct = Number(b.percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return reply.code(400).send({ error: "percent_invalid" });
      data.percent = pct;
    }
    if (b.isPrimary !== undefined) data.isPrimary = !!b.isPrimary;

    if (b.partyType !== undefined) {
      if (!["Organization", "Contact"].includes(b.partyType)) return reply.code(400).send({ error: "partyType_invalid" });
      data.partyType = b.partyType;
      // When changing partyType, require appropriate target
      if (b.partyType === "Organization") {
        const orgId = parseIntStrict(b.organizationId);
        if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
        await assertOrgInTenant(orgId, tenantId);
        data.organizationId = orgId;
        data.contactId = null;
      } else {
        const contactId = parseIntStrict(b.contactId);
        if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });
        await assertContactInTenant(contactId, tenantId);
        data.contactId = contactId;
        data.organizationId = null;
      }
    } else {
      // Same partyType; allow changing specific target IDs
      if (existing.partyType === "Organization" && b.organizationId !== undefined) {
        if (b.organizationId === null) return reply.code(400).send({ error: "organizationId_required" });
        const orgId = parseIntStrict(b.organizationId);
        if (!orgId) return reply.code(400).send({ error: "organizationId_invalid" });
        await assertOrgInTenant(orgId, tenantId);
        data.organizationId = orgId;
        data.contactId = null;
      }
      if (existing.partyType === "Contact" && b.contactId !== undefined) {
        if (b.contactId === null) return reply.code(400).send({ error: "contactId_required" });
        const contactId = parseIntStrict(b.contactId);
        if (!contactId) return reply.code(400).send({ error: "contactId_invalid" });
        await assertContactInTenant(contactId, tenantId);
        data.contactId = contactId;
        data.organizationId = null;
      }
    }

    try {
      const updated = await prisma.animalOwner.update({
        where: { id: ownerId },
        data,
        select: {
          id: true,
          partyType: true,
          organizationId: true,
          contactId: true,
          percent: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      reply.send(updated);
    } catch (e: any) {
      if (e?.code === "P2002") return reply.code(409).send({ error: "duplicate_owner" });
      throw e;
    }
  });

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

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRY IDENTIFIERS CRUD
  // GET /animals/:id/registries
  // POST /animals/:id/registries
  // PATCH /animals/:id/registries/:identifierId
  // DELETE /animals/:id/registries/:identifierId
  // ───────────────────────────────────────────────────────────────────────────
  app.get("/animals/:id/registries", async (req, reply) => {
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

    reply.send({ items: rows, total: rows.length });
  });

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
    // Optional species sanity check (if registry.species set)
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
};

export default animalsRoutes;
