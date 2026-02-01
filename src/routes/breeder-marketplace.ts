// src/routes/breeder-marketplace.ts
/**
 * Breeder Marketplace Management Endpoints
 *
 * Tenant-scoped endpoints for breeders to manage their marketplace listings.
 * These endpoints are used by the embedded marketplace portal within the platform.
 *
 * All endpoints require tenant context via X-Tenant-Id header.
 *
 * Endpoints:
 *   GET  /animal-listings              - List breeder's animal listings
 *   GET  /animal-listings/:id          - Get single animal listing
 *   GET  /animals/:animalId/public-listing  - Get listing for a specific animal
 *   GET  /marketplace/listings/:id/stats    - Get statistics for a listing
 *   GET  /offspring-groups             - List breeder's offspring groups
 *   GET  /offspring-groups/:id         - Get single offspring group
 *   GET  /inquiries                    - List inquiries received by breeder
 *   GET  /inquiries/:id                - Get single inquiry
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import prisma from "../prisma.js";

// ============================================================================
// Helpers
// ============================================================================

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number(req.tenantId);
  if (!tenantId) {
    reply.code(401).send({ error: "unauthorized", message: "Tenant context required" });
    return null;
  }
  return tenantId;
}

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ============================================================================
// Routes
// ============================================================================

export default async function breederMarketplaceRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /* ─────────────────────── Animal Listings ─────────────────────── */

  /**
   * GET /animal-listings - List breeder's animal listings
   *
   * Query params:
   *   - status: Filter by status (DRAFT, LIVE, PAUSED)
   *   - intent: Filter by intent (STUD, BROOD_PLACEMENT, REHOME, etc.)
   *   - programId: Filter by breeding program ID
   *   - page, limit: Pagination
   */
  app.get<{
    Querystring: {
      status?: string;
      intent?: string;
      programId?: string;
      page?: string;
      limit?: string;
    };
  }>("/animal-listings", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { status, intent, programId } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    // Build where clause
    const where: any = {
      tenantId,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (intent) {
      // Map intent to templateType field
      // Frontend uses "STUD" but schema uses "STUD_SERVICES"
      const intentMapping: Record<string, string> = {
        "STUD": "STUD_SERVICES",
        "STUD_SERVICES": "STUD_SERVICES",
        "GUARDIAN": "GUARDIAN",
        "TRAINED": "TRAINED",
        "REHOME": "REHOME",
        "BROOD_PLACEMENT": "REHOME", // alias
        "CO_OWNERSHIP": "CO_OWNERSHIP",
        "CUSTOM": "CUSTOM",
      };
      const upperIntent = intent.toUpperCase();
      where.templateType = intentMapping[upperIntent] || upperIntent;
    }

    // Filter by breeding program if specified
    if (programId) {
      const progId = parseInt(programId, 10);
      if (!isNaN(progId)) {
        where.animal = {
          breedingProgramId: progId,
        };
      }
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.mktListingIndividualAnimal.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            animal: true,
          },
        }),
        prisma.mktListingIndividualAnimal.count({ where }),
      ]);

      // Transform listings to response format
      const items = listings.map((listing: any) => ({
        id: listing.id,
        animalId: listing.animalId,
        urlSlug: listing.urlSlug,
        intent: listing.intent,
        status: listing.status,
        headline: listing.headline,
        title: listing.title,
        summary: listing.summary,
        priceCents: listing.priceCents,
        priceMinCents: listing.priceMinCents,
        priceMaxCents: listing.priceMaxCents,
        priceText: listing.priceText,
        priceModel: listing.priceModel,
        locationCity: listing.locationCity,
        locationRegion: listing.locationRegion,
        publishedAt: listing.publishedAt?.toISOString() ?? null,
        pausedAt: listing.pausedAt?.toISOString() ?? null,
        createdAt: listing.createdAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString(),
        animal: listing.animal
          ? {
              id: listing.animal.id,
              name: listing.animal.name,
              species: listing.animal.species,
              sex: listing.animal.sex,
              birthDate: listing.animal.birthDate?.toISOString() ?? null,
              photoUrl: listing.animal.photoUrl,
              breed: listing.animal.breed,
            }
          : null,
      }));

      return reply.send({
        items,
        total,
        page,
        limit,
        hasMore: skip + items.length < total,
      });
    } catch (err: any) {
      req.log?.error?.({ err, tenantId }, "Failed to list animal listings");
      return reply.code(500).send({
        error: "list_failed",
        message: "Failed to list animal listings. Please try again.",
      });
    }
  });

  /**
   * GET /animal-listings/:id - Get single animal listing
   */
  app.get<{
    Params: { id: string };
  }>("/animal-listings/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      const listing: any = await prisma.mktListingIndividualAnimal.findFirst({
        where: {
          id,
          tenantId,
        },
        include: {
          animal: true,
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send({
        id: listing.id,
        animalId: listing.animalId,
        urlSlug: listing.urlSlug,
        intent: listing.intent,
        status: listing.status,
        headline: listing.headline,
        title: listing.title,
        summary: listing.summary,
        description: listing.description,
        priceCents: listing.priceCents,
        priceMinCents: listing.priceMinCents,
        priceMaxCents: listing.priceMaxCents,
        priceText: listing.priceText,
        priceModel: listing.priceModel,
        locationCity: listing.locationCity,
        locationRegion: listing.locationRegion,
        locationCountry: listing.locationCountry,
        detailsJson: listing.detailsJson,
        publishedAt: listing.publishedAt?.toISOString() ?? null,
        pausedAt: listing.pausedAt?.toISOString() ?? null,
        createdAt: listing.createdAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString(),
        animal: listing.animal
          ? {
              id: listing.animal.id,
              name: listing.animal.name,
              species: listing.animal.species,
              sex: listing.animal.sex,
              birthDate: listing.animal.birthDate?.toISOString() ?? null,
              photoUrl: listing.animal.photoUrl,
              breed: listing.animal.breed,
            }
          : null,
      });
    } catch (err: any) {
      req.log?.error?.({ err, id }, "Failed to get animal listing");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get animal listing. Please try again.",
      });
    }
  });

  /**
   * GET /animals/:animalId/public-listing - Get listing for a specific animal
   * Returns the individual animal listing for this animal, or 404 if none exists
   */
  app.get<{
    Params: { animalId: string };
  }>("/animals/:animalId/public-listing", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt(req.params.animalId, 10);
    if (isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      const listing: any = await prisma.mktListingIndividualAnimal.findFirst({
        where: {
          animalId,
          tenantId,
        },
        include: {
          animal: true,
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send({
        id: listing.id,
        animalId: listing.animalId,
        slug: listing.slug,
        templateType: listing.templateType,
        status: listing.status,
        headline: listing.headline,
        title: listing.title,
        summary: listing.summary,
        description: listing.description,
        priceCents: listing.priceCents,
        priceMinCents: listing.priceMinCents,
        priceMaxCents: listing.priceMaxCents,
        priceModel: listing.priceModel,
        locationCity: listing.locationCity,
        locationRegion: listing.locationRegion,
        locationCountry: listing.locationCountry,
        publishedAt: listing.publishedAt?.toISOString() ?? null,
        pausedAt: listing.pausedAt?.toISOString() ?? null,
        createdAt: listing.createdAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString(),
        viewCount: listing.viewCount ?? 0,
        inquiryCount: listing.inquiryCount ?? 0,
        animal: listing.animal
          ? {
              id: listing.animal.id,
              name: listing.animal.name,
              species: listing.animal.species,
              sex: listing.animal.sex,
              birthDate: listing.animal.birthDate?.toISOString() ?? null,
              photoUrl: listing.animal.photoUrl,
              breed: listing.animal.breed,
            }
          : null,
      });
    } catch (err: any) {
      req.log?.error?.({ err, animalId }, "Failed to get animal listing");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get animal listing. Please try again.",
      });
    }
  });

  /**
   * GET /marketplace/listings/:id/stats - Get statistics for a listing
   * Returns view count, inquiry count, and saves count
   */
  app.get<{
    Params: { id: string };
  }>("/marketplace/listings/:id/stats", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      // Get the listing
      const listing = await prisma.mktListingIndividualAnimal.findFirst({
        where: {
          id,
          tenantId,
        },
        select: {
          viewCount: true,
          inquiryCount: true,
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Count saves for this listing
      const savesCount = await prisma.marketplaceSavedListing.count({
        where: {
          listingType: "animal",
          listingId: id,
        },
      });

      return reply.send({
        views: listing.viewCount ?? 0,
        inquiries: listing.inquiryCount ?? 0,
        saves: savesCount,
      });
    } catch (err: any) {
      req.log?.error?.({ err, id }, "Failed to get listing stats");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get listing stats. Please try again.",
      });
    }
  });

  /* ─────────────────────── Offspring Groups ─────────────────────── */

  /**
   * GET /offspring-groups - List breeder's offspring groups (litters)
   *
   * Query params:
   *   - published: Filter by published status ("true", "false")
   *   - programId: Filter by breeding program ID (via plan)
   *   - page, limit: Pagination
   */
  app.get<{
    Querystring: {
      published?: string;
      programId?: string;
      page?: string;
      limit?: string;
    };
  }>("/offspring-groups", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { published, programId } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    // Build where clause
    const where: any = {
      tenantId,
    };

    if (published === "true") {
      where.published = true;
    } else if (published === "false") {
      where.published = false;
    }

    // Filter by breeding program via plan
    if (programId) {
      const progId = parseInt(programId, 10);
      if (!isNaN(progId)) {
        where.plan = {
          breedingProgramId: progId,
        };
      }
    }

    try {
      const [groups, total] = await Promise.all([
        prisma.offspringGroup.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            sire: true,
            dam: true,
            plan: {
              include: {
                program: true,
              },
            },
            Offspring: true, // Include offspring for breeding programs dashboard
          },
        }),
        prisma.offspringGroup.count({ where }),
      ]);

      // Get animal counts for each group
      const groupIds = groups.map((g) => g.id);
      const animalCounts = groupIds.length
        ? await prisma.animal.groupBy({
            by: ["offspringGroupId"],
            where: { tenantId, offspringGroupId: { in: groupIds } },
            _count: { _all: true },
          })
        : [];

      const animalCountMap = new Map<number, number>();
      for (const r of animalCounts) {
        animalCountMap.set(Number(r.offspringGroupId), Number(r._count?._all ?? 0));
      }

      // Transform to response format
      const items = groups.map((group: any) => ({
        id: group.id,
        listingSlug: group.listingSlug,
        name: group.name,
        species: group.species,
        breedText: group.plan?.breedText ?? null,
        breedingPlanId: group.planId ?? null,
        actualBirthOn: group.actualBirthOn?.toISOString() ?? null,
        expectedBirthOn: group.expectedBirthOn?.toISOString() ?? null,
        published: group.published,
        listingTitle: group.listingTitle,
        listingDescription: group.listingDescription,
        countLive: group.countLive,
        countBorn: group.countBorn,
        totalCount: animalCountMap.get(group.id) ?? 0,
        availableCount: (group.Offspring || []).filter(
          (o: any) => o.keeperIntent === 'AVAILABLE' && o.marketplaceListed
        ).length,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        sire: group.sire ? { id: group.sire.id, name: group.sire.name } : null,
        dam: group.dam ? { id: group.dam.id, name: group.dam.name } : null,
        breedingProgram: group.plan?.program
          ? { id: group.plan.program.id, name: group.plan.program.name }
          : null,
        offspring: group.Offspring ?? [], // Include offspring for breeding programs dashboard
      }));

      return reply.send({
        items,
        total,
        page,
        limit,
        hasMore: skip + items.length < total,
      });
    } catch (err: any) {
      req.log?.error?.({ err, tenantId }, "Failed to list offspring groups");
      return reply.code(500).send({
        error: "list_failed",
        message: "Failed to list offspring groups. Please try again.",
      });
    }
  });

  /**
   * GET /offspring-groups/:id - Get single offspring group
   */
  app.get<{
    Params: { id: string };
  }>("/offspring-groups/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      const group: any = await prisma.offspringGroup.findFirst({
        where: {
          id,
          tenantId,
        },
        include: {
          sire: true,
          dam: true,
          plan: {
            include: {
              program: true,
            },
          },
          Offspring: true,
        },
      });

      if (!group) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Get linked animals
      const animals = await prisma.animal.findMany({
        where: { offspringGroupId: group.id },
        select: {
          id: true,
          name: true,
          sex: true,
          photoUrl: true,
        },
      });

      return reply.send({
        id: group.id,
        listingSlug: group.listingSlug,
        name: group.name,
        species: group.species,
        breedText: group.plan?.breedText ?? null,
        actualBirthOn: group.actualBirthOn?.toISOString() ?? null,
        expectedBirthOn: group.expectedBirthOn?.toISOString() ?? null,
        published: group.published,
        listingTitle: group.listingTitle,
        listingDescription: group.listingDescription,
        marketplaceDefaultPriceCents: group.marketplaceDefaultPriceCents,
        countBorn: group.countBorn,
        countLive: group.countLive,
        countStillborn: group.countStillborn,
        countMale: group.countMale,
        countFemale: group.countFemale,
        countWeaned: group.countWeaned,
        countPlaced: group.countPlaced,
        coverImageUrl: group.coverImageUrl,
        notes: group.notes,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        sire: group.sire ? { id: group.sire.id, name: group.sire.name, photoUrl: group.sire.photoUrl } : null,
        dam: group.dam ? { id: group.dam.id, name: group.dam.name, photoUrl: group.dam.photoUrl } : null,
        breedingProgram: group.plan?.program
          ? { id: group.plan.program.id, name: group.plan.program.name }
          : null,
        offspring: group.Offspring,
        animals,
      });
    } catch (err: any) {
      req.log?.error?.({ err, id }, "Failed to get offspring group");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get offspring group. Please try again.",
      });
    }
  });

  /* ─────────────────────── Inquiries ─────────────────────── */

  /**
   * GET /inquiries - List inquiries received by breeder
   *
   * Inquiries come from MessageThread with inquiryType = "MARKETPLACE" or "ANIMAL_LISTING"
   *
   * Query params:
   *   - status: Filter by archived status ("active", "archived")
   *   - listingType: Filter by listing type (not currently implemented in schema)
   *   - page, limit: Pagination
   */
  app.get<{
    Querystring: {
      status?: string;
      listingType?: string;
      page?: string;
      limit?: string;
    };
  }>("/inquiries", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { status } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    try {
      // Get message-based inquiries
      const messageWhere: any = {
        tenantId,
        inquiryType: {
          in: ["MARKETPLACE", "ANIMAL_LISTING"],
        },
      };

      // Filter by archived status
      if (status === "archived") {
        messageWhere.archived = true;
      } else if (status === "active") {
        messageWhere.archived = false;
      }

      const [threads, threadCount] = await Promise.all([
        prisma.messageThread.findMany({
          where: messageWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            participants: {
              include: {
                party: true,
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        prisma.messageThread.count({ where: messageWhere }),
      ]);

      // Transform to unified inquiry format
      const items = threads.map((thread: any) => {
        // Find the client/buyer participant (first non-staff participant)
        const clientParticipant = thread.participants.find((p: any) => p.party);
        const contact = clientParticipant?.party;

        return {
          id: thread.id,
          type: "message" as const,
          inquiryType: thread.inquiryType,
          subject: thread.subject,
          archived: thread.archived,
          createdAt: thread.createdAt.toISOString(),
          updatedAt: thread.updatedAt.toISOString(),
          lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
          contact: contact
            ? {
                id: contact.id,
                name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unknown",
                email: contact.email,
              }
            : null,
          lastMessage: thread.messages[0]
            ? {
                id: thread.messages[0].id,
                body: thread.messages[0].body,
                createdAt: thread.messages[0].createdAt.toISOString(),
              }
            : null,
          sourceListingSlug: thread.sourceListingSlug,
        };
      });

      return reply.send({
        items,
        total: threadCount,
        page,
        limit,
        hasMore: skip + items.length < threadCount,
      });
    } catch (err: any) {
      req.log?.error?.({ err, tenantId }, "Failed to list inquiries");
      return reply.code(500).send({
        error: "list_failed",
        message: "Failed to list inquiries. Please try again.",
      });
    }
  });

  /**
   * GET /inquiries/:id - Get single inquiry
   */
  app.get<{
    Params: { id: string };
  }>("/inquiries/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    try {
      const thread: any = await prisma.messageThread.findFirst({
        where: {
          id,
          tenantId,
          inquiryType: {
            in: ["MARKETPLACE", "ANIMAL_LISTING"],
          },
        },
        include: {
          participants: {
            include: {
              party: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!thread) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Find the client/buyer participant
      const clientParticipant = thread.participants.find((p: any) => p.party);
      const contact = clientParticipant?.party;

      return reply.send({
        id: thread.id,
        type: "message",
        inquiryType: thread.inquiryType,
        subject: thread.subject,
        archived: thread.archived,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
        contact: contact
          ? {
              id: contact.id,
              name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unknown",
              email: contact.email,
              phone: contact.phone,
            }
          : null,
        messages: thread.messages.map((m: any) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          direction: m.direction,
        })),
        sourceListingSlug: thread.sourceListingSlug,
        guestEmail: thread.guestEmail,
        guestName: thread.guestName,
      });
    } catch (err: any) {
      req.log?.error?.({ err, id }, "Failed to get inquiry");
      return reply.code(500).send({
        error: "get_failed",
        message: "Failed to get inquiry. Please try again.",
      });
    }
  });

  /* ─────────────────────── Waitlist ─────────────────────── */

  /**
   * GET /waitlist-entries - List waitlist entries for breeder management
   *
   * Note: Uses /waitlist-entries to avoid conflict with existing /waitlist route
   *
   * Query params:
   *   - status: Filter by status (PENDING, APPROVED, MATCHED, FULFILLED, CANCELLED)
   *   - programId: Filter by breeding program ID
   *   - page, limit: Pagination
   */
  app.get<{
    Querystring: {
      status?: string;
      programId?: string;
      page?: string;
      limit?: string;
    };
  }>("/waitlist-entries", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { status, programId } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    // Build where clause
    const where: any = {
      tenantId,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    // Filter by breeding program if specified
    if (programId) {
      const progId = parseInt(programId, 10);
      if (!isNaN(progId)) {
        where.plan = {
          breedingProgramId: progId,
        };
      }
    }

    try {
      const [entries, total] = await Promise.all([
        prisma.waitlistEntry.findMany({
          where,
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          skip,
          take: limit,
          include: {
            clientParty: {
              include: {
                contact: {
                  select: {
                    id: true,
                    display_name: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phoneE164: true,
                  },
                },
              },
            },
            plan: {
              include: {
                program: true,
              },
            },
            offspringGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.waitlistEntry.count({ where }),
      ]);

      // Transform to frontend-expected format
      const items = entries.map((entry: any) => {
        const contact = entry.clientParty?.contact;
        const program = entry.plan?.program;
        const name = contact?.display_name ||
          [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
          "Unknown";

        return {
          id: entry.id,
          tenantId: entry.tenantId,
          // Buyer info
          buyerId: contact?.id?.toString() || null,
          name,
          email: contact?.email || "",
          phone: contact?.phoneE164 || null,
          // Program context
          programId: program?.id || null,
          programName: program?.name || null,
          programSlug: program?.slug || null,
          // Status
          status: entry.status,
          // Preferences
          preferences: {
            sex: entry.sexPref || null,
            color: entry.colorPref || null,
            notes: entry.notes || null,
          },
          // Deposit info
          depositRequired: entry.depositRequiredCents != null && entry.depositRequiredCents > 0,
          depositAmountCents: entry.depositRequiredCents,
          depositPaidAt: entry.depositPaidAt?.toISOString() || null,
          // Position
          position: entry.priority || 0,
          // Timestamps
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
          approvedAt: entry.approvedAt?.toISOString() || null,
          matchedAt: entry.matchedAt?.toISOString() || null,
        };
      });

      return reply.send({
        items,
        total,
        page,
        limit,
        hasMore: skip + items.length < total,
      });
    } catch (err: any) {
      req.log?.error?.({ err, tenantId }, "Failed to list waitlist entries");
      return reply.code(500).send({
        error: "list_failed",
        message: "Failed to list waitlist entries. Please try again.",
      });
    }
  });

  /* ─────────────────────── Dashboard Stats ─────────────────────── */

  /**
   * GET /dashboard/stats - Get aggregate marketplace stats for breeder dashboard
   *
   * Returns counts of:
   *   - Animal Listings (direct listings)
   *   - Animal Programs (offspring groups)
   *   - Service Listings
   *   - Pending Inquiries
   */
  app.get("/dashboard/stats", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    try {
      // Get counts in parallel for all 4 marketplace listing types
      const [animalListings, animalPrograms, breedingPrograms, serviceListings] = await Promise.all([
        // Count individual animal listings (AnimalPublicListing with LIVE status)
        prisma.mktListingIndividualAnimal.count({
          where: {
            tenantId,
            status: "LIVE",
          },
        }),

        // Count animal programs (AnimalProgram - Stud Services, Guardian, etc. with LIVE status)
        prisma.mktListingAnimalProgram.count({
          where: {
            tenantId,
            status: "LIVE",
          },
        }),

        // Count breeding programs (BreedingProgram with LIVE status)
        prisma.mktListingBreedingProgram.count({
          where: {
            tenantId,
            status: "LIVE",
          },
        }),

        // Count service listings (MktListingBreederService with LIVE status)
        prisma.mktListingBreederService.count({
          where: {
            tenantId,
            status: "LIVE",
          },
        }),
      ]);

      return reply.send({
        animalListings,
        animalPrograms,
        breedingPrograms,
        serviceListings,
      });
    } catch (err: any) {
      req.log?.error?.({ err, tenantId }, "Failed to fetch dashboard stats");
      return reply.code(500).send({
        error: "fetch_failed",
        message: "Failed to fetch dashboard stats. Please try again.",
      });
    }
  });
}
