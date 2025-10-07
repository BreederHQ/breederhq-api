// src/routes/breeding.ts
import type { FastifyPluginCallback } from "fastify";
import prisma from "../prisma.js";

/** ---------- Sort + Paging helpers ---------- */
function buildOrderBy(sort?: string) {
  if (!sort) return [{ createdAt: "desc" as const }];
  const parts = sort.split(",").map(s => s.trim()).filter(Boolean);
  const orderBy: any[] = [];
  for (const p of parts) {
    const dir = p.startsWith("-") ? "desc" : "asc";
    const key = p.replace(/^-/, "");
    if (["name","species","status","expectedDueDate","createdAt","updatedAt","id"].includes(key)) {
      orderBy.push({ [key]: dir });
    }
  }
  return orderBy.length ? orderBy : [{ createdAt: "desc" as const }];
}

function clamp(n: any, d = 25, min = 1, max = 200) {
  const v = Math.floor(Number(n ?? d));
  return Math.min(Math.max(isFinite(v) ? v : d, min), max);
}

/** ---------- Include map (adjust names if your schema differs) ---------- */
const planInclude = {
  dam:   { select: { id: true, name: true, callName: true, species: true, breed: true } }, // female
  sire:  { select: { id: true, name: true, callName: true, species: true, breed: true } }, // male
  organization: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { name: true } } } }, // TagAssignment -> Tag
};

/** ---------- DTO mapping: Prisma → PlanDTO ---------- */
function labelAnimal(a: any) {
  if (!a) return null;
  const n = a.name ?? a.callName ?? null;
  const b = a.breed ?? null;
  return n && b ? `${n} - ${b}` : n ?? b ?? null;
}

function toPlanDTO(p: any) {
  const locked = p.lockedCycle ?? p.cycle ?? null;

  const deposits_committed_cents =
    typeof p.deposits_committed_cents === "number" ? p.deposits_committed_cents : 0;
  const deposits_paid_cents =
    typeof p.deposits_paid_cents === "number" ? p.deposits_paid_cents : 0;
  const deposit_risk_score =
    deposits_committed_cents > 0
      ? Math.round((1 - Math.min(1, deposits_paid_cents / deposits_committed_cents)) * 100)
      : null;

  return {
    // Identity
    id: p.id,
    name: p.name ?? p.title ?? null,
    code: p.code ?? p.planCode ?? null,
    nickname: p.nickname ?? null,

    // Species, breed
    species: p.species ?? p.dam?.species ?? p.sire?.species ?? null,
    breed: p.breed ?? null,

    // Pair
    damId: p.damId ?? null,
    sireId: p.sireId ?? null,
    female: p.female ?? p.dam ?? null,
    male: p.male ?? p.sire ?? null,
    femaleLabel: labelAnimal(p.dam) ?? null,
    maleLabel: labelAnimal(p.sire) ?? null,

    // Dates and cycle lock (all nullable)
    expected_due: p.expectedDueDate ?? p.expected_due ?? null,
    lockedCycle: locked
      ? {
          key: locked.key ?? null,
          cycleStart: locked.cycleStart ?? locked.start ?? null,
          ovulation: locked.ovulation ?? locked.ov ?? null,
          due: locked.due ?? null,
          goHome: locked.goHome ?? locked.release ?? null,
        }
      : null,

    // Status and planning
    status: p.status ?? null,
    riskLevel: p.riskLevel ?? null,
    priority: typeof p.priority === "number" ? p.priority : null,

    // Money and deposits
    deposits_committed_cents,
    deposits_paid_cents,
    deposit_risk_score,

    // Org and tags
    organizationId: p.organizationId ?? null,
    organizationName: p.organization?.name ?? null,
    organization: p.organization ? { id: p.organization.id, name: p.organization.name ?? null } : null,
    tags: Array.isArray(p.tags) ? p.tags.map((t: any) => t?.tag?.name).filter(Boolean) : [],

    // Notes and misc
    notes: p.notes ?? null,
    planKey: p.planKey ?? null,

    // Timestamps
    createdAt: p.createdAt?.toISOString?.() ?? String(p.createdAt ?? ""),
    updatedAt: p.updatedAt?.toISOString?.() ?? String(p.updatedAt ?? ""),
  };
}

/** ---------- Search filter ---------- */
function buildWhere(q?: string) {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { nickname: { contains: q, mode: "insensitive" } },
      { species: { contains: q, mode: "insensitive" } },
      { status: { contains: q, mode: "insensitive" } },
      { organization: { name: { contains: q, mode: "insensitive" } } },
      { dam: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { callName: { contains: q, mode: "insensitive" } },
          { breed: { contains: q, mode: "insensitive" } },
        ],
      }},
      { sire: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { callName: { contains: q, mode: "insensitive" } },
          { breed: { contains: q, mode: "insensitive" } },
        ],
      }},
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
    ],
  };
}

/** ---------- Routes ---------- */
const breedingRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // GET /api/v1/breeding/plans — table view
  app.get("/breeding/plans", async (req, reply) => {
    const qp = req.query as any;
    const q = qp?.q as string | undefined;
    const limit  = clamp(qp?.limit, 25, 1, 200);
    const offset = Math.max(0, Number(qp?.offset ?? 0));
    const sort   = qp?.sort as string | undefined;

    const where = buildWhere(q);

    const [rows, total] = await Promise.all([
      prisma.breedingPlan.findMany({
        where,
        include: planInclude as any,
        orderBy: buildOrderBy(sort),
        take: limit || undefined,
        skip: offset || undefined,
      }),
      prisma.breedingPlan.count({ where }),
    ]);

    reply.send({ items: rows.map(toPlanDTO), total });
  });

  // GET /api/v1/breeding/plans/:id — drawer hydration
  app.get("/breeding/plans/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.breedingPlan.findUnique({
      where: { id },
      include: planInclude as any,
    });
    if (!plan) return reply.code(404).send({ message: "Not found" });
    reply.send(toPlanDTO(plan));
  });

  // POST /api/v1/breeding/plans — minimal create, returns DTO
  app.post("/breeding/plans", async (req, reply) => {
    const token = req.headers["x-admin-token"];
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const b = (req.body as any) ?? {};
    const created = await prisma.breedingPlan.create({
      data: {
        name: b.name ?? null,
        code: b.code ?? null,
        nickname: b.nickname ?? null,
        species: b.species ?? null,
        breed: b.breed ?? null,
        damId: b.damId ?? null,
        sireId: b.sireId ?? null,
        expectedDueDate: b.expected_due ?? b.expectedDueDate ?? null,
        status: b.status ?? null,
        riskLevel: b.riskLevel ?? null,
        deposits_committed_cents:
          typeof b.deposits_committed_cents === "number" ? b.deposits_committed_cents : 0,
        deposits_paid_cents:
          typeof b.deposits_paid_cents === "number" ? b.deposits_paid_cents : 0,
        organizationId: b.organizationId ?? null,
        planKey: b.planKey ?? null,
        // If you store lockedCycle as JSON, allow pass-through:
        lockedCycle: b.lockedCycle ?? null,
      },
      include: planInclude as any,
    });
    reply.code(201).send(toPlanDTO(created));
  });

  done();
};

export default breedingRoutes;
