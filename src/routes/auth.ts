// src/routes/auth.ts
import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../prisma.js";
import {
  COOKIE_NAME,
  SessionPayload,
  setSessionCookies,
  clearSessionCookies,
  parseVerifiedSession,
  sessionLifetimes,
  Surface,
} from "../utils/session.js";
import { deriveSurface } from "../middleware/actor-context.js";

/**
 * Mounted with: app.register(authRoutes, { prefix: "/api/v1/auth" })
 *
 * Endpoints:
 *   POST /register
 *   POST /verify-email
 *   GET  /verify-email
 *   POST /forgot-password
 *   POST /reset-password
 *   GET  /reset-password
 *   POST /login
 *   GET|POST /logout
 *   GET|POST /dev-login    (DEV_LOGIN_ENABLED=1 and not production)
 *   GET  /me
 *   POST /password         (authenticated password change)
 *
 * Cookies:
 *   - Session:   COOKIE_NAME (default "bhq_s") => signed(base64url(JSON { userId, tenantId?, iat, exp }))
 *   - CSRF:      XSRF-TOKEN  (non-HttpOnly)
 */
const NODE_ENV = String(process.env.NODE_ENV || "").toLowerCase();
const DEV_LOGIN_ENABLED = String(process.env.DEV_LOGIN_ENABLED || "").trim() === "1";
const ALLOW_CROSS_SITE = String(process.env.COOKIE_CROSS_SITE || "").trim() === "1";
const IS_PROD = NODE_ENV === "production";
const EXPOSE_DEV_TOKENS = !IS_PROD; // never expose raw tokens in prod

/* ───────────────────────── schema guards ───────────────────────── */

let _hasTenants: boolean | null = null;
let _hasVerificationToken: boolean | null = null;
let _hasSessionTable: boolean | null = null;

