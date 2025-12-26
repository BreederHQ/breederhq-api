import type { PartyRead, PartyStatus, PartyType } from "../types/party.js";

type Logger = {
  warn?: (obj: Record<string, unknown>, msg?: string) => void;
};

function trimToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function resolveStatus(partyArchived: boolean | null | undefined, backingArchived: boolean | null | undefined): PartyStatus {
  if (partyArchived) return "ARCHIVED";
  if (backingArchived) return "INACTIVE";
  return "ACTIVE";
}

function collectTags(contact: any, organization: any, type: PartyType): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  const addFrom = (assignments: any[] | null | undefined) => {
    if (!assignments) return;
    for (const row of assignments) {
      const name = trimToNull(row?.tag?.name);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      tags.push(name);
    }
  };

  if (type === "PERSON") addFrom(contact?.tagAssignments);
  if (type === "ORGANIZATION") addFrom(organization?.tagAssignments);

  if (type !== "PERSON" && type !== "ORGANIZATION") {
    addFrom(contact?.tagAssignments);
    addFrom(organization?.tagAssignments);
  }

  return tags;
}

function buildAddress(party: any, contact: any, organization: any) {
  const address = {
    line1: trimToNull(party?.street ?? contact?.street ?? organization?.street ?? null),
    line2: trimToNull(party?.street2 ?? contact?.street2 ?? organization?.street2 ?? null),
    city: trimToNull(party?.city ?? contact?.city ?? organization?.city ?? null),
    state: trimToNull(party?.state ?? contact?.state ?? organization?.state ?? null),
    postalCode: trimToNull(party?.postalCode ?? contact?.zip ?? organization?.zip ?? null),
    country: trimToNull(party?.country ?? contact?.country ?? organization?.country ?? null),
  };

  const hasValue = Object.values(address).some((v) => v != null);
  return hasValue ? address : null;
}

function resolveDisplayName(type: PartyType, partyName: unknown, contact: any, organization: any) {
  if (type === "PERSON") {
    return trimToNull(partyName) ?? trimToNull(contact?.display_name);
  }
  return trimToNull(partyName) ?? trimToNull(organization?.name);
}

function resolvePartyType(row: any): PartyType {
  if (row?.type === "ORGANIZATION") return "ORGANIZATION";
  if (row?.type === "CONTACT") return "PERSON";
  if (row?.organization) return "ORGANIZATION";
  return "PERSON";
}

function warnBacking(
  logger: Logger | undefined,
  partyId: number,
  tenantId: number | null,
  hasContact: boolean,
  hasOrganization: boolean
) {
  const payload = { partyId, tenantId, hasContact, hasOrganization };
  if (!logger?.warn) {
    console.warn("[party] inconsistent backing pointers", payload);
    return;
  }
  logger.warn(payload, "party backing pointers inconsistent");
}

export function toPartyRead(row: any, logger?: Logger): PartyRead {
  const partyId = Number(row?.id);
  const tenantId = row?.tenantId ? Number(row?.tenantId) : null;
  const contact = row?.contact ?? null;
  const organization = row?.organization ?? null;
  const type = resolvePartyType(row);

  const hasContact = !!contact;
  const hasOrganization = !!organization;
  if ((hasContact && hasOrganization) || (!hasContact && !hasOrganization)) {
    warnBacking(logger, partyId, tenantId, hasContact, hasOrganization);
  }

  const displayName = resolveDisplayName(type, row?.name, contact, organization) ?? "(Unnamed)";

  const organizationName =
    type === "PERSON" ? trimToNull(contact?.organization?.party?.name ?? contact?.organization?.name ?? null) : null;
  const organizationPartyId = type === "PERSON" ? contact?.organization?.partyId ?? null : null;

  const primaryEmail = trimToNull(row?.email ?? contact?.email ?? organization?.email ?? null);
  const primaryPhone = trimToNull(
    row?.phoneE164 ??
      contact?.phoneE164 ??
      organization?.phone ??
      row?.whatsappE164 ??
      contact?.whatsappE164 ??
      null
  );

  const address = buildAddress(row, contact, organization);

  const backingArchived = contact?.archived ?? organization?.archived ?? null;
  const status = resolveStatus(row?.archived ?? null, backingArchived);

  const tags = collectTags(contact, organization, type);

  const createdAt = toIso(row?.createdAt ?? contact?.createdAt ?? organization?.createdAt ?? null);
  const updatedAt = toIso(row?.updatedAt ?? contact?.updatedAt ?? organization?.updatedAt ?? null);

  return {
    partyId,
    type,
    backing: {
      contactId: contact?.id ?? null,
      organizationId: organization?.id ?? null,
    },
    displayName,
    organizationName,
    organizationPartyId,
    primaryEmail,
    primaryPhone,
    address,
    status,
    tags,
    createdAt,
    updatedAt,
  };
}

