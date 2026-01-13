// src/server.ts
import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import prisma from "./prisma.js";
import {
  getCookieSecret,
  parseVerifiedSession,
  validateCsrfToken,
  Surface as SessionSurface,
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
import { auditFailure } from "./services/audit.js";

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
// IMPORTANT: Uses in-memory store by default. For production with multiple API instances,
// configure a shared store (Redis) to enforce rate limits across all instances.
// See: https://github.com/fastify/fastify-rate-limit#custom-store
await app.register(rateLimit, {
  global: false,
  ban: 2,
  errorResponseBuilder: (_req, _context) => ({ error: "RATE_LIMITED" }),
});

// ---------- WebSocket ----------
await app.register(websocket);

// ---------- CORS ----------
// Production: always allow these origins for breederhq.com subdomains
const PROD_ORIGINS = [
  "https://app.breederhq.com",
  "https://portal.breederhq.com",
  "https://marketplace.breederhq.com",
];

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
    if (ALLOWED_ORIGINS.includes(origin) || PROD_ORIGINS.includes(origin) || /\.vercel\.app$/i.test(origin)) return cb(null, true);
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
    const diagSurface = deriveSurface(req) as SessionSurface;
    const sess = parseVerifiedSession(req, diagSurface);
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

// ---------- CSRF (surface-bound double-submit cookie) + Origin Validation ----------
function normalizePath(url?: string) {
  const pathOnly = (url || "/").split("?")[0] || "/";
  const trimmed = pathOnly.replace(/\/+$/, "");
  return trimmed || "/";
}

/**
 * CSRF exemption list - keep minimal!
 * Login is exempt because the user doesn't have a CSRF cookie yet.
 * Registration is exempt for same reason.
 * dev-login is exempt (dev only).
 */
function isCsrfExempt(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m !== "POST") return false;

  // Auth bootstrap routes - user has no CSRF token yet
  if (pathname === "/api/v1/auth/login") return true;
  if (pathname === "/api/v1/auth/register") return true;
  if (pathname === "/api/v1/auth/dev-login") return true;
  // Logout is NOT exempt - requires CSRF to prevent logout CSRF attacks

  // Marketplace auth bootstrap routes - session-based with MARKETPLACE surface
  if (pathname === "/api/v1/marketplace/auth/login") return true;
  if (pathname === "/api/v1/marketplace/auth/register") return true;
  if (pathname === "/api/v1/marketplace/auth/logout") return true;
  if (pathname === "/api/v1/marketplace/auth/verify-email") return true;
  if (pathname === "/api/v1/marketplace/auth/forgot-password") return true;
  if (pathname === "/api/v1/marketplace/auth/reset-password") return true;

  // Portal activation - user may not have CSRF token for portal surface yet
  if (pathname === "/api/v1/portal/activate") return true;
  if (pathname.startsWith("/api/v1/portal/invites/") && pathname.endsWith("/accept")) return true;

  // Stripe webhook - verified by Stripe signature, not CSRF
  if (pathname === "/api/v1/billing/webhooks/stripe") return true;

  // Resend inbound email webhook - verified by Resend signature, not CSRF
  if (pathname === "/api/v1/webhooks/resend/inbound") return true;

  return false;
}

/**
 * Validate Origin header for state-changing requests.
 * Returns { valid: true } or { valid: false, detail: string }.
 */
function validateOrigin(
  origin: string | undefined,
  requestHost: string,
  surface: Surface
): { valid: true } | { valid: false; detail: string } {
  // If no Origin header, check if this is likely a server-to-server request
  // Browsers always send Origin for cross-origin requests and for same-origin POST/etc
  if (!origin) {
    // For now, allow missing Origin for backward compatibility with some clients
    // This is less strict but avoids breaking existing integrations
    // The CSRF token check provides the primary protection
    return { valid: true };
  }

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname.toLowerCase();

    // Define allowed origin hosts per surface
    // In production: exact subdomain match
    // In dev: allow localhost variants and .test domains
    const isLocalhost = originHost === "localhost" || originHost === "127.0.0.1";
    const isTestDomain = originHost.endsWith(".breederhq.test");

    // Allow local dev origins on any surface
    if (IS_DEV && (isLocalhost || isTestDomain)) {
      return { valid: true };
    }

    // Production: validate origin matches surface
    switch (surface) {
      case "PLATFORM":
        if (originHost === "app.breederhq.com" ||
            originHost.startsWith("app-") && originHost.endsWith(".vercel.app")) {
          return { valid: true };
        }
        break;
      case "PORTAL":
        if (originHost === "portal.breederhq.com" ||
            originHost.startsWith("portal-") && originHost.endsWith(".vercel.app")) {
          return { valid: true };
        }
        break;
      case "MARKETPLACE":
        if (originHost === "marketplace.breederhq.com" ||
            originHost.startsWith("marketplace-") && originHost.endsWith(".vercel.app")) {
          return { valid: true };
        }
        break;
    }

    // In dev mode, be more permissive for development convenience
    if (IS_DEV) {
      return { valid: true };
    }

    return { valid: false, detail: "origin_mismatch" };
  } catch {
    return { valid: false, detail: "invalid_origin" };
  }
}

