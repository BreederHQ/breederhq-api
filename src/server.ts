// src/server.ts
import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import prisma from "./prisma.js";

// ---------- Env ----------
const PORT = parseInt(process.env.PORT || "3000", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const IS_DEV =
  (process.env.BHQ_ENV || process.env.NODE_ENV) === "dev" ||
  String(process.env.NODE_ENV || "").toLowerCase() === "development";

// ---------- App ----------
const app: FastifyInstance = Fastify({
  logger: true,
  trustProxy: true,
  routerOptions: { ignoreTrailingSlash: true },
});

// ---------- Decorators ----------
app.decorate("prisma", prisma as any);

// ---------- Security ----------
await app.register(helmet, { contentSecurityPolicy: false });

// ---------- Cookie -----------
await app.register(cookie, {
  // secret: process.env.COOKIE_SECRET, // uncomment to sign cookies
  hook: "onRequest",
});

// ---------- Rate limit (opt-in per route) ----------
await app.register(rateLimit, {
  global: false,
  ban: 2,
});

// ---------- CORS ----------
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server/curl
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/i.test(origin)) return cb(null, true);
    return cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "authorization",
    "content-type",
    "x-tenant-id", // tenant context
    "x-org-id",    // legacy, harmless
    "x-csrf-token",
    "x-xsrf-token",
  ],
  exposedHeaders: ["set-cookie"],
});

// ---------- Health & Diagnostics ----------
app.get("/healthz", async () => ({ ok: true }));
app.get("/", async () => ({ ok: true }));
app.get("/__diag", async () => ({
  ok: true,
  time: new Date().toISOString(),
  env: {
    BHQ_ENV: process.env.BHQ_ENV || "unknown",
    NODE_ENV: process.env.NODE_ENV || "unknown",
    ALLOWED_ORIGINS,
    IS_DEV,
  },
}));

// ---------- CSRF (double-submit cookie) ----------
app.addHook("preHandler", async (req, reply) => {
  // Let safe and preflight through
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  // Auth endpoints: they set/clear CSRF themselves
  if (req.url.startsWith("/api/v1/auth/")) return;

  const csrfHeader = req.headers["x-csrf-token"];
  const csrfCookie = req.cookies?.["XSRF-TOKEN"];
  if (!csrfHeader || !csrfCookie || String(csrfHeader) !== String(csrfCookie)) {
    return reply.code(403).send({ error: "csrf_failed" });
  }
});

// Tolerate empty POST bodies on /auth/logout
app.addHook("preValidation", (req, _reply, done) => {
  if (req.method === "POST" && req.url.includes("/auth/logout") && req.body == null) {
    (req as any).body = {};
  }
  done();
});

// Accept JSON with charset, like "application/json; charset=utf-8"
app.addContentTypeParser(/^application\/json($|;)/i, { parseAs: "string" }, (req, body, done) => {
  try {
    if (!body || body.trim() === "") return done(null, {});
    done(null, JSON.parse(body));
  } catch (err) {
    done(err as Error);
  }
});

// Accept empty x-www-form-urlencoded bodies as {}
app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
  if (!body || body.trim() === "") return done(null, {});
  const obj: Record<string, string> = {};
  for (const pair of body.split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    obj[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  done(null, obj);
});

// ---------- Request logging ----------
app.addHook("onRequest", async (req) => {
  req.log.info({ m: req.method, url: req.url }, "REQ");
});

// ---------- Helpers: session + membership ----------
const COOKIE_NAME = process.env.COOKIE_NAME || "bhq_s";
function parseSessionCookie(raw?: string | null) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8"));
    if (!obj?.userId || !obj?.exp) return null;
    if (Date.now() >= Number(obj.exp)) return null;
    return obj as { userId: string; tenantId?: number; iat: number; exp: number };
  } catch {
    return null;
  }
}

