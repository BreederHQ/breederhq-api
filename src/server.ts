// src/server.ts
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import * as cookieLib from "cookie";

import authRoutes from "./routes/auth.js";
import contactsRoutes from "./routes/contacts.js";
import animalsRoutes from "./routes/animals.js";
import organizationsRoutes from "./routes/organizations.js";
import breedsRoutes from "./routes/breeds.js";
import animalsBreedsRoutes from "./routes/animals-breeds.js";
import orgSettingsRoutes from "./routes/org-settings.js";
import tagsRoutes from "./routes/tags.js";

import prisma, { closePrisma } from "./prisma.js";


// ───────────────────────────────────────────────────────────
// Types: attach a lightweight authUser to requests
declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email?: string;
      orgId?: number;
      role?: "ADMIN" | "STAFF" | "MEMBER" | "VIEWER";
    } | null;
  }
  interface FastifyReply {
    setSessionCookie(value: string, ttlSeconds?: number): void;
    clearSessionCookie(): void;
  }
}

const IS_PROD = (process.env.NODE_ENV || "development") === "production";
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 6001);
const HOST = process.env.HOST || "0.0.0.0";

const COOKIE_NAME = process.env.COOKIE_NAME || "bhq_s";
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);
const COOKIE_DOMAIN = IS_PROD ? (process.env.SESSION_COOKIE_DOMAIN || ".breederhq.com") : undefined;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// ───────────────────────────────────────────────────────────
// Factory: build the app without starting it
function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    ignoreTrailingSlash: true,
    caseSensitive: false,
  });

  // Plugins (register BEFORE routes)
  app.register(cookie, {
    secret: process.env.COOKIE_SECRET || "dev-cookie-secret",
    hook: "onRequest",
  });

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = (process.env.ALLOWED_ORIGINS || "")
        .split(",").map(s => s.trim()).filter(Boolean);

      if (NODE_ENV === "production") {
        const breederhq = /^https:\/\/([a-z0-9-]+\.)?breederhq\.com$/i.test(origin);
        if (breederhq || allowed.includes(origin)) return cb(null, true);
        return cb(null, false); // ← deny without throwing
      } else {
        // In dev: allow if list is empty (default) OR explicitly listed.
        if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
        return cb(null, false); // ← deny without throwing (no 500)
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Org-Id"],
    exposedHeaders: ["set-cookie"],
  });

  // Reply helpers
  app.decorateReply("setSessionCookie", function (value: string, ttlSeconds: number = SESSION_TTL_SECONDS) {
    const set = cookieLib.serialize(COOKIE_NAME, value, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? "none" : "lax",
      domain: COOKIE_DOMAIN,
      path: "/",
      maxAge: ttlSeconds,
    });
    this.header("Set-Cookie", set);
  });

  app.decorateReply("clearSessionCookie", function () {
    const set = cookieLib.serialize(COOKIE_NAME, "", {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? "none" : "lax",
      domain: COOKIE_DOMAIN,
      path: "/",
      maxAge: 0,
    });
    this.header("Set-Cookie", set);
  });

  // Health
  app.get("/health", async () => ({ ok: true }));
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/__diag", async () => ({ ok: true, env: NODE_ENV }));
  app.get("/__dbcheck", async () => {
    // will throw if DATABASE_URL is missing or connection fails
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, db: "connected" };
  });


  // S2S guard for /api/s2s/*
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS") return;
    if (req.url === "/health" || req.url === "/healthz" || req.url === "/__diag") return;
    if (req.url.startsWith("/api/v1/auth/")) return; // public auth endpoints

    if (req.url.startsWith("/api/s2s/")) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token || token !== ADMIN_TOKEN) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    }
  });

  // Attach req.authUser from cookie session for /api/*
  app.addHook("preHandler", async (req, reply) => {
    // @ts-ignore
    req.authUser = null;

    if (!req.url.startsWith("/api/")) return;

    // @ts-ignore - injected by @fastify/cookie
    const sid = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!sid) return;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) return;

    // ---- Block access to app APIs until email is verified ----
    // Allow-list public endpoints (auth flows, invites, health).
    const isPublic =
      req.url.startsWith("/api/v1/auth/") ||            // login, logout, register, verify, me
      req.url.startsWith("/api/v1/account/invites") ||  // invite prefill
      req.url === "/api/v1/session" ||                  // allow session introspection
      req.url === "/health" || req.url === "/healthz" || req.url === "/__diag";

    if (!isPublic) {
      const user = session.user as { emailVerified?: boolean } | null;
      if (user && user.emailVerified === false) {
        return reply.code(403).send({
          error: "email_unverified",
          message: "Please verify your email before using the app.",
        });
      }
    }


    const memberships = await prisma.membership.findMany({
      where: { userId: session.userId },
      select: { organizationId: true, role: true },
    });

    let orgId: number | undefined;
    let role: "ADMIN" | "STAFF" | "MEMBER" | "VIEWER" | undefined;

    if (!orgId && memberships.length > 0 && NODE_ENV !== "production") {
      orgId = memberships[0].organizationId;
      role = memberships[0].role as any;
      req.log.warn({ userId: session.userId, orgId }, "DEV: auto-selected orgId; set X-Org-Id to override");
    }

    if (memberships.length === 1 && !orgId) {
      orgId = memberships[0].organizationId;
      role = memberships[0].role as any;
    } else if (memberships.length > 1 && !orgId) {
      const hdr = req.headers["x-org-id"];
      let desired = hdr ? Number(hdr) : NaN;

      if (!Number.isFinite(desired) && NODE_ENV !== "production") {
        const fromEnv = Number(process.env.DEFAULT_DEV_ORG_ID);
        if (Number.isFinite(fromEnv)) desired = fromEnv;
      }

      let match = Number.isFinite(desired)
        ? memberships.find((m) => m.organizationId === desired)
        : undefined;

      if (!match && NODE_ENV !== "production") {
        match = memberships[0];
        req.log.warn({ userId: session.userId, picked: match.organizationId }, "DEV: fell back to first org");
      }

      if (match) {
        orgId = match.organizationId;
        role = match.role as any;
      } else {
        return reply.code(400).send({ error: "org_required", message: "Specify X-Org-Id for multi-org users" });
      }
    }

    // @ts-ignore
    req.authUser = { id: session.userId, email: session.user?.email ?? undefined, orgId, role };

    // Optional rolling session extension
    const ttlSec = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);
    const ttlMs = ttlSec * 1000;
    const rollIfLessThan = Math.min(ttlMs / 2, 7 * 24 * 60 * 60 * 1000);
    if (session.expiresAt.getTime() - Date.now() < rollIfLessThan) {
      const newExp = new Date(Date.now() + ttlMs);
      await prisma.session.update({ where: { id: sid }, data: { expiresAt: newExp } });
    }
  });

  if (NODE_ENV !== "production") {
    app.addHook("onRoute", (r) => {
      app.log.info({ method: r.method, url: r.url }, "ROUTE");
    });
  }

  // Register routes (ONCE) - Routes use absolute /api/v1/* inside the files
  app.register(authRoutes);
  app.register(contactsRoutes);
  app.register(animalsRoutes);
  app.register(tagsRoutes);
  app.register(organizationsRoutes);
  app.register(orgSettingsRoutes);
  app.register(breedsRoutes);
  app.register(animalsBreedsRoutes);

  // DEV org utilities under /api/s2s/* (guarded by ADMIN_TOKEN)
  if (!IS_PROD) {
    app.register(async (instance) => {
      try {
        const m = await import("./routes/dev-org.js");
        await instance.register(m.default);
        instance.log.info("dev-org routes registered");
      } catch (err) {
        instance.log.error({ err }, "Failed to load dev-org routes");
      }
    });
  }

  // 404 + error handlers
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: "not_found", path: req.url });
  });

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as any).statusCode || 500;
    reply.code(status).send({
      error: status === 500 ? "internal_error" : "request_error",
      message: err.message,
    });
  });

  app.addHook("onClose", async () => {
    try { await closePrisma(); } catch { /* noop */ }
  });

  return app;
}

// ───────────────────────────────────────────────────────────
// Singleton guard to avoid re-registering routes in dev HMR
declare global {
  // eslint-disable-next-line no-var
  var __BHQ_APP__: FastifyInstance | undefined;
}
export const appSingleton = globalThis.__BHQ_APP__ ?? (globalThis.__BHQ_APP__ = buildServer());

// Start unless explicitly disabled (e.g., tests set BHQ_NO_LISTEN=1)
async function start() {
  if (process.env.BHQ_NO_LISTEN === "1") {
    appSingleton.log.info("BHQ_NO_LISTEN=1 set; not starting HTTP listener.");
    return;
  }

  // Avoid double-listen in hot-reload
  if (!appSingleton.server.listening) {
    await appSingleton.listen({ port: PORT, host: HOST });
    appSingleton.log.info(`API listening on http://${HOST}:${PORT}`);
  }
}

start().catch((err) => {
  appSingleton.log.error(err);
  process.exit(1);
});
