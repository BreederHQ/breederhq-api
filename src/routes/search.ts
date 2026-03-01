// src/routes/search.ts
// Platform-wide search endpoint for Command Palette (Cmd+K)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── Types ───────────────────────── */

type SearchEntityType =
  | "animal"
  | "breeding_plan"
  | "breeding_program"
  | "contact"
  | "invoice"
  | "contract"
  | "listing"
  | "tag"
  | "title"
  | "competition";

interface SearchResultItem {
  id: string | number;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  badges?: string[];
  href: string;
  thumbnail?: string;
}

interface SearchResponse {
  query: string;
  results: Partial<Record<SearchEntityType, SearchResultItem[]>>;
  total: number;
  timing_ms: number;
}

/* ───────────────────────── Helpers ───────────────────────── */

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parseLimit(v: unknown, defaultLimit = 5, maxLimit = 20): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}

function parseTypes(v: unknown): SearchEntityType[] | null {
  if (!v) return null;
  const raw = String(v).trim();
  if (!raw) return null;

  const validTypes: SearchEntityType[] = [
    "animal",
    "breeding_plan",
    "breeding_program",
    "contact",
    "invoice",
    "contract",
    "listing",
    "tag",
    "title",
    "competition",
  ];

  const requested = raw.split(",").map((t) => t.trim().toLowerCase());
  const filtered = requested.filter((t) => validTypes.includes(t as SearchEntityType));
  return filtered.length > 0 ? (filtered as SearchEntityType[]) : null;
}

/* ───────────────────────── Search Functions ───────────────────────── */

async function searchAnimals(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  // Note: species is an enum, not searchable with contains
  const rows = await prisma.animal.findMany({
    where: {
      tenantId,
      archived: false,
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { breed: { contains: query, mode: "insensitive" } },
        { microchip: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      breed: true,
      species: true,
      sex: true,
      status: true,
      photoUrl: true,
    },
  });

  return rows.map((a) => ({
    id: a.id,
    type: "animal" as const,
    title: a.name,
    subtitle: [a.species, a.breed, a.sex].filter(Boolean).join(" · "),
    badges: a.status ? [a.status] : [],
    href: `/animals/${a.id}`,
    thumbnail: a.photoUrl ?? undefined,
  }));
}

async function searchBreedingPlans(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  // Search by plan name, dam name, or sire name
  const rows = await prisma.breedingPlan.findMany({
    where: {
      tenantId,
      archived: false,
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { dam: { name: { contains: query, mode: "insensitive" } } },
        { sire: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      dam: { select: { name: true } },
      sire: { select: { name: true } },
    },
  });

  return rows.map((p) => {
    const damName = p.dam?.name ?? "Unknown";
    const sireName = p.sire?.name ?? "TBD";
    const displayName = p.name || `${damName} × ${sireName}`;
    return {
      id: p.id,
      type: "breeding_plan" as const,
      title: displayName,
      subtitle: `${damName} × ${sireName}`,
      badges: p.status ? [p.status] : [],
      href: `/breeding/plans/${p.id}`,
    };
  });
}

async function searchBreedingPrograms(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  // Note: species is an enum, not searchable with contains
  const rows = await prisma.mktListingBreedingProgram.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { breedText: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      species: true,
      breedText: true,
    },
  });

  return rows.map((bp) => ({
    id: bp.id,
    type: "breeding_program" as const,
    title: bp.name,
    subtitle: [bp.species, bp.breedText].filter(Boolean).join(" · "),
    href: `/breeding/programs/${bp.id}`,
  }));
}

async function searchContacts(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  const rows = await prisma.contact.findMany({
    where: {
      tenantId,
      archived: false,
      deletedAt: null,
      OR: [
        { display_name: { contains: query, mode: "insensitive" } },
        { first_name: { contains: query, mode: "insensitive" } },
        { last_name: { contains: query, mode: "insensitive" } },
        { nickname: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phoneE164: { contains: query } },
      ],
    },
    take: limit,
    orderBy: { display_name: "asc" },
    select: {
      id: true,
      display_name: true,
      email: true,
      phoneE164: true,
    },
  });

  return rows.map((c) => ({
    id: c.id,
    type: "contact" as const,
    title: c.display_name || "Unnamed Contact",
    subtitle: c.email || c.phoneE164 || undefined,
    href: `/contacts/${c.id}`,
  }));
}

