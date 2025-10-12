// src/routes/session.ts
import type { FastifyInstance, FastifyPluginOptions, FastifyReply } from "fastify";
import prisma from "../prisma.js";

/**
 * Endpoints
 *   GET  /session           → read-only session context (may rotate expiry only)
 *   POST /session/tenant    → switch active tenant in the session cookie (CSRF protected)
 *
 * Notes
 * - We DO NOT mutate tenant on GET. Explicit POST is safer & auditable.
 * - Super admins can float to any tenant; others must be members.
 * - We still rotate the session cookie when close to expiry.
 */

type SessionPayload = {
  userId: string;
  tenantId?: number;
  iat: number; // ms epoch
  exp: number; // ms epoch
};

const COOKIE_NAME = process.env.COOKIE_NAME || "bhq_s";
const CROSS_SITE = String(process.env.COOKIE_CROSS_SITE || "").trim() === "1";
const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();

function lifetimes() {
  const dev = NODE_ENV === "development";
  const ms = CROSS_SITE ? 24 * 60 * 60 * 1000 : (dev ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
  const rotateAt = Math.floor(ms * 0.2);
  return { ms, rotateAt };
}

function baseCookie() {
  const { ms } = lifetimes();
  return {
    httpOnly: true,
    sameSite: (CROSS_SITE ? "none" : "lax") as "none" | "lax",
    secure: CROSS_SITE || NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ms / 1000),
  } as const;
}

function parseSession(raw?: string | null): SessionPayload | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8"));
    if (!obj?.userId || !obj?.iat || !obj?.exp) return null;
    return obj as SessionPayload;
  } catch {
    return null;
  }
}

function setSessionCookie(reply: FastifyReply, s: Omit<SessionPayload, "iat" | "exp">) {
  const { ms } = lifetimes();
  const now = Date.now();
  const payload: SessionPayload = { ...s, iat: now, exp: now + ms };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  reply.setCookie(COOKIE_NAME, encoded, baseCookie());
}

function maybeRotate(reply: FastifyReply, sess: SessionPayload) {
  const { rotateAt, ms } = lifetimes();
  const now = Date.now();
  if (now >= sess.exp) return false; // expired
  if (sess.exp - now < rotateAt) {
    const refreshed = { ...sess, iat: now, exp: now + ms };
    const encoded = Buffer.from(JSON.stringify(refreshed)).toString("base64url");
    reply.setCookie(COOKIE_NAME, encoded, baseCookie());
  }
  return true;
}

async function resolveActiveTenant(userId: string, requested?: number) {
  // pull minimal user context
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuperAdmin: true,
      defaultTenantId: true,
      tenantMemberships: { select: { tenantId: true, role: true }, orderBy: { tenantId: "asc" } },
    },
  });
  if (!user) return { user: null, activeTenantId: undefined, isMember: false };

  // requested takes precedence if valid membership (or super)
  if (requested && Number.isInteger(requested) && requested > 0) {
    const isMember = user.isSuperAdmin || user.tenantMemberships.some(m => m.tenantId === requested);
    return { user, activeTenantId: isMember ? requested : undefined, isMember };
  }

  const activeTenantId =
    user.defaultTenantId ??
    user.tenantMemberships[0]?.tenantId ??
    undefined;

  const isMember =
    user.isSuperAdmin ||
    (activeTenantId != null && user.tenantMemberships.some(m => m.tenantId === activeTenantId));

  return { user, activeTenantId, isMember };
}

export default async function sessionRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // GET /session  (read-only; rotate expiry only)
  app.get("/session", async (req, reply) => {
    reply.header("Cache-Control", "no-store");

    const raw = req.cookies?.[COOKIE_NAME];
    const sess = parseSession(raw);
    if (!sess) return reply.code(401).send({ user: null, tenant: null, memberships: [] });

    if (!maybeRotate(reply, sess)) {
      return reply.code(401).send({ user: null, tenant: null, memberships: [] });
    }

    // Allow FE to “request” a context via header, but DO NOT mutate cookie here.
    const hdrTenant = req.headers["x-tenant-id"];
    const requestedTenantId = hdrTenant ? Number(hdrTenant) : undefined;

    const { user, activeTenantId, isMember } = await resolveActiveTenant(sess.userId, requestedTenantId);
    if (!user) return reply.code(401).send({ user: null, tenant: null, memberships: [] });

    if (!activeTenantId) {
      return reply.code(403).send({
        error: "no_tenant_context",
        user: { id: sess.userId },
        memberships: user.tenantMemberships,
      });
    }
    if (!isMember) {
      return reply.code(403).send({
        error: "forbidden_tenant",
        tenantId: requestedTenantId ?? activeTenantId,
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: activeTenantId },
      select: { id: true, name: true, slug: true },
    });

    return reply.send({
      user: { id: sess.userId, isSuperAdmin: user.isSuperAdmin },
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug ?? null } : null,
      memberships: user.tenantMemberships, // [{ tenantId, role }]
    });
  });

  // POST /session/tenant   body: { tenantId: number, saveDefault?: boolean }
  // Explicit tenant switch (CSRF-protected via your global preHandler)
  app.post<{ Body: { tenantId?: number; saveDefault?: boolean } }>("/session/tenant", async (req, reply) => {
    const raw = req.cookies?.[COOKIE_NAME];
    const sess = parseSession(raw);
    if (!sess) return reply.code(401).send({ error: "unauthorized" });

    const tenantId = Number((req.body?.tenantId ?? 0));
    const saveDefault = !!req.body?.saveDefault;
    if (!tenantId || !Number.isInteger(tenantId) || tenantId <= 0) {
      return reply.code(400).send({ error: "tenantId_invalid" });
    }

    // Validate membership (or super admin)
    const actor = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: { isSuperAdmin: true },
    });
    const membership = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: sess.userId, tenantId } },
      select: { tenantId: true },
    });

    if (!actor?.isSuperAdmin && !membership) {
      return reply.code(403).send({ error: "forbidden" });
    }

    // Re-issue cookie with new tenantId
    setSessionCookie(reply, { userId: sess.userId, tenantId });

    // Optionally persist as defaultTenantId
    if (saveDefault) {
      await prisma.user.update({
        where: { id: sess.userId },
        data: { defaultTenantId: tenantId },
        select: { id: true },
      });
    }

    return reply.send({ ok: true, tenant: { id: tenantId }, savedAsDefault: saveDefault });
  });
}
