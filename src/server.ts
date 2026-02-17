// src/server.ts

// Initialize Sentry FIRST - before any other imports
import { initSentry, captureException, setUser, flush, Sentry } from "./lib/sentry.js";
initSentry();

// Global BigInt serialization support.
// Prisma returns BigInt for BigInt columns (e.g. Invoice.amountCents);
// JSON.stringify cannot serialize BigInt natively and throws
// "TypeError: Do not know how to serialize a BigInt".
// This polyfill converts BigInt to Number when safe, or to string for
// values exceeding Number.MAX_SAFE_INTEGER.
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import redis from "@fastify/redis";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
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
import apiUsageTracking from "./middleware/api-usage-tracking.js";
import { verifyAccessToken, TokenPayload } from "./services/jwt.service.js";

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

// ---------- Redis (optional, for horizontal scaling) ----------
// When REDIS_URL is set, enables shared state across API instances for:
// - Rate limiting (enforced across all instances)
// - Future: WebSocket pub/sub, session store, etc.
const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL) {
  await app.register(redis, { url: REDIS_URL });
  app.log.info("Redis connected - rate limits will be shared across instances");
} else {
  app.log.info("Redis not configured - using in-memory rate limiting (single instance only)");
}

// ---------- Rate limit (opt-in per route) ----------
// Uses Redis store when available, falls back to in-memory for local dev.
// See: https://github.com/fastify/fastify-rate-limit#custom-store
await app.register(rateLimit, {
  global: false,
  ban: 2,
  redis: app.redis, // undefined falls back to in-memory
  errorResponseBuilder: (_req, _context) => ({ error: "RATE_LIMITED" }),
});

// ---------- WebSocket ----------
await app.register(websocket);

// ---------- Multipart (file uploads) ----------
await app.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// ---------- CORS ----------
// Production: always allow these origins for breederhq.com subdomains
const PROD_ORIGINS = [
  "https://app.breederhq.com",
  "https://portal.breederhq.com",
  "https://marketplace.breederhq.com",
  "https://breederhq.com", // Marketing site — public share preview
];

// Dev-only: allow local Caddy HTTPS subdomains
const DEV_TEST_ORIGINS = [
  "https://app.breederhq.test",
  "https://portal.breederhq.test",
  "https://marketplace.breederhq.test",
  "https://mobile.breederhq.test",
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

// ---------- API Usage Tracking ----------
// Tracks API calls per tenant for billing and usage analytics
await app.register(apiUsageTracking);

// ---------- Health & Diagnostics ----------
app.get("/healthz", async () => ({ ok: true }));
app.get("/", async () => ({ ok: true }));

// Sentry test endpoint (dev only) - throws an error to verify Sentry capture
if (IS_DEV) {
  app.post("/api/v1/__test-sentry-error", async () => {
    throw new Error("Test Sentry error - this is intentional");
  });
}

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
  if (pathname === "/api/v1/__test-sentry-error") return true; // Dev-only Sentry test
  // Logout is NOT exempt - requires CSRF to prevent logout CSRF attacks

  // Mobile auth routes - use JWT tokens, not cookies, so no CSRF needed
  if (pathname === "/api/v1/auth/mobile-login") return true;
  if (pathname === "/api/v1/auth/refresh") return true;
  if (pathname === "/api/v1/auth/mobile-logout") return true;

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

  // Public breeding program inquiries - unauthenticated public submissions
  if (pathname.startsWith("/api/v1/public/breeding-programs/") && pathname.endsWith("/inquiries")) return true;

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

  // Bearer token auth (mobile app JWT) is immune to CSRF attacks because
  // the token must be explicitly set in JavaScript — a cross-origin form
  // submission cannot inject a custom Authorization header.
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) return;

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

// ---------- Sentry: finish transaction on response ----------
app.addHook("onResponse", async (req, reply) => {
  const transaction = (req as any)._sentryTransaction;
  if (transaction) {
    // Add response status to transaction
    transaction.setStatus(reply.statusCode >= 400 ? "internal_error" : "ok");
    transaction.end();
  }

  // Set user context if authenticated (for subsequent errors)
  const userId = (req as any).userId;
  const tenantId = (req as any).tenantId;
  if (userId) {
    setUser({ id: userId, tenantId });
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

  // Start Sentry transaction for performance monitoring
  const transaction = Sentry.startInactiveSpan({
    name: `${req.method} ${req.routeOptions?.url || req.url}`,
    op: "http.server",
    forceTransaction: true,
  });
  (req as any)._sentryTransaction = transaction;

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
  // Check if userId was already set by JWT auth or session auth earlier in the middleware chain
  let userId = (req as any).userId as string | undefined;

  if (!userId) {
    // Fall back to session parsing if userId not already set
    const surface = deriveSurface(req) as SessionSurface;
    const sess = parseVerifiedSession(req, surface);
    if (!sess) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    userId = sess.userId;
    (req as any).userId = userId;
  }

  // If tenant tables are missing, allow through in single-tenant mode
  if (!(await detectTenants())) {
    return { userId };
  }

  const actor = (await app.prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true } as any,
  })) as any;

  if (actor?.isSuperAdmin) return { userId }; // super admin floats across tenants

  const membership = await (app.prisma as any).tenantMembership.findUnique?.({
    where: { userId_tenantId: { userId, tenantId } },
    select: { tenantId: true },
  });

  if (!membership) {
    // Audit tenant access denied
    await auditFailure(req, "AUTH_TENANT_DENIED", {
      reason: "forbidden_tenant",
      tenantId,
      userId,
    });
    reply.code(403).send({ error: "forbidden_tenant" });
    return null;
  }
  return { userId };
}

