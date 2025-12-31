// src/server.ts
import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import prisma from "./prisma.js";
import {
  getCookieSecret,
  COOKIE_NAME,
  parseVerifiedSession,
} from "./utils/session.js";
import {
  deriveSurface,
  resolveActorContext,
  extractPortalTenantSlug,
  resolvePortalTenant,
  extractPlatformTenantContext,
  Surface,
  ActorContext,
  SURFACE_ACCESS_DENIED,
  ACTOR_CONTEXT_UNRESOLVABLE,
} from "./middleware/actor-context.js";

// ---------- Env ----------
const PORT = parseInt(process.env.PORT || "3000", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const IS_DEV =
  (process.env.BHQ_ENV || process.env.NODE_ENV) === "dev" ||
  String(process.env.NODE_ENV || "").toLowerCase() === "development";

// ---------- Cookie Secret (required for signed cookies) ----------
// This will throw in production if COOKIE_SECRET is not set
const COOKIE_SECRET = getCookieSecret();

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

// ---------- Cookie (signed) -----------
await app.register(cookie, {
  secret: COOKIE_SECRET, // Required for signed cookies - enforced at startup
  hook: "onRequest",
});

// ---------- Rate limit (opt-in per route) ----------
await app.register(rateLimit, {
  global: false,
  ban: 2,
});

// ---------- CORS ----------
// Dev-only: allow local Caddy HTTPS subdomains
const DEV_TEST_ORIGINS = [
  "https://app.breederhq.test",
  "https://portal.breederhq.test",
  "https://marketplace.breederhq.test",
];

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server/curl
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return cb(null, true);
    if (IS_DEV && DEV_TEST_ORIGINS.includes(origin)) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/i.test(origin)) return cb(null, true);
    app.log.warn({ origin }, "CORS: origin not allowed");
    return cb(new Error("CORS: origin not allowed"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "authorization",
    "content-type",
    "x-tenant-id",
    "x-org-id",
    "x-csrf-token",
    "x-xsrf-token",
    "x-requested-with", // fix preflight failures from fetch/axios
    "x-admin-token",    // required for admin-protected routes
    "idempotency-key",  // Finance MVP: idempotency for invoice/payment creation
  ],
  exposedHeaders: ["set-cookie"],
});

// ---------- Health & Diagnostics ----------
app.get("/healthz", async () => ({ ok: true }));
app.get("/", async () => ({ ok: true }));
app.get("/__diag", async (req, reply) => {
  // In production, only superadmins can access diagnostics
  // Non-production allows unauthenticated access for debugging
  if (!IS_DEV) {
    const sess = parseVerifiedSession(req);
    if (!sess) {
      return reply.code(404).send({ error: "not_found" });
    }
    // Check if user is superadmin
    const actor = await prisma.user.findUnique({
      where: { id: sess.userId },
      select: { isSuperAdmin: true } as any,
    }) as any;
    if (!actor?.isSuperAdmin) {
      return reply.code(404).send({ error: "not_found" });
    }
  }

  const hostname = req.hostname || "unknown";
  const surface = deriveSurface(req);

  // Derive tenant context from URL/headers only (no session details exposed)
  let resolvedTenantId: number | null = null;

  if (surface === "PORTAL") {
    const slug = extractPortalTenantSlug(req);
    if (slug) {
      const tenant = await resolvePortalTenant(slug);
      resolvedTenantId = tenant?.id ?? null;
    }
  } else if (surface === "PLATFORM") {
    const headerTenantId = req.headers["x-tenant-id"];
    if (headerTenantId) {
      const parsed = Number(headerTenantId);
      if (Number.isInteger(parsed) && parsed > 0) {
        resolvedTenantId = parsed;
      }
    }
  }

  return {
    ok: true,
    time: new Date().toISOString(),
    hostname,
    surface,
    resolvedTenantId,
    env: {
      BHQ_ENV: process.env.BHQ_ENV || "unknown",
      NODE_ENV: process.env.NODE_ENV || "unknown",
      IS_DEV,
    },
  };
});

// ---------- CSRF (double-submit cookie) ----------
function normalizePath(url?: string) {
  const pathOnly = (url || "/").split("?")[0] || "/";
  const trimmed = pathOnly.replace(/\/+$/, "");
  return trimmed || "/";
}