/**
 * Step 6 Legacy Field Mapping Helpers
 *
 * These functions derive legacy contactId/organizationId fields from Party relations
 * to maintain backward compatibility after Party-only column migration.
 */

/**
 * Maps a Party relation to legacy contactId and organizationId fields.
 * Used for backward-compatible read responses after Step 6 migration.
 *
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy contactId/organizationId from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 *
 * @param party - Party object with contact/organization relations included
 * @returns Object with contactId and organizationId (one will be set, other null)
 */
export function partyToLegacyContactOrg(party: any): { contactId: number | null; organizationId: number | null } {
  if (!party) {
    return { contactId: null, organizationId: null };
  }

  const contactId = party.contact?.id ?? null;
  const organizationId = party.organization?.id ?? null;

  return { contactId, organizationId };
}

/**
 * Maps a Party relation to legacy buyer fields (buyerContactId, buyerOrganizationId, buyerPartyType).
 * Used for backward-compatible read responses for Animal buyer and OffspringContract buyer.
 *
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy buyer fields from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 *
 * @param party - Party object with contact/organization relations and type field
 * @returns Object with buyerContactId, buyerOrganizationId, and buyerPartyType
 */
export function partyToLegacyBuyerFields(party: any): {
  buyerContactId: number | null;
  buyerOrganizationId: number | null;
  buyerPartyType: string | null;
} {
  if (!party) {
    return { buyerContactId: null, buyerOrganizationId: null, buyerPartyType: null };
  }

  const buyerContactId = party.contact?.id ?? null;
  const buyerOrganizationId = party.organization?.id ?? null;
  const buyerPartyType = party.type ?? null;

  return { buyerContactId, buyerOrganizationId, buyerPartyType };
}

/**
 * Maps a Party relation to legacy owner fields (contactId, organizationId, partyType).
 * Used for backward-compatible read responses for AnimalOwner.
 *
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects these fields.
 * This function derives legacy owner fields from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 *
 * @param party - Party object with contact/organization relations and type field
 * @returns Object with contactId, organizationId, and partyType
 */
export function partyToLegacyOwnerFields(party: any): {
  contactId: number | null;
  organizationId: number | null;
  partyType: string | null;
} {
  if (!party) {
    return { contactId: null, organizationId: null, partyType: null };
  }

  const contactId = party.contact?.id ?? null;
  const organizationId = party.organization?.id ?? null;
  const partyType = party.type ?? null;

  return { contactId, organizationId, partyType };
}

/**
 * Maps a Party relation to legacy stud owner contact field.
 * Used for backward-compatible read responses for BreedingAttempt studOwnerContactId.
 *
 * @deprecated Phase 2: Backend dual-write removed, but frontend still expects this field.
 * This function derives studOwnerContactId from Party for backward compatibility.
 * TODO: Remove in Phase 5 after frontend migration (see LEGACY_IDENTITY_CLEANUP_PLAN.md)
 *
 * @param party - Party object with contact relation included
 * @returns The contactId if party type is CONTACT, otherwise null
 */
export function partyToLegacyStudOwnerContactId(party: any): number | null {
  if (!party) {
    return null;
  }

  // Only return contactId if this is a contact-backed party
  if (party.type === "CONTACT" && party.contact?.id) {
    return party.contact.id;
  }

  return null;
}
