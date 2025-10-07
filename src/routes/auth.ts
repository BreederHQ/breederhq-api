// src/routes/auth.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import * as bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";
import crypto from "node:crypto";
import { addDays, addMinutes } from "date-fns";
import prisma from "../prisma.js";
import { Role } from "@prisma/client";

// ───────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_NAME = process.env.COOKIE_NAME || "bhq_s";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:6170";

// Basic per-IP limiter: 5 attempts/minute
const rl = new RateLimiterMemory({ points: 5, duration: 60 });

// ───────────────────────────────────────────────────────────
// Utils
// ───────────────────────────────────────────────────────────
function strongPassword(s: string) {
  return s.length >= 12 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^a-zA-Z0-9]/.test(s);
}
async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
function randomId(len = 48) { return crypto.randomBytes(len).toString("base64url"); }

async function verifyHCaptcha(token: string | null | undefined, _ip: string) {
  if (!process.env.HCAPTCHA_SECRET) return true; // off in dev
  if (!token) return false;
  // TODO: call https://hcaptcha.com/siteverify
  return true;
}

async function requireAdminToken(req: FastifyRequest, reply: FastifyReply) {
  const adminToken = process.env.ADMIN_TOKEN;
  const got = (req.headers["x-admin-token"] as string) || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (adminToken && got === adminToken) return;
  return reply.code(403).send({ message: "Forbidden" });
}

async function createSession(reply: FastifyReply, userId: string) {
  const id = randomId(32);
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS);
  await prisma.session.create({ data: { id, userId, expiresAt } });

  reply.setCookie(COOKIE_NAME, id, {
    httpOnly: true,
    secure: IS_PROD,                    // dev=false so localhost works
    sameSite: IS_PROD ? "none" : "lax", // prod cross-site cookie
    path: "/",
    domain: IS_PROD ? COOKIE_DOMAIN : undefined,
    expires: expiresAt,
  });
}

async function clearSession(reply: FastifyReply, cookieValue?: string) {
  if (cookieValue) await prisma.session.deleteMany({ where: { id: cookieValue } }).catch(() => { });
  reply.clearCookie(COOKIE_NAME, {
    path: "/",
    domain: IS_PROD ? COOKIE_DOMAIN : undefined,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
  });
}

async function createEmailVerifyToken(userId: string) {
  const token = randomId(32);
  const expiresAt = addDays(new Date(), 2);
  await prisma.verificationToken.create({
    data: { id: crypto.randomUUID(), userId, token, type: "EMAIL_VERIFY", expiresAt },
  });
  return { token, expiresAt };
}

async function sendVerifyEmail(to: string, token: string) {
  const url = `${WEB_ORIGIN}/verify?token=${encodeURIComponent(token)}`;
  console.log(`[email] Verify email to=${to} url=${url}`);
}

async function getPrimaryOrgForUser(userId: string) {
  const m = await prisma.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { id: "asc" },
  });
  return m?.organization || null;
}