function isCsrfExempt(pathname: string, method: string) {
  // Auth bootstrap routes lack an existing CSRF cookie (login/logout handshake).
  if (!pathname.startsWith("/api/v1/auth")) return false;
  const m = method.toUpperCase();
  switch (pathname) {
    case "/api/v1/auth/login":
      return m === "POST";
    case "/api/v1/auth/dev-login":
    case "/api/v1/auth/logout":
      return m === "GET" || m === "POST";
    default:
      return false;
  }
}

app.addHook("preHandler", async (req, reply) => {
  // Let safe and preflight through
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const pathOnly = normalizePath(req.url);
  if (isCsrfExempt(pathOnly, m)) return;

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
    const raw = typeof body === 'string' ? body : body.toString('utf8');
    done(null, JSON.parse(raw));
  } catch (err) {
    done(err as Error);
  }
});

// Accept empty x-www-form-urlencoded bodies as {}
app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
  const raw = typeof body === 'string' ? body : body.toString('utf8');
  const obj: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    obj[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  done(null, obj);
});

// ---------- Request logging + surface derivation ----------
app.addHook("onRequest", async (req) => {
  // Derive and attach surface early for all routes
  (req as any).surface = deriveSurface(req);
  req.log.info({ m: req.method, url: req.url, surface: (req as any).surface }, "REQ");
});

// ---------- Helpers: session + membership ----------
// Session parsing now uses signature-verified parseVerifiedSession from utils/session.js

// ——— Schema drift guards for tenant tables ———
let _hasTenants: boolean | null = null;
async function detectTenants(): Promise<boolean> {
  if (_hasTenants != null) return _hasTenants;
  try {
    await (app.prisma as any).tenant.findFirst?.({ select: { id: true }, take: 1 });
    await (app.prisma as any).tenantMembership.findFirst?.({ select: { tenantId: true }, take: 1 });
    _hasTenants = true;
  } catch {
    _hasTenants = false;
  }
  return _hasTenants;
}

