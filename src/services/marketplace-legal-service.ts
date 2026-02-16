// src/services/marketplace-legal-service.ts
// Marketplace legal acceptance service
// Records legal document acceptance for all marketplace flows (registration,
// booking, waitlist, inquiries). Supports both authenticated and anonymous users.

import type { FastifyRequest } from "fastify";
import prisma from "../prisma.js";

// Current document versions — MUST match frontend constants in packages/ui/src/legal/config.ts
const DOCUMENT_VERSIONS: Record<string, string> = {
  tos: "1.0",
  privacy_policy: "1.0",
  buyer_terms: "1.0",
  transaction_terms: "1.0",
  acceptable_use: "1.0",
  seller_agreement: "1.0",
};

const VALID_FLOWS = [
  "register",
  "booking",
  "waitlist",
  "breeding_inquiry",
  "service_inquiry",
  "listing_publish",
] as const;

type LegalAcceptanceFlow = (typeof VALID_FLOWS)[number];

export interface DocumentAcceptance {
  document: string;
  version: string;
}

export interface LegalAcceptancePayload {
  documents: DocumentAcceptance[];
  flow: string;
  surface: string;
}

/**
 * Extract IP address from Fastify request.
 * Handles X-Forwarded-For header for proxied requests.
 */
function extractIpAddress(req: FastifyRequest): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(",")[0]?.trim();
    if (first) return first;
  }
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
 * Validates a legal acceptance payload from the frontend.
 * Checks that all referenced documents exist and versions match.
 */
export function validateLegalAcceptancePayload(
  payload: unknown
): LegalAcceptancePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("LEGAL_ACCEPTANCE_REQUIRED");
  }

  const p = payload as Record<string, unknown>;

  // Validate documents array
  if (!Array.isArray(p.documents) || p.documents.length === 0) {
    throw new Error("LEGAL_ACCEPTANCE_REQUIRED");
  }

  const documents: DocumentAcceptance[] = [];
  for (const doc of p.documents) {
    if (!doc || typeof doc !== "object") {
      throw new Error("LEGAL_ACCEPTANCE_INVALID");
    }
    const d = doc as Record<string, unknown>;

    if (typeof d.document !== "string" || !d.document) {
      throw new Error("LEGAL_ACCEPTANCE_INVALID");
    }
    if (typeof d.version !== "string" || !d.version) {
      throw new Error("LEGAL_ACCEPTANCE_INVALID");
    }

    // Validate document is known
    const expectedVersion = DOCUMENT_VERSIONS[d.document];
    if (!expectedVersion) {
      throw new Error("LEGAL_ACCEPTANCE_INVALID");
    }

    // Validate version matches current
    if (d.version !== expectedVersion) {
      throw new Error("LEGAL_DOCUMENT_VERSION_MISMATCH");
    }

    documents.push({ document: d.document, version: d.version });
  }

  // Validate flow
  if (
    typeof p.flow !== "string" ||
    !VALID_FLOWS.includes(p.flow as LegalAcceptanceFlow)
  ) {
    throw new Error("LEGAL_ACCEPTANCE_INVALID");
  }

  // Validate surface
  if (typeof p.surface !== "string" || p.surface !== "marketplace") {
    throw new Error("LEGAL_ACCEPTANCE_INVALID");
  }

  return {
    documents,
    flow: p.flow as string,
    surface: p.surface as string,
  };
}

/**
 * Records a legal acceptance for a marketplace user or anonymous user.
 * Server stamps acceptedAt for audit integrity.
 *
 * Compliance: This MUST succeed — if logging fails, the operation fails.
 * Legal acceptance must be recorded before the action proceeds.
 */
export async function writeLegalAcceptance(
  payload: LegalAcceptancePayload,
  req: FastifyRequest,
  opts: {
    marketplaceUserId?: number;
    email?: string;
    entityType?: string;
    entityId?: number;
  }
): Promise<{ id: number }> {
  const ipAddress = extractIpAddress(req);
  const userAgent = extractUserAgent(req);

  const record = await (prisma as any).marketplaceLegalAcceptance.create({
    data: {
      marketplaceUserId: opts.marketplaceUserId ?? null,
      email: opts.email ?? null,
      documentsAccepted: payload.documents,
      acceptedAt: new Date(),
      ipAddress,
      userAgent,
      surface: payload.surface,
      flow: payload.flow,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
    },
  });

  if (!record) {
    console.error(
      "[marketplace-legal-service] COMPLIANCE ERROR: Failed to record legal acceptance"
    );
    throw new Error("LEGAL_ACCEPTANCE_LOGGING_FAILED");
  }

  return { id: record.id };
}

/**
 * Converts a legacy TosAcceptancePayload (from registration) into the new format
 * and records it in MarketplaceLegalAcceptance.
 */
export async function writeLegacyTosAcceptance(
  tosPayload: { version: string; effectiveDate: string; surface: string; flow: string },
  marketplaceUserId: number,
  req: FastifyRequest
): Promise<{ id: number }> {
  const legalPayload: LegalAcceptancePayload = {
    documents: [{ document: "tos", version: tosPayload.version }],
    flow: "register",
    surface: "marketplace",
  };

  return writeLegalAcceptance(legalPayload, req, { marketplaceUserId });
}
