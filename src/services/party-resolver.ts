/**
 * Party Resolution Utility
 *
 * Provides helper functions for resolving partyId from legacy Contact or Organization IDs.
 * Retained for compatibility with user.ts PATCH /users/:id/contact endpoint which still
 * accepts legacy contactId for setting user.partyId.
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
 * NOTE: This utility does NOT enforce tenant scoping. It trusts the caller to
 * provide IDs that have already been verified against the correct tenantId.
 * All current callers (e.g. user PATCH endpoint) perform their own tenant
 * checks before invoking this function.
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

