// src/routes/animals.ts
import { PrismaClient } from "@prisma/client";
import type { FastifyPluginCallback } from "fastify";
import { z } from "zod";

const prisma = new PrismaClient();

const Species = z.enum(["DOG", "CAT", "HORSE"]);
const PutAnimalBreeds = z.object({
  primaryBreedId: z.string().nullish(),
  species: Species,
  canonical: z.array(z.object({
    breedId: z.string(),
    percentage: z.number().min(0).max(100),
  })).default([]),
  custom: z.array(z.object({
    customBreedId: z.number().int().positive(),
    percentage: z.number().min(0).max(100),
  })).default([]),
});

function requireOrgId(h: any): number {
  const raw = (h["x-org-id"] ?? h["X-Org-Id"] ?? "").toString().trim();
  if (!raw) throw new Error("X-Org-Id required");
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error("X-Org-Id must be numeric");
  return n;
}


/* -------------------------------------------------------------
 * Sort helper: e.g., "name" or "-createdAt,sex"
 * -----------------------------------------------------------*/
function buildOrderBy(sort?: string) {
  if (!sort) return [{ createdAt: "desc" as const }];
  const parts = sort.split(",").map((s) => s.trim()).filter(Boolean);

  const sortable = new Set([
    "name",
    "callName",
    "sex",
    "species",   // scalar enum on Animal
    "status",
    "createdAt",
    "updatedAt",
    "birthDate",
  ]);

  const orderBy: any[] = [];
  for (const p of parts) {
    const desc = p.startsWith("-");
    const key = p.replace(/^-/, "");
    if (sortable.has(key)) orderBy.push({ [key]: (desc ? "desc" : "asc") as const });
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" as const }];
}


/* -------------------------------------------------------------
 * Search helper (enum-aware)
 * -----------------------------------------------------------*/
const SPECIES_LABELS = new Map([
  ["dog", "DOG"],
  ["cat", "CAT"],
  ["horse", "HORSE"],
]);
const SEX_LABELS = new Map([
  ["male", "MALE"],
  ["female", "FEMALE"],
]);
const STATUS_LABELS = new Map([
  ["active", "ACTIVE"],
  ["unavailable", "UNAVAILABLE"],
  ["retired", "RETIRED"],
  ["deceased", "DECEASED"],
  ["prospect", "PROSPECT"],
]);

function buildWhere(q?: string) {
  if (!q) return {};
  const ql = q.trim().toLowerCase();

  const species = SPECIES_LABELS.get(ql);
  const sex = SEX_LABELS.get(ql);
  const status = STATUS_LABELS.get(ql);

  const OR: any[] = [
    { name: { contains: q, mode: "insensitive" } },
    { callName: { contains: q, mode: "insensitive" } },
    { color: { contains: q, mode: "insensitive" } },
    { pattern: { contains: q, mode: "insensitive" } },
    { registration: { contains: q, mode: "insensitive" } },
    { microchip: { contains: q, mode: "insensitive" } },
    { organization: { name: { contains: q, mode: "insensitive" } } },
    {
      owners: {
        some: {
          contact: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    },
    {
      tagAssignments: {
        some: { tag: { AND: [{ type: "animal" }, { name: { contains: q, mode: "insensitive" } }] } },
      },
    },
  ];

  if (species) OR.push({ species });
  if (sex) OR.push({ sex });
  if (status) OR.push({ status });

  return { OR };
}

/* -------------------------------------------------------------
 * Common include for list/get (cast once to avoid Prisma type noise)
 * -----------------------------------------------------------*/
const animalInclude = {
  organization: { select: { id: true, name: true } },
  primaryOwner: {
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
  },
  owners: {
    select: {
      role: true,
      contact: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
    },
  },
  // If your schema has a single breed relation:
  breed: { select: { id: true, name: true } },
  // If you also support multi-breed breakdowns:
  breeds: { select: { breed: { select: { id: true, name: true } }, percentage: true } },
  sire: { select: { id: true, name: true, callName: true, registration: true } },
  dam: { select: { id: true, name: true, callName: true, registration: true } },
  tagAssignments: { select: { tag: { select: { name: true, type: true } } } },
} as any;

/* -------------------------------------------------------------
 * DTO mapper
 * -----------------------------------------------------------*/
function toAnimalDTO(a: any) {
  const owners = Array.isArray(a.owners)
    ? a.owners
      .map((o: any) => ({
        id: o?.contact?.id ?? null,
        displayName:
          o?.contact?.displayName ??
          ([o?.contact?.firstName, o?.contact?.lastName].filter(Boolean).join(" ") ||
            o?.contact?.email ||
            null),
        role: o?.role ?? null,
      }))
      .filter((o: any) => o.id)
    : [];

  const multiBreeds = Array.isArray(a.breeds)
    ? a.breeds
      .map((b: any) => ({
        id: b?.breed?.id ?? null,
        name: b?.breed?.name ?? null,
        percentage: typeof b?.percentage === "number" ? b.percentage : null,
      }))
      .filter((b: any) => b.id)
    : [];

  const tagNames =
    Array.isArray(a.tagAssignments)
      ? a.tagAssignments.map((t: any) => (t?.tag?.type === "animal" ? t?.tag?.name : null)).filter(Boolean)
      : [];

  return {
    id: a.id,
    name: a.name ?? null,
    callName: a.callName ?? null,
    species: a.species ?? null,
    sex: a.sex ?? null,
    status: a.status ?? null,

    birthDate: a.birthDate ?? null,
    registration: a.registration ?? null,
    microchip: a.microchip ?? null,
    color: a.color ?? null,
    pattern: a.pattern ?? null,

    organizationId: a.organizationId ?? null,
    organizationName: a.organization?.name ?? null,

    primaryOwnerId: a.primaryOwnerId ?? null,
    primaryOwnerName:
      a.primaryOwner?.displayName ??
      ([a.primaryOwner?.firstName, a.primaryOwner?.lastName].filter(Boolean).join(" ") ||
        a.primaryOwner?.email ||
        null),

    owners,
    breed: a.breed?.name ?? null,
    breeds: multiBreeds,
    tags: tagNames,

    createdAt: a.createdAt?.toISOString?.() ?? String(a.createdAt ?? ""),
    updatedAt: a.updatedAt?.toISOString?.() ?? String(a.updatedAt ?? ""),
  };
}

/* -------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------*/
function getOrgIdFrom(req: any): number | undefined {
  const orgIdHeader = req.headers?.["x-org-id"];
  const hdr = typeof orgIdHeader === "string" ? orgIdHeader : Array.isArray(orgIdHeader) ? orgIdHeader[0] : orgIdHeader;
  const fromAuth = req.authUser?.orgId;
  const n = Number(fromAuth ?? hdr);
  return Number.isFinite(n) ? n : undefined;
}

/* -------------------------------------------------------------
 * Routes (absolute paths; register with app.register(animalsRoutes))
 * -----------------------------------------------------------*/
const animalsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // LIST — GET /api/v1/animals
  app.get("/api/v1/animals", async (req: any, reply) => {
    const orgId = getOrgIdFrom(req);
    if (!orgId) return reply.code(400).send({ error: "org_required" });

    const qp = req.query as any;
    const q = (qp?.q ?? "").trim() || undefined;
    const limit = Math.max(0, Math.min(100, Number(qp?.limit ?? 25)));
    const page = Math.max(1, Number(qp?.page ?? 1));
    const offset = qp?.offset != null ? Math.max(0, Number(qp.offset)) : Math.max(0, (page - 1) * limit);
    const include_archived = String(qp?.include_archived ?? "0") === "1";
    const sort = qp?.sort as string | undefined;

    const whereBase = buildWhere(q);
    const scoped = { organizationId: orgId };
    const where = include_archived
      ? { AND: [whereBase, scoped] }
      : { AND: [whereBase, scoped, { archived: { not: true } }] };

    const [itemsRaw, total] = await Promise.all([
      prisma.animal.findMany({
        where,
        include: animalInclude,
        orderBy: buildOrderBy(sort),
        take: limit || undefined,
        skip: offset || undefined,
      }),
      prisma.animal.count({ where }),
    ]);

    reply.send({ items: itemsRaw.map(toAnimalDTO), total });
  });

  // GET ONE — GET /api/v1/animals/:id
  app.get("/api/v1/animals/:id", async (req: any, reply) => {
    const orgId = getOrgIdFrom(req);
    if (!orgId) return reply.code(400).send({ error: "org_required" });

    const { id } = req.params as { id: string };
    const animal = await prisma.animal.findFirst({
      where: { id, organizationId: orgId },
      include: animalInclude,
    });
    if (!animal) return reply.code(404).send({ message: "Not found" });
    reply.send(toAnimalDTO(animal));
  });

  // CREATE — POST /api/v1/animals
  app.post("/api/v1/animals", async (req: any, reply) => {
    const orgId = getOrgIdFrom(req);
    if (!orgId) return reply.code(400).send({ error: "org_required" });

    const body = (req.body as any) ?? {};
    const created = await prisma.animal.create({
      data: {
        name: body.name ?? null,
        callName: body.callName ?? null,
        species: body.species ?? null,
        sex: body.sex ?? null,
        status: body.status ?? null,
        birthDate: body.birthDate ?? null,
        registration: body.registration ?? null,
        microchip: body.microchip ?? null,
        color: body.color ?? null,
        pattern: body.pattern ?? null,
        notes: body.notes ?? null,

        organizationId: orgId,
        primaryOwnerId: body.primaryOwnerId ?? null,
        sireId: body.sireId ?? null,
        damId: body.damId ?? null,
        archived: false, // show up by default
      },
      include: animalInclude,
    });
    reply.code(201).send(toAnimalDTO(created));
  });

  // UPDATE — PATCH /api/v1/animals/:id
  app.patch("/api/v1/animals/:id", async (req: any, reply) => {
    const orgId = getOrgIdFrom(req);
    if (!orgId) return reply.code(400).send({ error: "org_required" });

    const { id } = req.params as { id: string };

    // ensure belongs to org
    const exists = await prisma.animal.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
    if (!exists) return reply.code(404).send({ message: "Not found" });

    const body = req.body as any;
    const data: any = {
      name: body.name ?? undefined,
      callName: body.callName ?? undefined,
      species: body.species ?? undefined,
      sex: body.sex ?? undefined,
      status: body.status ?? undefined,
      birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      registration: body.registration ?? undefined,
      microchip: body.microchip ?? undefined,
      color: body.color ?? undefined,
      pattern: body.pattern ?? undefined,
      notes: body.notes ?? undefined,
      primaryOwnerId: body.primaryOwnerId ?? undefined,
      sireId: body.sireId ?? undefined,
      damId: body.damId ?? undefined,
      breedId: body.breedId ?? undefined,
    };

    const updated = await prisma.animal.update({
      where: { id },
      data,
      include: animalInclude,
    });
    reply.send(toAnimalDTO(updated));
  });

  // ARCHIVE — POST /api/v1/animals/:id/archive
  app.post("/api/v1/animals/:id/archive", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    await prisma.animal.update({ where: { id }, data: { archived: true } });
    reply.send({ ok: true });
  });

  // RESTORE — POST /api/v1/animals/:id/restore
  app.post("/api/v1/animals/:id/restore", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    await prisma.animal.update({ where: { id }, data: { archived: false } });
    reply.send({ ok: true });
  });

  // OWNERS — GET /api/v1/animals/:id/owners
  app.get("/api/v1/animals/:id/owners", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const rows = await prisma.animalOwner.findMany({
      where: { animalId: id },
      orderBy: [{ isPrimary: "desc" }, { contactId: "asc" }],
      select: {
        contactId: true,
        percent: true,
        isPrimary: true,
        contact: { select: { displayName: true, firstName: true, lastName: true, email: true } },
      },
    });

    reply.send({
      owners: rows.map((r) => ({
        contactId: r.contactId,
        percent: r.percent,
        isPrimary: r.isPrimary,
        displayName:
          r.contact?.displayName ||
          [r.contact?.firstName, r.contact?.lastName].filter(Boolean).join(" ") ||
          r.contact?.email ||
          `Contact ${r.contactId}`,
      })),
    });
  });

  // OWNERS — PUT /api/v1/animals/:id/owners (idempotent replace)
  app.put("/api/v1/animals/:id/owners", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const owners = (req.body as any)?.owners ?? [];

    const sum = owners.reduce((a: number, o: any) => a + (typeof o.percent === "number" ? o.percent : 0), 0);
    if (sum > 100) return reply.code(400).send({ error: "Owner percents must sum to 100 or less" });

    const providedPrimaries = owners.filter((o: any) => o.isPrimary).length;
    if (providedPrimaries > 1) return reply.code(400).send({ error: "Only one primary owner allowed" });

    await prisma.$transaction(async (tx) => {
      await tx.animalOwner.deleteMany({ where: { animalId: id } });

      const next = owners.map((o: any, i: number) => ({
        animalId: id,
        contactId: Number(o.contactId), // keep numeric if Contact.id is numeric
        percent: o.percent ?? null,
        isPrimary: o.isPrimary ?? (i === 0),
      }));

      if (next.length) await tx.animalOwner.createMany({ data: next });

      const primary = next.find((n) => n.isPrimary);
      await tx.animal.update({
        where: { id },
        data: { primaryOwnerId: primary ? primary.contactId : null },
      });
    });

    reply.send({ ok: true });
  });

  // DOCUMENTS — GET /api/v1/animals/:id/documents
  app.get("/api/v1/animals/:id/documents", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const items = await prisma.animalDocument.findMany({
      where: { animalId: id },
      orderBy: { createdAt: "desc" },
    });
    reply.send({ items });
  });

  // DOCUMENTS — POST /api/v1/animals/:id/documents
  app.post("/api/v1/animals/:id/documents", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const { name, note, url } = (req.body as any) ?? {};
    const row = await prisma.animalDocument.create({
      data: { animalId: id, name, note: note ?? null, url: url ?? null },
    });
    reply.send(row);
  });

  // DOCUMENTS — DELETE /api/v1/animals/:id/documents/:docId
  app.delete("/api/v1/animals/:id/documents/:docId", async (req: any, reply) => {
    const { docId } = req.params as { docId: string };
    await prisma.animalDocument.delete({ where: { id: Number(docId) } });
    reply.send({ ok: true });
  });

  // AUDIT — GET /api/v1/animals/:id/audit
  app.get("/api/v1/animals/:id/audit", async (_req, reply) => {
    reply.send({ items: [], total: 0 });
  });

  // CYCLE DATES — GET /api/v1/animals/:id/cycle-dates
  app.get("/api/v1/animals/:id/cycle-dates", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const rows = await prisma.animalCycleDate.findMany({
      where: { animalId: id },
      orderBy: { startDate: "asc" },
    });
    reply.send({
      dates: rows.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString().slice(0, 10),
        note: r.note ?? null,
      })),
    });
  });

  // CYCLE DATES — PUT /api/v1/animals/:id/cycle-dates
  app.put("/api/v1/animals/:id/cycle-dates", async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const incoming = Array.isArray((req.body as any)?.dates) ? (req.body as any).dates : [];

    const clean = incoming
      .map((d: any) => ({ startDate: new Date(d.startDate), note: (d.note ?? null) as string | null }))
      .filter((d) => !Number.isNaN(d.startDate.valueOf()))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    await prisma.$transaction(async (tx) => {
      await tx.animalCycleDate.deleteMany({ where: { animalId: id } });
      if (clean.length) {
        await tx.animalCycleDate.createMany({
          data: clean.map((c) => ({ animalId: id, startDate: c.startDate, note: c.note })),
        });
      }
    });

    const rows = await prisma.animalCycleDate.findMany({
      where: { animalId: id },
      orderBy: { startDate: "asc" },
    });

    reply.send({
      dates: rows.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString().slice(0, 10),
        note: r.note ?? null,
      })),
    });
  });

  registerAnimalBreedUpsertRoute(app);

  done();
};

export async function registerAnimalBreedUpsertRoute(app: any) {
}
export default animalsRoutes;