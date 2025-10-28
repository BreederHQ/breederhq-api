import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
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
  return {
    Litter: has("litter") ? true : false,
    Reservations: has("reservations") ? true : false,
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

function errorReply(err: any) {
  if (err?.code === "P2002") {
    return { status: 409, payload: { error: "duplicate", detail: err?.meta?.target || undefined } };
  }
  if (err?.code === "P2003") {
    return { status: 409, payload: { error: "foreign_key_conflict" } };
  }
  if (err?.statusCode) return { status: err.statusCode, payload: { error: err.message } };
  return { status: 500, payload: { error: "internal_error" } };
}

/** Generate a tenant-unique, user-friendly plan code.
 * Pattern: PLN-YYYY-00001 (based on plan id)
 * - You can later swap this to include org slug or a per-tenant sequence.
 */
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
  const damFirst = String(plan?.dam?.name || "")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12) || "DAM";

  const commitYmd = ymd(new Date());
  const dueYmd = plan?.lockedDueDate ? ymd(new Date(plan.lockedDueDate)) :
    plan?.expectedDue ? ymd(new Date(plan.expectedDue)) : "TBD";

  const base = `PLN-${damFirst}-${commitYmd}-${dueYmd}`;

  // ensure tenant-unique by suffixing on collision
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (await prisma.breedingPlan.findFirst({ where: { tenantId, code: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

/** Attempt to set a unique code, retrying with a suffix on collision. */
async function generatePlanCode(opts: { planId: number; tenantId: number; codeHint?: string | null }) {
  const base = String(opts.codeHint || buildCodeFromId(opts.planId)).toUpperCase().replace(/\s+/g, "");
  const tryCodes = [base];
  // up to 5 suffix attempts if uniqueness fails
  for (let i = 2; i <= 6; i++) tryCodes.push(`${base}-${i}`);

  for (const code of tryCodes) {
    try {
      const updated = await prisma.breedingPlan.update({
        where: { id: opts.planId },
        data: { code },
      });
      return updated.code!;
    } catch (err: any) {
      if (err?.code === "P2002") continue; // unique violation → try next suffix
      throw err; // other errors bubble up
    }
  }
  throw Object.assign(new Error("could_not_assign_unique_code"), { statusCode: 409 });
}

/* ───────────────────────── routes ───────────────────────── */

const breedingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /* ───────────── Breeding Plans ───────────── */

  // GET /breeding/plans?status=&damId=&sireId=&q=&include=&page=&limit=
  app.get("/breeding/plans", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const q = (req.query || {}) as Partial<{
        status: string;
        damId: string;
        sireId: string;
        q: string;
        include: string;
        page: string;
        limit: string;
      }>;

      const where: any = { tenantId, archived: false };
      if (q.status) where.status = q.status;
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

  // GET /breeding/plans/:id?include=
  app.get("/breeding/plans/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

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

  // POST /breeding/plans
  app.post("/breeding/plans", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const b = (req.body || {}) as any;
      const name = String(b.name || "").trim();
      if (!name) return reply.code(400).send({ error: "name_required" });
      if (!b.species) return reply.code(400).send({ error: "species_required" });
      const damId = idNum(b.damId);
      if (!damId) return reply.code(400).send({ error: "damId_required" });

      const dam = await prisma.animal.findFirst({ where: { id: damId, tenantId }, select: { species: true } });
      if (!dam) return reply.code(400).send({ error: "dam_not_found" });
      if (String(dam.species) !== String(b.species)) return reply.code(400).send({ error: "dam_species_mismatch" });
      if (b.sireId) {
        const sire = await prisma.animal.findFirst({ where: { id: Number(b.sireId), tenantId }, select: { species: true } });
        if (!sire) return reply.code(400).send({ error: "sire_not_found" });
        if (String(sire.species) !== String(b.species)) return reply.code(400).send({ error: "sire_species_mismatch" });
      }

      const created = await prisma.breedingPlan.create({
        data: {
          tenantId,
          organizationId: b.organizationId ?? null,
          code: b.code ?? null,
          name,
          nickname: b.nickname ?? null,
          species: b.species,
          breedText: b.breedText ?? null,
          damId,
          sireId: b.sireId ?? null,
          lockedCycleKey: b.lockedCycleKey ?? null,
          lockedCycleStart: b.lockedCycleStart ? new Date(b.lockedCycleStart) : null,
          lockedOvulationDate: b.lockedOvulationDate ? new Date(b.lockedOvulationDate) : null,
          lockedDueDate: b.lockedDueDate ? new Date(b.lockedDueDate) : null,
          lockedGoHomeDate: b.lockedGoHomeDate ? new Date(b.lockedGoHomeDate) : null,
          expectedDue: b.expectedDue ? new Date(b.expectedDue) : null,
          expectedGoHome: b.expectedGoHome ? new Date(b.expectedGoHome) : null,
          breedDateActual: b.breedDateActual ? new Date(b.breedDateActual) : null,
          birthDateActual: b.birthDateActual ? new Date(b.birthDateActual) : null,
          weanedDateActual: b.weanedDateActual ? new Date(b.weanedDateActual) : null,
          goHomeDateActual: b.goHomeDateActual ? new Date(b.goHomeDateActual) : null,
          lastGoHomeDateActual: b.lastGoHomeDateActual ? new Date(b.lastGoHomeDateActual) : null,
          status: b.status ?? "PLANNING",
          notes: b.notes ?? null,
          depositsCommittedCents: b.depositsCommittedCents ?? null,
          depositsPaidCents: b.depositsPaidCents ?? null,
          depositRiskScore: b.depositRiskScore ?? null,
        },
      });

      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // PATCH /breeding/plans/:id
  app.patch("/breeding/plans/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { species: true, code: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};

      if (b.name !== undefined) {
        const n = String(b.name || "").trim();
        if (!n) return reply.code(400).send({ error: "name_required" });
        data.name = n;
      }
      if (b.organizationId !== undefined) data.organizationId = b.organizationId;

      // IMMUTABLE CODE: once set, it cannot change
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

      // parent/species checks if any of dam/sire/species change
      const targetSpecies = (b.species ?? existing.species) as string;
      if (b.damId !== undefined) {
        const damId = idNum(b.damId);
        if (!damId) return reply.code(400).send({ error: "bad_damId" });
        const dam = await prisma.animal.findFirst({ where: { id: damId, tenantId }, select: { species: true } });
        if (!dam) return reply.code(400).send({ error: "dam_not_found" });
        if (String(dam.species) !== String(targetSpecies)) return reply.code(400).send({ error: "dam_species_mismatch" });
        data.damId = damId;
      }
      if (b.sireId !== undefined) {
        if (b.sireId === null) data.sireId = null;
        else {
          const sireId = idNum(b.sireId);
          if (!sireId) return reply.code(400).send({ error: "bad_sireId" });
          const sire = await prisma.animal.findFirst({ where: { id: sireId, tenantId }, select: { species: true } });
          if (!sire) return reply.code(400).send({ error: "sire_not_found" });
          if (String(sire.species) !== String(targetSpecies)) return reply.code(400).send({ error: "sire_species_mismatch" });
          data.sireId = sireId;
        }
      }

      const dateKeys = [
        "lockedCycleStart",
        "lockedOvulationDate",
        "lockedDueDate",
        "lockedGoHomeDate",
        "expectedDue",
        "expectedGoHome",
        "breedDateActual",
        "birthDateActual",
        "weanedDateActual",
        "goHomeDateActual",
        "lastGoHomeDateActual",
      ];
      for (const k of dateKeys) {
        if (b[k] !== undefined) data[k] = b[k] ? new Date(b[k]) : null;
      }

      const passthrough = [
        "breedText",
        "lockedCycleKey",
        "status",
        "notes",
        "depositsCommittedCents",
        "depositsPaidCents",
        "depositRiskScore",
        "archived",
      ];
      for (const k of passthrough) if (b[k] !== undefined) data[k] = b[k];

      const updated = await prisma.breedingPlan.update({ where: { id }, data });
      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });


  // POST /breeding/plans/:id/commit  ← server-side commit + immutable code
  app.post("/breeding/plans/:id/commit", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as Partial<{ codeHint: string }>;

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
          expectedDue: true,
          expectedGoHome: true,
          lockedDueDate: true,
          lockedGoHomeDate: true,
        },
      });
      if (!plan) return reply.code(404).send({ error: "not_found" });

      // validate commit preconditions
      const terminalStatuses = ["BRED", "PREGNANT", "WHELPED", "WEANED", "HOMING_STARTED", "COMPLETE", "CANCELED", "COMMITTED"];
      if (terminalStatuses.includes(String(plan.status))) {
        return reply.code(409).send({ error: "already_in_terminal_state" });
      }
      if (!plan.damId || !plan.sireId || !plan.lockedCycleStart) {
        return reply.code(400).send({ error: "dam_sire_lockedCycle_required" });
      }

      // do commit in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        // 1) set code if missing (immutable thereafter)
        let code = plan.code;
        if (!code) {
          code = await buildFriendlyPlanCode(plan.tenantId, plan.id);
        }

        // 2) ensure expected dates are set from locked if missing
        const expectedDue = plan.expectedDue ?? plan.lockedDueDate ?? null;
        const expectedGoHome = plan.expectedGoHome ?? plan.lockedGoHomeDate ?? null;

        // 3) flip status → COMMITTED (requires enum migration below)
        const saved = await tx.breedingPlan.update({
          where: { id: plan.id },
          data: {
            code,
            status: "COMMITTED" as any, // add to enum in schema (see below)
            expectedDue,
            expectedGoHome,
            committedAt: new Date(),     // add field in schema (see below)
          },
        });
        return saved;
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/archive
  app.post("/breeding/plans/:id/archive", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(id, tenantId);
      await prisma.breedingPlan.update({ where: { id }, data: { archived: true } });
      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // POST /breeding/plans/:id/restore
  app.post("/breeding/plans/:id/restore", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      await getPlanInTenant(id, tenantId);
      await prisma.breedingPlan.update({ where: { id }, data: { archived: false } });
      reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────────── Reproductive Cycles (unchanged) ───────────── */

  app.get("/breeding/cycles", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

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
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const b = (req.body || {}) as any;
      const femaleId = idNum(b.femaleId);
      if (!femaleId) return reply.code(400).send({ error: "femaleId_required" });
      if (!b.cycleStart) return reply.code(400).send({ error: "cycleStart_required" });

      const female = await prisma.animal.findFirst({ where: { id: femaleId, tenantId }, select: { id: true } });
      if (!female) return reply.code(400).send({ error: "female_not_found" });

      const created = await prisma.reproductiveCycle.create({
        data: {
          tenantId,
          femaleId,
          cycleStart: new Date(b.cycleStart),
          ovulation: b.ovulation ? new Date(b.ovulation) : null,
          dueDate: b.dueDate ? new Date(b.dueDate) : null,
          goHomeDate: b.goHomeDate ? new Date(b.goHomeDate) : null,
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
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const exists = await prisma.reproductiveCycle.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: "not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};
      if (b.femaleId !== undefined) {
        if (b.femaleId === null) data.femaleId = null;
        else {
          const fid = idNum(b.femaleId);
          if (!fid) return reply.code(400).send({ error: "bad_femaleId" });
          const f = await prisma.animal.findFirst({ where: { id: fid, tenantId }, select: { id: true } });
          if (!f) return reply.code(400).send({ error: "female_not_found" });
          data.femaleId = fid;
        }
      }
      for (const k of ["cycleStart", "ovulation", "dueDate", "goHomeDate"] as const) {
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

  /* ───────────── Events / Tests / Attempts / Pregnancy Checks / etc. (unchanged) ───────────── */

  app.get("/breeding/plans/:id/events", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
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
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.type || !b.occurredAt) return reply.code(400).send({ error: "type_and_occurredAt_required" });

      await getPlanInTenant(planId, tenantId);
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
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
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
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
      const planId = idNum((req.params as any).id);
      if (!planId) return reply.code(400).send({ error: "bad_id" });

      const b = (req.body || {}) as any;
      if (!b.method) return reply.code(400).send({ error: "method_required" });

      await getPlanInTenant(planId, tenantId);
      if (b.studOwnerContactId) {
        const c = await prisma.contact.findFirst({ where: { id: Number(b.studOwnerContactId), tenantId }, select: { id: true } });
        if (!c) return reply.code(400).send({ error: "stud_owner_contact_not_in_tenant" });
      }

      const created = await prisma.breedingAttempt.create({
        data: {
          tenantId,
          planId,
          method: b.method,
          attemptAt: b.attemptAt ? new Date(b.attemptAt) : null,
          windowStart: b.windowStart ? new Date(b.windowStart) : null,
          windowEnd: b.windowEnd ? new Date(b.windowEnd) : null,
          studOwnerContactId: b.studOwnerContactId ?? null,
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
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });
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

  /* ───────────── Litter / Reservations / Attachments / Shares / Parties (unchanged) ───────────── */

  // ... (your existing litter/reservation/attachment/share/party routes remain unchanged)
};

export default breedingRoutes;
