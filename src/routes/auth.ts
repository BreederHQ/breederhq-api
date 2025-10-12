// src/routes/auth.ts
import type { FastifyInstance, FastifyPluginOptions, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../prisma.js";

/**
 * Mounted with: app.register(authRoutes, { prefix: "/api/v1/auth" })
 *
 * Endpoints:
 *   POST /register
 *   POST /verify-email
 *   GET  /verify-email                (browser-friendly; optional redirect)
 *   POST /forgot-password
 *   POST /reset-password
 *   GET  /reset-password              (browser-friendly; token preflight; optional redirect)
 *   POST /login
 *   GET|POST /logout
 *   GET|POST /dev-login               (enabled only when DEV_LOGIN_ENABLED=1 and not production)
 *   GET  /me
 *
 * Cookies:
 *   - Session:   COOKIE_NAME (default "bhq_s") => base64url(JSON { userId, tenantId?, iat, exp })
 *   - CSRF:      XSRF-TOKEN  (non-HttpOnly)
 */

type SessionPayload = {
  userId: string;
  tenantId?: number;
  iat: number; // ms
  exp: number; // ms
};

const COOKIE_NAME = process.env.COOKIE_NAME || "bhq_s";
const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const DEV_LOGIN_ENABLED = String(process.env.DEV_LOGIN_ENABLED || "").trim() === "1";
const ALLOW_CROSS_SITE = String(process.env.COOKIE_CROSS_SITE || "").trim() === "1";
const IS_PROD = NODE_ENV === "production";
const EXPOSE_DEV_TOKENS = !IS_PROD; // Never expose raw tokens in prod

/* ───────────────────────── cookies / session ───────────────────────── */

function sessionLifetimes() {
  // Cross-site sessions: 24h. Local dev: 7d. Prod same-site: 24h.
  const ms = ALLOW_CROSS_SITE
    ? 24 * 60 * 60 * 1000
    : (NODE_ENV === "development" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
  const rotateAt = Math.floor(ms * 0.2); // reissue when <20% left
  return { ms, rotateAt };
}

function cookieBase() {
  const { ms } = sessionLifetimes();
  const sameSite: "lax" | "none" = ALLOW_CROSS_SITE ? "none" : "lax";
  const secure = ALLOW_CROSS_SITE || NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: Math.floor(ms / 1000),
  } as const;
}

function randCsrf() {
  return randomBytes(32).toString("base64url");
}

function setSessionCookies(reply: FastifyReply, sess: Omit<SessionPayload, "iat" | "exp">) {
  const now = Date.now();
  const { ms } = sessionLifetimes();
  const payload: SessionPayload = { ...sess, iat: now, exp: now + ms };
  const buf = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // Session (HttpOnly)
  reply.setCookie(COOKIE_NAME, buf, cookieBase());

  // CSRF (not HttpOnly)
  reply.setCookie("XSRF-TOKEN", randCsrf(), { ...cookieBase(), httpOnly: false });
}

function clearAuthCookies(reply: FastifyReply) {
  const base = cookieBase();
  reply.setCookie(COOKIE_NAME, "", { ...base, maxAge: 0 });
  reply.clearCookie(COOKIE_NAME, { path: "/" });
  reply.setCookie("XSRF-TOKEN", "", { ...base, httpOnly: false, maxAge: 0 });
  reply.clearCookie("XSRF-TOKEN", { path: "/" });
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

/* ───────────────────────── tenant helpers ───────────────────────── */

/** 1) defaultTenantId 2) first membership (lowest id) 3) undefined */
async function pickTenantIdForUser(userId: string): Promise<number | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      defaultTenantId: true,
      tenantMemberships: { select: { tenantId: true }, orderBy: { tenantId: "asc" } },
    },
  });
  if (!user) return undefined;
  if (user.defaultTenantId) return user.defaultTenantId;
  const first = user.tenantMemberships[0]?.tenantId;
  return first ?? undefined;
}

async function ensureDefaultTenant(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      defaultTenantId: true,
      tenantMemberships: { select: { tenantId: true }, orderBy: { tenantId: "asc" } },
    },
  });
  if (u && !u.defaultTenantId && u.tenantMemberships.length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { defaultTenantId: u.tenantMemberships[0].tenantId },
    });
  }
}

async function findUserByEmail(email: string) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;
  return prisma.user.findUnique({
    where: { email: e },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      passwordHash: true,
      isSuperAdmin: true,
      defaultTenantId: true,
      emailVerifiedAt: true,
      tenantMemberships: { select: { tenantId: true, role: true } },
    },
  });
}

