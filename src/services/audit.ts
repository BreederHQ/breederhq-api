// src/services/audit.ts
// Minimal audit logging service for security events
// Never throws - fail open if DB is down

import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import prisma from "../prisma.js";

// ---------- Types ----------

export type AuditAction =
  // Auth events
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_REGISTER_SUCCESS"
  | "AUTH_REGISTER_FAILURE"
  | "AUTH_LOGOUT"
  // Surface/tenant denials
  | "AUTH_SURFACE_DENIED"
  | "AUTH_TENANT_DENIED"
  | "AUTH_TENANT_CONTEXT_REQUIRED"
  // Portal events
  | "PORTAL_INVITE_CREATED"
  | "PORTAL_INVITE_RESENT"
  | "PORTAL_ACTIVATE_SUCCESS"
  | "PORTAL_ACTIVATE_FAILURE"
  // Marketplace events
  | "MARKETPLACE_ENTITLEMENT_GRANTED"
  | "MARKETPLACE_ENTITLEMENT_REVOKED"
  | "MARKETPLACE_ACCESS_DENIED"
  // CSRF events
  | "CSRF_FAILED";

export type AuditSurface = "PLATFORM" | "PORTAL" | "MARKETPLACE";
export type AuditActorContext = "STAFF" | "CLIENT" | "PUBLIC";
export type AuditOutcome = "SUCCESS" | "FAILURE";

export interface AuditParams {
  action: AuditAction;
  outcome: AuditOutcome;
  userId?: string | null;
  tenantId?: number | null;
  surface?: AuditSurface;
  actorContext?: AuditActorContext | null;
  detail?: Record<string, unknown>;
}

// ---------- Request context extraction ----------

function getRequestId(req: FastifyRequest): string | null {
  // Check for common request ID headers
  const xRequestId = req.headers["x-request-id"];
  const xCorrelationId = req.headers["x-correlation-id"];
  const traceId = req.headers["x-amzn-trace-id"];

  if (typeof xRequestId === "string") return xRequestId.slice(0, 64);
  if (typeof xCorrelationId === "string") return xCorrelationId.slice(0, 64);
  if (typeof traceId === "string") return traceId.slice(0, 64);

  // Generate one from req.id if available
  if (req.id) return String(req.id).slice(0, 64);

  return null;
}

function getClientIp(req: FastifyRequest): string | null {
  // Check forwarded headers (in order of trust)
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const xRealIp = req.headers["x-real-ip"];
  const xForwardedFor = req.headers["x-forwarded-for"];

  if (typeof cfConnectingIp === "string") return cfConnectingIp.slice(0, 45);
  if (typeof xRealIp === "string") return xRealIp.slice(0, 45);
  if (typeof xForwardedFor === "string") {
    // Take first IP (client's original IP)
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }

  // Fall back to socket remote address
  const ip = req.ip || (req.socket?.remoteAddress);
  return ip ? String(ip).slice(0, 45) : null;
}

function getUserAgent(req: FastifyRequest): string | null {
  const ua = req.headers["user-agent"];
  if (typeof ua === "string" && ua.length > 0) {
    // Truncate very long user agents
    return ua.slice(0, 500);
  }
  return null;
}

function deriveSurfaceFromRequest(req: FastifyRequest): AuditSurface {
  // Check if surface was already attached to request
  const attached = (req as any).surface;
  if (attached === "PLATFORM" || attached === "PORTAL" || attached === "MARKETPLACE") {
    return attached;
  }

  // Fall back to hostname detection
  const host = (req.hostname || req.headers.host || "").toLowerCase();
  if (host.includes("portal")) return "PORTAL";
  if (host.includes("marketplace")) return "MARKETPLACE";
  return "PLATFORM";
}

// ---------- Main audit function ----------

/**
 * Log an audit event. Never throws.
 * Designed to fail open if DB is unavailable.
 */
export async function audit(
  req: FastifyRequest,
  params: AuditParams
): Promise<void> {
  try {
    const surface = params.surface ?? deriveSurfaceFromRequest(req);

    await prisma.auditEvent.create({
      data: {
        requestId: getRequestId(req),
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        userId: params.userId ?? null,
        surface,
        actorContext: params.actorContext ?? null,
        tenantId: params.tenantId ?? null,
        action: params.action,
        outcome: params.outcome,
        detailJson: params.detail as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Never throw - log and continue
    // In production, this would go to a log aggregator
    console.error("[audit] Failed to write audit event:", {
      action: params.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Convenience wrapper for logging failures with detail.
 */
export async function auditFailure(
  req: FastifyRequest,
  action: AuditAction,
  detail: Record<string, unknown>,
  opts?: {
    userId?: string | null;
    tenantId?: number | null;
    surface?: AuditSurface;
    actorContext?: AuditActorContext | null;
  }
): Promise<void> {
  return audit(req, {
    action,
    outcome: "FAILURE",
    detail,
    ...opts,
  });
}

/**
 * Convenience wrapper for logging successes.
 */
export async function auditSuccess(
  req: FastifyRequest,
  action: AuditAction,
  opts?: {
    userId?: string | null;
    tenantId?: number | null;
    surface?: AuditSurface;
    actorContext?: AuditActorContext | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  return audit(req, {
    action,
    outcome: "SUCCESS",
    ...opts,
  });
}