async function requireTenantMembership(
  app: FastifyInstance,
  req: any,
  reply: any,
  tenantId: number
) {
  const sess = parseSessionCookie(req.cookies?.[COOKIE_NAME]);
  if (!sess) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  (req as any).userId = sess.userId; // stash for downstream

  const actor = await app.prisma.user.findUnique({
    where: { id: sess.userId },
    select: { isSuperAdmin: true },
  });

  if (actor?.isSuperAdmin) return sess; // super admin floats across tenants

  const membership = await app.prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: sess.userId, tenantId } },
    select: { tenantId: true },
  });
  if (!membership) {
    reply.code(403).send({ error: "forbidden_tenant" });
    return null;
  }
  return sess;
}

// ---------- Route imports ----------
import accountRoutes from "./routes/account.js";
import animalsRoutes from "./routes/animals.js";
import authRoutes from "./routes/auth.js";
import breedsRoutes from "./routes/breeds.js";
import contactsRoutes from "./routes/contacts.js";
import organizationsRoutes from "./routes/organizations.js";
import sessionRoutes from "./routes/session.js";
import tagsRoutes from "./routes/tags.js";
import tenantRoutes from "./routes/tenant.js";
import userRoutes from "./routes/user.js";

// ---------- TS typing: prisma + req.tenantId/req.userId ----------
declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
  interface FastifyRequest {
    tenantId: number | null;
    userId?: string;
  }
}

// ---------- API v1: public/no-tenant subtree ----------
// (Auth, session, account, global admin-like)
app.register(
  async (api) => {
    api.register(authRoutes, { prefix: "/auth" }); // /api/v1/auth/*
    api.register(sessionRoutes);                   // /api/v1/session/*
    api.register(accountRoutes);                   // /api/v1/account/*
    api.register(tenantRoutes);                    // /api/v1/tenants/*
  },
  { prefix: "/api/v1" }
);

// ---------- API v1: tenant-scoped subtree ----------
// Header X-Tenant-Id preferred; falls back to cookie session tenant.
// Enforces membership (or super admin).
app.register(
  async (api) => {
    api.decorateRequest("tenantId", null as unknown as number);

    api.addHook("preHandler", async (req, reply) => {
      // 1) Resolve tenant: header → session fallback
      const headerVal = req.headers["x-tenant-id"];
      let tId = headerVal ? Number(headerVal) : undefined;
      if (!tId || !Number.isInteger(tId) || tId <= 0) {
        const sess = parseSessionCookie(req.cookies?.[COOKIE_NAME]);
        if (sess?.tenantId && Number.isInteger(sess.tenantId) && sess.tenantId > 0) {
          tId = sess.tenantId;
        }
      }
      if (!tId) {
        return reply
          .code(400)
          .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
      }

      // 2) Enforce membership (unless super admin)
      const ok = await requireTenantMembership(app, req, reply, tId);
      if (!ok) return;

      (req as any).tenantId = tId;
    });

    // Tenant-scoped resources
    api.register(contactsRoutes);      // /api/v1/contacts/*
    api.register(organizationsRoutes); // /api/v1/organizations/*
    api.register(animalsRoutes);       // /api/v1/animals/*
    api.register(breedsRoutes);        // /api/v1/breeds/*
    api.register(userRoutes);          // /api/v1/users/* and /api/v1/user
    api.register(tagsRoutes);
  },
  { prefix: "/api/v1" }
);

// ---------- Not Found ----------
app.setNotFoundHandler((req, reply) => {
  req.log.warn({ m: req.method, url: req.url }, "NOT FOUND");
  reply.code(404).send({ ok: false, error: "Not found" });
});

// ---------- Start ----------
export async function start() {
  try {
    await app.ready();
    app.printRoutes();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`API listening on :${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

// ---------- Shutdown ----------
process.on("SIGTERM", async () => {
  app.log.info("SIGTERM received, closing");
  await app.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  app.log.info("SIGINT received, closing");
  await app.close();
  process.exit(0);
});