// ---------- Route imports ----------
import accountRoutes from "./routes/account.js";
import animalsRoutes from "./routes/animals.js";
import breedingRoutes from "./routes/breeding.js";
import breedingPlanBuyersRoutes from "./routes/breeding-plan-buyers.js";
import breedingGroupsRoutes from "./routes/breeding-groups.js";
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
import marketplaceInvoicesRoutes from "./routes/marketplace-invoices.js"; // Marketplace provider invoices (Stripe)
import marketplaceWebsocketRoutes from "./routes/marketplace-websocket.js"; // Marketplace WebSocket for real-time messaging
import marketplaceReviewsRoutes from "./routes/marketplace-reviews.js"; // Marketplace reviews & ratings
import marketplaceAdminRoutes from "./routes/marketplace-admin.js"; // Marketplace admin dashboard
import marketplaceSavedRoutes from "./routes/marketplace-saved.js"; // Marketplace saved items (favorites)
import marketplaceNotificationsRoutes from "./routes/marketplace-notifications.js"; // Marketplace notification counts
import marketplaceVerificationRoutes from "./routes/marketplace-verification.js"; // Marketplace verification (phone, identity, packages)
import marketplace2faRoutes from "./routes/marketplace-2fa.js"; // Marketplace 2FA (TOTP, SMS, Passkey)
import portalAccessRoutes from "./routes/portal-access.js"; // Portal Access Management
import portalRoutes from "./routes/portal.js"; // Portal public routes (activation)
import portalDataRoutes from "./routes/portal-data.js"; // Portal read-only data surfaces
import portalProfileRoutes from "./routes/portal-profile.js"; // Portal profile self-service
import portalSchedulingRoutes from "./routes/portal-scheduling.js"; // Portal scheduling endpoints
import portalProtocolsRoutes from "./routes/portal-protocols.js"; // Portal training protocol continuation
import schedulingRoutes from "./routes/scheduling.js"; // Staff scheduling endpoints (calendar)
import businessHoursRoutes from "./routes/business-hours.js"; // Business hours settings
import adminMarketplaceRoutes from "./routes/admin-marketplace.js"; // Admin marketplace management
import adminBreederReportsRoutes from "./routes/admin-breeder-reports.js"; // Admin breeder reports
import adminSubscriptionRoutes from "./routes/admin-subscriptions.js"; // Admin subscription management
import adminFeatureRoutes from "./routes/admin-features.js"; // Admin feature registry & analytics
import marketplaceReportBreederRoutes from "./routes/marketplace-report-breeder.js"; // Marketplace report breeder
import marketplaceReportProviderRoutes from "./routes/marketplace-report-provider.js"; // Marketplace report provider
import marketplaceServiceTagsRoutes from "./routes/marketplace-service-tags.js"; // Marketplace service tags
import marketplaceImageUploadRoutes from "./routes/marketplace-image-upload.js"; // Marketplace image uploads (S3 presigned URLs)
import marketplaceServiceDetailRoutes from "./routes/marketplace-service-detail.js"; // Marketplace service detail (public)
import marketplaceAbuseReportsRoutes from "./routes/marketplace-abuse-reports.js"; // Marketplace abuse reporting
import marketplaceIdentityVerificationRoutes from "./routes/marketplace-identity-verification.js"; // Marketplace identity verification (Stripe)
import marketplaceAdminModerationRoutes from "./routes/marketplace-admin-moderation.js"; // Marketplace admin moderation queue
import usageRoutes from "./routes/usage.js"; // Usage and quota dashboard
import billingRoutes from "./routes/billing.js"; // Billing and Stripe integration
import settingsRoutes from "./routes/settings.js"; // User settings (genetics disclaimer, etc.)
import titlesRoutes from "./routes/titles.js"; // Title definitions and animal titles
import competitionsRoutes from "./routes/competitions.js"; // Competition entry tracking
import dashboardRoutes from "./routes/dashboard.js"; // Dashboard Mission Control
import dashboardConfigRoutes from "./routes/dashboard-config.js"; // Dashboard config & presets
import horseDashboardRoutes from "./routes/horse-dashboard.js"; // Horse-specific dashboard widgets
import horseWorkflowRoutes from "./routes/horse-workflows.js"; // Horse workflow pages (mare status, stallion calendar, etc.)
import partyCrmRoutes from "./routes/party-crm.js"; // Party CRM (notes, events, milestones, emails)
import templatesRoutes from "./routes/templates.js"; // Email/message templates
import autoRepliesRoutes from "./routes/auto-replies.js"; // Auto-reply rules for email/DM
import contractsRoutes from "./routes/contracts.js"; // Contract e-signatures (platform)
import contractTemplatesRoutes from "./routes/contract-templates.js"; // Contract templates management
import portalContractsRoutes from "./routes/portal-contracts.js"; // Contract signing (portal)
import communicationsRoutes from "./routes/communications.js"; // Communications Hub inbox
import draftsRoutes from "./routes/drafts.js"; // Draft messages/emails
import documentBundlesRoutes from "./routes/document-bundles.js"; // Document Bundles for email attachments
import documentsRoutes from "./routes/documents.js"; // General documents listing
import watermarkSettingsRoutes from "./routes/watermark-settings.js"; // Watermark settings
import documentWatermarkRoutes from "./routes/document-watermark.js"; // Document download with watermarking
import animalLinkingRoutes from "./routes/animal-linking.js"; // Cross-tenant animal linking
import networkRoutes from "./routes/network.js"; // Network Breeding Discovery search
import messagingHubRoutes from "./routes/messaging-hub.js"; // MessagingHub - send to any email
import websocketRoutes from "./routes/websocket.js"; // WebSocket for real-time messaging
import breedingProgramsRoutes from "./routes/breeding-programs.js"; // Breeding Programs (marketplace)
import publicBreedingProgramsRoutes from "./routes/public-breeding-programs.js"; // Public Breeding Programs (marketplace)
import breederMarketplaceRoutes from "./routes/breeder-marketplace.js"; // Breeder Marketplace Management (animal-listings, offspring-groups, inquiries)
import animalVaccinationsRoutes from "./routes/animal-vaccinations.js"; // Animal vaccinations tracking
import supplementRoutes from "./routes/supplements.js"; // Supplement tracking (protocols, schedules, administrations)
import nutritionRoutes from "./routes/nutrition.js"; // Nutrition & food tracking (products, plans, records, changes)
import dairyRoutes from "./routes/dairy.js"; // Dairy production tracking (lactations, milking, DHIA, appraisals)
import fiberRoutes from "./routes/fiber.js"; // Fiber/wool production tracking (shearings, lab tests)
import microchipRegistrationsRoutes from "./routes/microchip-registrations.js"; // Microchip registry tracking
import resendWebhooksRoutes from "./routes/webhooks-resend.js"; // Resend inbound email webhooks
import marketplaceV2Routes from "./routes/marketplace-v2.js"; // Marketplace V2 - Direct Listings & Animal Programs
import breederServicesRoutes from "./routes/breeder-services.js"; // Breeder Service Listings Management
import listingPaymentsRoutes from "./routes/listing-payments.js"; // Listing payment config (pricing transparency)
import mktBreedingBookingsRoutes from "./routes/mkt-breeding-bookings.js"; // Breeding Bookings Listings (stud, mare lease, etc.)
import marketplaceBreedsRoutes from "./routes/marketplace-breeds.js"; // Marketplace breeds search (public, canonical only)
import notificationsRoutes from "./routes/notifications.js"; // Health & breeding notifications (persistent)
import geneticPreferencesRoutes from "./routes/genetic-preferences.js"; // Genetic notification preferences & snooze
import { startNotificationScanJob, stopNotificationScanJob } from "./jobs/notification-scan.js"; // Daily notification cron job
import breedingProgramRulesRoutes from "./routes/breeding-program-rules.js"; // Breeding Program Rules (cascading automation)
import studVisibilityRoutes from "./routes/stud-visibility.js"; // Stud Listing Visibility Rules (P11)
import { startRuleExecutionJob, stopRuleExecutionJob } from "./jobs/rule-execution.js"; // Rule execution cron job
import { startNetworkSearchIndexJob, stopNetworkSearchIndexJob } from "./jobs/network-search-index.js"; // Network search index rebuild cron job
import { startAnimalAccessCleanupJob, stopAnimalAccessCleanupJob } from "./jobs/animal-access-cleanup.js"; // Animal access cleanup cron job (30-day retention)
import { startShareCodeExpirationJob, stopShareCodeExpirationJob } from "./jobs/share-code-expiration.js"; // Share code expiration cron job (hourly)
import { startAnimalAccessExpirationJob, stopAnimalAccessExpirationJob } from "./jobs/animal-access-expiration.js"; // Animal access expiration cron job (hourly)
import { startListingBoostExpirationJob, stopListingBoostExpirationJob } from "./jobs/listing-boost-expiration.js"; // Listing boost expiration cron job (hourly)
import { startServiceListingExpirationJob, stopServiceListingExpirationJob } from "./jobs/expire-service-listings.js"; // Service listing payment expiration cron job (daily)
import listingBoostRoutes from "./routes/listing-boosts.js"; // Listing boost checkout + CRUD
import adminBoostRoutes from "./routes/admin-boosts.js"; // Admin boost management
import sitemapRoutes from "./routes/sitemap.js"; // Public sitemap data endpoint
import mediaRoutes from "./routes/media.js"; // Media upload/access endpoints (S3)
import searchRoutes from "./routes/search.js"; // Platform-wide search (Command Palette)
import buyersRoutes from "./routes/buyers.js"; // Buyer CRM (P4)
import dealsRoutes from "./routes/deals.js"; // Deals/Sales pipeline (P4)
import buyerTasksRoutes from "./routes/buyer-tasks.js"; // Buyer CRM Tasks (P5)
import buyerAnalyticsRoutes from "./routes/buyer-analytics.js"; // Buyer CRM Analytics (P5)
import buyerEmailsRoutes from "./routes/buyer-emails.js"; // Buyer CRM Emails (P5)
import registryIntegrationRoutes from "./routes/registry-integration.js"; // Registry Integration (P6)
import semenInventoryRoutes from "./routes/semen-inventory.js"; // Semen Inventory (P7)
import breederProfileRoutes from "./routes/breeder-profile.js"; // Breeding Discovery: Breeder Profile (Phase 2)
import breedingDiscoveryProgramsRoutes from "./routes/breeding-discovery-programs.js"; // Breeding Discovery: Programs (Phase 2)
import breedingDiscoveryListingsRoutes from "./routes/breeding-discovery-listings.js"; // Breeding Discovery: Listings (Phase 2)
import breedingBookingsRoutes from "./routes/breeding-bookings.js"; // Breeding Discovery: Bookings (Phase 2)
import breedingAnalyticsRoutes from "./routes/breeding-analytics.js"; // Breeding Discovery: Analytics (Phase 3)
import compatibilityRoutes from "./routes/compatibility.js"; // Breeding Discovery: Compatibility Checking (Phase 2)
import publicBreedingDiscoveryRoutes from "./routes/public-breeding-discovery.js"; // Breeding Discovery: Public Endpoints (Phase 2)
import tenantStripeConnectRoutes from "./routes/tenant-stripe-connect.js"; // Tenant Stripe Connect (breeder payments)
import animalBreedingProfileRoutes from "./routes/animal-breeding-profile.js"; // Animal Breeding Profile (user-entered preferences)

