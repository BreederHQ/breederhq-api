// src/routes/tenant.ts
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import prisma from "../prisma.js";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getActorId } from "../utils/session.js";

/* ───────────────────────── helpers ───────────────────────── */

type SortKey = "name" | "slug" | "createdAt" | "updatedAt";
const ALLOWED_SORT: SortKey[] = ["name", "slug", "createdAt", "updatedAt"];

function b64url(bytes: Buffer) {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeRawToken(nBytes = 32) {
  return b64url(crypto.randomBytes(nBytes));
}
function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw, "utf8").digest("base64url");
}
function inviteIdentifier(
  tenantId: number,
  emailLower: string,
  role: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER" = "MEMBER"
) {
  return `invite:t=${tenantId};e=${emailLower};r=${role}`;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseSort(sortParam?: string) {
  if (!sortParam) return undefined as undefined | { [k in SortKey]?: "asc" | "desc" }[];
  const parts = String(sortParam)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const orderBy: { [k in SortKey]?: "asc" | "desc" }[] = [];
  for (const p of parts) {
    const dir: "asc" | "desc" = p.startsWith("-") ? "desc" : "asc";
    const key = p.replace(/^-/, "") as SortKey;
    if (ALLOWED_SORT.includes(key)) {
      orderBy.push({ [key]: dir } as any);
    }
  }
  return orderBy.length ? orderBy : undefined;
}

function errorReply(err: unknown) {
  const any = err as any;
  const code = any?.code;
  if (code === "P2002") return { status: 409, payload: { error: "conflict", detail: "Unique constraint violation" } };
  if (code === "P2025") return { status: 404, payload: { error: "not_found" } };
  return { status: 500, payload: { error: "internal_error", detail: any?.message || "Unexpected error" } };
}

// Session verification is now imported from utils/session.js
async function requireSuperAdmin(req: any, reply: any) {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
  if (!actor?.isSuperAdmin) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return actorId;
}

/** Availability prefs shape stored on Tenant.availabilityPrefs */
type AvailabilityPrefs = {
  testing_risky_from_full_start: number;
  testing_risky_to_full_end: number;
  testing_unlikely_from_likely_start: number;
  testing_unlikely_to_likely_end: number;
  post_risky_from_full_start: number;
  post_risky_to_full_end: number;
  post_unlikely_from_likely_start: number;
  post_unlikely_to_likely_end: number;
};

const DEFAULT_AVAILABILITY_PREFS: AvailabilityPrefs = {
  testing_risky_from_full_start: 0,
  testing_risky_to_full_end: 0,
  testing_unlikely_from_likely_start: 0,
  testing_unlikely_to_likely_end: 0,
  post_risky_from_full_start: 0,
  post_risky_to_full_end: 0,
  post_unlikely_from_likely_start: 0,
  post_unlikely_to_likely_end: 0,
};

const normEmail = (v?: string | null) => String(v || "").trim().toLowerCase();

/** Shape returned to Admin UI */
function tenantDTO(t: any) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug ?? null,
    primaryEmail: t.primaryEmail ?? null,
    usersCount: t.usersCount ?? 0,
    organizationsCount: t.organizationsCount ?? 0,
    contactsCount: t.contactsCount ?? 0,
    animalsCount: t.animalsCount ?? 0,
    billing: t.billing
      ? {
          provider: t.billing.provider ?? null,
          customerId: t.billing.customerId ?? null,
          subscriptionId: t.billing.subscriptionId ?? null,
          plan: t.billing.plan ?? null,
          status: t.billing.status ?? null,
          currentPeriodEnd: t.billing.currentPeriodEnd ?? null,
          createdAt: t.billing.createdAt ?? null,
          updatedAt: t.billing.updatedAt ?? null,
        }
      : null,
    plan: t.billing?.plan ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** Build count maps with single queries to avoid N+1 */
async function buildCountMaps(tenantIds: number[]) {
  if (!tenantIds.length) {
    return {
      users: new Map<number, number>(),
      orgs: new Map<number, number>(),
      contacts: new Map<number, number>(),
      animals: new Map<number, number>(),
    };
  }

  const [m, o, c, a] = await Promise.all([
    prisma.tenantMembership.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: tenantIds } },
      _count: { _all: true },
    }),
    prisma.organization.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: tenantIds } },
      _count: { _all: true },
    }),
    prisma.contact.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: tenantIds } },
      _count: { _all: true },
    }),
    prisma.animal.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: tenantIds } },
      _count: { _all: true },
    }),
  ]);

  const asMap = (rows: { tenantId: number; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.tenantId, r._count._all]));

  return {
    users: asMap(m),
    orgs: asMap(o),
    contacts: asMap(c),
    animals: asMap(a),
  };
}

/* ───────────────────────── settings helpers (new) ───────────────────────── */