async function requireTenantMembership(
  app: FastifyInstance,
  req: any,
  reply: any,
  tenantId: number
) {
  // Use signature-verified session parsing
  const sess = parseVerifiedSession(req);
  if (!sess) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  (req as any).userId = sess.userId; // stash for downstream

  // If tenant tables are missing, allow through in single-tenant mode
  if (!(await detectTenants())) {
    return sess;
  }

  const actor = (await app.prisma.user.findUnique({
    where: { id: sess.userId },
    select: { isSuperAdmin: true } as any,
  })) as any;

  if (actor?.isSuperAdmin) return sess; // super admin floats across tenants

  const membership = await (app.prisma as any).tenantMembership.findUnique?.({
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
import breedingRoutes from "./routes/breeding.js";
import animalTraitsRoutes from "./routes/animal-traits.js";
import animalDocumentsRoutes from "./routes/animal-documents.js";
import authRoutes from "./routes/auth.js";
import breedsRoutes from "./routes/breeds.js";
import contactsRoutes from "./routes/contacts.js";
import organizationsRoutes from "./routes/organizations.js";
import partiesRoutes from "./routes/parties.js";
import offspringRoutes from "./routes/offspring.js";
import sessionRoutes from "./routes/session.js";
import tagsRoutes from "./routes/tags.js";
import tenantRoutes from "./routes/tenant.js";
import userRoutes from "./routes/user.js";
import waitlistRoutes from "./routes/waitlist.js"; // <— NEW
import invoicesRoutes from "./routes/invoices.js"; // Finance MVP
import paymentsRoutes from "./routes/payments.js"; // Finance MVP
import expensesRoutes from "./routes/expenses.js"; // Finance MVP
import attachmentsRoutes from "./routes/attachments.js"; // Finance Track C
import messagesRoutes from "./routes/messages.js"; // Direct Messages
import publicMarketplaceRoutes from "./routes/public-marketplace.js"; // Marketplace MVP
import portalAccessRoutes from "./routes/portal-access.js"; // Portal Access Management
import portalRoutes from "./routes/portal.js"; // Portal public routes (activation)

// ---------- Feature Flags ----------
const MARKETPLACE_PUBLIC_ENABLED = process.env.MARKETPLACE_PUBLIC_ENABLED === "true";

// ---------- TS typing: prisma + req.tenantId/req.userId/req.surface/req.actorContext/req.tenantSlug ----------
declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
  interface FastifyRequest {
    tenantId: number | null;
    userId?: string;
    surface?: Surface;
    actorContext?: ActorContext;
    tenantSlug?: string; // PORTAL only: slug from URL path
  }
}

// ---------- API v1: public/no-tenant subtree ----------
app.register(
  async (api) => {
    api.register(authRoutes, { prefix: "/auth" }); // /api/v1/auth/*
    api.register(sessionRoutes);                   // /api/v1/session/*
    api.register(accountRoutes);                   // /api/v1/account/*
    api.register(tenantRoutes);                    // /api/v1/tenants/*
    api.register(portalRoutes);                    // /api/v1/portal/* (activation - no auth)

    // Marketplace MVP: public routes (no auth required for reads, auth for inquiries)
    if (MARKETPLACE_PUBLIC_ENABLED) {
      api.register(publicMarketplaceRoutes, { prefix: "/public/marketplace" }); // /api/v1/public/marketplace/*
    }
  },
  { prefix: "/api/v1" }
);

// ---------- Global error handler ----------
app.setErrorHandler((err, req, reply) => {
  req.log.error(
    {
      err: {
        message: err.message,
        code: (err as any).code,
        meta: (err as any).meta,
        stack: err.stack,
      },
      url: req.url,
      method: req.method,
    },
    "Unhandled error"
  );

  const code = (err as any).code;
  if (code === "P2002") {
    return reply.status(409).send({ error: "duplicate", detail: (err as any).meta?.target });
  }
  if (code === "P2003") {
    return reply.status(409).send({ error: "foreign_key_conflict" });
  }
  if ((err as any).statusCode) {
    return reply.status((err as any).statusCode).send({ error: err.message });
  }
  return reply.status(500).send({ error: "internal_error" });
});


// ---------- API v1: tenant-scoped subtree ----------
app.register(
  async (api) => {
    api.decorateRequest("tenantId", null as unknown as number);

    api.addHook("preHandler", async (req, reply) => {
      const surface = (req as any).surface as Surface;

      // Normalize path (strip query) and be tolerant of prefixes
      const full = req.url || "/";
      const pathOnly = full.split("?")[0] || "/";
      const m = req.method.toUpperCase();

      // Allow-list paths (works whether path has /api/v1 or not)
      const isSpeciesPath =
        pathOnly === "/species" || pathOnly.endsWith("/api/v1/species") || pathOnly.endsWith("/species");

      const isBreedsSearchPath =
        pathOnly === "/breeds/search" ||
        pathOnly.endsWith("/api/v1/breeds/search") ||
        pathOnly.endsWith("/breeds/search");

      // 1) /species is always public (GET only)
      if (m === "GET" && isSpeciesPath) {
        (req as any).tenantId = null;
        (req as any).actorContext = "PUBLIC";
        return;
      }

      // 2) /breeds/search is public only when organizationId is NOT present
      if (m === "GET" && isBreedsSearchPath) {
        const q: any = (req as any).query || {};
        const hasOrgId = q.organizationId != null || /(^|[?&])organizationId=/.test(full);
        if (!hasOrgId) {
          (req as any).tenantId = null;
          (req as any).actorContext = "PUBLIC";
          return;
        }
        // if orgId present → require tenant/membership below
      }

      // ---------- Session verification ----------
      const sess = parseVerifiedSession(req);
      if (!sess) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      (req as any).userId = sess.userId;

      // ---------- Surface-specific tenant context resolution ----------
      let tenantId: number | null = null;

      if (surface === "PORTAL") {
        // PORTAL: tenant ONLY from URL slug - no headers, no session
        const tenantSlug = extractPortalTenantSlug(req);

        if (tenantSlug) {
          // Resolve slug to tenant ID via database
          const tenant = await resolvePortalTenant(tenantSlug);
          if (!tenant) {
            // Slug provided but tenant not found
            return reply.code(403).send({
              error: ACTOR_CONTEXT_UNRESOLVABLE,
              surface,
            });
          }
          tenantId = tenant.id;
          (req as any).tenantSlug = tenant.slug;
        }
        // If no slug, tenantId stays null (tenantless route or missing slug)

      } else if (surface === "PLATFORM") {
        // PLATFORM: tenant from X-Tenant-Id header or session
        const platformContext = extractPlatformTenantContext(req, sess);
        tenantId = platformContext.tenantId ?? null;

      }
      // MARKETPLACE: no tenant context needed, tenantId stays null

      // ---------- Surface-based ActorContext resolution ----------
      const resolved = await resolveActorContext(surface, sess.userId, tenantId);

      if (!resolved) {
        // PORTAL without tenant context or no membership → ACTOR_CONTEXT_UNRESOLVABLE
        // PLATFORM without membership → SURFACE_ACCESS_DENIED
        // MARKETPLACE should always resolve (PUBLIC)
        const errorCode = surface === "PORTAL" ? ACTOR_CONTEXT_UNRESOLVABLE : SURFACE_ACCESS_DENIED;
        return reply.code(403).send({
          error: errorCode,
          surface,
        });
      }

      (req as any).actorContext = resolved.context;

      // ---------- Verify surface/context alignment ----------
      // PLATFORM surface requires STAFF context
      if (surface === "PLATFORM" && resolved.context !== "STAFF") {
        return reply.code(403).send({
          error: SURFACE_ACCESS_DENIED,
          surface,
        });
      }

      // PORTAL surface requires CLIENT context
      if (surface === "PORTAL" && resolved.context !== "CLIENT") {
        return reply.code(403).send({
          error: SURFACE_ACCESS_DENIED,
          surface,
        });
      }

      // MARKETPLACE surface requires PUBLIC context
      if (surface === "MARKETPLACE" && resolved.context !== "PUBLIC") {
        return reply.code(403).send({
          error: SURFACE_ACCESS_DENIED,
          surface,
        });
      }

      // ---------- Final tenant context ----------
      let tId: number | null = resolved.tenantId;

      // For STAFF on PLATFORM, allow header override after initial resolution
      if (surface === "PLATFORM" && resolved.context === "STAFF") {
        const headerVal = req.headers["x-tenant-id"];
        if (headerVal && Number(headerVal) > 0) {
          tId = Number(headerVal);
        }
      }

      if (!(await detectTenants())) {
        (req as any).tenantId = tId;
        return;
      }

      // For STAFF on PLATFORM, verify tenant membership
      if (surface === "PLATFORM" && resolved.context === "STAFF") {
        if (!tId) {
          // No tenant context → 403
          return reply.code(403).send({
            error: ACTOR_CONTEXT_UNRESOLVABLE,
            surface,
          });
        }

        const ok = await requireTenantMembership(app, req, reply, tId);
        if (!ok) return;
      }

      (req as any).tenantId = tId;
    });

    // Tenant-scoped resources
    api.register(contactsRoutes);      // /api/v1/contacts/*
    api.register(partiesRoutes);       // /api/v1/parties/*
    api.register(organizationsRoutes); // /api/v1/organizations/*
    api.register(breedingRoutes);      // /api/v1/breeding/*
    api.register(animalsRoutes);       // /api/v1/animals/*
    api.register(breedsRoutes);        // /api/v1/breeds/*
    api.register(animalTraitsRoutes);  // /api/v1/animals/:animalId/traits
    api.register(animalDocumentsRoutes); // /api/v1/animals/:animalId/documents
    api.register(offspringRoutes);     // /api/v1/offspring/*
    api.register(waitlistRoutes);      // /api/v1/waitlist/*  <-- NEW global waitlist endpoints
    api.register(userRoutes);          // /api/v1/users/* and /api/v1/user
    api.register(tagsRoutes);
    api.register(invoicesRoutes);      // /api/v1/invoices/* Finance MVP
    api.register(paymentsRoutes);      // /api/v1/payments/* Finance MVP
    api.register(expensesRoutes);      // /api/v1/expenses/* Finance MVP
    api.register(attachmentsRoutes);   // /api/v1/attachments/* Finance Track C
    api.register(messagesRoutes);      // /api/v1/messages/* Direct Messages
    api.register(portalAccessRoutes);  // /api/v1/portal-access/* Portal Access Management
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
