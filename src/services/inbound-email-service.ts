// src/services/inbound-email-service.ts
import crypto from "crypto";
import { INBOUND_DOMAIN } from "./email-service.js";

const HMAC_SECRET = process.env.INBOUND_EMAIL_HMAC_SECRET;

/**
 * Generate HMAC hash for a thread ID
 */
function generateThreadHmac(threadId: number): string {
  if (!HMAC_SECRET) {
    throw new Error("INBOUND_EMAIL_HMAC_SECRET environment variable is not set");
  }
  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`thread:${threadId}`)
    .digest("hex")
    .substring(0, 12); // First 12 chars is sufficient
}

/**
 * Generate a reply-to address for a message thread.
 * Format: reply+t_{threadId}_{hmac}@mail.breederhq.com
 *
 * @param threadId - The message thread ID
 * @returns The reply-to email address
 */
export function generateReplyToAddress(threadId: number): string {
  const hmac = generateThreadHmac(threadId);
  return `reply+t_${threadId}_${hmac}@${INBOUND_DOMAIN}`;
}

/**
 * Parse and validate a reply-to address.
 * Returns the thread ID if valid, null if invalid or tampered.
 *
 * @param email - The email address to parse
 * @returns Object with threadId if valid, null if invalid
 */
export function parseReplyToAddress(email: string): { threadId: number } | null {
  const localPart = email.split("@")[0];
  const match = localPart.match(/^reply\+t_(\d+)_([a-f0-9]+)$/);

  if (!match) return null;

  const threadId = parseInt(match[1], 10);
  const providedHmac = match[2];

  // Verify HMAC
  const expectedHmac = generateThreadHmac(threadId);
  if (providedHmac !== expectedHmac) {
    console.warn(`[inbound-email] Invalid HMAC for thread ${threadId}`);
    return null;
  }

  return { threadId };
}

/**
 * Parse a tenant inbound address.
 * Format: {slug}@mail.breederhq.com
 *
 * @param email - The email address to parse
 * @returns Object with slug if valid tenant address, null otherwise
 */
export function parseTenantInboundAddress(email: string): { slug: string } | null {
  const [localPart, domain] = email.split("@");

  // Must be on our inbound domain
  if (domain?.toLowerCase() !== INBOUND_DOMAIN.toLowerCase()) return null;

  // Exclude special addresses
  if (localPart.startsWith("reply+")) return null;
  if (localPart === "noreply") return null;
  if (localPart === "notifications") return null;

  // Validate slug format (alphanumeric and hyphens)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(localPart) && !/^[a-z0-9]$/.test(localPart)) {
    return null;
  }

  return { slug: localPart };
}

/**
 * Strip common email reply patterns (quoted text, signatures).
 * Extracts just the new content from an email reply.
 *
 * @param body - The email body text
 * @returns The cleaned body with reply cruft removed
 */
export function stripEmailReplyContent(body: string): string {
  let cleaned = body;

  // Common reply markers - cut everything after these
  const cutoffPatterns = [
    /^On .+wrote:$/im,                        // "On Mon, Jan 1, 2025, X wrote:"
    /^-{2,}\s*Original Message\s*-{2,}/im,    // "-- Original Message --"
    /^>{1,}\s*On .+wrote:/im,                 // "> On Mon... wrote:" (quoted)
    /\n--\s*\n/,                              // "-- \n" signature marker (RFC 3676)
    /^From:\s*.+$/im,                         // "From: Someone" header in forwarded
    /^Sent:\s*.+$/im,                         // "Sent: Date" header in forwarded
  ];

  for (const pattern of cutoffPatterns) {
    const match = cleaned.match(pattern);
    if (match?.index !== undefined) {
      cleaned = cleaned.substring(0, match.index);
    }
  }

  // Remove quoted lines (lines starting with >)
  cleaned = cleaned
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n");

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned || body.trim(); // Fallback to original if everything was stripped
}

/**
 * Parse RFC 5322 "From" header to extract display name and email.
 * Formats:
 *   - "Display Name" <email@example.com>
 *   - Display Name <email@example.com>
 *   - email@example.com
 *
 * @param from - The "From" header value
 * @returns Object with displayName and email
 */
export function parseFromHeader(from: string): { displayName: string | null; email: string } {
  // Match "Name" <email> or Name <email> format
  const match = from.match(/^(.+?)\s*<(.+?)>$/);

  if (match) {
    let displayName = match[1].trim();
    const email = match[2].trim();

    // Remove surrounding quotes if present
    displayName = displayName.replace(/^["']|["']$/g, "");

    return { displayName: displayName || null, email };
  }

  // Just an email address with no display name
  return { displayName: null, email: from.trim() };
}

/**
 * Extract a display name from an email address.
 * Converts "john.doe@example.com" to "John Doe"
 *
 * @param email - The email address
 * @returns A formatted name
 */
export function extractNameFromEmail(email: string): string {
  const localPart = email.split("@")[0];
  return localPart
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Generate a unique slug from a name.
 * Converts "Sunny Acres Farm" to "sunny-acres-farm"
 *
 * @param name - The name to convert
 * @returns A URL-safe slug
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);
}

/**
 * Reserved email slugs that cannot be used by tenants
 */
const RESERVED_SLUGS = [
  "reply",
  "noreply",
  "notifications",
  "admin",
  "support",
  "info",
  "contact",
  "help",
  "abuse",
  "postmaster",
];

/**
 * Validate an inbound email slug for format and reserved words.
 *
 * @param slug - The slug to validate
 * @returns Validation result with reason if invalid
 */
export function validateInboundSlug(slug: string): { valid: boolean; reason?: string } {
  // Length check
  if (slug.length < 3 || slug.length > 30) {
    return { valid: false, reason: "Must be 3-30 characters" };
  }

  // Format check (alphanumeric and hyphens only, no leading/trailing hyphens)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
    return { valid: false, reason: "Only lowercase letters, numbers, and hyphens allowed" };
  }

  // Reserved words check
  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    return { valid: false, reason: "This address is reserved" };
  }

  return { valid: true };
}

/**
 * Assign a unique inbound email slug to a tenant based on organization name.
 * Handles duplicates by appending a numeric suffix.
 *
 * @param orgName - Organization name to generate slug from
 * @param prismaClient - Prisma client instance (supports transactions)
 * @returns Unique slug for the tenant
 */
export async function assignUniqueSlug(
  orgName: string,
  prismaClient: any
): Promise<string> {
  const baseSlug = generateSlugFromName(orgName);
  let finalSlug = baseSlug;
  let suffix = 2;

  // Find unique slug by checking for existing tenants
  while (suffix < 100) {
    const existing = await prismaClient.tenant.findFirst({
      where: { inboundEmailSlug: finalSlug },
    });

    if (!existing) break;

    finalSlug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  if (suffix >= 100) {
    throw new Error(`Could not find unique slug for organization: ${orgName}`);
  }

  return finalSlug;
}
