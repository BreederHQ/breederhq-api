import type { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import { toPartyRead } from "./party-mapper.js";
import type { PartyRead, PartyStatus, PartyType } from "../types/party.js";

export type PartySortKey = "displayName" | "updatedAt" | "createdAt";
export type PartySortDir = "asc" | "desc";

export type PartyListParams = {
  tenantId: number;
  q?: string | null;
  page: number;
  limit: number;
  sort: PartySortKey;
  dir: PartySortDir;
  type?: PartyType;
  status?: PartyStatus;
  logger?: { warn?: (obj: Record<string, unknown>, msg?: string) => void };
};

const TAG_ASSIGNMENT_SELECT = {
  select: {
    tag: { select: { name: true } },
  },
  orderBy: { tag: { name: "asc" } },
} as const;

const CONTACT_SELECT = {
  select: {
    id: true,
    display_name: true,
    first_name: true,
    last_name: true,
    nickname: true,
    email: true,
    phoneE164: true,
    whatsappE164: true,
    street: true,
    street2: true,
    city: true,
    state: true,
    zip: true,
    country: true,
    archived: true,
    createdAt: true,
    updatedAt: true,
    organization: {
      select: {
        id: true,
        partyId: true,
        name: true,
        archived: true,
        party: { select: { name: true, archived: true } },
      },
    },
    // Note: tagAssignments is on Party, not Contact
  },
} as const;

const ORGANIZATION_SELECT = {
  select: {
    id: true,
    name: true,
    email: true,
    phone: true,
    street: true,
    street2: true,
    city: true,
    state: true,
    zip: true,
    country: true,
    archived: true,
    createdAt: true,
    updatedAt: true,
    partyId: true,
  },
} as const;

const PARTY_SELECT = {
  select: {
    id: true,
    tenantId: true,
    type: true,
    name: true,
    email: true,
    phoneE164: true,
    whatsappE164: true,
    street: true,
    street2: true,
    city: true,
    state: true,
    postalCode: true,
    country: true,
    archived: true,
    createdAt: true,
    updatedAt: true,
    contact: CONTACT_SELECT,
    organization: ORGANIZATION_SELECT,
    tagAssignments: TAG_ASSIGNMENT_SELECT,
  },
} as const;

const TIE_BREAKER: Prisma.PartyOrderByWithRelationInput = { id: "asc" };

function buildOrderBy(sort: PartySortKey, dir: PartySortDir): Prisma.PartyOrderByWithRelationInput[] {
  const sortDir = dir as Prisma.SortOrder;
  switch (sort) {
    case "createdAt":
      return [{ createdAt: sortDir }, TIE_BREAKER];
    case "updatedAt":
      return [{ updatedAt: sortDir }, TIE_BREAKER];
    case "displayName":
    default:
      return [{ name: sortDir }, TIE_BREAKER];
  }
}

function mapPartyTypeToDb(type?: PartyType) {
  if (type === "PERSON") return "CONTACT";
  if (type === "ORGANIZATION") return "ORGANIZATION";
  return undefined;
}

function buildSearchOr(search: string) {
  // For optional relations, use direct nested query without 'is' wrapper
  // This correctly handles null relations (no match when relation doesn't exist)
  return [
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
    { phoneE164: { contains: search, mode: "insensitive" } },
    { whatsappE164: { contains: search, mode: "insensitive" } },
    { contact: { display_name: { contains: search, mode: "insensitive" } } },
    { contact: { first_name: { contains: search, mode: "insensitive" } } },
    { contact: { last_name: { contains: search, mode: "insensitive" } } },
    { contact: { nickname: { contains: search, mode: "insensitive" } } },
    { contact: { email: { contains: search, mode: "insensitive" } } },
    { contact: { phoneE164: { contains: search, mode: "insensitive" } } },
    { contact: { whatsappE164: { contains: search, mode: "insensitive" } } },
    { organization: { name: { contains: search, mode: "insensitive" } } },
    { organization: { email: { contains: search, mode: "insensitive" } } },
    { organization: { phone: { contains: search, mode: "insensitive" } } },
  ];
}

function buildWhere(params: PartyListParams) {
  const where: Record<string, unknown> = { tenantId: params.tenantId };
  const and: any[] = [];

  const dbType = mapPartyTypeToDb(params.type);
  if (dbType) and.push({ type: dbType });

  if (params.status === "ARCHIVED") {
    and.push({ archived: true });
  } else if (params.status === "ACTIVE") {
    and.push({ archived: false });
    // Exclude parties with archived backing records (direct nested query for optional relations)
    and.push({
      NOT: {
        OR: [
          { contact: { archived: true } },
          { organization: { archived: true } },
        ],
      },
    });
  } else if (params.status === "INACTIVE") {
    and.push({ archived: false });
    // Include parties with archived backing records
    and.push({
      OR: [
        { contact: { archived: true } },
        { organization: { archived: true } },
      ],
    });
  }

  const search = String(params.q || "").trim();
  if (search) {
    and.push({ OR: buildSearchOr(search) });
  }

  if (and.length) where.AND = and;
  return where;
}

export const PartyService = {
  async list(params: PartyListParams): Promise<{ items: PartyRead[]; total: number; page: number; limit: number }> {
    const where = buildWhere(params);
    const orderBy = buildOrderBy(params.sort, params.dir);
    const skip = (params.page - 1) * params.limit;

    // Get tenant's default owner party to potentially feature it prominently
    let tenantDefaultParty: PartyRead | null = null;
    const search = String(params.q || "").trim().toLowerCase();

    // Only fetch and feature default party on page 1 when searching
    if (params.page === 1 && params.type !== "PERSON") {  // Only for org searches or unfiltered
      try {
        // Try to get the first organization's party for this tenant
        const org = await prisma.organization.findFirst({
          where: { tenantId: params.tenantId, archived: false },
          orderBy: { id: "asc" },
          select: { partyId: true },
        });

        if (org) {
          const defaultParty = await prisma.party.findUnique({
            where: { id: org.partyId },
            ...PARTY_SELECT,
          });
          if (defaultParty) {
            tenantDefaultParty = toPartyRead(defaultParty, params.logger);
            // Only include if it matches the search (if any)
            if (search) {
              const matchesSearch =
                tenantDefaultParty.displayName.toLowerCase().includes(search) ||
                (tenantDefaultParty.backing.organizationId != null);
              if (!matchesSearch) {
                tenantDefaultParty = null;
              }
            }
          }
        }
      } catch (err) {
        params.logger?.warn?.({ err }, "Failed to fetch tenant default party");
      }
    }

    const [rows, total] = await prisma.$transaction([
      prisma.party.findMany({
        where,
        skip,
        take: params.limit,
        orderBy,
        ...PARTY_SELECT,
      }),
      prisma.party.count({ where }),
    ]);

    let items = rows.map((row) => toPartyRead(row, params.logger));

    // Prepend tenant default party if found and not already in results
    if (tenantDefaultParty) {
      const alreadyIncluded = items.some(item => item.partyId === tenantDefaultParty.partyId);
      if (!alreadyIncluded) {
        items = [tenantDefaultParty, ...items.slice(0, params.limit - 1)];
      }
    }

    return { items, total, page: params.page, limit: params.limit };
  },

  async getById(tenantId: number, partyId: number, logger?: PartyListParams["logger"]): Promise<PartyRead | null> {
    const row = await prisma.party.findFirst({
      where: { id: partyId, tenantId },
      ...PARTY_SELECT,
    });
    if (!row) return null;
    return toPartyRead(row, logger);
  },
};