async function searchInvoices(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        { invoiceNumber: { contains: query, mode: "insensitive" } },
        { number: { contains: query, mode: "insensitive" } },
        { clientParty: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      number: true,
      status: true,
      amountCents: true,
      clientParty: { select: { name: true } },
    },
  });

  return rows.map((inv) => ({
    id: inv.id,
    type: "invoice" as const,
    title: inv.invoiceNumber || inv.number || `Invoice #${inv.id}`,
    subtitle: inv.clientParty?.name || undefined,
    badges: inv.status ? [inv.status] : [],
    href: `/finance/invoices/${inv.id}`,
  }));
}

async function searchContracts(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  const rows = await prisma.contract.findMany({
    where: {
      tenantId,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { parties: { some: { party: { name: { contains: query, mode: "insensitive" } } } } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      parties: {
        take: 1,
        select: { party: { select: { name: true } } },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    type: "contract" as const,
    title: c.title || `Contract #${c.id}`,
    subtitle: c.parties[0]?.party?.name || undefined,
    badges: c.status ? [c.status] : [],
    href: `/contracts/${c.id}`,
  }));
}

async function searchListings(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  // Search MktListingIndividualAnimal (stud services, guardian, rehome, etc.)
  const rows = await prisma.mktListingIndividualAnimal.findMany({
    where: {
      tenantId,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { headline: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
        { animal: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      headline: true,
      templateType: true,
      status: true,
      animal: { select: { id: true, name: true, photoUrl: true } },
    },
  });

  return rows.map((l) => ({
    id: l.id,
    type: "listing" as const,
    title: l.title || l.animal?.name || "Untitled Listing",
    subtitle: l.headline || l.templateType || undefined,
    badges: l.status ? [l.status] : [],
    href: `/marketplace/listings/${l.slug}`,
    thumbnail: l.animal?.photoUrl ?? undefined,
  }));
}

// Map TagModule to a readable module name and URL path
const TAG_MODULE_INFO: Record<string, { label: string; path: string }> = {
  CONTACT: { label: "Contacts", path: "/contacts" },
  ORGANIZATION: { label: "Organizations", path: "/contacts" },
  ANIMAL: { label: "Animals", path: "/animals" },
  WAITLIST_ENTRY: { label: "Waitlist", path: "/waitlist" },
  OFFSPRING_GROUP: { label: "Offspring", path: "/offspring" }, // Legacy DB enum value (TagModule) — kept for backward compatibility with persisted tags
  OFFSPRING: { label: "Offspring", path: "/offspring" },
  MESSAGE_THREAD: { label: "Messages", path: "/marketing/messages" },
  DRAFT: { label: "Drafts", path: "/marketing/messages" },
  BREEDING_PLAN: { label: "Breeding Plans", path: "/breeding/plans" },
};

async function searchTags(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  const rows = await prisma.tag.findMany({
    where: {
      tenantId,
      isArchived: false,
      name: { contains: query, mode: "insensitive" },
    },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      module: true,
      color: true,
      _count: { select: { assignments: true } },
    },
  });

  return rows.map((t) => {
    const moduleInfo = TAG_MODULE_INFO[t.module] || { label: t.module, path: "/settings/tags" };
    return {
      id: t.id,
      type: "tag" as const,
      title: t.name,
      subtitle: `${moduleInfo.label} · ${t._count.assignments} items`,
      badges: [],
      href: `${moduleInfo.path}?tag=${encodeURIComponent(t.name)}`,
    };
  });
}

async function searchTitles(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  // Search AnimalTitle (titles earned by animals)
  const rows = await prisma.animalTitle.findMany({
    where: {
      tenantId,
      OR: [
        { titleDefinition: { fullName: { contains: query, mode: "insensitive" } } },
        { titleDefinition: { abbreviation: { contains: query, mode: "insensitive" } } },
        { animal: { name: { contains: query, mode: "insensitive" } } },
        { eventName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { dateEarned: "desc" },
    select: {
      id: true,
      dateEarned: true,
      eventName: true,
      status: true,
      animal: { select: { id: true, name: true, photoUrl: true } },
      titleDefinition: { select: { abbreviation: true, fullName: true, category: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    type: "title" as const,
    title: `${t.titleDefinition.abbreviation} - ${t.animal.name}`,
    subtitle: [
      t.titleDefinition.fullName,
      t.eventName,
      t.dateEarned ? new Date(t.dateEarned).getFullYear().toString() : null,
    ]
      .filter(Boolean)
      .join(" · "),
    badges: [t.titleDefinition.category, t.status].filter(Boolean) as string[],
    href: `/animals/${t.animal.id}/titles`,
    thumbnail: t.animal.photoUrl ?? undefined,
  }));
}

async function searchCompetitions(
  tenantId: number,
  query: string,
  limit: number
): Promise<SearchResultItem[]> {
  const rows = await prisma.competitionEntry.findMany({
    where: {
      tenantId,
      OR: [
        { eventName: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
        { className: { contains: query, mode: "insensitive" } },
        { placementLabel: { contains: query, mode: "insensitive" } },
        { animal: { name: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: limit,
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      location: true,
      placement: true,
      placementLabel: true,
      competitionType: true,
      animal: { select: { id: true, name: true, photoUrl: true } },
    },
  });

  return rows.map((c) => {
    const placementText = c.placementLabel || (c.placement ? `#${c.placement}` : null);
    return {
      id: c.id,
      type: "competition" as const,
      title: `${c.eventName} - ${c.animal.name}`,
      subtitle: [
        placementText,
        c.location,
        c.eventDate ? new Date(c.eventDate).getFullYear().toString() : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badges: [c.competitionType, placementText].filter(Boolean) as string[],
      href: `/animals/${c.animal.id}/competitions`,
      thumbnail: c.animal.photoUrl ?? undefined,
    };
  });
}

/* ───────────────────────── Route ───────────────────────── */

const searchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /search/directory
   *
   * Unified directory search for contacts, organizations, and animals.
   * Used by offspring module for buyer selection and parent pickers.
   *
   * Body:
   * - q: search query (required, min 2 characters)
   * - types: array of types to search ["contact", "organization", "animal"] (optional, defaults to all)
   * - limit: max results per type (optional, default 20, max 50)
   *
   * Returns:
   * {
   *   contacts: Contact[],
   *   organizations: Organization[],
   *   animals: Animal[]
   * }
   */
  app.post("/search/directory", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = (req.body as any) ?? {};
      const q = trimToNull(body.q);

      if (!q || q.length < 2) {
        return reply.code(400).send({
          error: "query_too_short",
          message: "Search query must be at least 2 characters",
        });
      }

      const requestedTypes = body.types ?? ["contact", "organization", "animal"];
      const limit = Math.min(50, Math.max(1, Number(body.limit ?? 20)));

      const results: {
        contacts?: any[];
        organizations?: any[];
        animals?: any[];
      } = {};

      // Search contacts
      if (requestedTypes.includes("contact")) {
        const contacts = await prisma.contact.findMany({
          where: {
            tenantId,
            archived: false,
            deletedAt: null,
            OR: [
              { display_name: { contains: q, mode: "insensitive" } },
              { first_name: { contains: q, mode: "insensitive" } },
              { last_name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          orderBy: { display_name: "asc" },
          select: {
            id: true,
            display_name: true,
            first_name: true,
            last_name: true,
            email: true,
            phoneE164: true,
          },
        });
        results.contacts = contacts;
      }

      // Search organizations
      if (requestedTypes.includes("organization")) {
        const organizations = await prisma.organization.findMany({
          where: {
            tenantId,
            archived: false,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        });
        results.organizations = organizations;
      }

      // Search animals
      if (requestedTypes.includes("animal")) {
        const animals = await prisma.animal.findMany({
          where: {
            tenantId,
            archived: false,
            deletedAt: null,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { breed: { contains: q, mode: "insensitive" } },
              { microchip: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            breed: true,
            species: true,
            sex: true,
            photoUrl: true,
          },
        });
        results.animals = animals;
      }

      return reply.send(results);
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "search_unavailable" });
    }
  });

  /**
   * GET /search
   *
   * Platform-wide search across all entity types.
   *
   * Query params:
   * - q: search query (required, min 2 characters)
   * - types: comma-separated entity types to search (optional, defaults to all)
   * - limit: max results per type (optional, default 5, max 20)
   *
   * Returns grouped results by entity type.
   */
  app.get("/search", async (req, reply) => {
    const start = Date.now();

    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const queryParams = (req.query as any) ?? {};
      const q = trimToNull(queryParams.q);

      if (!q || q.length < 2) {
        return reply.code(400).send({
          error: "query_too_short",
          message: "Search query must be at least 2 characters",
        });
      }

      const types = parseTypes(queryParams.types);
      const limit = parseLimit(queryParams.limit);

      // Determine which entity types to search
      const allTypes: SearchEntityType[] = [
        "animal",
        "breeding_plan",
        "breeding_program",
        "contact",
        "invoice",
        "contract",
        "listing",
        "tag",
        "title",
        "competition",
      ];
      const typesToSearch = types ?? allTypes;

      // Execute searches in parallel
      const searchPromises: Array<Promise<{ type: SearchEntityType; items: SearchResultItem[] }>> =
        [];

      if (typesToSearch.includes("animal")) {
        searchPromises.push(
          searchAnimals(tenantId, q, limit).then((items) => ({ type: "animal" as const, items }))
        );
      }
      if (typesToSearch.includes("breeding_plan")) {
        searchPromises.push(
          searchBreedingPlans(tenantId, q, limit).then((items) => ({
            type: "breeding_plan" as const,
            items,
          }))
        );
      }
      if (typesToSearch.includes("breeding_program")) {
        searchPromises.push(
          searchBreedingPrograms(tenantId, q, limit).then((items) => ({
            type: "breeding_program" as const,
            items,
          }))
        );
      }
      if (typesToSearch.includes("contact")) {
        searchPromises.push(
          searchContacts(tenantId, q, limit).then((items) => ({ type: "contact" as const, items }))
        );
      }
      if (typesToSearch.includes("invoice")) {
        searchPromises.push(
          searchInvoices(tenantId, q, limit).then((items) => ({ type: "invoice" as const, items }))
        );
      }
      if (typesToSearch.includes("contract")) {
        searchPromises.push(
          searchContracts(tenantId, q, limit).then((items) => ({ type: "contract" as const, items }))
        );
      }
      if (typesToSearch.includes("listing")) {
        searchPromises.push(
          searchListings(tenantId, q, limit).then((items) => ({ type: "listing" as const, items }))
        );
      }
      if (typesToSearch.includes("tag")) {
        searchPromises.push(
          searchTags(tenantId, q, limit).then((items) => ({ type: "tag" as const, items }))
        );
      }
      if (typesToSearch.includes("title")) {
        searchPromises.push(
          searchTitles(tenantId, q, limit).then((items) => ({ type: "title" as const, items }))
        );
      }
      if (typesToSearch.includes("competition")) {
        searchPromises.push(
          searchCompetitions(tenantId, q, limit).then((items) => ({
            type: "competition" as const,
            items,
          }))
        );
      }

      const searchResults = await Promise.all(searchPromises);

      // Assemble response
      const results: Partial<Record<SearchEntityType, SearchResultItem[]>> = {};
      let total = 0;

      for (const { type, items } of searchResults) {
        if (items.length > 0) {
          results[type] = items;
          total += items.length;
        }
      }

      const response: SearchResponse = {
        query: q,
        results,
        total,
        timing_ms: Date.now() - start,
      };

      return reply.send(response);
    } catch (err) {
      req.log?.error?.(err as any);
      return reply.code(500).send({ error: "search_unavailable" });
    }
  });
};

export default searchRoutes;