/* ───────────────────────── token helpers ───────────────────────── */

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function sha256b64url(input: string | Buffer) {
  return b64url(createHash("sha256").update(input).digest());
}
function newRawToken(): string {
  return b64url(randomBytes(32));
}

async function createVerificationToken(args: {
  identifier: string; // usually email for VERIFY_EMAIL/RESET_PASSWORD
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD" | "INVITE" | "OTHER";
  userId?: string | null;
  ttlMinutes?: number; // default 60
}) {
  const raw = newRawToken();
  const tokenHash = sha256b64url(raw);
  const expires = new Date(Date.now() + (args.ttlMinutes ?? 60) * 60 * 1000);
  const rec = await prisma.verificationToken.create({
    data: {
      identifier: args.identifier,
      tokenHash,
      purpose: args.purpose,
      userId: args.userId ?? null,
      expires,
    },
    select: { identifier: true, tokenHash: true, purpose: true, expires: true },
  });
  return { raw, rec };
}

/** Validate without consuming (for GET reset preflight). */
async function findValidToken(
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD",
  rawToken: string
) {
  const tokenHash = sha256b64url(rawToken);
  const tok = await prisma.verificationToken.findFirst({
    where: { tokenHash, purpose },
    select: { identifier: true, userId: true, expires: true },
  });
  if (!tok) return null;
  if (tok.expires <= new Date()) return null;
  return tok;
}

/** Consume (delete) a token; returns payload if valid. */
async function consumeToken(
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD",
  rawToken: string
) {
  const tokenHash = sha256b64url(rawToken);
  const tok = await prisma.verificationToken.findFirst({
    where: { tokenHash, purpose },
    select: { identifier: true, userId: true, expires: true },
  });
  if (!tok) return null;
  if (tok.expires <= new Date()) {
    await prisma.verificationToken.deleteMany({ where: { tokenHash } }); // cleanup expired
    return null;
  }
  await prisma.verificationToken.deleteMany({ where: { tokenHash } }); // single-use
  return tok;
}

