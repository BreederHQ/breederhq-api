/**
 * Party Resolution Utility
 *
 * Provides helper functions for resolving partyId from legacy Contact or Organization IDs.
 * Used for dual-write operations in the Party migration (Step 5: Breeding domain).
 *
 * Usage:
 * - When creating/updating records with contactId or organizationId,
 *   call resolvePartyId() to get the corresponding partyId.
 * - This ensures dual-write: both legacy and new partyId fields are populated.
 */

import type { PrismaClient } from "@prisma/client";

export type PartySource =
  | { contactId: number }
  | { organizationId: number }
  | null;

/**
 * Resolves partyId from a Contact or Organization ID.
 * Returns null if source is null or if the Contact/Organization has no partyId.
 *
 * @param prisma - Prisma client instance
 * @param source - Object with either contactId or organizationId
 * @returns The partyId if resolvable, otherwise null
 */
export async function resolvePartyId(
  prisma: PrismaClient | any,
  source: PartySource
): Promise<number | null> {
  if (!source) return null;

  if ("contactId" in source && source.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: source.contactId },
      select: { partyId: true },
    });
    return contact?.partyId ?? null;
  }

  if ("organizationId" in source && source.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: source.organizationId },
      select: { partyId: true },
    });
    return org?.partyId ?? null;
  }

  return null;
}

/**
 * Resolves partyId for a party-type discriminated union.
 * Useful for models that have partyType field to indicate which FK to use.
 *
 * @param prisma - Prisma client instance
 * @param partyType - Either "Contact" or "Organization"
 * @param contactId - Contact ID if partyType is "Contact"
 * @param organizationId - Organization ID if partyType is "Organization"
 * @returns The partyId if resolvable, otherwise null
 */
export async function resolvePartyIdByType(
  prisma: PrismaClient | any,
  partyType: "Contact" | "Organization" | string,
  contactId: number | null | undefined,
  organizationId: number | null | undefined
): Promise<number | null> {
  if (partyType === "Contact" && contactId) {
    return resolvePartyId(prisma, { contactId });
  }
  if (partyType === "Organization" && organizationId) {
    return resolvePartyId(prisma, { organizationId });
  }
  return null;
}
