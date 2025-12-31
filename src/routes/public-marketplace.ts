// src/routes/public-marketplace.ts
// Marketplace endpoints - authentication required via surface gate
//
// Access control:
// - MARKETPLACE surface: requires session + MARKETPLACE_ACCESS entitlement → PUBLIC context
// - PLATFORM surface: requires session + STAFF membership → STAFF context (marketplace as module)
// - PORTAL surface: no access (rejected by surface gate)
//
// All endpoints resolve tenant from program slug, not headers/session

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  resolveTenantFromProgramSlug,
  resolveOffspringGroupListing,
  resolveAnimalListing,
  isValidSlug,
  normalizeSlug,
} from "../utils/public-tenant-resolver.js";
import {
  toPublicProgramDTO,
  toPublicOffspringGroupListingDTO,
  toPublicOffspringDTO,
  toPublicAnimalListingDTO,
  toOffspringGroupSummaryDTO,
  toAnimalListingSummaryDTO,
  type PublicListingSummaryDTO,
} from "../utils/public-dto.js";

// ============================================================================
// Helper: parse pagination
// ============================================================================
function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(q?.limit ?? 20) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ============================================================================
// Routes
// ============================================================================

const publicMarketplaceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --------------------------------------------------------------------------
  // GET /programs/:programSlug - Public program profile
  // --------------------------------------------------------------------------
  app.get<{ Params: { programSlug: string } }>(
    "/programs/:programSlug",
    async (req, reply) => {
      const { programSlug } = req.params;

      if (!isValidSlug(programSlug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      const org = await prisma.organization.findUnique({
        where: { id: resolved.organizationId },
        select: {
          programSlug: true,
          name: true,
          programBio: true,
          publicContactEmail: true,
          website: true,
        },
      });

      if (!org) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send(toPublicProgramDTO(org));
    }
  );

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/offspring-groups - List published offspring groups
  // --------------------------------------------------------------------------
  app.get<{
    Params: { programSlug: string };
    Querystring: { species?: string; page?: string; limit?: string };
  }>("/programs/:programSlug/offspring-groups", async (req, reply) => {
    const { programSlug } = req.params;
    const { species } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Get organization for programName
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true, programSlug: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Build where clause
    const where: any = {
      tenantId: resolved.tenantId,
      published: true,
      listingSlug: { not: null },
    };

    if (species) {
      where.species = species.toUpperCase();
    }

    const [groups, total] = await Promise.all([
      prisma.offspringGroup.findMany({
        where,
        skip,
        take: limit,
        orderBy: { actualBirthOn: "desc" },
        select: {
          listingSlug: true,
          listingTitle: true,
          listingDescription: true,
          species: true,
          expectedBirthOn: true,
          actualBirthOn: true,
          coverImageUrl: true,
          dam: {
            select: { name: true, photoUrl: true, breed: true },
          },
          sire: {
            select: { name: true, photoUrl: true, breed: true },
          },
          Offspring: {
            select: { priceCents: true, keeperIntent: true, placementState: true },
          },
        },
      }),
      prisma.offspringGroup.count({ where }),
    ]);

    const items = groups.map((g) =>
      toPublicOffspringGroupListingDTO(g, org.programSlug || "", org.name)
    );

    return reply.send({ items, total, page, limit });
  });

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/offspring-groups/:listingSlug - Single listing detail
  // --------------------------------------------------------------------------
  app.get<{ Params: { programSlug: string; listingSlug: string } }>(
    "/programs/:programSlug/offspring-groups/:listingSlug",
    async (req, reply) => {
      const { programSlug, listingSlug } = req.params;

      if (!isValidSlug(programSlug) || !isValidSlug(listingSlug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listingResolved = await resolveOffspringGroupListing(
        prisma,
        resolved.tenantId,
        listingSlug
      );
      if (!listingResolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Get organization for programName
      const org = await prisma.organization.findUnique({
        where: { id: resolved.organizationId },
        select: { name: true, programSlug: true },
      });

      if (!org) {
        return reply.code(404).send({ error: "not_found" });
      }

      const group = await prisma.offspringGroup.findUnique({
        where: { id: listingResolved.groupId },
        select: {
          listingSlug: true,
          listingTitle: true,
          listingDescription: true,
          species: true,
          expectedBirthOn: true,
          actualBirthOn: true,
          coverImageUrl: true,
          dam: {
            select: { name: true, photoUrl: true, breed: true },
          },
          sire: {
            select: { name: true, photoUrl: true, breed: true },
          },
          Offspring: {
            where: {
              // Only include offspring that could be shown publicly
              lifeState: "ALIVE",
            },
            select: {
              id: true,
              name: true,
              sex: true,
              collarColorName: true,
              collarColorHex: true,
              priceCents: true,
              keeperIntent: true,
              placementState: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });

      if (!group) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listing = toPublicOffspringGroupListingDTO(
        group,
        org.programSlug || "",
        org.name
      );
      const offspring = (group.Offspring || []).map(toPublicOffspringDTO);

      return reply.send({ ...listing, offspring });
    }
  );

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/animals - List animal listings
  // --------------------------------------------------------------------------
  app.get<{
    Params: { programSlug: string };
    Querystring: { species?: string; page?: string; limit?: string };
  }>("/programs/:programSlug/animals", async (req, reply) => {
    const { programSlug } = req.params;
    const { species } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Get organization for programName
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true, programSlug: true },
    });

    if (!org) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Build where clause for animal listings
    const where: any = {
      tenantId: resolved.tenantId,
      isListed: true,
      urlSlug: { not: null },
    };

    if (species) {
      where.animal = { species: species.toUpperCase() };
    }

    const [listings, total] = await Promise.all([
      prisma.animalPublicListing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          urlSlug: true,
          title: true,
          animal: {
            select: {
              species: true,
              breed: true,
              photoUrl: true,
              priceCents: true,
            },
          },
        },
      }),
      prisma.animalPublicListing.count({ where }),
    ]);

    const items = listings.map(toAnimalListingSummaryDTO);

    return reply.send({ items, total, page, limit });
  });

  // --------------------------------------------------------------------------
  // GET /programs/:programSlug/animals/:urlSlug - Single animal listing detail
  // --------------------------------------------------------------------------
  app.get<{ Params: { programSlug: string; urlSlug: string } }>(
    "/programs/:programSlug/animals/:urlSlug",
    async (req, reply) => {
      const { programSlug, urlSlug } = req.params;

      if (!isValidSlug(programSlug) || !isValidSlug(urlSlug)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
      if (!resolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listingResolved = await resolveAnimalListing(
        prisma,
        resolved.tenantId,
        urlSlug
      );
      if (!listingResolved) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Get organization for programName
      const org = await prisma.organization.findUnique({
        where: { id: resolved.organizationId },
        select: { name: true, programSlug: true },
      });

      if (!org) {
        return reply.code(404).send({ error: "not_found" });
      }

      const listing = await prisma.animalPublicListing.findUnique({
        where: { id: listingResolved.listingId },
        select: {
          urlSlug: true,
          title: true,
          description: true,
          animal: {
            select: {
              name: true,
              species: true,
              sex: true,
              breed: true,
              birthDate: true,
              photoUrl: true,
              priceCents: true,
              registryIds: {
                select: {
                  identifier: true,
                  registry: {
                    select: { name: true },
                  },
                },
              },
              AnimalTraitValue: {
                where: { marketplaceVisible: true },
                select: {
                  marketplaceVisible: true,
                  status: true,
                  verified: true,
                  traitDefinition: {
                    select: {
                      key: true,
                      displayName: true,
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send(
        toPublicAnimalListingDTO(listing, org.programSlug || "", org.name)
      );
    }
  );

  // --------------------------------------------------------------------------
  // POST /inquiries - Create marketplace inquiry
  // --------------------------------------------------------------------------
  app.post<{
    Body: {
      programSlug: string;
      listingSlug?: string;
      listingType?: "offspring_group" | "animal";
      message: string;
      offspringId?: number;
      // Guest fields - not implemented for MVP (auth required)
      guestName?: string;
      guestEmail?: string;
    };
  }>("/inquiries", async (req, reply) => {
    const { programSlug, listingSlug, listingType, message, offspringId } = req.body;

    // Validate required fields
    if (!programSlug || !message) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["programSlug", "message"],
      });
    }

    if (!isValidSlug(programSlug)) {
      return reply.code(404).send({ error: "program_not_found" });
    }

    // Resolve program
    const resolved = await resolveTenantFromProgramSlug(prisma, programSlug);
    if (!resolved) {
      return reply.code(404).send({ error: "program_not_found" });
    }

    // For MVP: require authentication (no guest inquiries without rate limiting)
    const userId = (req as any).userId;
    if (!userId) {
      return reply.code(401).send({
        error: "authentication_required",
        detail: "Guest inquiries are not supported in this version",
      });
    }

    // Get sender's party
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { partyId: true },
    });

    if (!user?.partyId) {
      return reply.code(400).send({ error: "user_has_no_party" });
    }

    // Validate listing if provided
    if (listingSlug) {
      if (!isValidSlug(listingSlug)) {
        return reply.code(404).send({ error: "listing_not_found" });
      }

      if (listingType === "offspring_group") {
        const listingResolved = await resolveOffspringGroupListing(
          prisma,
          resolved.tenantId,
          listingSlug
        );
        if (!listingResolved) {
          return reply.code(404).send({ error: "listing_not_found" });
        }
      } else if (listingType === "animal") {
        const listingResolved = await resolveAnimalListing(
          prisma,
          resolved.tenantId,
          listingSlug
        );
        if (!listingResolved) {
          return reply.code(404).send({ error: "listing_not_found" });
        }
      }
    }

    // Get organization for subject line
    const org = await prisma.organization.findUnique({
      where: { id: resolved.organizationId },
      select: { name: true },
    });

    // Build subject
    const subject = listingSlug
      ? `Inquiry: Listing ${listingSlug}`
      : `Inquiry: ${org?.name || "Program"}`;

    const now = new Date();

    try {
      const thread = await prisma.messageThread.create({
        data: {
          tenantId: resolved.tenantId,
          subject,
          inquiryType: "MARKETPLACE",
          sourceListingSlug: listingSlug || null,
          lastMessageAt: now,
          participants: {
            create: [
              { partyId: user.partyId, lastReadAt: now },
              { partyId: resolved.partyId },
            ],
          },
          messages: {
            create: {
              senderPartyId: user.partyId,
              body: message,
            },
          },
        },
        select: { id: true },
      });

      return reply.send({ ok: true, threadId: thread.id });
    } catch (err: any) {
      return reply.code(500).send({ error: "internal_error", detail: err.message });
    }
  });
};

export default publicMarketplaceRoutes;