const BREEDING_NS = "breeding";

/** Minimal program defaults; extend as needed in app code */
const DEFAULT_BREEDING_PROGRAM = {
  program: {
    defaultMethod: "NATURAL",
    codeFormat: "YYYY-SEQ3",
    weaningWeeks: 8,
    placementPolicy: "AFTER_WEANED",
  },
  cycleHeuristics: {
    gestationDays: 63,
    weanDays: 56,
    placementStartOffsetDays: 60,
  },
};

async function requireTenantMemberOrAdmin(req: any, tenantId: number) {
  const actorId = getActorId(req);
  if (!actorId) return { ok: false as const, code: 401 as const };
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
  if (user?.isSuperAdmin) return { ok: true as const, role: "OWNER" as const };

  const mem = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: actorId, tenantId } },
    select: { role: true },
  });
  if (!mem) return { ok: false as const, code: 403 as const };
  return { ok: true as const, role: mem.role };
}
function isAdminLike(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

async function readTenantSetting(tenantId: number, namespace: string, fallback: any) {
  const row = await prisma.tenantSetting.findUnique({
    where: { tenantId_namespace: { tenantId, namespace } },
    select: { data: true, version: true, updatedAt: true, updatedBy: true },
  });
  if (!row) return { data: fallback, version: 1, updatedAt: null as Date | null, updatedBy: null as string | null };
  return { data: row.data ?? fallback, version: row.version, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
}
async function writeTenantSetting(tenantId: number, namespace: string, data: any, userId: string | null) {
  const row = await prisma.tenantSetting.upsert({
    where: { tenantId_namespace: { tenantId, namespace } },
    update: { data, version: { increment: 1 }, updatedBy: userId ?? undefined },
    create: { tenantId, namespace, data, version: 1, updatedBy: userId ?? undefined },
    select: { data: true, version: true, updatedAt: true, updatedBy: true },
  });
  return row;
}

/* ───────────────────────── routes (plugin) ───────────────────────── */

const tenantRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** GET /tenants/:id/availability */
  fastify.get<{ Params: { id: string } }>("/tenants/:id/availability", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const t = await prisma.tenant.findUnique({
        where: { id },
        select: { availabilityPrefs: true },
      });
      return reply.send(t?.availabilityPrefs ?? DEFAULT_AVAILABILITY_PREFS);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** PATCH /tenants/:id/availability */
  fastify.patch<{
    Params: { id: string };
    Body: Partial<AvailabilityPrefs>;
  }>("/tenants/:id/availability", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const actorId = getActorId(req);
      if (!actorId) return reply.code(401).send({ error: "unauthorized" });
      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
      let allowed = !!actor?.isSuperAdmin;
      if (!allowed) {
        const mem = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: actorId, tenantId: id } },
          select: { role: true },
        });
        allowed = !!mem && (mem.role === "OWNER" || mem.role === "ADMIN");
      }
      if (!allowed) return reply.code(403).send({ error: "forbidden" });

      const body = req.body || {};
      if (typeof body !== "object") return reply.status(400).send({ error: "bad_request", detail: "Invalid payload" });

      const existing = await prisma.tenant.findUnique({
        where: { id },
        select: { availabilityPrefs: true },
      });

      const merged = { ...((existing?.availabilityPrefs as any) ?? DEFAULT_AVAILABILITY_PREFS), ...body };

      const updated = await prisma.tenant.update({
        where: { id },
        data: { availabilityPrefs: merged as any },
        select: { availabilityPrefs: true },
      });

      return reply.send(updated.availabilityPrefs);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** ─────────────── NEW: Breeding program settings (namespace: "breeding") ─────────────── */

  /** GET /tenants/:id/breeding-program */
  fastify.get<{ Params: { id: string } }>("/tenants/:id/breeding-program", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const gate = await requireTenantMemberOrAdmin(req, id);
      if (!gate.ok) return reply.code(gate.code).send({ error: gate.code === 401 ? "unauthorized" : "forbidden" });

      const setting = await readTenantSetting(id, BREEDING_NS, DEFAULT_BREEDING_PROGRAM);
      return reply.send(setting.data);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** PUT /tenants/:id/breeding-program (OWNER/ADMIN) */
  fastify.put<{ Params: { id: string }; Body: Record<string, any> }>(
    "/tenants/:id/breeding-program",
    async (req, reply) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

        const gate = await requireTenantMemberOrAdmin(req, id);
        if (!gate.ok) return reply.code(gate.code).send({ error: gate.code === 401 ? "unauthorized" : "forbidden" });
        if (!isAdminLike(gate.role)) return reply.code(403).send({ error: "forbidden" });

        const raw = (req.body ?? {}) as any;
        if (typeof raw !== "object") return reply.status(400).send({ error: "bad_request", detail: "Invalid payload" });

        const saved = await writeTenantSetting(id, BREEDING_NS, raw, getActorId(req));
        return reply.send(saved.data);
      } catch (err) {
        const { status, payload } = errorReply(err);
        return reply.status(status).send(payload);
      }
    }
  );

  /** ─────────────── NEW: Generic tenant settings storage ─────────────── */

  /** GET /tenants/:id/settings/:namespace */
  fastify.get<{ Params: { id: string; namespace: string } }>(
    "/tenants/:id/settings/:namespace",
    async (req, reply) => {
      try {
        const id = Number(req.params.id);
        const ns = String(req.params.namespace || "").trim();
        if (!Number.isFinite(id) || !ns) return reply.status(400).send({ error: "bad_request" });

        const gate = await requireTenantMemberOrAdmin(req, id);
        if (!gate.ok) return reply.code(gate.code).send({ error: gate.code === 401 ? "unauthorized" : "forbidden" });

        const setting = await readTenantSetting(id, ns, {});
        return reply.send(setting.data);
      } catch (err) {
        const { status, payload } = errorReply(err);
        return reply.status(status).send(payload);
      }
    }
  );

  /** PUT /tenants/:id/settings/:namespace (OWNER/ADMIN) */
  fastify.put<{ Params: { id: string; namespace: string }; Body: Record<string, any> }>(
    "/tenants/:id/settings/:namespace",
    async (req, reply) => {
      try {
        const id = Number(req.params.id);
        const ns = String(req.params.namespace || "").trim();
        if (!Number.isFinite(id) || !ns) return reply.status(400).send({ error: "bad_request" });

        const gate = await requireTenantMemberOrAdmin(req, id);
        if (!gate.ok) return reply.code(gate.code).send({ error: gate.code === 401 ? "unauthorized" : "forbidden" });
        if (!isAdminLike(gate.role)) return reply.code(403).send({ error: "forbidden" });

        const raw = (req.body ?? {}) as any;
        if (typeof raw !== "object") return reply.status(400).send({ error: "bad_request", detail: "Invalid payload" });

        const saved = await writeTenantSetting(id, ns, raw, getActorId(req));
        return reply.send(saved.data);
      } catch (err) {
        const { status, payload } = errorReply(err);
        return reply.status(status).send(payload);
      }
    }
  );

  /** GET /admin/tenants */
  fastify.get("/admin/tenants", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    try {
      const { page, limit, skip } = parsePaging((req as any).query);
      const q = (req as any).query?.q ? String((req as any).query.q) : undefined;
      const orderBy = parseSort((req as any).query?.sort);

      const where = q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { primaryEmail: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : undefined;

      const [total, itemsRaw] = await Promise.all([
        prisma.tenant.count({ where }),
        prisma.tenant.findMany({
          where,
          take: limit,
          skip,
          orderBy: orderBy ?? [{ createdAt: "desc" }],
          include: { billing: true },
        }),
      ]);

      const ids = itemsRaw.map((t) => t.id);
      const maps = await buildCountMaps(ids);

      const items = itemsRaw.map((t) =>
        tenantDTO({
          ...t,
          usersCount: maps.users.get(t.id) ?? 0,
          organizationsCount: maps.orgs.get(t.id) ?? 0,
          contactsCount: maps.contacts.get(t.id) ?? 0,
          animalsCount: maps.animals.get(t.id) ?? 0,
        })
      );

      return reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** GET /tenants */
  fastify.get("/tenants", async (req, reply) => {
    try {
      const { page, limit, skip } = parsePaging((req as any).query);
      const q = (req as any).query?.q ? String((req as any).query.q) : undefined;
      const orderBy = parseSort((req as any).query?.sort);

      const where = q
        ? {
            OR: [
              { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : undefined;

      const [total, itemsRaw] = await Promise.all([
        prisma.tenant.count({ where }),
        prisma.tenant.findMany({
          where,
          take: limit,
          skip,
          orderBy: orderBy ?? [{ createdAt: "desc" }],
          include: { billing: true },
        }),
      ]);

      const ids = itemsRaw.map((t) => t.id);
      const maps = await buildCountMaps(ids);

      const items = itemsRaw.map((t) =>
        tenantDTO({
          ...t,
          usersCount: maps.users.get(t.id) ?? 0,
          organizationsCount: maps.orgs.get(t.id) ?? 0,
          contactsCount: maps.contacts.get(t.id) ?? 0,
          animalsCount: maps.animals.get(t.id) ?? 0,
        })
      );

      return reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** GET /tenants/:id */
  fastify.get<{ Params: { id: string } }>("/tenants/:id", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const t = await prisma.tenant.findUnique({
        where: { id },
        include: { billing: true },
      });
      if (!t) return reply.status(404).send({ error: "not_found" });

      const [usersCount, organizationsCount, contactsCount, animalsCount] = await Promise.all([
        prisma.tenantMembership.count({ where: { tenantId: id } }),
        prisma.organization.count({ where: { tenantId: id } }),
        prisma.contact.count({ where: { tenantId: id } }),
        prisma.animal.count({ where: { tenantId: id } }),
      ]);

      return reply.send(
        tenantDTO({
          ...t,
          usersCount,
          organizationsCount,
          contactsCount,
          animalsCount,
        })
      );
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** PATCH /tenants/:id */
  fastify.patch<{
    Params: { id: string };
    Body: { name?: string | null; slug?: string | null; primaryEmail?: string | null };
  }>("/tenants/:id", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const { name, slug, primaryEmail } = req.body || {};
      if (name == null && slug === undefined && primaryEmail === undefined) {
        return reply.status(400).send({ error: "bad_request", detail: "No fields to update" });
      }

      const updated = await prisma.tenant.update({
        where: { id },
        data: {
          ...(name != null ? { name } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(primaryEmail !== undefined ? { primaryEmail } : {}),
        },
        include: { billing: true },
      });

      const [usersCount, organizationsCount, contactsCount, animalsCount] = await Promise.all([
        prisma.tenantMembership.count({ where: { tenantId: id } }),
        prisma.organization.count({ where: { tenantId: id } }),
        prisma.contact.count({ where: { tenantId: id } }),
        prisma.animal.count({ where: { tenantId: id } }),
      ]);

      return reply.send(
        tenantDTO({
          ...updated,
          usersCount,
          organizationsCount,
          contactsCount,
          animalsCount,
        })
      );
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** GET /tenants/:id/billing */
  fastify.get<{ Params: { id: string } }>("/tenants/:id/billing", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const billing = await prisma.billingAccount.findUnique({ where: { tenantId: id } });
      return reply.send(billing ?? null);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** PATCH /tenants/:id/billing */
  fastify.patch<{
    Params: { id: string };
    Body: {
      provider?: string | null;
      customerId?: string | null;
      subscriptionId?: string | null;
      plan?: string | null;
      status?: string | null;
      currentPeriodEnd?: string | null;
    };
  }>("/tenants/:id/billing", async (req, reply) => {
    try {
      const tenantId = Number(req.params.id);
      if (!Number.isFinite(tenantId)) return reply.status(400).send({ error: "bad_request", detail: "Invalid id" });

      const data: any = { ...req.body };
      if ("currentPeriodEnd" in data) {
        if (data.currentPeriodEnd === null) {
          data.currentPeriodEnd = null;
        } else if (typeof data.currentPeriodEnd === "string") {
          const d = new Date(data.currentPeriodEnd);
          if (Number.isNaN(+d))
            return reply.status(400).send({ error: "bad_request", detail: "Invalid currentPeriodEnd" });
          data.currentPeriodEnd = d;
        }
      }

      const billing = await prisma.billingAccount.upsert({
        where: { tenantId },
        update: data,
        create: { tenantId, ...data },
      });
      return reply.send(billing);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** GET /tenants/:tenantId/users */
  fastify.get<{
    Params: { tenantId: string };
    Querystring: {
      q?: string;
      role?: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER";
      page?: string;
      limit?: string;
    };
  }>("/tenants/:tenantId/users", async (req, reply) => {
    try {
      const tenantId = Number(req.params.tenantId);
      if (!Number.isFinite(tenantId))
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });

      const { page, limit, skip } = parsePaging(req.query);
      const role = req.query.role;
      const q = (req.query.q || "").trim();

      const where = {
        tenantId,
        ...(role ? { role } : {}),
        ...(q
          ? {
              user: {
                OR: [
                  { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
                  { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            }
          : {}),
      } as const;

      const [total, rows] = await Promise.all([
        prisma.tenantMembership.count({ where }),
        prisma.tenantMembership.findMany({
          where,
          take: limit,
          skip,
          orderBy: [{ role: "asc" }, { userId: "asc" }],
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                emailVerifiedAt: true,
                isSuperAdmin: true,
              },
            },
          },
        }),
      ]);

      const items = rows.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name ?? null,
        role: m.role,
        verified: !!m.user.emailVerifiedAt,
        createdAt: m.user.createdAt.toISOString(),
        isSuperAdmin: !!m.user.isSuperAdmin,
      }));

      return reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // POST /tenants/:tenantId/invites
  fastify.post<{
    Params: { tenantId: string };
    Body: { email: string; role?: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER" };
  }>("/tenants/:tenantId/invites", async (req, reply) => {
    try {
      const tenantId = Number(req.params.tenantId);
      if (!Number.isFinite(tenantId)) return reply.code(400).send({ error: "tenantId_invalid" });

      const actorId = getActorId(req);
      if (!actorId) return reply.code(401).send({ error: "unauthorized" });
      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
      let allowed = !!actor?.isSuperAdmin;
      if (!allowed) {
        const mem = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: actorId, tenantId } },
          select: { role: true },
        });
        allowed = !!mem && (mem.role === "OWNER" || mem.role === "ADMIN");
      }
      if (!allowed) return reply.code(403).send({ error: "forbidden" });

      const { email, role = "MEMBER" } = (req.body || {}) as any;
      const emailLower = String(email || "").trim().toLowerCase();
      if (!emailLower) return reply.code(400).send({ error: "email_required" });

      const raw = makeRawToken(32);
      const tokenHash = hashToken(raw);
      const identifier = inviteIdentifier(tenantId, emailLower, role);
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

      await prisma.verificationToken.deleteMany({ where: { identifier, purpose: "INVITE" } });

      const vt = await prisma.verificationToken.create({
        data: {
          identifier,
          tokenHash,
          purpose: "INVITE",
          expires,
          userId: null,
        },
        select: { identifier: true, expires: true, createdAt: true },
      });

      return reply.code(201).send({
        ok: true,
        previewLink: process.env.APP_ORIGIN
          ? `${process.env.APP_ORIGIN}/accept-invite?token=${raw}`
          : undefined,
        expires: vt.expires.toISOString(),
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // POST /tenants/:tenantId/invites/revoke
  fastify.post<{
    Params: { tenantId: string };
    Body: { email: string };
  }>("/tenants/:tenantId/invites/revoke", async (req, reply) => {
    const tenantId = Number(req.params.tenantId);
    if (!Number.isFinite(tenantId)) return reply.code(400).send({ error: "tenantId_invalid" });

    const actorId = getActorId(req);
    if (!actorId) return reply.code(401).send({ error: "unauthorized" });
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
    let allowed = !!actor?.isSuperAdmin;
    if (!allowed) {
      const mem = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: actorId, tenantId } },
        select: { role: true },
      });
      allowed = !!mem && (mem.role === "OWNER" || mem.role === "ADMIN");
    }
    if (!allowed) return reply.code(403).send({ error: "forbidden" });

    const emailLower = String((req.body as any)?.email || "").trim().toLowerCase();
    if (!emailLower) return reply.code(400).send({ error: "email_required" });

    await prisma.verificationToken.deleteMany({
      where: { purpose: "INVITE", identifier: { startsWith: `invite:t=${tenantId};e=${emailLower};` } },
    });

    reply.send({ ok: true });
  });

  // POST /invites/accept
  fastify.post("/invites/accept", async (req, reply) => {
    try {
      const { token, name, password } = (req.body || {}) as {
        token?: string;
        name?: string | null;
        password?: string | null;
      };
      const raw = String(token || "").trim();
      if (!raw) return reply.code(400).send({ error: "token_required" });

      const tokenHash = hashToken(raw);
      const vt = await prisma.verificationToken.findFirst({
        where: { tokenHash, purpose: "INVITE", expires: { gt: new Date() } },
        select: { identifier: true, expires: true },
      });
      if (!vt) return reply.code(400).send({ error: "invalid_or_expired" });

      const match = vt.identifier.match(/^invite:t=(\d+);e=([^;]+);r=(OWNER|ADMIN|MEMBER|BILLING|VIEWER)$/);
      if (!match) return reply.code(400).send({ error: "malformed_identifier" });
      const tenantId = Number(match[1]);
      const emailLower = match[2];
      const role = match[3] as "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER";

      const ten = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!ten) return reply.code(404).send({ error: "tenant_not_found" });

      const dataUser: any = {
        email: emailLower,
        name: name ? String(name).trim() || null : undefined,
        emailVerifiedAt: new Date(),
      };
      if (password && String(password).trim().length >= 8) {
        dataUser.passwordHash = await bcrypt.hash(String(password).trim(), 12);
        dataUser.passwordUpdatedAt = new Date();
      }

      const nameParts = (dataUser.name || '').split(' ').filter(Boolean);
      const firstName = nameParts[0] || 'Team';
      const lastName = nameParts.slice(1).join(' ') || 'Member';

      const user = await prisma.user.upsert({
        where: { email: emailLower },
        update: dataUser,
        create: {
          email: emailLower,
          name: dataUser.name ?? null,
          firstName,
          lastName,
          emailVerifiedAt: new Date(),
          passwordHash: dataUser.passwordHash ?? undefined,
          passwordUpdatedAt: dataUser.passwordUpdatedAt ?? undefined,
        },
        select: { id: true, email: true, defaultTenantId: true },
      });

      await prisma.tenantMembership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        update: { role },
        create: { userId: user.id, tenantId, role },
      });

      if (!user.defaultTenantId) {
        await prisma.user.update({ where: { id: user.id }, data: { defaultTenantId: tenantId } });
      }

      await prisma.verificationToken.deleteMany({ where: { tokenHash, purpose: "INVITE" } });

      return reply.send({ ok: true, tenantId, email: user.email });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** GET /tenants/:tenantId/invites */
  fastify.get<{ Params: { tenantId: string } }>("/tenants/:tenantId/invites", async (req, reply) => {
    const tenantId = Number(req.params.tenantId);
    if (!Number.isFinite(tenantId)) return reply.code(400).send({ error: "tenantId_invalid" });

    const actorId = getActorId(req);
    if (!actorId) return reply.code(401).send({ error: "unauthorized" });
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
    let allowed = !!actor?.isSuperAdmin;
    if (!allowed) {
      const mem = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: actorId, tenantId } },
        select: { role: true },
      });
      allowed = !!mem && (mem.role === "OWNER" || mem.role === "ADMIN");
    }
    if (!allowed) return reply.code(403).send({ error: "forbidden" });

    const rows = await prisma.verificationToken.findMany({
      where: { purpose: "INVITE", identifier: { startsWith: `invite:t=${tenantId};` }, expires: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { identifier: true, expires: true, createdAt: true },
    });

    const items = rows.map((r) => {
      const m = r.identifier.match(
        /^invite:t=(\d+);e=([^;]+);r=(OWNER|ADMIN|MEMBER|BILLING|VIEWER)$/
      );
      return {
        tenantId: Number(m?.[1] || tenantId),
        email: m?.[2] || "",
        role: (m?.[3] as any) || "MEMBER",
        createdAt: r.createdAt.toISOString(),
        expires: r.expires.toISOString(),
      };
    });

    reply.send({ items });
  });

  /** POST /tenants/:tenantId/users */
  fastify.post<{
    Params: { tenantId: string };
    Body: { email: string; name?: string | null; role: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER" };
  }>("/tenants/:tenantId/users", async (req, reply) => {
    try {
      const tenantId = Number(req.params.tenantId);
      if (!Number.isFinite(tenantId)) {
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });
      }

      const { email, name, role } = req.body || {};
      if (!email || !role) {
        return reply.status(400).send({ error: "bad_request", detail: "email and role are required" });
      }

      const normalizedEmail = normEmail(email);

      const nameParts = (name || '').split(' ').filter(Boolean);
      const firstName = nameParts[0] || 'Team';
      const lastName = nameParts.slice(1).join(' ') || 'Member';

      const user = await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: { name: name ?? undefined },
        create: {
          email: normalizedEmail,
          name: name ?? undefined,
          firstName,
          lastName,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          emailVerifiedAt: true,
          isSuperAdmin: true,
        },
      });

      const key = { userId_tenantId: { userId: user.id, tenantId } };
      const existing = await prisma.tenantMembership.findUnique({ where: key, select: { role: true } });

      if (existing?.role === "OWNER" && role !== "OWNER") {
        const otherOwners = await prisma.tenantMembership.count({
          where: { tenantId, role: "OWNER", NOT: { userId: user.id } },
        });
        if (otherOwners === 0) {
          return reply.code(409).send({ error: "cannot_demote_last_owner" });
        }
      }

      const membership = existing
        ? await prisma.tenantMembership.update({ where: key, data: { role } })
        : await prisma.tenantMembership.create({ data: { userId: user.id, tenantId, role } });

      return reply.send({
        userId: membership.userId,
        email: user.email,
        name: user.name ?? null,
        role: membership.role,
        verified: !!user.emailVerifiedAt,
        createdAt: user.createdAt.toISOString(),
        isSuperAdmin: !!user.isSuperAdmin,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** POST /tenants/admin-provision */
  fastify.post<{
    Body: {
      tenant: { name: string; primaryEmail?: string | null };
      owner: {
        email: string;
        name?: string | null;
        verify?: boolean;
        makeDefault?: boolean;
        tempPassword?: string;
        generateTempPassword?: boolean;
      };
      billing?: {
        provider?: string | null;
        customerId?: string | null;
        subscriptionId?: string | null;
        plan?: string | null;
        status?: string | null;
        currentPeriodEnd?: string | null;
      };
    };
  }>("/tenants/admin-provision", async (req, reply) => {
    try {
      const actorId = getActorId(req);
      if (!actorId) return reply.status(401).send({ error: "unauthorized" });

      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { isSuperAdmin: true } });
      if (!actor?.isSuperAdmin) return reply.status(403).send({ error: "forbidden" });

      const { tenant, owner, billing } = req.body || {};
      if (!tenant?.name || !owner?.email) {
        return reply
          .status(400)
          .send({ error: "bad_request", detail: "tenant.name and owner.email are required" });
      }

      const ownerEmail = normEmail(owner.email);

      // Generate or use provided temp password
      let tempPassword = "";
      if (owner.generateTempPassword) {
        tempPassword = makeRawToken(16); // 16 bytes = ~21 chars base64url
      } else if (owner.tempPassword) {
        tempPassword = owner.tempPassword;
      }

      const result = await prisma.$transaction(async (tx) => {
        const createdTenant = await tx.tenant.create({
          data: {
            name: tenant.name,
            primaryEmail: tenant.primaryEmail ?? null,
          },
          include: { billing: true },
        });

        // Prepare password hash if we have a temp password
        const passwordData: any = {};
        if (tempPassword) {
          passwordData.passwordHash = await bcrypt.hash(tempPassword, 12);
          passwordData.passwordUpdatedAt = new Date();
        }

        const user = await tx.user.upsert({
          where: { email: ownerEmail },
          update: {
            name: owner.name ?? undefined,
            ...(owner.verify ? { emailVerifiedAt: new Date() } : {}),
            ...passwordData,
          },
          create: {
            email: ownerEmail,
            name: owner.name ?? undefined,
            ...(owner.verify ? { emailVerifiedAt: new Date() } : {}),
            ...passwordData,
          },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            emailVerifiedAt: true,
            isSuperAdmin: true,
          },
        });

        await tx.tenantMembership.upsert({
          where: { userId_tenantId: { userId: user.id, tenantId: createdTenant.id } },
          update: { role: "OWNER" },
          create: { userId: user.id, tenantId: createdTenant.id, role: "OWNER" },
        });

        if (owner.makeDefault) {
          await tx.user.update({
            where: { id: user.id },
            data: { defaultTenantId: createdTenant.id },
          });
        }

        let savedBilling = null as any;
        if (billing) {
          const data: any = { ...billing };
          if ("currentPeriodEnd" in data) {
            if (data.currentPeriodEnd === null) data.currentPeriodEnd = null;
            else if (typeof data.currentPeriodEnd === "string") {
              const d = new Date(data.currentPeriodEnd);
              if (Number.isNaN(+d)) throw new Error("Invalid currentPeriodEnd");
              data.currentPeriodEnd = d;
            }
          }
          savedBilling = await tx.billingAccount.upsert({
            where: { tenantId: createdTenant.id },
            update: data,
            create: { tenantId: createdTenant.id, ...data },
          });
        }

        // Optional: initialize default breeding program at provision time
        await tx.tenantSetting.upsert({
          where: { tenantId_namespace: { tenantId: createdTenant.id, namespace: BREEDING_NS } },
          update: { data: DEFAULT_BREEDING_PROGRAM, version: { increment: 1 }, updatedBy: actorId },
          create: { tenantId: createdTenant.id, namespace: BREEDING_NS, data: DEFAULT_BREEDING_PROGRAM, version: 1, updatedBy: actorId },
        });

        return {
          tenant: {
            id: createdTenant.id,
            name: createdTenant.name,
            primaryEmail: createdTenant.primaryEmail ?? null,
            createdAt: createdTenant.createdAt,
            updatedAt: createdTenant.updatedAt,
          },
          owner: {
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            verified: !!user.emailVerifiedAt,
            isSuperAdmin: !!user.isSuperAdmin,
            createdAt: user.createdAt,
          },
          billing: savedBilling,
          tempPassword,
        };
      });

      return reply.status(201).send(result);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** PUT /tenants/:tenantId/users/:userId/password */
  fastify.put<{
    Params: { tenantId: string; userId: string };
    Body: { password: string };
  }>("/tenants/:tenantId/users/:userId/password", async (req, reply) => {
    try {
      const tenantId = Number(req.params.tenantId);
      const { userId } = req.params;
      const { password } = req.body || {};

      if (!Number.isFinite(tenantId)) {
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });
      }
      if (!userId || !password) {
        return reply.status(400).send({ error: "bad_request", detail: "password is required" });
      }
      if (password.length < 8) {
        return reply.status(400).send({ error: "bad_request", detail: "Password must be at least 8 characters" });
      }

      const actorId = getActorId(req);
      if (!actorId) return reply.status(401).send({ error: "unauthorized" });

      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { isSuperAdmin: true },
      });

      let allowed = !!actor?.isSuperAdmin;
      if (!allowed) {
        const actorMembership = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: actorId, tenantId } },
          select: { role: true },
        });
        allowed = !!actorMembership && (actorMembership.role === "OWNER" || actorMembership.role === "ADMIN");
      }
      if (!allowed) return reply.status(403).send({ error: "forbidden" });

      const targetMembership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { userId: true },
      });
      if (!targetMembership) return reply.status(404).send({ error: "not_found" });

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordUpdatedAt: new Date() },
      });

      return reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** PUT /tenants/:tenantId/users/:userId/role */
  fastify.put<{
    Params: { tenantId: string; userId: string };
    Body: { role: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER" };
  }>("/tenants/:tenantId/users/:userId/role", async (req, reply) => {
    try {
      const tenantId = Number(req.params.tenantId);
      const { userId } = req.params;
      const { role } = req.body || {};
      if (!Number.isFinite(tenantId)) {
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });
      }
      if (!userId || !role) {
        return reply.status(400).send({ error: "bad_request", detail: "role is required" });
      }

      if (role !== "OWNER") {
        const current = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId, tenantId } },
          select: { role: true },
        });
        if (current?.role === "OWNER") {
          const otherOwners = await prisma.tenantMembership.count({
            where: { tenantId, role: "OWNER", NOT: { userId } },
          });
          if (otherOwners === 0) {
            return reply.code(409).send({ error: "cannot_demote_last_owner" });
          }
        }
      }

      await prisma.tenantMembership.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: { role },
      });

      return reply.send({ ok: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  /** POST /tenants/:tenantId/users/:userId/verify-email */
  fastify.post<{ Params: { tenantId: string; userId: string } }>(
    "/tenants/:tenantId/users/:userId/verify-email",
    async (req, reply) => {
      const tenantId = Number(req.params.tenantId);
      const { userId } = req.params;
      if (!Number.isFinite(tenantId))
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });

      const membership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { userId: true },
      });
      if (!membership) return reply.status(404).send({ error: "not_found" });

      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });

      return reply.send({ ok: true });
    }
  );

  /** POST /tenants/:tenantId/users/:userId/reset-password */
  fastify.post<{ Params: { tenantId: string; userId: string } }>(
    "/tenants/:tenantId/users/:userId/reset-password",
    async (req, reply) => {
      const tenantId = Number(req.params.tenantId);
      const { userId } = req.params;
      if (!Number.isFinite(tenantId))
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });

      const membership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { userId: true },
      });
      if (!membership) return reply.status(404).send({ error: "not_found" });

      return reply.send({ ok: true });
    }
  );

  /** DELETE /tenants/:tenantId/users/:userId */
  fastify.delete<{ Params: { tenantId: string; userId: string } }>(
    "/tenants/:tenantId/users/:userId",
    async (req, reply) => {
      try {
        const tenantId = Number(req.params.tenantId);
        const { userId } = req.params;
        if (!Number.isFinite(tenantId))
          return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });

        const mem = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId, tenantId } },
          select: { role: true },
        });
        if (!mem) return reply.status(404).send({ error: "not_found" });

        if (mem.role === "OWNER") {
          const otherOwners = await prisma.tenantMembership.count({
            where: { tenantId, role: "OWNER", NOT: { userId } },
          });
          if (otherOwners === 0) {
            return reply.code(409).send({ error: "cannot_remove_last_owner" });
          }
        }

        await prisma.tenantMembership.delete({
          where: { userId_tenantId: { userId, tenantId } },
        });

        return reply.send({ ok: true });
      } catch (err) {
        const { status, payload } = errorReply(err);
        return reply.status(status).send(payload);
      }
    }
  );

  /** POST /admin/tenants/:id/owner/reset-password */
  fastify.post<{
    Params: { id: string };
    Body: { tempPassword?: string; generateTempPassword?: boolean };
  }>("/admin/tenants/:id/owner/reset-password", async (req, reply) => {
    try {
      const actorId = await requireSuperAdmin(req, reply);
      if (!actorId) return;

      const tenantId = Number(req.params.id);
      if (!Number.isFinite(tenantId)) {
        return reply.status(400).send({ error: "bad_request", detail: "Invalid tenantId" });
      }

      const { tempPassword: providedPassword, generateTempPassword } = req.body || {};

      // Generate or use provided temp password
      let tempPassword = "";
      if (generateTempPassword) {
        tempPassword = makeRawToken(16); // 16 bytes = ~21 chars base64url
      } else if (providedPassword) {
        tempPassword = providedPassword;
      } else {
        return reply.status(400).send({ error: "bad_request", detail: "Either tempPassword or generateTempPassword is required" });
      }

      // Find the owner of this tenant
      const ownerMembership = await prisma.tenantMembership.findFirst({
        where: { tenantId, role: "OWNER" },
        select: { userId: true },
      });

      if (!ownerMembership) {
        return reply.status(404).send({ error: "not_found", detail: "No owner found for this tenant" });
      }

      // Hash and update the password
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await prisma.user.update({
        where: { id: ownerMembership.userId },
        data: { passwordHash, passwordUpdatedAt: new Date() },
      });

      return reply.send({ ok: true, tempPassword });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default tenantRoutes;
