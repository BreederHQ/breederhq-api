// apps/api/src/routes/breeding.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";

/* ───────────────────────── tenant resolution (plugin-scoped) ───────────────────────── */

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readCookie(rawCookie: string | undefined, name: string): string | null {
  if (!rawCookie) return null;
  const esc = name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  const m = rawCookie.match(new RegExp(`(?:^|; )${esc}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function parseBHQSessionTenant(cookieVal: string | null): number | null {
  if (!cookieVal) return null;
  try {
    const payloadB64 = cookieVal.includes(".") ? cookieVal.split(".")[1] : cookieVal; // JWT payload or raw
    // atob safe polyfill
    const jsonStr =
      typeof Buffer !== "undefined"
        ? Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
        : (globalThis as any).atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(jsonStr || "{}");
    return (
      toNum((obj as any)?.tenantId) ??
      toNum((obj as any)?.orgId) ??
      toNum((obj as any)?.tenantID) ??
      toNum((obj as any)?.tenant_id) ??
      null
    );
  } catch {
    return null;
  }
}

function resolveTenantIdFromRequest(req: any): number | null {
  // 1) Header (prefer explicit header)
  // Fastify lower-cases header names, but be defensive.
  const h = req.headers || {};
  const headerTenant =
    toNum(h["x-tenant-id"]) ??
    toNum(h["X-Tenant-Id"]) ??
    toNum(h["x-tenantid"]) ??
    null;
  if (headerTenant) return headerTenant;

  // 2) Cookie (supports JWT or plain base64 JSON)
  const cookieHeader: string | undefined = (req.headers?.cookie as string | undefined) ?? undefined;
  const bhq = readCookie(cookieHeader, "bhq_s");
  const cookieTenant = parseBHQSessionTenant(bhq);
  if (cookieTenant) return cookieTenant;

  // 3) Common server session/user shapes
  const fromReq =
    toNum(req.tenantId) ??
    toNum(req.session?.tenantId) ??
    toNum(req.user?.tenantId) ??
    toNum(req.user?.defaultTenantId) ??
    null;
  if (fromReq) return fromReq;

  // 4) Arrays of memberships (pick a sensible default if present)
  const memberships =
    req.user?.memberships ||
    req.user?.tenantMemberships ||
    req.session?.memberships ||
    [];
  if (Array.isArray(memberships) && memberships.length) {
    // Prefer default/primary/owner if present
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

  // accept common boolean-ish flags too
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
  const wantsWaitlist = has("waitlist") || has("reservations"); // back-compat

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
  };
}

/* ───────────────────────── normalization ───────────────────────── */

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function mapLegacyDates(body: any) {
  // expected → placement (legacy "GoHome" keys)
  if (body.expectedGoHome !== undefined && body.expectedPlacementStart === undefined) {
    body.expectedPlacementStart = body.expectedGoHome;
  }
  if (body.expectedGoHomeExtendedEnd !== undefined && body.expectedPlacementCompleted === undefined) {
    body.expectedPlacementCompleted = body.expectedGoHomeExtendedEnd;
  }
  // locked → placement
  if (body.lockedGoHomeDate !== undefined && body.lockedPlacementStartDate === undefined) {
    body.lockedPlacementStartDate = body.lockedGoHomeDate;
  }
  // actuals → placement
  if (body.goHomeDateActual !== undefined && body.placementStartDateActual === undefined) {
    body.placementStartDateActual = body.goHomeDateActual;
  }
  if (body.lastGoHomeDateActual !== undefined && body.placementCompletedDateActual === undefined) {
    body.placementCompletedDateActual = body.lastGoHomeDateActual;
  }
  // expectedDue → expectedBirthDate
  if (body.expectedDue !== undefined && body.expectedBirthDate === undefined) {
    body.expectedBirthDate = body.expectedDue;
  }
  // very old "whelp" aliases
  if (body.whelpDateActual !== undefined && body.birthDateActual === undefined) {
    body.birthDateActual = body.whelpDateActual;
  }
  if (body.expectedWhelpDate !== undefined && body.expectedBirthDate === undefined) {
    body.expectedBirthDate = body.expectedWhelpDate;
  }
  return body;
}

function validateAndNormalizeLockPayload(body: any) {
  mapLegacyDates(body);

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
    : "TBD";

  const base = `PLN-${damFirst}-${commitYmd}-${dueYmd}`;

  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
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

/* ───────────────────────── routes ───────────────────────── */

const breedingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Enforce tenant context for all routes in this plugin
  app.addHook("preHandler", async (req, reply) => {
    // Already set by upstream middleware? keep it.
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

  app.post("/breeding/plans", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);

      const b = mapLegacyDates((req.body || {}) as any);

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

      const damId = idNum(b.damId);
      if (!damId) return reply.code(400).send({ error: "damId_required" });

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
        code: b.code ?? null,
        name,
        nickname: b.nickname ?? null,
        species: b.species,
        breedText: b.breedText ?? null,
        damId,
        sireId: b.sireId ?? null,

        lockedCycleKey: b.lockedCycleKey ?? null,
        lockedCycleStart: lockNorm.touched
          ? lockNorm.lockedCycleStart
          : b.lockedCycleStart
          ? new Date(b.lockedCycleStart)
          : null,
        lockedOvulationDate: lockNorm.touched
          ? lockNorm.lockedOvulationDate
          : b.lockedOvulationDate
          ? new Date(b.lockedOvulationDate)
          : null,
        lockedDueDate: lockNorm.touched
          ? lockNorm.lockedDueDate
          : b.lockedDueDate
          ? new Date(b.lockedDueDate)
          : null,
        lockedPlacementStartDate: lockNorm.touched
          ? lockNorm.lockedPlacementStartDate
          : b.lockedPlacementStartDate
          ? new Date(b.lockedPlacementStartDate)
          : null,

        expectedCycleStart: b.expectedCycleStart ? new Date(b.expectedCycleStart) : null,
        expectedHormoneTestingStart: b.expectedHormoneTestingStart ? new Date(b.expectedHormoneTestingStart) : null,
        expectedBreedDate: b.expectedBreedDate ? new Date(b.expectedBreedDate) : null,
        expectedBirthDate: b.expectedBirthDate
          ? new Date(b.expectedBirthDate)
          : lockNorm.touched && lockNorm.lockedDueDate
          ? lockNorm.lockedDueDate
          : null,
        expectedPlacementStart: b.expectedPlacementStart
          ? new Date(b.expectedPlacementStart)
          : lockNorm.touched && lockNorm.lockedPlacementStartDate
          ? lockNorm.lockedPlacementStartDate
          : null,
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
      const created = await prisma.$transaction(async (tx) => {
        const plan = await tx.breedingPlan.create({ data });

        const lockedOnCreate =
          lockNorm.touched &&
          lockNorm.lockedCycleStart &&
          lockNorm.lockedOvulationDate &&
          lockNorm.lockedDueDate &&
          lockNorm.lockedPlacementStartDate;

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
                lockedCycleStart: lockNorm.lockedCycleStart,
                lockedOvulationDate: lockNorm.lockedOvulationDate,
                lockedDueDate: lockNorm.lockedDueDate,
                lockedPlacementStartDate: lockNorm.lockedPlacementStartDate,
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

      reply.code(201).send(created);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.patch("/breeding/plans/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingPlan.findFirst({
        where: { id, tenantId },
        select: { species: true, code: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const raw = (req.body || {}) as any;
      const b = mapLegacyDates(raw);
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

      if (b.status !== undefined) {
        const s = normalizePlanStatus(b.status);
        if (!s) return reply.code(400).send({ error: "bad_status" });
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
          }
        }
      } catch (e) {
        const { status, payload } = errorReply(e);
        return reply.status(status).send(payload);
      }

      const updated = await prisma.breedingPlan.update({ where: { id }, data });
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

      const updated = await prisma.$transaction(async (tx) => {
        let code = plan.code;
        if (!code) {
          code = await buildFriendlyPlanCode(plan.tenantId, plan.id);
        }

        const expectedBirthDate = plan.expectedBirthDate ?? plan.lockedDueDate ?? null;
        const expectedPlacementStart =
          plan.expectedPlacementStart ?? plan.lockedPlacementStartDate ?? null;

        const saved = await tx.breedingPlan.update({
          where: { id: plan.id },
          data: {
            code,
            status: Prisma.BreedingPlanStatus.COMMITTED,
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

        return saved;
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  app.post("/breeding/plans/:id/archive", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
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

  app.post("/breeding/plans/:id/restore", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
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
        b.placementStartDate ?? b.goHomeDate ?? null; // legacy acceptor

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
};

export default breedingRoutes;
