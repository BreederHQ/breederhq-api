// src/services/contracts/signature-event-service.ts
/**
 * Signature Event Service
 *
 * Logs all signature-related events for audit trail compliance.
 * Captures IP address, user agent, timestamps for all status changes.
 */

import type { FastifyRequest } from "fastify";
import type { SignatureStatus } from "@prisma/client";
import prisma from "../../prisma.js";
import type { SignatureData } from "./types.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface LogEventParams {
  tenantId: number;
  contractId: number;
  partyId?: number; // ContractParty.id, not Party.id
  status: SignatureStatus;
  message?: string;
  data?: Record<string, any>;
}

// ────────────────────────────────────────────────────────────────────────────
// IP/User Agent Extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract client IP address from request
 * Handles proxied requests (Cloudflare, load balancers)
 */
export function getClientIp(req: FastifyRequest): string {
  // Cloudflare
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  // Standard proxy header
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(",")[0].trim();
  }

  // X-Real-IP (nginx)
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // Direct connection
  return req.ip || "unknown";
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: FastifyRequest): string {
  const ua = req.headers["user-agent"];
  return ua || "unknown";
}

// ────────────────────────────────────────────────────────────────────────────
// Event Logging
// ────────────────────────────────────────────────────────────────────────────

/**
 * Log a signature event with audit data
 */
export async function logSignatureEvent(
  req: FastifyRequest | null,
  params: LogEventParams
): Promise<void> {
  const ipAddress = req ? getClientIp(req) : "system";
  const userAgent = req ? getUserAgent(req) : "system";

  await prisma.signatureEvent.create({
    data: {
      tenantId: params.tenantId,
      contractId: params.contractId,
      partyId: params.partyId,
      status: params.status,
      at: new Date(),
      ipAddress,
      userAgent,
      message: params.message,
      data: params.data,
    },
  });
}

/**
 * Log contract creation event
 */
export async function logContractCreated(
  req: FastifyRequest,
  tenantId: number,
  contractId: number
): Promise<void> {
  await logSignatureEvent(req, {
    tenantId,
    contractId,
    status: "pending",
    message: "Contract created",
  });
}

/**
 * Log contract sent event
 */
export async function logContractSent(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  recipientEmails: string[]
): Promise<void> {
  await logSignatureEvent(req, {
    tenantId,
    contractId,
    status: "pending",
    message: `Contract sent to ${recipientEmails.length} recipient(s)`,
    data: { recipients: recipientEmails },
  });
}

/**
 * Log contract viewed event (idempotent - only logs first view per party)
 */
export async function logContractViewed(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  contractPartyId: number
): Promise<boolean> {
  // Check if this party has already viewed
  const existingView = await prisma.signatureEvent.findFirst({
    where: {
      contractId,
      partyId: contractPartyId,
      status: "viewed",
    },
  });

  if (existingView) {
    return false; // Already logged view
  }

  await logSignatureEvent(req, {
    tenantId,
    contractId,
    partyId: contractPartyId,
    status: "viewed",
    message: "Contract viewed",
  });

  return true; // First view logged
}

/**
 * Log signature captured event
 */
export async function logSignatureCaptured(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  contractPartyId: number,
  signatureData: SignatureData
): Promise<void> {
  // Hash the signature image if present (for integrity verification)
  let signatureHash: string | undefined;
  if (signatureData.imageData) {
    const crypto = await import("crypto");
    signatureHash = crypto.createHash("sha256").update(signatureData.imageData).digest("hex");
  }

  await logSignatureEvent(req, {
    tenantId,
    contractId,
    partyId: contractPartyId,
    status: "signed",
    message: `Signed using ${signatureData.type} signature`,
    data: {
      signatureType: signatureData.type,
      signatureHash,
      typedName: signatureData.typedName,
      consentText: "I agree to sign this document electronically",
      capturedAt: signatureData.capturedAt,
    },
  });
}

/**
 * Log contract declined event
 */
export async function logContractDeclined(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  contractPartyId: number,
  reason?: string
): Promise<void> {
  await logSignatureEvent(req, {
    tenantId,
    contractId,
    partyId: contractPartyId,
    status: "declined",
    message: reason || "Contract declined",
    data: { declineReason: reason },
  });
}

/**
 * Log contract voided event
 */
export async function logContractVoided(
  req: FastifyRequest,
  tenantId: number,
  contractId: number,
  voidedByUserId: string,
  reason?: string
): Promise<void> {
  await logSignatureEvent(req, {
    tenantId,
    contractId,
    status: "voided",
    message: reason || "Contract voided",
    data: { voidedBy: voidedByUserId, voidReason: reason },
  });
}

/**
 * Log contract expired event (called by cron)
 */
export async function logContractExpired(
  tenantId: number,
  contractId: number
): Promise<void> {
  await logSignatureEvent(null, {
    tenantId,
    contractId,
    status: "expired",
    message: "Contract expired automatically",
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Event Retrieval
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get all events for a contract (audit trail)
 */
export async function getContractEvents(
  tenantId: number,
  contractId: number
): Promise<Array<{
  id: number;
  status: SignatureStatus;
  at: Date;
  ipAddress: string | null;
  userAgent: string | null;
  message: string | null;
  partyName?: string;
}>> {
  const events = await prisma.signatureEvent.findMany({
    where: {
      tenantId,
      contractId,
    },
    include: {
      party: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { at: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    status: e.status,
    at: e.at,
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
    message: e.message,
    partyName: e.party?.name || e.party?.email,
  }));
}