// ───────────────────────────────────────────────────────────
// Routes
// ───────────────────────────────────────────────────────────
export async function authRoutes(app: FastifyInstance) {
  // GET /api/v1/session
  app.get("/api/v1/session", async (req, reply) => {
    const sid = req.cookies?.[COOKIE_NAME];
    if (!sid) return reply.code(401).send({ ok: false });

    const session = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      await clearSession(reply, sid);
      return reply.code(401).send({ ok: false });
    }

    const user = session.user;
    const org = await getPrimaryOrgForUser(user.id);

    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
      org: org ? { id: org.id, name: org.name } : null,
      roles: [],
    });
  });

  // GET /api/v1/auth/me  (legacy alias for FE)
  app.get("/api/v1/auth/me", async (req, reply) => {
    const sid = req.cookies?.[COOKIE_NAME];
    if (!sid) return reply.code(401).send({ ok: false });

    const session = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      await clearSession(reply, sid);
      return reply.code(401).send({ ok: false });
    }

    const user = session.user;
    const org = await getPrimaryOrgForUser(user.id);
    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
      org: org ? { id: org.id, name: org.name } : null,
      roles: [],
    });
  });

  // POST /api/v1/auth/login
  app.post("/api/v1/auth/login", async (req, reply) => {
    try { await rl.consume(req.ip); } catch { return reply.code(429).send({ message: "Too many attempts." }); }

    const body = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !user.hashedPass) return reply.code(400).send({ message: "Invalid email or password." });

    const ok = await verifyPassword(body.password, user.hashedPass);
    if (!ok) return reply.code(400).send({ message: "Invalid email or password." });

    if (!user.emailVerified) {
      return reply.code(403).send({ message: "Please verify your email before signing in." });
    }

    await createSession(reply, user.id);
    return reply.send({ ok: true });
  });

  // POST /api/v1/auth/logout
  app.post("/api/v1/auth/logout", async (req, reply) => {
    const sid = req.cookies?.[COOKIE_NAME];
    await clearSession(reply, sid);
    return reply.send({ ok: true });
  });

  // POST /api/v1/account/invites  (guarded)
  app.post("/api/v1/account/invites", { preHandler: [requireAdminToken] }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      organizationId: z.number().int().optional(),
      role: z.nativeEnum(Role).optional(),
      ttlMinutes: z.number().min(5).max(60 * 24 * 14).default(60 * 24 * 7),
    }).parse(req.body);

    const token = randomId(24);
    const expiresAt = addMinutes(new Date(), body.ttlMinutes);

    const invite = await prisma.invite.create({
      data: {
        email: body.email.toLowerCase(),
        organizationId: body.organizationId ?? null,
        role: body.role ?? "STAFF",
        token,
        expiresAt,
      },
    });

    const link = `${WEB_ORIGIN}/invite?token=${encodeURIComponent(token)}`;
    app.log.info({ event: "invite_created", email: body.email, organizationId: body.organizationId, link });

    return reply.code(201).send({ id: invite.id, token, link, expiresAt });
  });

  // GET /api/v1/account/invites/:token
  app.get("/api/v1/account/invites/:token", async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.params);
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.consumedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ message: "Invite not found or expired." });
    }
    return reply.send({ email: invite.email, organizationId: invite.organizationId });
  });

  // GET /api/v1/auth/dev-login
  app.get("/api/v1/auth/dev-login", async (req, reply) => {
    if (IS_PROD) return reply.code(404).send({ error: "not_found" });

    const { orgId, redirect } = z.object({
      orgId: z.coerce.number().int().optional(),
      redirect: z.string().url().optional(),
    }).parse(req.query);

    // dev user
    const devEmail = "dev@local";
    let user = await prisma.user.findUnique({ where: { email: devEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: devEmail,
          name: "Dev User",
          hashedPass: await hashPassword("dev-only-password"),
        },
      });
    }

    // org
    let org = orgId ? await prisma.organization.findUnique({ where: { id: orgId } }) : null;
    if (!org) org = await prisma.organization.create({ data: { name: "Dev Org" } });

    // membership
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { role: "ADMIN" },
      create: { userId: user.id, organizationId: org.id, role: "ADMIN" },
    });

    await createSession(reply, user.id);
    reply.redirect(redirect || "/");
  });

  // DEV helper
  if (!IS_PROD) {
    app.get("/api/v1/dev/verify-token", async (_req, reply) => {
      const rec = await prisma.verificationToken.findFirst({
        where: { type: "EMAIL_VERIFY" },
        orderBy: { expiresAt: "desc" },
      });
      if (!rec) return reply.code(404).send({ message: "none" });
      return reply.send({ token: rec.token, expiresAt: rec.expiresAt });
    });
  }

  // POST /api/v1/auth/register
  app.post("/api/v1/auth/register", async (req, reply) => {
    try { await rl.consume(req.ip); } catch { return reply.code(429).send({ message: "Too many attempts." }); }

    const body = z.object({
      token: z.string(),
      captchaToken: z.string().nullable().optional(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(12),
      displayName: z.string().optional(),
      phone: z.string().optional(),
    }).parse(req.body);

    const captchaOk = await verifyHCaptcha(body.captchaToken, req.ip);
    if (!captchaOk) return reply.code(400).send({ message: "Captcha failed." });
    if (!strongPassword(body.password)) {
      return reply.code(400).send({ message: "Password must be 12+ chars and include upper, lower, number, and symbol." });
    }

    const invite = await prisma.invite.findUnique({ where: { token: body.token } });
    if (!invite || invite.consumedAt || invite.expiresAt < new Date() ||
      invite.email.toLowerCase() !== body.email.toLowerCase()) {
      return reply.code(400).send({ message: "Invalid or expired invite." });
    }

    const org = invite.organizationId != null
      ? await prisma.organization.findUniqueOrThrow({ where: { id: invite.organizationId } })
      : await prisma.organization.create({ data: { name: `${body.firstName}'s Kennel` } });

    const hashedPass = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: body.email.toLowerCase(),
        name: `${body.firstName} ${body.lastName}`,
        hashedPass,
      },
    });

    const subscriber = await prisma.contact.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName ?? `${body.firstName} ${body.lastName}`,
        email: body.email.toLowerCase(),
        phone: body.phone ?? null,
        organizationId: org.id,
        kind: "SUBSCRIBER", // if your schema has this column; otherwise remove
      } as any,
    });

    await prisma.user.update({ where: { id: user.id }, data: { contactId: subscriber.id } });

    const role = invite.organizationId == null ? "ADMIN" : invite.role;
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: role || "STAFF" },
    });

    await prisma.invite.update({ where: { id: invite.id }, data: { consumedAt: new Date() } });

    const ver = await createEmailVerifyToken(user.id);
    await sendVerifyEmail(user.email!, ver.token);

    // Do NOT create a session yet. User must verify first.
    return reply.code(201).send({
      userId: user.id,
      orgId: org.id,
      emailVerified: false,
      next: "verify_email",
    });
  });

  // POST /api/v1/auth/verify  (idempotent)
  app.post("/api/v1/auth/verify", async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const vt = await prisma.verificationToken.findUnique({ where: { token } }).catch(() => null);
    if (!vt) return reply.send({ ok: true, already: true });

    if (vt.type !== "EMAIL_VERIFY") {
      await prisma.verificationToken.delete({ where: { id: vt.id } }).catch(() => { });
      return reply.code(400).send({ message: "Invalid token type." });
    }
    if (vt.expiresAt < new Date()) {
      await prisma.verificationToken.delete({ where: { id: vt.id } }).catch(() => { });
      return reply.code(400).send({ message: "Token expired." });
    }

    if (vt.userId) {
      await prisma.user.update({
        where: { id: vt.userId },
        data: { emailVerified: true },
      });
    } else if (vt.email) {
      // fallback if you issued token by email
      await prisma.user.updateMany({
        where: { email: vt.email.toLowerCase() },
        data: { emailVerified: true },
      });
    }

    await prisma.verificationToken.delete({ where: { id: vt.id } }).catch(() => { });
    return reply.send({ ok: true, emailVerified: true });
  });
}
export default authRoutes;