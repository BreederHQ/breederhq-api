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
