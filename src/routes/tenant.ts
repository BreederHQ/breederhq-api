// src/routes/tenant.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/* ───────────────────────── helpers ───────────────────────── */

type SortKey = "name" | "slug" | "createdAt" | "updatedAt";
const ALLOWED_SORT: SortKey[] = ["name", "slug", "createdAt", "updatedAt"];

function b64url(bytes: Buffer) {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeRawToken(nBytes = 32) {
  return b64url(crypto.randomBytes(nBytes)); // raw shown to user via email link
}
function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw, "utf8").digest("base64url");
}
function inviteIdentifier(
  tenantId: number,
  emailLower: string,
  role: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER" = "MEMBER"
) {
  // You can extend this (e.g., add inviter id). Keep short & deterministic.
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

function getCookieName() {
  return process.env.COOKIE_NAME || "bhq_s";
}
function decodeSessionCookie(raw?: string) {
  if (!raw) return null;
  try {
    const json = Buffer.from(String(raw), "base64url").toString("utf8");
    const obj = JSON.parse(json);
    const exp = Number(obj?.exp);
    const nowMs = Date.now();
    const expMs = exp > 2_000_000_000 ? exp : exp * 1000;
    if (!obj?.userId || !expMs || nowMs > expMs) return null;
    return obj as { userId: string; exp: number; orgId?: number; iat?: number };
  } catch {
    return null;
  }
}
function getActorId(req: any): string | null {
  const raw = req.cookies?.[getCookieName()];
  const sess = decodeSessionCookie(raw);
  return (sess && String(sess.userId)) || null;
}
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
    // convenience for current Admin UI (Plan column)
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

/* ───────────────────────── routes (plugin) ───────────────────────── */

const tenantRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /** GET /admin/tenants — Super Admin only, UNscoped (all tenants) */
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
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { primaryEmail: { contains: q, mode: "insensitive" } },
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
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
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

      // roll-up counts in bulk
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
                  { email: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
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

  // POST /tenants/:tenantId/invites  { email, role? }
  fastify.post<{
    Params: { tenantId: string };
    Body: { email: string; role?: "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER" };
  }>("/tenants/:tenantId/invites", async (req, reply) => {
    try {
      const tenantId = Number(req.params.tenantId);
      if (!Number.isFinite(tenantId)) return reply.code(400).send({ error: "tenantId_invalid" });

      // AuthZ: super admin OR OWNER/ADMIN of tenant
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

      // create token (hash-at-rest)
      const raw = makeRawToken(32);
      const tokenHash = hashToken(raw);
      const identifier = inviteIdentifier(tenantId, emailLower, role);
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7d

      // Clean out any old invites for same identifier to keep “latest wins”
      await prisma.verificationToken.deleteMany({ where: { identifier, purpose: "INVITE" } });

      const vt = await prisma.verificationToken.create({
        data: {
          identifier,
          tokenHash,
          purpose: "INVITE",
          expires,
          userId: null, // may be linked later; leave null now
        },
        select: { identifier: true, expires: true, createdAt: true },
      });

      // (send email out-of-band) — include `raw` in link:
      // e.g. https://app.example.com/accept-invite?token=${raw}

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

  // POST /tenants/:tenantId/invites/revoke  { email }
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

  // POST /invites/accept  { token, name?, password? }
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

      // identifier format: invite:t=<tenantId>;e=<emailLower>;r=<role>
      const match = vt.identifier.match(/^invite:t=(\d+);e=([^;]+);r=(OWNER|ADMIN|MEMBER|BILLING|VIEWER)$/);
      if (!match) return reply.code(400).send({ error: "malformed_identifier" });
      const tenantId = Number(match[1]);
      const emailLower = match[2];
      const role = match[3] as "OWNER" | "ADMIN" | "MEMBER" | "BILLING" | "VIEWER";

      // sanity check tenant still exists
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

      const user = await prisma.user.upsert({
        where: { email: emailLower },
        update: dataUser,
        create: {
          email: emailLower,
          name: dataUser.name ?? null,
          emailVerifiedAt: new Date(),
          passwordHash: dataUser.passwordHash ?? undefined,
          passwordUpdatedAt: dataUser.passwordUpdatedAt ?? undefined,
        },
        select: { id: true, email: true, defaultTenantId: true },
      });

      // create or update membership
      await prisma.tenantMembership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        update: { role }, // if already a member, you can choose NOT to elevate role here; tweak if needed
        create: { userId: user.id, tenantId, role },
      });

      // optional: set defaultTenantId if none
      if (!user.defaultTenantId) {
        await prisma.user.update({ where: { id: user.id }, data: { defaultTenantId: tenantId } });
      }

      // single-use: delete token
      await prisma.verificationToken.deleteMany({ where: { tokenHash, purpose: "INVITE" } });

      return reply.send({ ok: true, tenantId, email: user.email });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // GET /tenants/:tenantId/invites
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

      const user = await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: { name: name ?? undefined },
        create: { email: normalizedEmail, name: name ?? undefined },
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

  /** POST /tenants/admin-provision  (Super Admin only) */
  fastify.post<{
    Body: {
      tenant: { name: string; primaryEmail?: string | null };
      owner: { email: string; name?: string | null; verify?: boolean; makeDefault?: boolean };
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

      const result = await prisma.$transaction(async (tx) => {
        // 1) Tenant
        const createdTenant = await tx.tenant.create({
          data: {
            name: tenant.name,
            primaryEmail: tenant.primaryEmail ?? null,
          },
          include: { billing: true },
        });

        // 2) Owner user
        const user = await tx.user.upsert({
          where: { email: ownerEmail },
          update: {
            name: owner.name ?? undefined,
            ...(owner.verify ? { emailVerifiedAt: new Date() } : {}),
          },
          create: {
            email: ownerEmail,
            name: owner.name ?? undefined,
            ...(owner.verify ? { emailVerifiedAt: new Date() } : {}),
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

        // 3) OWNER membership
        await tx.tenantMembership.upsert({
          where: { userId_tenantId: { userId: user.id, tenantId: createdTenant.id } },
          update: { role: "OWNER" },
          create: { userId: user.id, tenantId: createdTenant.id, role: "OWNER" },
        });

        // 4) Optional default tenant
        if (owner.makeDefault) {
          await tx.user.update({
            where: { id: user.id },
            data: { defaultTenantId: createdTenant.id },
          });
        }

        // 5) Optional billing
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

      // authz: Super Admin OR tenant OWNER/ADMIN
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

      // ensure target is in this tenant
      const targetMembership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { userId: true },
      });
      if (!targetMembership) return reply.status(404).send({ error: "not_found" });

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordUpdatedAt: new Date() }, // ← aligns with schema
      });

      // Optional: revoke existing sessions for the user
      // await prisma.session.deleteMany({ where: { userId } });

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

      // Protect against demoting the last OWNER
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

  /** POST /tenants/:tenantId/users/:userId/verify-email (stub) */
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

  /** POST /tenants/:tenantId/users/:userId/reset-password (stub) */
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

      // TODO: generate verification token (purpose=RESET_PASSWORD, hash-at-rest) and email it.
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
};

export default tenantRoutes;
