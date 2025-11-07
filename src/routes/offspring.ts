// src/routes/offspring.ts
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";

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

function litterListItem(L: any) {
  return {
    id: L.id,
    tenantId: L.tenantId,
    identifier: L.identifier,
    createdAt: L.createdAt.toISOString(),
    updatedAt: L.updatedAt.toISOString(),
    counts: {
      animals: L._count?.Animals ?? 0,
      waitlist: L._count?.Waitlist ?? 0,
      born: L.countBorn ?? null,
      live: L.countLive ?? null,
      stillborn: L.countStillborn ?? null,
      male: L.countMale ?? null,
      female: L.countFemale ?? null,
    },
    dates: {
      birthedStartAt: L.birthedStartAt?.toISOString() ?? null,
      birthedEndAt: L.birthedEndAt?.toISOString() ?? null,
      weanedAt: L.weanedAt?.toISOString() ?? null,
      placementStartAt: L.placementStartAt?.toISOString() ?? null,
      placementCompletedAt: L.placementCompletedAt?.toISOString() ?? null,
    },
    published: L.published ?? false,
    plan: litePlanForList(L.plan),
  };
}

function litterDetail(L: any) {
  if (!L) return null;
  return {
    id: L.id,
    tenantId: L.tenantId,
    identifier: L.identifier,
    notes: L.notes ?? null,
    published: !!L.published,
    coverImageUrl: L.coverImageUrl ?? null,
    themeName: L.themeName ?? null,
    birthedStartAt: L.birthedStartAt?.toISOString() ?? null,
    birthedEndAt: L.birthedEndAt?.toISOString() ?? null,
    weanedAt: L.weanedAt?.toISOString() ?? null,
    placementStartAt: L.placementStartAt?.toISOString() ?? null,
    placementCompletedAt: L.placementCompletedAt?.toISOString() ?? null,
    counts: {
      born: L.countBorn ?? null,
      live: L.countLive ?? null,
      stillborn: L.countStillborn ?? null,
      male: L.countMale ?? null,
      female: L.countFemale ?? null,
    },
    plan: L.plan
      ? {
          id: L.plan.id,
          code: L.plan.code,
          name: L.plan.name,
          species: L.plan.species,
          breedText: L.plan.breedText,
          dam: L.plan.dam ? { id: L.plan.dam.id, name: L.plan.dam.name } : null,
          sire: L.plan.sire ? { id: L.plan.sire.id, name: L.plan.sire.name } : null,
        }
      : null,
    Animals: (L.Animals ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      sex: a.sex,
      status: a.status,
      birthDate: a.birthDate?.toISOString() ?? null,
      species: a.species,
      breed: a.breed ?? null,
      litterId: a.litterId,
      updatedAt: a.updatedAt.toISOString(),
    })),
    Waitlist: (L.Waitlist ?? []).map((w: any) => ({
      id: w.id,
      tenantId: w.tenantId,
      status: w.status,
      priority: w.priority,
      depositRequiredCents: w.depositRequiredCents,
      depositPaidCents: w.depositPaidCents,
      balanceDueCents: w.balanceDueCents,
      depositPaidAt: w.depositPaidAt?.toISOString() ?? null,
      contactId: w.contactId,
      organizationId: w.organizationId,
      litterId: w.litterId,
      planId: w.planId,
      speciesPref: w.speciesPref,
      breedPrefs: w.breedPrefs ?? null,
      sirePrefId: w.sirePrefId,
      damPrefId: w.damPrefId,
      contact: w.contact
        ? { id: w.contact.id, display_name: w.contact.display_name, email: w.contact.email, phoneE164: w.contact.phoneE164 }
        : null,
      organization: w.organization
        ? { id: w.organization.id, name: w.organization.name, email: w.organization.email, phone: w.organization.phone ?? null }
        : null,
      sirePref: w.sirePref ? { id: w.sirePref.id, name: w.sirePref.name } : null,
      damPref: w.damPref ? { id: w.damPref.id, name: w.damPref.name } : null,
      TagAssignment: (w.TagAssignment ?? []).map((t: any) => ({ id: t.id, tagId: t.tagId, tag: t.tag })),
    })),
    Attachment: L.Attachment ?? [],
    createdAt: L.createdAt.toISOString(),
    updatedAt: L.updatedAt.toISOString(),
  };
}

/* ========= router ========= */

const offspringRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // inject tenant
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  /* ===== LIST: GET /api/v1/offspring ===== */
  app.get("/offspring", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const q = String(req.query["q"] ?? "").trim();
    const limit = Math.min(250, Math.max(1, Number(req.query["limit"] ?? 25)));
    const cursorId = req.query["cursor"] ? Number(req.query["cursor"]) : undefined;
    const published = asBool(req.query["published"]);
    const hasAnimals = asBool(req.query["hasAnimals"]);

    const dateFieldRaw = String(req.query["dateField"] ?? "").trim();
    const dateFrom = parseISO(req.query["dateFrom"]);
    const dateTo = parseISO(req.query["dateTo"]);
    const dateFieldMap: Record<string, keyof typeof whereDates> = {
      birthed: "birthedStartAt",
      weaned: "weanedAt",
      placementStart: "placementStartAt",
      placementCompleted: "placementCompletedAt",
    };

    // build where
    const whereDates = {
      birthedStartAt: undefined as any,
      weanedAt: undefined as any,
      placementStartAt: undefined as any,
      placementCompletedAt: undefined as any,
    };

    if (dateFieldRaw && dateFieldMap[dateFieldRaw]) {
      const k = dateFieldMap[dateFieldRaw];
      whereDates[k] = {
        gte: dateFrom ?? undefined,
        lte: dateTo ?? undefined,
      };
    }

    const where: any = {
      tenantId,
      ...(q ? { identifier: { contains: q, mode: "insensitive" } } : null),
      ...(published !== undefined ? { published } : null),
      ...(whereDates.birthedStartAt ? { birthedStartAt: whereDates.birthedStartAt } : null),
      ...(whereDates.weanedAt ? { weanedAt: whereDates.weanedAt } : null),
      ...(whereDates.placementStartAt ? { placementStartAt: whereDates.placementStartAt } : null),
      ...(whereDates.placementCompletedAt ? { placementCompletedAt: whereDates.placementCompletedAt } : null),
      ...(hasAnimals !== undefined
        ? hasAnimals
          ? { Animals: { some: {} } }
          : { Animals: { none: {} } }
        : null),
      ...(cursorId ? { id: { lt: cursorId } } : null), // simple keyset by id desc
    };

    const litters = await prisma.litter.findMany({
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
        _count: { select: { Animals: true, Waitlist: true } },
      },
    });

    const hasMore = litters.length > limit;
    const rows = hasMore ? litters.slice(0, limit) : litters;
    const items = rows.map(litterListItem);
    const nextCursor = hasMore ? String(rows[rows.length - 1].id) : null;

    reply.send({ items, nextCursor });
  });

  /* ===== DETAIL: GET /api/v1/offspring/:id ===== */
  app.get("/offspring/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const L = await prisma.litter.findFirst({
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
        Animals: {
          select: {
            id: true,
            name: true,
            sex: true,
            status: true,
            birthDate: true,
            species: true,
            breed: true,
            litterId: true,
            updatedAt: true,
          },
          orderBy: { id: "asc" },
        },
        Waitlist: {
          include: {
            contact: { select: { id: true, display_name: true, email: true, phoneE164: true } },
            organization: { select: { id: true, name: true, email: true, phone: true } },
            sirePref: { select: { id: true, name: true } },
            damPref: { select: { id: true, name: true } },
            TagAssignment: { include: { tag: true } },
          },
          orderBy: [{ depositPaidAt: "desc" }, { createdAt: "asc" }],
        },
        Attachment: true,
      },
    });

    if (!L) return reply.code(404).send({ error: "not found" });
    reply.send(litterDetail(L));
  });

  /* ===== CREATE: POST /api/v1/offspring ===== */
  app.post("/offspring", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const { planId, identifier, notes, published, dates } = (req.body as any) ?? {};
    if (!planId) return reply.code(400).send({ error: "planId required" });

    const plan = await prisma.breedingPlan.findFirst({ where: { id: Number(planId), tenantId } });
    if (!plan) return reply.code(404).send({ error: "plan not found" });
    if (plan.status !== "COMMITTED") return reply.code(409).send({ error: "plan must be COMMITTED" });

    const existing = await prisma.litter.findFirst({ where: { planId: plan.id, tenantId } });

    const payload: any = {
      tenantId,
      planId: plan.id,
      identifier: identifier ?? null,
      notes: notes ?? null,
      published: Boolean(published ?? false),
    };

    if (dates) {
      payload.birthedStartAt = parseISO(dates.birthedStartAt);
      payload.birthedEndAt = parseISO(dates.birthedEndAt);
      payload.weanedAt = parseISO(dates.weanedAt);
      payload.placementStartAt = parseISO(dates.placementStartAt) ?? (plan.lockedPlacementStartDate ?? null);
      payload.placementCompletedAt = parseISO(dates.placementCompletedAt);
    } else {
      payload.placementStartAt = plan.lockedPlacementStartDate ?? null;
    }

    const litter = existing
      ? await prisma.litter.update({ where: { id: existing.id }, data: payload })
      : await prisma.litter.create({ data: payload });

    const created = await prisma.litter.findFirst({
      where: { id: litter.id, tenantId },
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
        Animals: true,
        Waitlist: true,
        Attachment: true,
      },
    });

    reply.code(existing ? 200 : 201).send(litterDetail(created));
  });

  /* ===== UPDATE: PATCH /api/v1/offspring/:id ===== */
  app.patch("/offspring/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    const L = await prisma.litter.findFirst({ where: { id, tenantId } });
    if (!L) return reply.code(404).send({ error: "not found" });

    const data: any = {};
    if ("identifier" in body) data.identifier = body.identifier ?? null;
    if ("notes" in body) data.notes = body.notes ?? null;
    if ("published" in body) data.published = !!body.published;
    if (body.publishedMeta) {
      if ("coverImageUrl" in body.publishedMeta) data.coverImageUrl = body.publishedMeta.coverImageUrl ?? null;
      if ("themeName" in body.publishedMeta) data.themeName = body.publishedMeta.themeName ?? null;
    }
    if (body.dates) {
      if ("birthedStartAt" in body.dates) data.birthedStartAt = parseISO(body.dates.birthedStartAt);
      if ("birthedEndAt" in body.dates) data.birthedEndAt = parseISO(body.dates.birthedEndAt);
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
    }

    await prisma.litter.update({ where: { id }, data });

    const refreshed = await prisma.litter.findFirst({
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
        Animals: true,
        Waitlist: {
          include: { contact: true, organization: true, TagAssignment: { include: { tag: true } }, sirePref: true, damPref: true },
          orderBy: [{ depositPaidAt: "desc" }, { createdAt: "asc" }],
        },
        Attachment: true,
      },
    });

    reply.send(litterDetail(refreshed));
  });

  /* ===== DELETE: DELETE /api/v1/offspring/:id ===== */
  app.delete("/offspring/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);

    const existing = await prisma.litter.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: "not found" });

    await prisma.litter.delete({ where: { id } });
    reply.send({ ok: true, id });
  });

  /* ===== MOVE WAITLIST INTO LITTER: POST /offspring/:id/move-waitlist ===== */
  app.post("/offspring/:id/move-waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const { waitlistEntryIds } = (req.body as any) ?? {};
    if (!Array.isArray(waitlistEntryIds) || waitlistEntryIds.length === 0) {
      return reply.code(400).send({ error: "waitlistEntryIds required" });
    }

    const L = await prisma.litter.findFirst({ where: { id, tenantId } });
    if (!L) return reply.code(404).send({ error: "group not found" });

    const entries = await prisma.waitlistEntry.findMany({
      where: { id: { in: waitlistEntryIds.map(Number) }, tenantId },
      select: { id: true },
    });
    if (entries.length !== waitlistEntryIds.length) {
      return reply.code(404).send({ error: "some entries not found" });
    }

    await prisma.$transaction(entries.map((e) =>
      prisma.waitlistEntry.update({ where: { id: e.id }, data: { litterId: id } }),
    ));

    reply.send({ moved: entries.length });
  });

  /* ===== OFFSPRING ANIMALS: CREATE ===== */
  app.post("/offspring/:id/animals", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const body = (req.body as any) ?? {};

    const L = await prisma.litter.findFirst({
      where: { id, tenantId },
      include: { plan: { select: { species: true } } },
    });
    if (!L) return reply.code(404).send({ error: "litter not found" });

    if (!body?.name || !body?.sex) {
      return reply.code(400).send({ error: "name and sex are required" });
    }

    const created = await prisma.animal.create({
      data: {
        tenantId,
        organizationId: null, // optional for now
        name: String(body.name),
        species: body.species ?? L.plan?.species ?? "DOG",
        sex: body.sex,
        status: body.status ?? "ACTIVE",
        birthDate: parseISO(body.birthDate),
        microchip: body.microchip ?? null,
        notes: body.notes ?? null,
        breed: body.breed ?? null,
        litterId: L.id,
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
    if (A.litterId !== id) return reply.code(409).send({ error: "animal does not belong to this litter" });

    const data: any = {};
    if ("name" in body) data.name = body.name;
    if ("sex" in body) data.sex = body.sex;
    if ("status" in body) data.status = body.status;
    if ("species" in body) data.species = body.species;
    if ("breed" in body) data.breed = body.breed ?? null;
    if ("microchip" in body) data.microchip = body.microchip ?? null;
    if ("notes" in body) data.notes = body.notes ?? null;
    if ("birthDate" in body) data.birthDate = parseISO(body.birthDate);

    const updated = await prisma.animal.update({ where: { id: animalId }, data });
    reply.send(updated);
  });

  /* ===== OFFSPRING ANIMALS: DELETE or UNLINK ===== */
  app.delete("/offspring/:id/animals/:animalId", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const animalId = Number((req.params as any).animalId);
    const mode = String(req.query["mode"] ?? "unlink");

    const A = await prisma.animal.findFirst({ where: { id: animalId, tenantId } });
    if (!A) return reply.code(404).send({ error: "animal not found" });
    if (A.litterId !== id) return reply.code(409).send({ error: "animal does not belong to this litter" });

    if (mode === "delete") {
      await prisma.animal.delete({ where: { id: animalId } });
      return reply.send({ ok: true, deleted: animalId });
    }

    await prisma.animal.update({ where: { id: animalId }, data: { litterId: null } });
    reply.send({ ok: true, unlinked: animalId });
  });

  /* ===== WAITLIST: CREATE under litter ===== */
  app.post("/offspring/:id/waitlist", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const L = await prisma.litter.findFirst({ where: { id, tenantId } });
    if (!L) return reply.code(404).send({ error: "litter not found" });

    if (!b.partyType || !["Organization", "Contact"].includes(b.partyType)) {
      return reply.code(400).send({ error: "partyType must be Contact or Organization" });
    }
    if (b.partyType === "Contact" && !b.contactId) return reply.code(400).send({ error: "contactId required for Contact partyType" });
    if (b.partyType === "Organization" && !b.organizationId) return reply.code(400).send({ error: "organizationId required for Organization partyType" });

    const data: any = {
      tenantId,
      litterId: id,
      planId: b.planId ?? null,
      partyType: b.partyType,
      contactId: b.partyType === "Contact" ? Number(b.contactId) : null,
      organizationId: b.partyType === "Organization" ? Number(b.organizationId) : null,
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
  app.patch("/offspring/:id/waitlist/:wid", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const wid = Number((req.params as any).wid);
    const b = (req.body as any) ?? {};

    const W = await prisma.waitlistEntry.findFirst({ where: { id: wid, tenantId } });
    if (!W) return reply.code(404).send({ error: "waitlist entry not found" });
    if (W.litterId !== id) return reply.code(409).send({ error: "waitlist entry does not belong to this litter" });

    const data: any = {};
    if ("partyType" in b) data.partyType = b.partyType;
    if ("contactId" in b) data.contactId = b.contactId ? Number(b.contactId) : null;
    if ("organizationId" in b) data.organizationId = b.organizationId ? Number(b.organizationId) : null;
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
    const mode = String(req.query["mode"] ?? "unlink");

    const W = await prisma.waitlistEntry.findFirst({ where: { id: wid, tenantId } });
    if (!W) return reply.code(404).send({ error: "waitlist entry not found" });
    if (W.litterId !== id) return reply.code(409).send({ error: "waitlist entry does not belong to this litter" });

    if (mode === "delete") {
      await prisma.waitlistEntry.delete({ where: { id: wid } });
      return reply.send({ ok: true, deleted: wid });
    }

    await prisma.waitlistEntry.update({ where: { id: wid }, data: { litterId: null } });
    reply.send({ ok: true, unlinked: wid });
  });

  /* ===== ATTACHMENTS: CREATE ===== */
  app.post("/offspring/:id/attachments", async (req, reply) => {
    const tenantId = (req as any).tenantId as number;
    const id = Number((req.params as any).id);
    const b = (req.body as any) ?? {};

    const L = await prisma.litter.findFirst({ where: { id, tenantId } });
    if (!L) return reply.code(404).send({ error: "litter not found" });

    const required = ["kind", "storageProvider", "storageKey", "filename", "mime", "bytes"] as const;
    for (const k of required) {
      if (!(k in b)) return reply.code(400).send({ error: `missing field ${k}` });
    }

    const created = await prisma.attachment.create({
      data: {
        tenantId,
        litterId: id,
        planId: null,
        animalId: null,
        contactId: null,
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
    if (A.litterId !== id) return reply.code(409).send({ error: "attachment does not belong to this litter" });

    await prisma.attachment.delete({ where: { id: aid } });
    reply.send({ ok: true, deleted: aid });
  });

  done();
};

export default offspringRoutes;