// Rearing Protocols (Offspring Module)
import rearingProtocolsRoutes from "./routes/rearing-protocols.js"; // Rearing Protocols CRUD
import rearingAssignmentsRoutes from "./routes/rearing-assignments.js"; // Protocol assignments to offspring groups
import rearingCompletionsRoutes from "./routes/rearing-completions.js"; // Activity completions
import rearingExceptionsRoutes from "./routes/rearing-exceptions.js"; // Per-offspring exceptions
import rearingCommunityRoutes from "./routes/rearing-community.js"; // Community sharing and discovery
import rearingCommentsRoutes from "./routes/rearing-comments.js"; // Community comments and Q&A
import rearingAssessmentsRoutes from "./routes/rearing-assessments.js"; // Volhard PAT and custom assessments
import rearingCertificatesRoutes from "./routes/rearing-certificates.js"; // Completion certificates
import rearingImportExportRoutes from "./routes/rearing-import-export.js"; // Protocol import/export

// Network Breeding Discovery
import shareCodesRoutes from "./routes/share-codes.js"; // Share code generation & redemption
import animalAccessRoutes from "./routes/animal-access.js"; // Shadow animal access management
import breedingDataAgreementsRoutes from "./routes/breeding-data-agreements.js"; // Breeding data agreements

// Mobile App (JWT auth & push notifications)
import mobileAuthRoutes from "./routes/mobile-auth.js"; // Mobile login, refresh, logout
import mobileProviderRoutes from "./routes/mobile-provider.js"; // Mobile provider dashboard, listings, messages
import devicesRoutes from "./routes/devices.js"; // Device registration for push notifications
import { initFirebase } from "./services/push.service.js"; // Firebase Cloud Messaging

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
    api.register(marketplaceInvoicesRoutes, { prefix: "/marketplace/invoices" }); // /api/v1/marketplace/invoices/* (Provider invoices)
    api.register(marketplaceTransactionMessagesRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/* (Transaction messaging)
    api.register(marketplaceWebsocketRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/ws (WebSocket for real-time messaging)
    api.register(marketplaceReviewsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/* (Reviews & ratings)
    api.register(marketplaceAdminRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/admin/* (Admin dashboard)
    api.register(marketplaceSavedRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/saved/* (Saved items/favorites)
    api.register(marketplaceNotificationsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/notifications/* (Notification counts)
    api.register(marketplaceVerificationRoutes, { prefix: "/marketplace/verification" }); // /api/v1/marketplace/verification/* (Phone, identity, packages)
    api.register(marketplace2faRoutes, { prefix: "/marketplace/2fa" }); // /api/v1/marketplace/2fa/* (TOTP, SMS, Passkey)
    api.register(marketplaceServiceTagsRoutes, { prefix: "/marketplace/service-tags" }); // /api/v1/marketplace/service-tags/* (Service tags for provider portal)
    // NOTE: marketplaceImageUploadRoutes moved to tenant-scoped subtree for proper auth (req.userId)
    // NOTE: mediaRoutes moved to tenant-scoped subtree for proper auth (req.tenantId for platform uploads)
    api.register(marketplaceServiceDetailRoutes, { prefix: "/marketplace/services" }); // /api/v1/marketplace/services/:slugOrId (Public service detail)
    api.register(marketplaceAbuseReportsRoutes, { prefix: "/marketplace/listings" }); // /api/v1/marketplace/listings/report (Abuse reporting)
    api.register(marketplaceIdentityVerificationRoutes, { prefix: "/marketplace/identity" }); // /api/v1/marketplace/identity/* (Stripe Identity verification)
    api.register(marketplaceAdminModerationRoutes, { prefix: "/marketplace/admin" }); // /api/v1/marketplace/admin/* (Admin moderation queue)
    api.register(marketplaceBreedsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/breeds/* (Public breeds search)
    api.register(listingPaymentsRoutes); // /api/v1/service-listing-payment-config (Listing payment pricing config)
    // NOTE: rearingCertificatesRoutes moved to tenant-authenticated section (line ~1021)
    // TODO: Split into separate public/private plugins if /verify endpoint needs to be public

    // Mobile App (JWT-based authentication for native mobile clients)
    api.register(mobileAuthRoutes, { prefix: "/auth" }); // /api/v1/auth/mobile-login, /refresh, /mobile-logout
    api.register(mobileProviderRoutes, { prefix: "/mobile/provider" }); // /api/v1/mobile/provider/* (provider dashboard, listings, messages)
    api.register(devicesRoutes, { prefix: "/devices" }); // /api/v1/devices/* (push notification registration)

    // Marketplace routes moved to authenticated subtree for entitlement-gated access
  },
  { prefix: "/api/v1" }
);

// ---------- Global error handler ----------
app.setErrorHandler((err: Error, req, reply) => {
  // Handle cases where err is undefined, null, or non-Error object
  const safeErr = err ?? new Error("Unknown error (thrown value was falsy)");
  const errInfo = {
    message: safeErr.message ?? String(safeErr),
    code: (safeErr as any).code,
    meta: (safeErr as any).meta,
    stack: safeErr.stack,
    // Log raw value if it's not a proper Error for debugging
    ...(!(safeErr instanceof Error) && { rawType: typeof err, rawValue: String(err) }),
  };

  req.log.error(
    {
      err: errInfo,
      url: req.url,
      method: req.method,
    },
    "Unhandled error"
  );

  // Send to Sentry (skip expected errors)
  const code = (safeErr as any).code;
  const statusCode = (safeErr as any).statusCode;
  const isExpectedError =
    code === "P2002" || // Duplicate key
    code === "P2003" || // Foreign key constraint
    statusCode === 400 || // Bad request
    statusCode === 401 || // Unauthorized
    statusCode === 403 || // Forbidden
    statusCode === 404;   // Not found

  if (!isExpectedError) {
    captureException(safeErr, {
      url: req.url,
      method: req.method,
      tenantId: (req as any).tenantId,
      userId: (req as any).userId,
      surface: (req as any).surface,
    });
  }

  if (code === "P2002") {
    return reply.status(409).send({ error: "duplicate", detail: (safeErr as any).meta?.target });
  }
  if (code === "P2003") {
    return reply.status(409).send({ error: "foreign_key_conflict" });
  }
  if (statusCode) {
    return reply.status(statusCode).send({ error: safeErr.message });
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

      // 4) /public/breeding-programs/* are public (GET for list/detail, POST for inquiries)
      // These endpoints allow anonymous browsing and inquiry submission
      const isBreedingProgramsPublic =
        pathOnly.startsWith("/public/breeding-programs") ||
        pathOnly.startsWith("/api/v1/public/breeding-programs");
      if ((m === "GET" || m === "POST") && isBreedingProgramsPublic) {
        // Skip auth checks - public endpoints for marketplace browsing
        (req as any).tenantId = null;
        (req as any).userId = null;
        (req as any).actorContext = "PUBLIC";
        return; // Exit hook early
      }

      // 5) Public marketplace browse endpoints (GET only)
      // These endpoints allow anonymous browsing of marketplace listings
      const publicBrowsePatterns = [
        // Exact matches and prefixes for list endpoints
        "/marketplace/offspring-groups",
        "/marketplace/animal-programs",
        "/marketplace/animals",
        "/marketplace/services",
        "/marketplace/mkt-listing-individual-animals",
        "/api/v1/marketplace/offspring-groups",
        "/api/v1/marketplace/animal-programs",
        "/api/v1/marketplace/animals",
        "/api/v1/marketplace/services",
        "/api/v1/marketplace/mkt-listing-individual-animals",
      ];

      // Check if path matches public browse patterns (including detail pages like /animal-programs/:slug)
      const isPublicBrowsePath = publicBrowsePatterns.some(pattern => {
        // Exact match
        if (pathOnly === pattern) return true;
        // Path ends with pattern (handles /api/v1 prefix variations)
        if (pathOnly.endsWith(pattern)) return true;
        // Path starts with pattern (handles detail pages like /animal-programs/my-slug)
        if (pathOnly.startsWith(pattern + "/")) return true;
        return false;
      });

      if (m === "GET" && isPublicBrowsePath) {
        // Skip auth checks - public browse endpoint
        (req as any).tenantId = null;
        (req as any).userId = null;
        (req as any).actorContext = "PUBLIC";
        return; // Exit hook early
      }

      // 6) /marketplace/me should work for both authenticated and anonymous users
      // Anonymous users will get { userId: null } response from handler
      const isMePath =
        pathOnly === "/marketplace/me" ||
        pathOnly === "/api/v1/marketplace/me" ||
        pathOnly.endsWith("/marketplace/me");
      if (m === "GET" && isMePath) {
        // Allow through without session check - handler will determine auth status
        const sess = parseVerifiedSession(req, surface as SessionSurface);
        (req as any).userId = sess?.userId || null;
        (req as any).tenantId = null;
        (req as any).actorContext = sess?.userId ? "PUBLIC" : "PUBLIC";
        return; // Exit hook early
      }

      // ---------- Session verification ----------
      // Use surface-specific cookie for session isolation across subdomains
      // Also accept JWT Bearer token for mobile clients
      const sess = parseVerifiedSession(req, surface as SessionSurface);
      let jwtPayload: TokenPayload | null = null;

      if (!sess) {
        // No session cookie - check for JWT Bearer token (mobile auth)
        const authHeader = req.headers.authorization;
        if (IS_DEV) {
          console.log("[JWT Debug] Auth header present:", !!authHeader, authHeader ? authHeader.substring(0, 20) + "..." : "none");
        }
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          try {
            jwtPayload = verifyAccessToken(token);
            if (IS_DEV) {
              console.log("[JWT Debug] Token verified, userId:", jwtPayload.userId, "tenantId:", jwtPayload.tenantId);
            }
          } catch (err) {
            // Invalid JWT - fall through to 401
            if (IS_DEV) {
              console.log("[JWT Debug] Token verification failed:", (err as Error).message);
            }
          }
        }

        if (!jwtPayload) {
          return reply.code(401).send({ error: "unauthorized" });
        }
      }

      // Use session userId if available, otherwise use JWT payload
      (req as any).userId = sess?.userId ?? jwtPayload?.userId;

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
        // PLATFORM: tenant from JWT payload (mobile), X-Tenant-Id header, or session
        if (jwtPayload?.tenantId) {
          // Mobile JWT auth - tenant is embedded in token
          tenantId = jwtPayload.tenantId;
        } else if (sess) {
          const platformContext = extractPlatformTenantContext(req, sess);
          tenantId = platformContext.tenantId ?? null;
        }

      }
      // MARKETPLACE: no tenant context needed, tenantId stays null

      // ---------- Surface-based ActorContext resolution ----------
      const userId = (req as any).userId as string;

      // For JWT-authenticated requests (mobile), trust the token - membership was verified at login
      // Skip full ActorContext resolution since JWT already contains verified tenantId
      if (jwtPayload?.tenantId) {
        (req as any).actorContext = "STAFF";
        (req as any).tenantId = jwtPayload.tenantId;
        if (IS_DEV) {
          console.log("[JWT Auth] Bypassing ActorContext resolution - using JWT tenantId:", jwtPayload.tenantId);
        }
        // Skip to tenant membership verification (which now handles JWT auth)
        const ok = await requireTenantMembership(app, req, reply, jwtPayload.tenantId);
        if (!ok) return;
        return; // Continue to route handler
      }

      const resolved = await resolveActorContext(surface, userId, tenantId);

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
          userId,
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
          userId,
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
          userId,
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
          userId,
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
              userId,
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
    api.register(dashboardRoutes);       // /api/v1/dashboard/*
    api.register(dashboardConfigRoutes); // /api/v1/dashboard/config, /api/v1/dashboard/presets/*
    api.register(horseDashboardRoutes);  // /api/v1/dashboard/horse/* (horse-specific widgets)
    api.register(horseWorkflowRoutes);   // /api/v1/horses/* (horse workflow pages: mare status, stallion calendar, etc.)

    // Platform-wide search (Command Palette)
    api.register(searchRoutes);        // /api/v1/search

    // Tenant-scoped resources
    api.register(contactsRoutes);      // /api/v1/contacts/*
    api.register(partiesRoutes);       // /api/v1/parties/*
    api.register(partyCrmRoutes);      // /api/v1/parties/:partyId/notes|events|milestones|emails|activity
    api.register(buyersRoutes);        // /api/v1/buyers/* Buyer CRM (P4)
    api.register(dealsRoutes);         // /api/v1/deals/* Sales pipeline (P4)
    api.register(buyerTasksRoutes);    // /api/v1/buyer-tasks/* Buyer CRM Tasks (P5)
    api.register(buyerAnalyticsRoutes); // /api/v1/buyer-analytics/* Buyer CRM Analytics (P5)
    api.register(buyerEmailsRoutes);   // /api/v1/buyer-email-templates/*, /api/v1/buyers/:id/emails (P5)
    api.register(templatesRoutes);     // /api/v1/templates/* Email/message templates
    api.register(autoRepliesRoutes);   // /api/v1/auto-replies/* Auto-reply rules
    api.register(contractsRoutes);     // /api/v1/contracts/* Contract e-signatures
    api.register(contractTemplatesRoutes); // /api/v1/contract-templates/* Contract template management
    api.register(organizationsRoutes); // /api/v1/organizations/*
    api.register(breedingRoutes);      // /api/v1/breeding/*
    api.register(breedingPlanBuyersRoutes); // /api/v1/breeding/plans/:planId/buyers/*
    api.register(breedingGroupsRoutes); // /api/v1/breeding/groups/* (livestock group breeding)
    api.register(breedingProgramsRoutes); // /api/v1/breeding/programs/*
    api.register(breedingProgramRulesRoutes); // /api/v1/breeding/programs/rules/* (cascading automation rules)
    api.register(studVisibilityRoutes); // /api/v1/stud-visibility/* (stud listing visibility rules - P11)
    api.register(publicBreedingProgramsRoutes); // /api/v1/public/breeding-programs/* (public marketplace)
    api.register(breederMarketplaceRoutes); // /api/v1/animal-listings/*, /api/v1/offspring-groups/*, /api/v1/inquiries/*
    api.register(breederMarketplaceRoutes, { prefix: "/marketplace/breeder" }); // /api/v1/marketplace/breeder/* (dashboard stats)
    api.register(marketplaceImageUploadRoutes, { prefix: "/marketplace/images" }); // /api/v1/marketplace/images/* (S3 presigned URL upload - moved from mixed-auth for proper userId)
    api.register(mediaRoutes, { prefix: "/media" }); // /api/v1/media/* (Unified media upload/access - moved from public for proper auth)
    api.register(animalsRoutes);       // /api/v1/animals/*
    api.register(breedsRoutes);        // /api/v1/breeds/*
    api.register(animalTraitsRoutes);  // /api/v1/animals/:animalId/traits
    api.register(animalDocumentsRoutes); // /api/v1/animals/:animalId/documents
    api.register(animalVaccinationsRoutes); // /api/v1/animals/:animalId/vaccinations, /api/v1/vaccinations/protocols
    api.register(supplementRoutes); // /api/v1/supplement-protocols/*, /api/v1/supplement-schedules/*, /api/v1/supplements/*
    api.register(nutritionRoutes); // /api/v1/nutrition/*, /api/v1/animals/:id/nutrition/*
    api.register(dairyRoutes); // /api/v1/dairy/*, /api/v1/animals/:id/dairy/*
    api.register(fiberRoutes); // /api/v1/fiber/*, /api/v1/animals/:id/fiber/*
    api.register(animalBreedingProfileRoutes); // /api/v1/animals/:id/breeding-profile, /api/v1/animals/:id/breeding-events, /api/v1/animals/:id/breeding-stats
    api.register(microchipRegistrationsRoutes); // /api/v1/microchip-registries, /api/v1/animals/:id/microchip-registrations, /api/v1/offspring/:id/microchip-registrations
    api.register(registryIntegrationRoutes); // /api/v1/registry-connections/*, /api/v1/animals/:id/registries/:id/verify|pedigree (P6)
    api.register(semenInventoryRoutes); // /api/v1/semen/* (Semen Inventory - P7)
    api.register(breederProfileRoutes); // /api/v1/breeder-profile/* (Breeding Discovery - Phase 2)
    api.register(breedingDiscoveryProgramsRoutes); // /api/v1/breeding-discovery/programs/* (Breeding Discovery - Phase 2)
    api.register(breedingDiscoveryListingsRoutes); // /api/v1/breeding-discovery/listings/* (Breeding Discovery - Phase 2)
    api.register(breedingBookingsRoutes); // /api/v1/breeding-bookings/* (Breeding Discovery - Phase 2)
    api.register(breedingAnalyticsRoutes); // /api/v1/breeding-analytics/* (Breeding Discovery - Phase 3)
    api.register(compatibilityRoutes); // /api/v1/compatibility/* (Breeding Discovery - Phase 2)
    api.register(publicBreedingDiscoveryRoutes); // /api/v1/public/breeding-* (Breeding Discovery - Phase 2)
    api.register(shareCodesRoutes);    // /api/v1/share-codes/* (Network Breeding Discovery)
    api.register(animalAccessRoutes);  // /api/v1/animal-access/* (Network Breeding Discovery)
    api.register(breedingDataAgreementsRoutes); // /api/v1/breeding-agreements/* (Network Breeding Discovery)
    api.register(titlesRoutes);        // /api/v1/animals/:animalId/titles, /api/v1/title-definitions
    api.register(competitionsRoutes);  // /api/v1/animals/:animalId/competitions, /api/v1/competitions/*
    api.register(offspringRoutes);     // /api/v1/offspring/*
    api.register(waitlistRoutes);      // /api/v1/waitlist/*  <-- NEW global waitlist endpoints

    // Rearing Protocols
    api.register(rearingProtocolsRoutes);   // /api/v1/rearing-protocols/*
    api.register(rearingAssignmentsRoutes); // /api/v1/offspring-groups/:groupId/rearing-assignments/*, /api/v1/rearing-assignments/*
    api.register(rearingCompletionsRoutes); // /api/v1/rearing-assignments/:id/completions/*, /api/v1/rearing-completions/*
    api.register(rearingExceptionsRoutes);  // /api/v1/rearing-assignments/:id/exceptions/*, /api/v1/rearing-exceptions/*
    api.register(rearingCommunityRoutes);   // /api/v1/rearing-protocols/community/*
    api.register(rearingCommentsRoutes);    // /api/v1/rearing-protocols/:id/comments/*
    api.register(rearingAssessmentsRoutes); // /api/v1/rearing-assignments/:id/assessments/*, /api/v1/rearing-assessments/*
    api.register(rearingCertificatesRoutes); // /api/v1/rearing-assignments/:id/certificates/*, /api/v1/rearing-certificates/*
    api.register(rearingImportExportRoutes); // /api/v1/rearing-protocols/import/*, /api/v1/rearing-protocols/:id/export
    api.register(userRoutes);          // /api/v1/users/* and /api/v1/user
    api.register(tagsRoutes);
    api.register(invoicesRoutes);      // /api/v1/invoices/* Finance MVP
    api.register(paymentsRoutes);      // /api/v1/payments/* Finance MVP
    api.register(expensesRoutes);      // /api/v1/expenses/* Finance MVP
    api.register(tenantStripeConnectRoutes, { prefix: "/tenant/stripe-connect" }); // /api/v1/tenant/stripe-connect/* Tenant Stripe Connect
    api.register(attachmentsRoutes);   // /api/v1/attachments/* Finance Track C
    api.register(messagesRoutes);      // /api/v1/messages/* Direct Messages
    api.register(communicationsRoutes); // /api/v1/communications/* Communications Hub
    api.register(draftsRoutes);         // /api/v1/drafts/* Draft messages/emails
    api.register(documentBundlesRoutes); // /api/v1/document-bundles/* Document bundles for email attachments
    api.register(documentsRoutes);      // /api/v1/documents/* General documents listing
    api.register(watermarkSettingsRoutes); // /api/v1/settings/watermark Watermark settings
    api.register(documentWatermarkRoutes); // /api/v1/documents/:id/download, /watermark, /access-log Document watermarking
    api.register(messagingHubRoutes);   // /api/v1/emails/*, /api/v1/parties/lookup-by-email MessagingHub
    api.register(animalLinkingRoutes); // /api/v1/network/*, /api/v1/link-requests/*, /api/v1/cross-tenant-links/*
    api.register(networkRoutes);       // /api/v1/network/search Network Breeding Discovery
    api.register(portalAccessRoutes);  // /api/v1/portal-access/* Portal Access Management
    api.register(portalDataRoutes);    // /api/v1/portal/* Portal read-only data surfaces
    api.register(portalProfileRoutes); // /api/v1/portal/profile/* Portal profile self-service
    api.register(portalSchedulingRoutes); // /api/v1/portal/scheduling/* Portal scheduling
    api.register(portalContractsRoutes); // /api/v1/portal/contracts/* Portal contract signing
    api.register(portalProtocolsRoutes); // /api/v1/portal/protocols/* Portal training protocol continuation
    api.register(notificationsRoutes); // /api/v1/notifications/* Health & breeding notifications
    api.register(geneticPreferencesRoutes); // /api/v1/users/me/genetic-notification-preferences, /api/v1/genetic-notifications/snooze/*

    // Register portal routes at tenant-prefixed paths for clean URL-based tenant context
    // This allows portal frontend to use /api/v1/t/:slug/portal/* URLs
    // The middleware extracts tenant from the :slug param and sets req.tenantId
    api.register(portalDataRoutes, { prefix: "/t/:tenantSlug" });    // /api/v1/t/:slug/portal/*
    api.register(portalProfileRoutes, { prefix: "/t/:tenantSlug" }); // /api/v1/t/:slug/portal/profile/*
    api.register(portalSchedulingRoutes, { prefix: "/t/:tenantSlug" }); // /api/v1/t/:slug/portal/scheduling/*
    api.register(portalContractsRoutes, { prefix: "/t/:tenantSlug" }); // /api/v1/t/:slug/portal/contracts/*
    api.register(portalProtocolsRoutes, { prefix: "/t/:tenantSlug" }); // /api/v1/t/:slug/portal/protocols/*
    api.register(messagesRoutes, { prefix: "/t/:tenantSlug" });      // /api/v1/t/:slug/messages/*
    api.register(schedulingRoutes);       // /api/v1/scheduling/* Staff scheduling (calendar)
    api.register(businessHoursRoutes);    // /api/v1/business-hours/* Business hours settings
    api.register(usageRoutes, { prefix: "/usage" }); // /api/v1/usage/* Usage and quota dashboard
    api.register(adminMarketplaceRoutes); // /api/v1/admin/marketplace/* Admin marketplace management
    api.register(adminBreederReportsRoutes); // /api/v1/admin/breeder-reports/* Admin breeder reports
    api.register(adminSubscriptionRoutes); // /api/v1/admin/subscriptions/* & /api/v1/admin/products/*
    api.register(adminFeatureRoutes); // /api/v1/admin/features/* & /api/v1/features/checks (telemetry)
    api.register(adminBoostRoutes); // /api/v1/admin/boosts/* Admin boost management

    // Marketplace routes - accessible by STAFF (platform module) or PUBLIC (with entitlement)
    api.register(publicMarketplaceRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/*
    api.register(marketplaceAssetsRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/assets/*
    api.register(marketplaceProfileRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/profile/*
    api.register(marketplaceBreedersRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/breeders/* (PUBLIC)
    api.register(marketplaceWaitlistRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/waitlist/* (auth required)
    api.register(marketplaceMessagesRoutes, { prefix: "/marketplace/messages" }); // /api/v1/marketplace/messages/* (buyer-to-breeder)
    api.register(marketplaceReportBreederRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/report-breeder (auth required)
    api.register(marketplaceReportProviderRoutes, { prefix: "/marketplace" }); // /api/v1/marketplace/report-provider (auth required)
    api.register(breederServicesRoutes, { prefix: "/services" }); // /api/v1/services/* Breeder service listings management
    api.register(mktBreedingBookingsRoutes, { prefix: "/mkt-breeding-bookings" }); // /api/v1/mkt-breeding-bookings/* Breeding bookings listings (stud, mare lease, etc.)
    api.register(listingBoostRoutes); // /api/v1/listing-boosts/* Listing boost checkout + management
  },
  { prefix: "/api/v1" }
);

// ---------- API v2: Marketplace V2 ----------
// Uses same tenant-scoped authentication as V1
const v2App = app.register(
  async (api) => {
    // Reuse the same tenant authentication logic from V1
    api.decorateRequest("tenantId", null as unknown as number);
    api.decorateRequest("userId", null as unknown as string);
    api.decorateRequest("surface", null as unknown as Surface);
    api.decorateRequest("actorContext", null as unknown as ActorContext);

    // Reuse tenant-scoped auth hook (same as V1 at line 610)
    api.addHook("preHandler", async (req, reply) => {
      const surface = (req as any).surface as Surface;

      // CSRF validation for state-changing methods
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
        const csrfHeader = req.headers["x-csrf-token"] as string | undefined;
        const csrfCookie = req.cookies?.["XSRF-TOKEN"];
        const csrfResult = validateCsrfToken(csrfHeader, csrfCookie, surface as SessionSurface);

        if (!csrfResult.valid) {
          return reply.code(403).send({
            error: "csrf_invalid",
            detail: csrfResult.detail,
          });
        }
      }

      const sess = parseVerifiedSession(req, surface as SessionSurface);
      if (!sess) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      (req as any).userId = sess.userId;

      const tenantIdRaw = req.headers["x-tenant-id"];
      const tenantId = tenantIdRaw ? Number(tenantIdRaw) : null;

      if (!tenantId || isNaN(tenantId)) {
        return reply.code(401).send({ error: "unauthorized", message: "Tenant context required" });
      }

      const membership = await app.prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: sess.userId, tenantId } },
        select: { tenantId: true },
      });

      if (!membership) {
        return reply.code(403).send({ error: "forbidden_tenant" });
      }

      (req as any).tenantId = tenantId;
      (req as any).actorContext = "STAFF";
    });

    api.register(marketplaceV2Routes, { prefix: "/marketplace" });
  },
  { prefix: "/api/v2" }
);

// ---------- API v1/public: public (no-auth) subtree ----------
// Share code preview (public landing page for QR codes / smart links)
import publicSharePreviewRoutes from "./routes/public-share-preview.js";

app.register(
  async (api) => {
    // Share code preview — returns non-sensitive animal data for marketing landing page
    api.register(publicSharePreviewRoutes); // /api/v1/public/share-codes/:code/preview

    // SECURITY: Public marketplace routes have been REMOVED to prevent unauthenticated scraping.
    // All marketplace data is now served exclusively via /api/v1/marketplace/* which requires:
    //   1. Valid session cookie (bhq_s)
    //   2. Marketplace entitlement (MARKETPLACE_ACCESS or STAFF membership)
    //
    // EXCEPTION: /marketplace/featured is public — the FeaturedCarousel must render for
    // unauthenticated visitors on the marketplace homepage (FR-29..FR-35).
    // This endpoint returns only boost record metadata (no PII, no pricing details).

    // Public featured listings for carousel (no auth required)
    api.get<{ Querystring: { page?: string } }>("/marketplace/featured", async (req, reply) => {
      try {
        const { getFeaturedListings } = await import("./services/listing-boost-service.js");
        const page = (req.query.page || "all") as string;
        if (!["all", "animals", "breeders", "services"].includes(page)) {
          return reply.code(400).send({ error: "invalid_page" });
        }

        const boosts = await getFeaturedListings(page);
        if (boosts.length === 0) {
          return reply.send({ items: [] });
        }

        // Resolve each boost into a displayable item (same logic as authenticated /featured)
        const { default: prisma } = await import("./prisma.js");
        const items: Array<{
          id: number;
          listingType: string;
          title: string;
          subtitle: string | null;
          imageUrl: string | null;
          href: string;
          priceCents: number | null;
        }> = [];

        for (const boost of boosts) {
          try {
            let item: typeof items[number] | null = null;

            if (boost.listingType === "INDIVIDUAL_ANIMAL") {
              const listing = await prisma.mktListingIndividualAnimal.findUnique({
                where: { id: boost.listingId },
              });
              if (listing) {
                item = {
                  id: listing.id,
                  listingType: boost.listingType,
                  title: listing.title || listing.headline || "Animal Listing",
                  subtitle: null,
                  imageUrl: listing.coverImageUrl || null,
                  href: `/listings/${listing.slug}`,
                  priceCents: listing.priceCents,
                };
              }
            } else if (boost.listingType === "BREEDER") {
              const tenant = await prisma.tenant.findUnique({
                where: { id: boost.listingId },
                select: { id: true, name: true, slug: true, city: true, region: true },
              });
              if (tenant) {
                item = {
                  id: tenant.id,
                  listingType: boost.listingType,
                  title: tenant.name,
                  subtitle: [tenant.city, tenant.region].filter(Boolean).join(", ") || null,
                  imageUrl: null,
                  href: `/breeders/${tenant.slug}`,
                  priceCents: null,
                };
              }
            } else if (boost.listingType === "ANIMAL_PROGRAM") {
              const program = await prisma.mktListingAnimalProgram.findUnique({
                where: { id: boost.listingId },
                select: { id: true, name: true, slug: true, headline: true, coverImageUrl: true, defaultPriceCents: true },
              });
              if (program) {
                item = {
                  id: program.id,
                  listingType: boost.listingType,
                  title: program.name || "Animal Program",
                  subtitle: program.headline || null,
                  imageUrl: program.coverImageUrl || null,
                  href: `/animal-programs/${program.slug}`,
                  priceCents: program.defaultPriceCents,
                };
              }
            }
            // Other listing types can be added as needed

            if (item) items.push(item);
          } catch {
            // Skip unresolvable boosts
          }
        }

        return reply.send({ items });
      } catch (err: any) {
        req.log?.error?.({ err }, "Failed to get public featured listings");
        return reply.code(500).send({ error: "featured_failed" });
      }
    });

    // Remaining marketplace routes return 410 Gone
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

// ---------- Sitemap: public sitemap data endpoint ----------
// Used by build-time sitemap generation script
// Returns only publicly visible entity URLs (no sensitive data)
app.register(
  async (api) => {
    api.register(sitemapRoutes);
  },
  { prefix: "/api" }
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
    // Initialize Firebase for push notifications (optional - will log if not configured)
    initFirebase();

    await app.ready();
    app.printRoutes();
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`API listening on :${PORT}`);

    // Start notification scan cron job
    startNotificationScanJob();

    // Start rule execution cron job
    startRuleExecutionJob();

    // Start network search index rebuild cron job
    startNetworkSearchIndexJob();

    // Start animal access cleanup cron job (30-day OWNER_DELETED retention)
    startAnimalAccessCleanupJob();

    // Start share code expiration cron job (hourly)
    startShareCodeExpirationJob();

    // Start animal access expiration cron job (hourly)
    startAnimalAccessExpirationJob();

    // Start listing boost expiration cron job (hourly)
    startListingBoostExpirationJob();

    // Start service listing payment expiration cron job (daily)
    startServiceListingExpirationJob();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

// ---------- Shutdown ----------
process.on("SIGTERM", async () => {
  app.log.info("SIGTERM received, closing");
  stopNotificationScanJob();
  stopRuleExecutionJob();
  stopNetworkSearchIndexJob();
  stopAnimalAccessCleanupJob();
  stopShareCodeExpirationJob();
  stopAnimalAccessExpirationJob();
  stopListingBoostExpirationJob();
  stopServiceListingExpirationJob();
  await flush(2000); // Flush pending Sentry events
  await app.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  app.log.info("SIGINT received, closing");
  stopNotificationScanJob();
  stopRuleExecutionJob();
  stopNetworkSearchIndexJob();
  stopAnimalAccessCleanupJob();
  stopShareCodeExpirationJob();
  stopAnimalAccessExpirationJob();
  stopListingBoostExpirationJob();
  stopServiceListingExpirationJob();
  await flush(2000); // Flush pending Sentry events
  await app.close();
  process.exit(0);
});