async function tableExists(tableName: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<
    Array<{ exists: boolean }>
  >(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = current_schema() and table_name = $1
     ) as exists`,
    tableName.toLowerCase()
  );
  return !!r?.[0]?.exists;
}

async function detectTenants(): Promise<boolean> {
  if (_hasTenants != null) return _hasTenants;
  const hasTenant = await tableExists("Tenant");
  const hasTM = await tableExists("TenantMembership");
  _hasTenants = hasTenant && hasTM;
  return _hasTenants;
}

async function detectVerificationToken(): Promise<boolean> {
  if (_hasVerificationToken != null) return _hasVerificationToken;
  _hasVerificationToken = await tableExists("VerificationToken");
  return _hasVerificationToken;
}

async function detectSessionTable(): Promise<boolean> {
  if (_hasSessionTable != null) return _hasSessionTable;
  _hasSessionTable = await tableExists("Session");
  return _hasSessionTable;
}

/* ───────────────────────── cookies / session ───────────────────────── */
// Session cookie functions are now imported from utils/session.js
// - setSessionCookies: creates signed session cookie + CSRF token
// - clearSessionCookies: clears all auth cookies
// - parseVerifiedSession: verifies signature and parses session

/* ───────────────────────── tenant helpers ───────────────────────── */

/** 1) defaultTenantId 2) first membership 3) undefined */
async function pickTenantIdForUser(userId: string): Promise<number | undefined> {
  if (!(await detectTenants())) return undefined;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      // these fields exist only in multi-tenant schema
      // use any to skip TS binding to a specific Prisma client
      // @ts-ignore
      defaultTenantId: true,
      // @ts-ignore
      tenantMemberships: { select: { tenantId: true }, orderBy: { tenantId: "asc" } },
    } as any,
  }) as any;

  if (!user) return undefined;
  if (typeof user.defaultTenantId === "number" && user.defaultTenantId > 0) return user.defaultTenantId;
  const first = Array.isArray(user.tenantMemberships) ? user.tenantMemberships[0]?.tenantId : undefined;
  return first ?? undefined;
}

async function ensureDefaultTenant(userId: string) {
  if (!(await detectTenants())) return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      // @ts-ignore
      defaultTenantId: true,
      // @ts-ignore
      tenantMemberships: { select: { tenantId: true }, orderBy: { tenantId: "asc" } },
    } as any,
  }) as any;
  if (u && !u.defaultTenantId && Array.isArray(u.tenantMemberships) && u.tenantMemberships.length > 0) {
    try {
      await prisma.user.update({
        where: { id: userId },
        // @ts-ignore
        data: { defaultTenantId: u.tenantMemberships[0].tenantId },
      } as any);
    } catch {
      // ignore if column not present
    }
  }
}

async function findUserByEmail(email: string) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;

  // Select minimal core fields that should exist
  const base = await prisma.user.findUnique({
    where: { email: e },
    select: {
      id: true,
      email: true,
      // Optional fields guarded via any
      // @ts-ignore
      name: true,
      // @ts-ignore
      image: true,
      // @ts-ignore
      passwordHash: true,
      // @ts-ignore
      isSuperAdmin: true,
      // @ts-ignore
      defaultTenantId: true,
      // @ts-ignore
      emailVerifiedAt: true,
      // @ts-ignore
      tenantMemberships: { select: { tenantId: true, role: true } },
    } as any,
  }) as any;

  if (!base) return null;

  // Normalize shape so callers do not need guards
  return {
    id: base.id,
    email: base.email,
    name: base.name ?? null,
    image: base.image ?? null,
    passwordHash: base.passwordHash ?? null,
    isSuperAdmin: !!base.isSuperAdmin,
    defaultTenantId: typeof base.defaultTenantId === "number" ? base.defaultTenantId : null,
    emailVerifiedAt: base.emailVerifiedAt ?? null,
    tenantMemberships: Array.isArray(base.tenantMemberships) ? base.tenantMemberships : [],
  };
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
  identifier: string; // usually email
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD" | "INVITE" | "OTHER";
  userId?: string | null;
  ttlMinutes?: number; // default 60
}) {
  if (!(await detectVerificationToken())) {
    // Token table not available. Return a synthetic that only shows in dev for visibility.
    return { raw: newRawToken(), rec: { identifier: args.identifier, purpose: args.purpose, expires: new Date(Date.now() + (args.ttlMinutes ?? 60) * 60 * 1000) } };
  }

  const raw = newRawToken();
  const tokenHash = sha256b64url(raw);
  const expires = new Date(Date.now() + (args.ttlMinutes ?? 60) * 60 * 1000);
  const rec = await prisma.verificationToken.create({
    data: {
      identifier: args.identifier.toLowerCase(),
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
  if (!(await detectVerificationToken())) return null;
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
  if (!(await detectVerificationToken())) return null;
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

/* Optional redirect guard */
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

    const existing = await prisma.user.findUnique({
      where: { email: e },
      // select only core fields to avoid schema coupling
      select: { id: true },
    });

    let userId: string;
    if (!existing) {
      // optional fields guarded with try
      const data: any = { email: e };
      if (name != null) data.name = name; // ignored if column missing
      try {
        data.passwordHash = await bcrypt.hash(p, 12);
      } catch {
        // if no passwordHash column, we cannot support email+password auth
      }
      const u = await prisma.user.create({
        data,
        select: { id: true },
      });
      userId = u.id;
    } else {
      // If user exists, try to set password if passwordHash column exists
      const passwordHash = await bcrypt.hash(p, 12);
      const u = await prisma.user.update({
        where: { id: existing.id },
        data: (() => {
          const d: any = {};
          d.passwordHash = passwordHash;
          return d;
        })(),
        select: { id: true },
      });
      userId = u.id;
    }

    // Issue verify-email token when table exists
    const { raw } = await createVerificationToken({
      identifier: e,
      purpose: "VERIFY_EMAIL",
      userId,
      ttlMinutes: 60,
    });

    // Grant MARKETPLACE_ACCESS entitlement when registered from marketplace surface
    const surface = deriveSurface(req);
    if (surface === "MARKETPLACE") {
      try {
        await (prisma as any).userEntitlement.upsert({
          where: { userId_key: { userId, key: "MARKETPLACE_ACCESS" } },
          create: {
            userId,
            key: "MARKETPLACE_ACCESS",
            status: "ACTIVE",
            grantedAt: new Date(),
          },
          update: {
            status: "ACTIVE",
            revokedAt: null,
          },
        });
      } catch {
        // Ignore if UserEntitlement table not yet migrated
      }
    }

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
      select: { id: true },
    });
    if (!user) return reply.code(404).send({ error: "user_not_found" });

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() } as any,
        select: { id: true },
      });
    } catch {
      // ignore if column not present
    }

    return reply.send({ ok: true });
  });

  // GET /verify-email?token=...&redirect=...
  app.get("/verify-email", async (req, reply) => {
    const q = (req.query || {}) as { token?: string; redirect?: string };
    const token = q.token || "";
    const redirect = q.redirect;

    if (!token) return reply.code(400).send({ error: "token_required" });

    let ok = false;
    const tok = await consumeToken("VERIFY_EMAIL", token);
    if (tok) {
      const u = await prisma.user.findUnique({ where: { email: tok.identifier.toLowerCase() }, select: { id: true } });
      if (u) {
        try {
          await prisma.user.update({
            where: { id: u.id },
            data: { emailVerifiedAt: new Date() } as any,
          });
          ok = true;
        } catch {
          ok = true; // verified conceptually even if column missing
        }
      }
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

    if (!(await detectVerificationToken())) {
      // Still return 200 to avoid enumeration patterns
      return reply.send({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { email: e }, select: { id: true } });
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
      // update password if column exists
      try {
        await (tx as any).user.update({
          where: { id: tok.userId! },
          data: { passwordHash, passwordUpdatedAt: new Date() } as any,
          select: { id: true },
        });
      } catch {
        // if password cannot be set, leave as is
      }

      // revoke all sessions if Session table exists
      if (await detectSessionTable()) {
        try {
          await (tx as any).session.deleteMany({ where: { userId: tok.userId! } });
        } catch {
          // ignore
        }
      }

      // cleanup any other pending reset tokens
      if (await detectVerificationToken()) {
        try {
          await (tx as any).verificationToken.deleteMany({
            where: { userId: tok.userId!, purpose: "RESET_PASSWORD" },
          });
        } catch {
          // ignore
        }
      }
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

    // lastLoginAt is optional
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() } as any,
        select: { id: true },
      });
    } catch {
      // ignore if column not present
    }

    await ensureDefaultTenant(user.id);
    const tenantId = await pickTenantIdForUser(user.id);
    const surface = deriveSurface(req) as Surface;
    setSessionCookies(reply, { userId: String(user.id), tenantId }, surface);

    return reply.send({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        isSuperAdmin: !!user.isSuperAdmin,
      },
      tenant: tenantId ? { id: tenantId } : null,
      memberships: (user.tenantMemberships || []).map((m: any) => ({ tenantId: m.tenantId, role: m.role ?? null })),
    });
  });

  // GET/POST /logout
  const handleLogout = async (req: any, reply: FastifyReply) => {
    const bag = (req.body || req.query || {}) as { redirect?: string };
    clearSessionCookies(reply);
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
        data: { email, name: "Dev User", isSuperAdmin: true, emailVerifiedAt: new Date() } as any,
      });
    }

    let tenantId: number | undefined = undefined;

    if (await detectTenants()) {
      tenantId = requestedTenantId ?? (await pickTenantIdForUser(user.id));
      if (requestedTenantId) {
        const hasMembership = await (prisma as any).tenantMembership.findUnique?.({
          where: { userId_tenantId: { userId: user.id, tenantId: requestedTenantId } },
        });
        if (!hasMembership) {
          try {
            await (prisma as any).tenantMembership.create({
              data: { userId: user.id, tenantId: requestedTenantId, role: "OWNER" },
            });
            tenantId = requestedTenantId;
          } catch {
            // ignore; tenant may not exist
          }
        }
      }
    }

    const devSurface = deriveSurface(req) as Surface;
    setSessionCookies(reply, { userId: String(user.id), tenantId }, devSurface);
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
    // Use signature-verified session parsing
    const sess = parseVerifiedSession(req);

    if (!sess) {
      return reply.code(401).send({ ok: false, error: "unauthorized" });
    }

    // Optional rotation if close to expiry
    const { rotateAt } = sessionLifetimes();
    if (sess.exp - Date.now() < rotateAt) {
      const meSurface = deriveSurface(req) as Surface;
      setSessionCookies(reply, { userId: sess.userId, tenantId: sess.tenantId }, meSurface);
    }

    const userRec = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: {
        id: true, email: true,
        // Optional reads guarded with any
        // @ts-ignore
        name: true,
        // @ts-ignore
        image: true,
        // @ts-ignore
        isSuperAdmin: true,
        // @ts-ignore
        defaultTenantId: true,
        // @ts-ignore
        tenantMemberships: { select: { tenantId: true, role: true }, orderBy: { tenantId: "asc" } },
      } as any,
    }) as any;

    if (!userRec) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const tenantId =
      sess.tenantId ??
      (typeof userRec.defaultTenantId === "number" ? userRec.defaultTenantId : undefined) ??
      (Array.isArray(userRec.tenantMemberships) ? userRec.tenantMemberships[0]?.tenantId : undefined);

    return reply.send({
      id: userRec.id,
      email: userRec.email,
      name: userRec.name ?? null,
      image: userRec.image ?? null,
      isSuperAdmin: !!userRec.isSuperAdmin,
      tenant: tenantId ? { id: tenantId } : null,
      memberships: (userRec.tenantMemberships || []).map((m: any) => ({ tenantId: m.tenantId, role: m.role ?? null })),
    });
  });

  /* ───── Change Password (authenticated) ───── */
  // POST /password  { currentPassword, newPassword }
  app.post("/password", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    // Use signature-verified session parsing
    const sess = parseVerifiedSession(req);

    if (!sess) {
      return reply.code(401).send({ error: "unauthorized", message: "Not authenticated" });
    }

    const { currentPassword = "", newPassword = "" } = (req.body || {}) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currPw = String(currentPassword);
    const newPw = String(newPassword);

    if (!currPw) return reply.code(400).send({ error: "current_password_required", message: "Current password is required" });
    if (!newPw) return reply.code(400).send({ error: "new_password_required", message: "New password is required" });
    if (newPw.length < 8) return reply.code(422).send({ error: "password_too_short", message: "New password must be at least 8 characters" });

    // Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: {
        id: true,
        email: true,
        // @ts-ignore
        passwordHash: true,
      } as any,
    }) as any;

    if (!user) return reply.code(401).send({ error: "unauthorized", message: "User not found" });
    if (!user.passwordHash) return reply.code(400).send({ error: "no_password_set", message: "Account does not use password authentication" });

    // Verify current password
    const valid = await bcrypt.compare(currPw, user.passwordHash).catch(() => false);
    if (!valid) return reply.code(401).send({ error: "invalid_current_password", message: "Current password is incorrect" });

    // Hash new password
    const newHash = await bcrypt.hash(newPw, 12);

    // Update password in transaction
    await prisma.$transaction(async (tx) => {
      try {
        await (tx as any).user.update({
          where: { id: sess.userId },
          data: { passwordHash: newHash, passwordUpdatedAt: new Date() } as any,
          select: { id: true },
        });
      } catch {
        // If passwordUpdatedAt column missing, try without it
        await (tx as any).user.update({
          where: { id: sess.userId },
          data: { passwordHash: newHash } as any,
          select: { id: true },
        });
      }

      // Revoke all sessions if Session table exists
      if (await detectSessionTable()) {
        try {
          await (tx as any).session.deleteMany({ where: { userId: sess.userId } });
        } catch {
          // ignore if Session table not available
        }
      }
    });

    // Clear current session cookie (user will need to re-login)
    clearSessionCookies(reply);

    return reply.send({ ok: true, message: "Password changed successfully" });
  });
}