app.addHook("preHandler", async (req, reply) => {
  // Let safe and preflight methods through
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const pathOnly = normalizePath(req.url);
  const surface = (req as any).surface as Surface;

  // Check exemptions first
  if (isCsrfExempt(pathOnly, m)) return;

  // 1) Validate Origin header
  const originHeader = req.headers.origin as string | undefined;
  const originResult = validateOrigin(originHeader, req.hostname || "", surface);
  if (!originResult.valid) {
    // Audit CSRF failure (origin mismatch)
    await auditFailure(req, "CSRF_FAILED", {
      reason: originResult.detail,
      origin: originHeader || null,
      surface,
      path: pathOnly,
    });
    return reply.code(403).send({
      error: "CSRF_FAILED",
      detail: originResult.detail,
      surface,
    });
  }

  // 2) Validate surface-bound CSRF token
  const csrfHeader = req.headers["x-csrf-token"] as string | undefined;
  const csrfCookie = req.cookies?.["XSRF-TOKEN"];
  const csrfResult = validateCsrfToken(csrfHeader, csrfCookie, surface as SessionSurface);

  if (!csrfResult.valid) {
    // Audit CSRF failure (token mismatch/missing/surface mismatch)
    await auditFailure(req, "CSRF_FAILED", {
      reason: csrfResult.detail,
      surface,
      path: pathOnly,
    });
    return reply.code(403).send({
      error: "CSRF_FAILED",
      detail: csrfResult.detail,
      surface,
    });
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

    // Save raw body for webhook signature verification (Stripe, Resend)
    if (req.url?.includes('/billing/webhooks/stripe') || req.url?.includes('/webhooks/resend/')) {
      (req as any).rawBody = Buffer.from(raw, 'utf8');
    }

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

// ---------- Request logging + surface derivation + UNKNOWN rejection ----------
app.addHook("onRequest", async (req, reply) => {
  // Derive and attach surface early for all routes
  const surface = deriveSurface(req);
  (req as any).surface = surface;
  req.log.info({ m: req.method, url: req.url, surface }, "REQ");

  // In production, reject UNKNOWN surfaces immediately (before any auth logic)
  if (surface === "UNKNOWN") {
    await auditFailure(req, "AUTH_SURFACE_DENIED", {
      reason: "unknown_hostname",
      hostname: req.hostname || "unknown",
    });
    return reply.code(403).send({
      error: SURFACE_ACCESS_DENIED,
      surface: "UNKNOWN",
    });
  }
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
  // Use signature-verified session parsing with surface-specific cookie
  const surface = deriveSurface(req) as SessionSurface;
  const sess = parseVerifiedSession(req, surface);
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
    // Audit tenant access denied
    await auditFailure(req, "AUTH_TENANT_DENIED", {
      reason: "forbidden_tenant",
      tenantId,
      userId: sess.userId,
    });
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
import marketplaceAssetsRoutes from "./routes/marketplace-assets.js"; // Marketplace assets (auth-gated)
import marketplaceProfileRoutes from "./routes/marketplace-profile.js"; // Marketplace profile (draft/publish)
import marketplaceBreedersRoutes from "./routes/marketplace-breeders.js"; // Public breeder profiles (no auth)
import marketplaceWaitlistRoutes from "./routes/marketplace-waitlist.js"; // Marketplace waitlist requests
import marketplaceMessagesRoutes from "./routes/marketplace-messages.js"; // Marketplace messaging (buyer-to-breeder)
import marketplaceAuthRoutes from "./routes/marketplace-auth.js"; // Marketplace authentication (JWT-based)
import marketplaceProvidersRoutes from "./routes/marketplace-providers.js"; // Marketplace provider registration
import marketplaceListingsRoutes from "./routes/marketplace-listings.js"; // Marketplace service listings
import marketplaceTransactionsRoutes from "./routes/marketplace-transactions.js"; // Marketplace transactions & payments
import marketplaceTransactionMessagesRoutes from "./routes/marketplace-transaction-messages.js"; // Marketplace transaction messaging
import marketplaceWebsocketRoutes from "./routes/marketplace-websocket.js"; // Marketplace WebSocket for real-time messaging
import marketplaceReviewsRoutes from "./routes/marketplace-reviews.js"; // Marketplace reviews & ratings
import marketplaceAdminRoutes from "./routes/marketplace-admin.js"; // Marketplace admin dashboard
import marketplaceSavedRoutes from "./routes/marketplace-saved.js"; // Marketplace saved items (favorites)
import marketplaceNotificationsRoutes from "./routes/marketplace-notifications.js"; // Marketplace notification counts
import portalAccessRoutes from "./routes/portal-access.js"; // Portal Access Management
import portalRoutes from "./routes/portal.js"; // Portal public routes (activation)
import portalDataRoutes from "./routes/portal-data.js"; // Portal read-only data surfaces
import portalProfileRoutes from "./routes/portal-profile.js"; // Portal profile self-service
import portalSchedulingRoutes from "./routes/portal-scheduling.js"; // Portal scheduling endpoints
import schedulingRoutes from "./routes/scheduling.js"; // Staff scheduling endpoints (calendar)
import businessHoursRoutes from "./routes/business-hours.js"; // Business hours settings
import adminMarketplaceRoutes from "./routes/admin-marketplace.js"; // Admin marketplace management
import adminBreederReportsRoutes from "./routes/admin-breeder-reports.js"; // Admin breeder reports
import adminSubscriptionRoutes from "./routes/admin-subscriptions.js"; // Admin subscription management
import adminFeatureRoutes from "./routes/admin-features.js"; // Admin feature registry & analytics
import marketplaceReportBreederRoutes from "./routes/marketplace-report-breeder.js"; // Marketplace report breeder
import usageRoutes from "./routes/usage.js"; // Usage and quota dashboard
import billingRoutes from "./routes/billing.js"; // Billing and Stripe integration
import settingsRoutes from "./routes/settings.js"; // User settings (genetics disclaimer, etc.)
import titlesRoutes from "./routes/titles.js"; // Title definitions and animal titles
import competitionsRoutes from "./routes/competitions.js"; // Competition entry tracking
import dashboardRoutes from "./routes/dashboard.js"; // Dashboard Mission Control
import partyCrmRoutes from "./routes/party-crm.js"; // Party CRM (notes, events, milestones, emails)
import templatesRoutes from "./routes/templates.js"; // Email/message templates
import communicationsRoutes from "./routes/communications.js"; // Communications Hub inbox
import draftsRoutes from "./routes/drafts.js"; // Draft messages/emails
import animalLinkingRoutes from "./routes/animal-linking.js"; // Cross-tenant animal linking
import messagingHubRoutes from "./routes/messaging-hub.js"; // MessagingHub - send to any email
import websocketRoutes from "./routes/websocket.js"; // WebSocket for real-time messaging
import breedingProgramsRoutes from "./routes/breeding-programs.js"; // Breeding Programs (marketplace)
import breederServicesRoutes from "./routes/breeder-services.js"; // Breeder Services (marketplace)
import serviceProviderRoutes from "./routes/service-provider.js"; // Service Provider portal
import animalVaccinationsRoutes from "./routes/animal-vaccinations.js"; // Animal vaccinations tracking
import resendWebhooksRoutes from "./routes/webhooks-resend.js"; // Resend inbound email webhooks


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
    api.register(billingRoutes, { prefix: "/billing" }); // /api/v1/billing/webhooks/* (Stripe webhooks - no auth)
    api.register(settingsRoutes); // /api/v1/settings/* (user settings)
    api.register(websocketRoutes); // /api/v1/ws/* WebSocket for real-time messaging
    api.register(resendWebhooksRoutes, { prefix: "/webhooks/resend" }); // /api/v1/webhooks/resend/* (Resend inbound email)
    api.register(marketplaceAuthRoutes, { prefix: "/marketplace/auth" }); // /api/v1/marketplace/auth/* (JWT-based auth for marketplace)
    api.register(marketplaceProvidersRoutes, { prefix: "/marketplace/providers" }); // /api/v1/marketplace/providers/* (Provider registration & management)
    api.register(marketplaceListingsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/* (Service listing management)
    api.register(marketplaceTransactionsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/* (Transactions & payments)
    api.register(marketplaceTransactionMessagesRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/* (Transaction messaging)
    api.register(marketplaceWebsocketRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/ws (WebSocket for real-time messaging)
    api.register(marketplaceReviewsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/* (Reviews & ratings)
    api.register(marketplaceAdminRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/admin/* (Admin dashboard)
    api.register(marketplaceSavedRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/saved/* (Saved items/favorites)
    api.register(marketplaceNotificationsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/notifications/* (Notification counts)

    // Marketplace routes moved to authenticated subtree for entitlement-gated access
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

      // 3) /marketplace/breeders and /marketplace/breeders/:tenantSlug are public (GET only)
      // These endpoints are accessible without authentication from any surface
      // Note: pathOnly may or may not include /api/v1 prefix depending on how request is routed
      const isBreedersListPath =
        pathOnly === "/marketplace/breeders" ||
        pathOnly === "/api/v1/marketplace/breeders" ||
        pathOnly.endsWith("/marketplace/breeders");
      const isBreedersDetailPath =
        /\/marketplace\/breeders\/[^/]+$/.test(pathOnly);
      if (m === "GET" && (isBreedersListPath || isBreedersDetailPath)) {
        // Skip all auth/context checks - these are fully public endpoints
        (req as any).tenantId = null;
        (req as any).userId = null;
        (req as any).actorContext = "PUBLIC";
        return; // Exit hook early - no session/tenant/context verification needed
      }

      // ---------- Session verification ----------
      // Use surface-specific cookie for session isolation across subdomains
      const sess = parseVerifiedSession(req, surface as SessionSurface);
      if (!sess) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      (req as any).userId = sess.userId;

      // ---------- Surface-specific tenant context resolution ----------
      let tenantId: number | null = null;

      if (surface === "PORTAL") {
        // PORTAL: tenant from URL slug preferred, but allow X-Tenant-Id header for authenticated data routes
        const tenantSlug = extractPortalTenantSlug(req);

        if (tenantSlug) {
          // Resolve slug to tenant ID via database
          const tenant = await resolvePortalTenant(tenantSlug);
          if (!tenant) {
            // Slug provided but tenant not found
            await auditFailure(req, "AUTH_TENANT_CONTEXT_REQUIRED", {
              reason: "tenant_slug_not_found",
              tenantSlug,
              surface,
            });
            return reply.code(403).send({
              error: ACTOR_CONTEXT_UNRESOLVABLE,
              surface,
            });
          }
          tenantId = tenant.id;
          (req as any).tenantSlug = tenant.slug;
        } else {
          // No slug in URL - check for X-Tenant-Id header (authenticated data routes)
          // This allows portal frontend to call /api/v1/portal/* without slug in path
          const headerTenantId = req.headers["x-tenant-id"];
          if (headerTenantId) {
            const parsed = Number(headerTenantId);
            if (Number.isInteger(parsed) && parsed > 0) {
              tenantId = parsed;
            }
          }
        }
        // If still no tenant, tenantId stays null (tenantless route or missing context)

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
        const auditAction = surface === "PORTAL" ? "AUTH_TENANT_CONTEXT_REQUIRED" : "AUTH_SURFACE_DENIED";
        await auditFailure(req, auditAction, {
          reason: "actor_context_unresolvable",
          surface,
          tenantId,
          userId: sess.userId,
        });
        return reply.code(403).send({
          error: errorCode,
          surface,
        });
      }

      (req as any).actorContext = resolved.context;

      // ---------- Verify surface/context alignment ----------
      // PLATFORM surface requires STAFF context
      if (surface === "PLATFORM" && resolved.context !== "STAFF") {
        await auditFailure(req, "AUTH_SURFACE_DENIED", {
          reason: "platform_requires_staff",
          surface,
          actualContext: resolved.context,
          userId: sess.userId,
          tenantId,
        });
        return reply.code(403).send({
          error: SURFACE_ACCESS_DENIED,
          surface,
        });
      }

      // PORTAL surface requires CLIENT context
      if (surface === "PORTAL" && resolved.context !== "CLIENT") {
        await auditFailure(req, "AUTH_SURFACE_DENIED", {
          reason: "portal_requires_client",
          surface,
          actualContext: resolved.context,
          userId: sess.userId,
          tenantId,
        });
        return reply.code(403).send({
          error: SURFACE_ACCESS_DENIED,
          surface,
        });
      }

      // MARKETPLACE surface requires PUBLIC context
      if (surface === "MARKETPLACE" && resolved.context !== "PUBLIC") {
        await auditFailure(req, "MARKETPLACE_ACCESS_DENIED", {
          reason: "marketplace_requires_public",
          surface,
          actualContext: resolved.context,
          userId: sess.userId,
        });
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

      // For STAFF on PLATFORM, verify tenant membership (except for marketplace routes)
      if (surface === "PLATFORM" && resolved.context === "STAFF") {
        // Marketplace routes don't require tenant context - they're cross-tenant
        // Use exact prefix match to avoid bypassing tenant checks on unrelated routes
        const isMarketplacePath =
          pathOnly === "/marketplace" ||
          pathOnly.startsWith("/marketplace/") ||
          pathOnly === "/api/v1/marketplace" ||
          pathOnly.startsWith("/api/v1/marketplace/");

        if (!isMarketplacePath) {
          if (!tId) {
            // No tenant context → 403 (non-marketplace routes require tenant)
            await auditFailure(req, "AUTH_TENANT_CONTEXT_REQUIRED", {
              reason: "tenant_required_for_platform_route",
              surface,
              userId: sess.userId,
              path: pathOnly,
            });
            return reply.code(403).send({
              error: ACTOR_CONTEXT_UNRESOLVABLE,
              surface,
            });
          }

          const ok = await requireTenantMembership(app, req, reply, tId);
          if (!ok) return;
        }
      }

      (req as any).tenantId = tId;
    });

    // Dashboard Mission Control
    api.register(dashboardRoutes);     // /api/v1/dashboard/*

    // Tenant-scoped resources
    api.register(contactsRoutes);      // /api/v1/contacts/*
    api.register(partiesRoutes);       // /api/v1/parties/*
    api.register(partyCrmRoutes);      // /api/v1/parties/:partyId/notes|events|milestones|emails|activity
    api.register(templatesRoutes);     // /api/v1/templates/* Email/message templates
    api.register(organizationsRoutes); // /api/v1/organizations/*
    api.register(breedingRoutes);      // /api/v1/breeding/*
    api.register(breedingProgramsRoutes); // /api/v1/breeding/programs/*
    api.register(breederServicesRoutes); // /api/v1/services/* (breeder service listings)
    api.register(animalsRoutes);       // /api/v1/animals/*
    api.register(breedsRoutes);        // /api/v1/breeds/*
    api.register(animalTraitsRoutes);  // /api/v1/animals/:animalId/traits
    api.register(animalDocumentsRoutes); // /api/v1/animals/:animalId/documents
    api.register(animalVaccinationsRoutes); // /api/v1/animals/:animalId/vaccinations, /api/v1/vaccinations/protocols
    api.register(titlesRoutes);        // /api/v1/animals/:animalId/titles, /api/v1/title-definitions
    api.register(competitionsRoutes);  // /api/v1/animals/:animalId/competitions, /api/v1/competitions/*
    api.register(offspringRoutes);     // /api/v1/offspring/*
    api.register(waitlistRoutes);      // /api/v1/waitlist/*  <-- NEW global waitlist endpoints
    api.register(userRoutes);          // /api/v1/users/* and /api/v1/user
    api.register(tagsRoutes);
    api.register(invoicesRoutes);      // /api/v1/invoices/* Finance MVP
    api.register(paymentsRoutes);      // /api/v1/payments/* Finance MVP
    api.register(expensesRoutes);      // /api/v1/expenses/* Finance MVP
    api.register(attachmentsRoutes);   // /api/v1/attachments/* Finance Track C
    api.register(messagesRoutes);      // /api/v1/messages/* Direct Messages
    api.register(communicationsRoutes); // /api/v1/communications/* Communications Hub
    api.register(draftsRoutes);         // /api/v1/drafts/* Draft messages/emails
    api.register(messagingHubRoutes);   // /api/v1/emails/*, /api/v1/parties/lookup-by-email MessagingHub
    api.register(animalLinkingRoutes); // /api/v1/network/*, /api/v1/link-requests/*, /api/v1/cross-tenant-links/*
    api.register(portalAccessRoutes);  // /api/v1/portal-access/* Portal Access Management
    api.register(portalDataRoutes);    // /api/v1/portal/* Portal read-only data surfaces
    api.register(portalProfileRoutes); // /api/v1/portal/profile/* Portal profile self-service
    api.register(portalSchedulingRoutes); // /api/v1/portal/scheduling/* Portal scheduling

    // Register portal routes at tenant-prefixed paths for clean URL-based tenant context
    // This allows portal frontend to use /api/v1/t/:slug/portal/* URLs
    // The middleware extracts tenant from the :slug param and sets req.tenantId
    api.register(portalDataRoutes, { prefix: "/t/:tenantSlug" });    // /api/v1/t/:slug/portal/*
    api.register(portalProfileRoutes, { prefix: "/t/:tenantSlug" }); // /api/v1/t/:slug/portal/profile/*
    api.register(portalSchedulingRoutes, { prefix: "/t/:tenantSlug" }); // /api/v1/t/:slug/portal/scheduling/*
    api.register(messagesRoutes, { prefix: "/t/:tenantSlug" });      // /api/v1/t/:slug/messages/*
    api.register(schedulingRoutes);       // /api/v1/scheduling/* Staff scheduling (calendar)
    api.register(businessHoursRoutes);    // /api/v1/business-hours/* Business hours settings
    api.register(usageRoutes, { prefix: "/usage" }); // /api/v1/usage/* Usage and quota dashboard
    api.register(adminMarketplaceRoutes); // /api/v1/admin/marketplace/* Admin marketplace management
    api.register(adminBreederReportsRoutes); // /api/v1/admin/breeder-reports/* Admin breeder reports
    api.register(adminSubscriptionRoutes); // /api/v1/admin/subscriptions/* & /api/v1/admin/products/*
    api.register(adminFeatureRoutes); // /api/v1/admin/features/* & /api/v1/features/checks (telemetry)

    // Marketplace routes - accessible by STAFF (platform module) or PUBLIC (with entitlement)
    api.register(publicMarketplaceRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/*
    api.register(marketplaceAssetsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/assets/*
    api.register(marketplaceProfileRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/profile/*
    api.register(marketplaceBreedersRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/breeders/* (PUBLIC)
    api.register(marketplaceWaitlistRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/waitlist/* (auth required)
    api.register(marketplaceMessagesRoutes, { prefix: "/marketplace/messages" }); // /api/v1/marketplace/messages/* (buyer-to-breeder)
    api.register(marketplaceReportBreederRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/report-breeder (auth required)
    api.register(serviceProviderRoutes); // /api/v1/provider/* Service Provider portal
  },
  { prefix: "/api/v1" }
);
// ---------- API v1/public: public marketplace subtree ----------
// SECURITY: Public marketplace routes have been REMOVED to prevent unauthenticated scraping.
// All marketplace data is now served exclusively via /api/v1/marketplace/* which requires:
//   1. Valid session cookie (bhq_s)
//   2. Marketplace entitlement (MARKETPLACE_ACCESS or STAFF membership)
// Requests to /api/v1/public/marketplace/* now return 410 Gone.
app.register(
  async (api) => {
    // Return 410 Gone for all requests to removed public marketplace routes
    // SECURITY: No data, no DB reads, no DTO building - just a static error response
    const goneResponse = {
      error: "gone",
      message: "Marketplace endpoints require authentication. Use /api/v1/marketplace/*.",
    };
    api.all("/marketplace/*", async (_req, reply) => {
      return reply.code(410).send(goneResponse);
    });
    api.all("/marketplace", async (_req, reply) => {
      return reply.code(410).send(goneResponse);
    });
  },
  { prefix: "/api/v1/public" }
);

// DEV: Log disabled public marketplace endpoint status at startup
if (process.env.NODE_ENV !== "production") {
  console.log("[DEV] Public marketplace endpoints disabled:");
  console.log("  - /api/v1/public/marketplace/* → 410 Gone");
  console.log("  - Authenticated access: /api/v1/marketplace/*");
}

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
