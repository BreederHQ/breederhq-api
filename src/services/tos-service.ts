// src/services/tos-service.ts
// Terms of Service acceptance service
// Handles ToS version tracking, validation, and acceptance recording

import type { FastifyRequest } from "fastify";
import prisma from "../prisma.js";

/**
 * Current Terms of Service version.
 * MUST match frontend CURRENT_TOS_VERSION in packages/ui/src/legal/config.ts
 */
export const CURRENT_TOS_VERSION = "1.0";

/**
 * Effective date of the current Terms of Service.
 * MUST match frontend TOS_EFFECTIVE_DATE in packages/ui/src/legal/config.ts
 */
export const TOS_EFFECTIVE_DATE = "2026-01-03";

/**
 * Valid surfaces for ToS acceptance
 */
export type TosAcceptanceSurface = "marketplace" | "platform" | "portal";

/**
 * Valid flows for ToS acceptance
 */
export type TosAcceptanceFlow = "register" | "invite_signup" | "portal_activate";

/**
 * Payload received from frontend for ToS acceptance
 */
export interface TosAcceptancePayload {
  version: string;
  effectiveDate: string;
  surface: TosAcceptanceSurface;
  flow: TosAcceptanceFlow;
}

/**
 * Validates a ToS acceptance payload from the frontend.
 * Throws an error if invalid.
 */
export function validateTosAcceptancePayload(payload: unknown): TosAcceptancePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("tos_acceptance_required");
  }

  const p = payload as Record<string, unknown>;

  // Validate version
  if (typeof p.version !== "string" || !p.version) {
    throw new Error("tos_version_required");
  }

  // Version must match current
  if (p.version !== CURRENT_TOS_VERSION) {
    throw new Error("tos_version_mismatch");
  }

  // Validate effectiveDate (should match our current effective date)
  if (typeof p.effectiveDate !== "string" || !p.effectiveDate) {
    throw new Error("tos_effective_date_required");
  }

  if (p.effectiveDate !== TOS_EFFECTIVE_DATE) {
    throw new Error("tos_effective_date_mismatch");
  }

  // Validate surface
  const validSurfaces: TosAcceptanceSurface[] = ["marketplace", "platform", "portal"];
  if (!validSurfaces.includes(p.surface as TosAcceptanceSurface)) {
    throw new Error("tos_surface_invalid");
  }

  // Validate flow
  const validFlows: TosAcceptanceFlow[] = ["register", "invite_signup", "portal_activate"];
  if (!validFlows.includes(p.flow as TosAcceptanceFlow)) {
    throw new Error("tos_flow_invalid");
  }

  return {
    version: p.version as string,
    effectiveDate: p.effectiveDate as string,
    surface: p.surface as TosAcceptanceSurface,
    flow: p.flow as TosAcceptanceFlow,
  };
}

/**
 * Extract IP address from Fastify request.
 * Handles X-Forwarded-For header for proxied requests.
 */
function extractIpAddress(req: FastifyRequest): string | null {
  // X-Forwarded-For can be a comma-separated list
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(",")[0]?.trim();
    if (first) return first;
  }

  // Fallback to direct connection IP
  return req.ip || null;
}

/**
 * Extract user agent from Fastify request.
 */
function extractUserAgent(req: FastifyRequest): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

/**
 * Records a ToS acceptance for a user.
 * Server stamps acceptedAt for audit integrity.
 */
export async function writeTosAcceptance(
  userId: string,
  payload: TosAcceptancePayload,
  req: FastifyRequest
): Promise<void> {
  const ipAddress = extractIpAddress(req);
  const userAgent = extractUserAgent(req);

  try {
    await (prisma as any).tosAcceptance.create({
      data: {
        userId,
        version: payload.version,
        acceptedAt: new Date(), // Server-side timestamp
        ipAddress,
        userAgent,
        surface: payload.surface,
        flow: payload.flow,
      },
    });
  } catch (err) {
    // If TosAcceptance table doesn't exist yet (migration pending), log and continue
    console.warn("[tos-service] Failed to record ToS acceptance (table may not exist):", err);
    // Don't throw - we don't want to block registration if the table is missing
  }
}

/**
 * Get the latest ToS acceptance for a user.
 * Returns null if user has never accepted ToS.
 */
export async function getLatestTosAcceptance(
  userId: string
): Promise<{ version: string; acceptedAt: Date } | null> {
  try {
    const latest = await (prisma as any).tosAcceptance.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      select: { version: true, acceptedAt: true },
    });
    return latest ?? null;
  } catch {
    // Table may not exist yet
    return null;
  }
}

/**
 * Check if a user needs to re-accept ToS.
 * Returns true if user has never accepted or accepted an older version.
 */
export async function needsTosReacceptance(userId: string): Promise<boolean> {
  const latest = await getLatestTosAcceptance(userId);
  if (!latest) return true;
  return latest.version !== CURRENT_TOS_VERSION;
}

/**
 * Get ToS status for a user (for session/bootstrap endpoints).
 */
export async function getTosStatus(userId: string): Promise<{
  currentVersion: string;
  acceptedVersion: string | null;
  needsReaccept: boolean;
}> {
  const latest = await getLatestTosAcceptance(userId);
  return {
    currentVersion: CURRENT_TOS_VERSION,
    acceptedVersion: latest?.version ?? null,
    needsReaccept: !latest || latest.version !== CURRENT_TOS_VERSION,
  };
}
