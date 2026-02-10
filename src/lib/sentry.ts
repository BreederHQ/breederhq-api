// src/lib/sentry.ts
// Sentry initialization for error tracking and performance monitoring

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Call this as early as possible in server startup.
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    if (IS_PRODUCTION) {
      console.warn("[Sentry] SENTRY_DSN not set - error tracking disabled in production!");
    } else {
      console.log("[Sentry] SENTRY_DSN not set - skipping initialization (dev mode)");
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.BHQ_ENV || process.env.NODE_ENV || "development",
    release: process.env.npm_package_version || "unknown",

    // Performance Monitoring
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0, // 10% in prod, 100% in dev
    profilesSampleRate: IS_PRODUCTION ? 0.1 : 1.0, // Profile 10% of sampled transactions

    integrations: [
      // Enable profiling for performance insights
      nodeProfilingIntegration(),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      // Ignore client disconnects
      "ECONNRESET",
      "EPIPE",
      // Ignore expected auth failures
      "unauthorized",
      "forbidden_tenant",
    ],

    // Add context to all events
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (!IS_PRODUCTION && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Scrub sensitive data
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-csrf-token"];
      }

      return event;
    },
  });

  console.log(`[Sentry] Initialized (env: ${process.env.BHQ_ENV || process.env.NODE_ENV})`);
}

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("additional", context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with optional context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, unknown>
) {
  if (!SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("additional", context);
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for all subsequent events
 */
export function setUser(user: { id: string; email?: string; tenantId?: number }) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Custom data
    tenantId: user.tenantId,
  } as Sentry.User & { tenantId?: number });
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  if (!SENTRY_DSN) return;
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a performance transaction span
 */
export function startSpan<T>(
  name: string,
  op: string,
  callback: () => T
): T {
  if (!SENTRY_DSN) return callback();

  return Sentry.startSpan({ name, op }, callback);
}

/**
 * Flush pending events (call before process exit)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  if (!SENTRY_DSN) return true;
  return Sentry.flush(timeout);
}

// Re-export Sentry for advanced usage
export { Sentry };