/* Optional: very light redirect guard — allows http(s) only. */
function isSafeRedirect(u?: string) {
  if (!u) return false;
  try {
    const url = new URL(u);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

/* ───────────────────────── routes ───────────────────────── */

export default async function authRoutes(app: FastifyInstance, _opts: FastifyPluginOptions) {
  /* ───── Register ───── */
  // POST /register  { email, password, name? }
  app.post("/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { email = "", password = "", name = null } = (req.body || {}) as {
      email?: string; password?: string; name?: string | null;
    };
    const e = String(email).trim().toLowerCase();
    const p = String(password);

    if (!e || !p) return reply.code(400).send({ error: "email_and_password_required" });
    if (p.length < 8) return reply.code(400).send({ error: "password_too_short" });

    // Upsert: if user exists with password, block; else create or set initial password
    const existing = await prisma.user.findUnique({
      where: { email: e },
      select: { id: true, passwordHash: true, emailVerifiedAt: true },
    });

    let userId: string;
    if (!existing) {
      const passwordHash = await bcrypt.hash(p, 12);
      const u = await prisma.user.create({
        data: { email: e, name: name ?? null, passwordHash },
        select: { id: true },
      });
      userId = u.id;
    } else {
      if (existing.passwordHash) {
        return reply.code(409).send({ error: "email_already_registered" });
      }
      const passwordHash = await bcrypt.hash(p, 12);
      const u = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
        select: { id: true },
      });
      userId = u.id;
    }

    // Issue verify-email token
    const { raw } = await createVerificationToken({
      identifier: e,
      purpose: "VERIFY_EMAIL",
      userId,
      ttlMinutes: 60,
    });

    // TODO: send email: https://yourapp.example/verify-email?token=${raw}
    return reply.code(201).send({
      ok: true,
      ...(EXPOSE_DEV_TOKENS ? { dev_token: raw } : {}),
    });
  });

  /* ───── Verify Email ───── */
  // POST /verify-email  { token }
  app.post("/verify-email", async (req, reply) => {
    const { token = "" } = (req.body || {}) as { token?: string };
    if (!token) return reply.code(400).send({ error: "token_required" });

    const tok = await consumeToken("VERIFY_EMAIL", token);
    if (!tok) return reply.code(400).send({ error: "invalid_or_expired_token" });

    const user = await prisma.user.findUnique({
      where: { email: tok.identifier.toLowerCase() },
      select: { id: true, emailVerifiedAt: true },
    });
    if (!user) return reply.code(404).send({ error: "user_not_found" });

    if (!user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
        select: { id: true },
      });
    }

    return reply.send({ ok: true });
  });

  // GET /verify-email?token=...&redirect=...
  app.get("/verify-email", async (req, reply) => {
    const q = (req.query || {}) as { token?: string; redirect?: string };
    const token = q.token || "";
    const redirect = q.redirect;

    if (!token) return reply.code(400).send({ error: "token_required" });

    const tok = await consumeToken("VERIFY_EMAIL", token);
    const ok = !!tok && !!(await prisma.user.findUnique({ where: { email: tok!.identifier.toLowerCase() }, select: { id: true } }));

    if (ok) {
      // Set verified flag (idempotent)
      await prisma.user.updateMany({
        where: { email: tok!.identifier.toLowerCase(), emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
    }

    if (redirect && isSafeRedirect(redirect)) {
      const url = new URL(redirect);
      url.searchParams.set("verified", ok ? "1" : "0");
      return reply.redirect(url.toString());
    }

    return reply.type("text/html").send(
      ok
        ? "<!doctype html><meta charset=utf-8><title>Email Verified</title><p>Email verified. You may close this window.</p>"
        : "<!doctype html><meta charset=utf-8><title>Invalid Token</title><p>Verification link is invalid or expired.</p>"
    );
  });

  /* ───── Forgot / Reset Password ───── */
  // POST /forgot-password  { email }
  app.post("/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { email = "" } = (req.body || {}) as { email?: string };
    const e = String(email).trim().toLowerCase();
    if (!e) return reply.code(400).send({ error: "email_required" });

    const user = await prisma.user.findUnique({ where: { email: e }, select: { id: true } });
    // Always return 200 to avoid enumeration; only create token if user exists
    if (user) {
      const { raw } = await createVerificationToken({
        identifier: e,
        purpose: "RESET_PASSWORD",
        userId: user.id,
        ttlMinutes: 30,
      });
      // TODO: send email link: https://yourapp.example/reset-password?token=${raw}
      if (EXPOSE_DEV_TOKENS) {
        return reply.send({ ok: true, dev_token: raw });
      }
    }
    return reply.send({ ok: true });
  });

  // GET /reset-password?token=...&redirect=...
  // Preflight for browser: validate token (WITHOUT consuming) and optionally redirect to your SPA with token.
  app.get("/reset-password", async (req, reply) => {
    const q = (req.query || {}) as { token?: string; redirect?: string };
    const token = q.token || "";
    const redirect = q.redirect;

    if (!token) return reply.code(400).send({ error: "token_required" });

    const tok = await findValidToken("RESET_PASSWORD", token);
    const ok = !!tok;

    if (redirect && isSafeRedirect(redirect)) {
      const url = new URL(redirect);
      url.searchParams.set("ok", ok ? "1" : "0");
      // In SPA flows you typically carry the raw token forward in the URL fragment or query:
      if (ok) url.searchParams.set("token", token);
      return reply.redirect(url.toString());
    }

    return reply.type("text/html").send(
      ok
        ? "<!doctype html><meta charset=utf-8><title>Reset Password</title><p>Token looks good. Continue in the app.</p>"
        : "<!doctype html><meta charset=utf-8><title>Invalid Token</title><p>Reset link is invalid or expired.</p>"
    );
  });

  // POST /reset-password  { token, password }
  app.post("/reset-password", async (req, reply) => {
    const { token = "", password = "" } = (req.body || {}) as { token?: string; password?: string };
    const pw = String(password);
    if (!token || !pw) return reply.code(400).send({ error: "token_and_password_required" });
    if (pw.length < 8) return reply.code(400).send({ error: "password_too_short" });

    const tok = await consumeToken("RESET_PASSWORD", token);
    if (!tok || !tok.userId) return reply.code(400).send({ error: "invalid_or_expired_token" });

    const passwordHash = await bcrypt.hash(pw, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tok.userId! },
        data: { passwordHash, passwordUpdatedAt: new Date() },
        select: { id: true },
      });
      // Revoke all sessions for this user
      await tx.session.deleteMany({ where: { userId: tok.userId! } });
      // Cleanup any other pending reset tokens for this user
      await tx.verificationToken.deleteMany({
        where: { userId: tok.userId!, purpose: "RESET_PASSWORD" },
      });
    });

    return reply.send({ ok: true });
  });

  /* ───── Login / Logout / Me / Dev-login ───── */

  // POST /login
  app.post("/login", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { email = "", password = "" } = (req.body || {}) as { email?: string; password?: string };
    const e = String(email).trim().toLowerCase();
    const p = String(password);

    if (!e || !p) return reply.code(400).send({ error: "email_and_password_required" });

    const user = await findUserByEmail(e);
    if (!user || !user.passwordHash) return reply.code(401).send({ error: "invalid_credentials" });

    // If you want to require verified email, uncomment:
    // if (!user.emailVerifiedAt) return reply.code(403).send({ error: "email_not_verified" });

    const ok = await bcrypt.compare(p, user.passwordHash).catch(() => false);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: { id: true },
    });

    await ensureDefaultTenant(user.id);
    const tenantId = await pickTenantIdForUser(user.id);
    setSessionCookies(reply, { userId: String(user.id), tenantId });

    return reply.send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        isSuperAdmin: !!user.isSuperAdmin,
      },
      tenant: tenantId ? { id: tenantId } : null,
      memberships: user.tenantMemberships.map(m => ({ tenantId: m.tenantId, role: m.role })),
    });
  });

  // GET/POST /logout
  const handleLogout = async (req: any, reply: FastifyReply) => {
    const bag = (req.body || req.query || {}) as { redirect?: string };
    clearAuthCookies(reply);
    if (bag.redirect && isSafeRedirect(bag.redirect)) return reply.redirect(encodeURI(String(bag.redirect)));
    return reply.send({ ok: true });
  };
  app.get("/logout", handleLogout);
  app.post("/logout", handleLogout);

  // DEV-ONLY: GET/POST /dev-login
  const handleDevLogin = async (req: any, reply: FastifyReply) => {
    if (IS_PROD || !DEV_LOGIN_ENABLED) return reply.code(404).send({ error: "not_found" });

    const bag = (req.body || req.query || {}) as { tenantId?: string; redirect?: string };
    const requestedTenantId = bag.tenantId ? Number(bag.tenantId) : undefined;

    const email = "dev@bhq.local";
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: "Dev User", isSuperAdmin: true, emailVerifiedAt: new Date() },
      });
    }

    let tenantId = requestedTenantId ?? (await pickTenantIdForUser(user.id));
    if (requestedTenantId) {
      const hasMembership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: requestedTenantId } },
      });
      if (!hasMembership) {
        try {
          await prisma.tenantMembership.create({
            data: { userId: user.id, tenantId: requestedTenantId, role: "OWNER" },
          });
          tenantId = requestedTenantId;
        } catch {
          // ignore; tenant may not exist
        }
      }
    }

    setSessionCookies(reply, { userId: String(user.id), tenantId });
    if (bag.redirect && isSafeRedirect(bag.redirect)) return reply.redirect(encodeURI(bag.redirect));
    return reply.send({
      ok: true,
      user: { id: user.id, email: user.email },
      tenant: tenantId ? { id: tenantId } : null,
    });
  };
  app.get("/dev-login", handleDevLogin);
  app.post("/dev-login", handleDevLogin);

  // GET /me
  app.get("/me", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const raw = req.cookies?.[COOKIE_NAME];
    const sess = parseSession(raw);

    if (!sess || Date.now() >= sess.exp) {
      return reply.code(401).send({ ok: false, error: "unauthorized" });
    }

    // Optional rotation if close to expiry
    const { rotateAt } = sessionLifetimes();
    if (sess.exp - Date.now() < rotateAt) {
      setSessionCookies(reply, { userId: sess.userId, tenantId: sess.tenantId });
    }

    const user = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: {
        id: true, email: true, name: true, image: true, isSuperAdmin: true,
        defaultTenantId: true,
        tenantMemberships: { select: { tenantId: true, role: true }, orderBy: { tenantId: "asc" } },
      },
    });
    if (!user) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const tenantId = sess.tenantId ?? (user.defaultTenantId || user.tenantMemberships[0]?.tenantId);

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      isSuperAdmin: !!user.isSuperAdmin,
      tenant: tenantId ? { id: tenantId } : null,
      memberships: user.tenantMemberships.map(m => ({ tenantId: m.tenantId, role: m.role })),
    });
  });
}
