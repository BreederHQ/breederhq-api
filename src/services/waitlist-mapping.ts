/**
 * WaitlistEntry Party Mapping (Step 6E)
 *
 * Provides backward-compatible mapping between Party-only storage and legacy contact/org fields.
 * After Step 6E, WaitlistEntry persists only clientPartyId; legacy contactId/organizationId are removed.
 *
 * This module ensures:
 * - Reads: derive legacy contactId/organizationId from Party.type
 * - Writes: accept legacy fields and resolve to clientPartyId
 */

import type { PrismaClient, Party, PartyType } from "@prisma/client";

/**
 * Standard include for WaitlistEntry queries that need Party data for mapping.
 */
export const WAITLIST_INCLUDE_PARTY = {
  clientParty: {
    select: {
      id: true,
      type: true,
      contact: { select: { id: true, display_name: true, email: true, phoneE164: true } },
      organization: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
  sirePref: { select: { id: true, name: true } },
  damPref: { select: { id: true, name: true } },
  TagAssignment: { include: { tag: true } },
} as const;

interface WaitlistWithParty {
  id: number;
  tenantId: number;
  clientPartyId: number | null;
  clientParty?: {
    id: number;
    type: PartyType;
    contact?: { id: number; display_name: string; email: string | null; phoneE164: string | null } | null;
    organization?: { id: number; name: string; email: string | null; phone: string | null } | null;
  } | null;
  [key: string]: any;
}

/**
 * Derives legacy contactId/organizationId from Party for backward-compatible responses.
 * Returns object with contactId, organizationId, contact, organization populated from Party.
 *
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy client fields from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 */
export function deriveLegacyClientFields(entry: WaitlistWithParty): {
  contactId: number | null;
  organizationId: number | null;
  contact: { id: number; display_name: string; email: string | null; phoneE164: string | null } | null;
  organization: { id: number; name: string; email: string | null; phone: string | null } | null;
} {
  if (!entry.clientParty) {
    return {
      contactId: null,
      organizationId: null,
      contact: null,
      organization: null,
    };
  }

  const party = entry.clientParty;

  if (party.type === "CONTACT" && party.contact) {
    return {
      contactId: party.contact.id,
      organizationId: null,
      contact: party.contact,
      organization: null,
    };
  }

  if (party.type === "ORGANIZATION" && party.organization) {
    return {
      contactId: null,
      organizationId: party.organization.id,
      contact: null,
      organization: party.organization,
    };
  }

  // Fallback: Party exists but backing entity missing (orphan)
  return {
    contactId: null,
    organizationId: null,
    contact: null,
    organization: null,
  };
}

/**
 * Resolves clientPartyId from legacy contactId/organizationId inputs.
 * Accepts either contactId or organizationId (precedence: organizationId > contactId if both provided).
 *
 * This function allows the API to accept legacy field inputs while persisting only partyId internally.
 * Step 6E migration pattern: accept legacy, resolve to Party, persist Party-only.
 *
 * @param prisma - Prisma client
 * @param contactId - Legacy contact ID
 * @param organizationId - Legacy organization ID
 * @returns clientPartyId or null
 */
export async function resolveClientPartyId(
  prisma: PrismaClient | any,
  contactId: number | null | undefined,
  organizationId: number | null | undefined
): Promise<number | null> {
  // Precedence: organizationId > contactId
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { partyId: true },
    });
    return org?.partyId ?? null;
  }

  if (contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { partyId: true },
    });
    return contact?.partyId ?? null;
  }

  return null;
}
