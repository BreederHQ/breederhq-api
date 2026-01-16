// src/services/contracts/pdf-generator/audit-footer.ts
/**
 * Audit Footer Generator
 *
 * Creates audit trail information for the PDF footer.
 */

import type { SignatureEvent, ContractParty } from "@prisma/client";

export interface AuditEntry {
  action: string;
  timestamp: Date;
  partyName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditFooterData {
  contractId: number;
  title: string;
  entries: AuditEntry[];
  generatedAt: Date;
}

/**
 * Create audit footer data from signature events
 */
export function createAuditFooter(
  contractId: number,
  title: string,
  events: Array<
    SignatureEvent & {
      party?: Pick<ContractParty, "name" | "email"> | null;
    }
  >
): AuditFooterData {
  const entries: AuditEntry[] = events.map((event) => {
    let action = getActionLabel(event.status);
    if (event.message) {
      action = event.message;
    }

    return {
      action,
      timestamp: event.at,
      partyName: event.party?.name || event.party?.email || undefined,
      ipAddress: event.ipAddress || undefined,
      userAgent: event.userAgent ? summarizeUserAgent(event.userAgent) : undefined,
    };
  });

  return {
    contractId,
    title,
    entries,
    generatedAt: new Date(),
  };
}

/**
 * Get human-readable action label for signature status
 */
function getActionLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Contract created",
    viewed: "Contract viewed",
    signed: "Contract signed",
    declined: "Contract declined",
    voided: "Contract voided",
    expired: "Contract expired",
    complete: "All signatures collected",
  };
  return labels[status] || status;
}

/**
 * Summarize user agent to a shorter form
 */
function summarizeUserAgent(ua: string): string {
  // Extract browser and OS info
  const browsers = [
    { pattern: /Chrome\/[\d.]+/, name: "Chrome" },
    { pattern: /Firefox\/[\d.]+/, name: "Firefox" },
    { pattern: /Safari\/[\d.]+/, name: "Safari" },
    { pattern: /Edge\/[\d.]+/, name: "Edge" },
    { pattern: /MSIE [\d.]+/, name: "IE" },
  ];

  const systems = [
    { pattern: /Windows NT 10/, name: "Windows 10" },
    { pattern: /Windows NT 6.3/, name: "Windows 8.1" },
    { pattern: /Windows NT 6.1/, name: "Windows 7" },
    { pattern: /Mac OS X/, name: "macOS" },
    { pattern: /Linux/, name: "Linux" },
    { pattern: /Android/, name: "Android" },
    { pattern: /iPhone|iPad/, name: "iOS" },
  ];

  let browser = "Unknown Browser";
  let system = "Unknown OS";

  for (const b of browsers) {
    if (b.pattern.test(ua)) {
      browser = b.name;
      break;
    }
  }

  for (const s of systems) {
    if (s.pattern.test(ua)) {
      system = s.name;
      break;
    }
  }

  return `${browser} on ${system}`;
}

/**
 * Format audit footer as text for PDF embedding
 */
export function formatAuditFooterText(data: AuditFooterData): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════════════════════════════════",
    "                           CERTIFICATE OF COMPLETION",
    "═══════════════════════════════════════════════════════════════════════════════",
    "",
    `Document: ${data.title}`,
    `Contract ID: ${data.contractId}`,
    `Generated: ${data.generatedAt.toISOString()}`,
    "",
    "AUDIT TRAIL:",
    "───────────────────────────────────────────────────────────────────────────────",
  ];

  for (const entry of data.entries) {
    const timestamp = entry.timestamp.toISOString();
    const party = entry.partyName ? ` by ${entry.partyName}` : "";
    const ip = entry.ipAddress ? ` (IP: ${entry.ipAddress})` : "";

    lines.push(`${timestamp} - ${entry.action}${party}${ip}`);

    if (entry.userAgent) {
      lines.push(`                     Device: ${entry.userAgent}`);
    }
  }

  lines.push("───────────────────────────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("This document was electronically signed using BreederHQ E-Signatures.");
  lines.push("The signatures and audit trail are legally binding under the ESIGN Act.");
  lines.push("");

  return lines.join("\n");
}
