// src/services/marketplace-provider-terms-service.ts
// Provider Service Agreement acceptance service for marketplace
// Handles terms version tracking, validation, and acceptance recording
// Follows same pattern as tos-service.ts but for marketplace provider terms

import type { FastifyRequest } from "fastify";
import prisma from "../prisma.js";

/**
 * Current Provider Service Agreement version.
 * MUST match frontend CURRENT_PROVIDER_TERMS_VERSION
 */
export const CURRENT_PROVIDER_TERMS_VERSION = "1.0";

/**
 * Effective date of the current Provider Service Agreement.
 * MUST match frontend PROVIDER_TERMS_EFFECTIVE_DATE
 */
export const PROVIDER_TERMS_EFFECTIVE_DATE = "2026-02-15";

/**
 * Payload received from frontend for provider terms acceptance
 */
export interface ProviderTermsPayload {
  version: string;
  effectiveDate: string;
}

/**
 * Provider terms status response
 */
export interface ProviderTermsStatus {
  currentVersion: string;
  effectiveDate: string;
  acceptedVersion: string | null;
  acceptedAt: Date | null;
  hasAccepted: boolean;
  needsReaccept: boolean;
}

/**
 * Validates a provider terms acceptance payload from the frontend.
 * Throws an error if invalid.
 */
export function validateProviderTermsPayload(payload: unknown): ProviderTermsPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("PROVIDER_TERMS_ACCEPTANCE_REQUIRED");
  }

  const p = payload as Record<string, unknown>;

  // Validate version
  if (typeof p.version !== "string" || !p.version) {
    throw new Error("PROVIDER_TERMS_ACCEPTANCE_REQUIRED");
  }

  // Version must match current
  if (p.version !== CURRENT_PROVIDER_TERMS_VERSION) {
    throw new Error("PROVIDER_TERMS_VERSION_MISMATCH");
  }

  // Validate effectiveDate (should match our current effective date)
  if (typeof p.effectiveDate !== "string" || !p.effectiveDate) {
    throw new Error("PROVIDER_TERMS_ACCEPTANCE_INVALID");
  }

  if (p.effectiveDate !== PROVIDER_TERMS_EFFECTIVE_DATE) {
    throw new Error("PROVIDER_TERMS_VERSION_MISMATCH");
  }

  return {
    version: p.version as string,
    effectiveDate: p.effectiveDate as string,
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
 * Records a provider terms acceptance for a marketplace user.
 * Server stamps acceptedAt for audit integrity.
 *
 * COMPLIANCE: This MUST succeed - if logging fails, the operation fails.
 * Terms acceptance is a legal requirement and must be recorded before proceeding.
 */
export async function writeProviderTermsAcceptance(
  userId: number,
  payload: ProviderTermsPayload,
  req: FastifyRequest
): Promise<{ acceptedAt: Date; version: string }> {
  const ipAddress = extractIpAddress(req);
  const userAgent = extractUserAgent(req);

  // Server-stamped timestamp for audit integrity
  const acceptedAt = new Date();

  // COMPLIANCE: Provider terms acceptance logging is MANDATORY
  // If this fails, the entire operation must fail - we cannot allow users
  // to proceed without a recorded acceptance
  const record = await prisma.marketplaceProviderTermsAcceptance.create({
    data: {
      userId,
      version: payload.version,
      acceptedAt,
      ipAddress,
      userAgent,
    },
  });

  if (!record) {
    console.error(
      "[marketplace-provider-terms-service] COMPLIANCE ERROR: Failed to record provider terms acceptance for userId:",
      userId
    );
    throw new Error("PROVIDER_TERMS_ACCEPTANCE_LOGGING_FAILED");
  }

  return { acceptedAt: record.acceptedAt, version: record.version };
}

/**
 * Get the latest provider terms acceptance for a marketplace user.
 * Returns null if user has never accepted provider terms.
 */
export async function getLatestProviderTermsAcceptance(
  userId: number
): Promise<{ version: string; acceptedAt: Date } | null> {
  try {
    const latest = await prisma.marketplaceProviderTermsAcceptance.findFirst({
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
 * Check if a marketplace user has accepted the current provider terms version.
 */
export async function hasAcceptedCurrentProviderTerms(userId: number): Promise<boolean> {
  const latest = await getLatestProviderTermsAcceptance(userId);
  if (!latest) return false;
  return latest.version === CURRENT_PROVIDER_TERMS_VERSION;
}

/**
 * Check if a marketplace user needs to re-accept provider terms.
 * Returns true if user has never accepted or accepted an older version.
 */
export async function needsProviderTermsReacceptance(userId: number): Promise<boolean> {
  const latest = await getLatestProviderTermsAcceptance(userId);
  if (!latest) return true;
  return latest.version !== CURRENT_PROVIDER_TERMS_VERSION;
}

/**
 * Get provider terms status for a marketplace user.
 * Used by SSO check and terms acceptance page.
 */
export async function getProviderTermsStatus(userId: number): Promise<ProviderTermsStatus> {
  const latest = await getLatestProviderTermsAcceptance(userId);
  const hasAccepted = !!latest && latest.version === CURRENT_PROVIDER_TERMS_VERSION;

  return {
    currentVersion: CURRENT_PROVIDER_TERMS_VERSION,
    effectiveDate: PROVIDER_TERMS_EFFECTIVE_DATE,
    acceptedVersion: latest?.version ?? null,
    acceptedAt: latest?.acceptedAt ?? null,
    hasAccepted,
    needsReaccept: !hasAccepted,
  };
}
