// src/routes/public-breeding-discovery.ts
// Breeding Discovery: Public marketplace endpoints (no auth required)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { publicBreedingInquirySchema } from "../validation/breeding-discovery.js";
import {
  sendInquiryConfirmationToUser,
  sendInquiryNotificationToBreeder,
} from "../services/marketplace-email-service.js";

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Populate animal data based on dataDrawerConfig settings
 */
async function populateAnimalDataFromConfig(
  animalId: number,
  tenantId: number,
  config: any
): Promise<any> {
  const result: any = {};

  try {
    // Fetch genetics data if enabled
    if (config.genetics?.enabled) {
      const geneticsData = await prisma.animalGenetics.findFirst({
        where: { animalId },
      });

      if (geneticsData) {
        result.genetics = {};

        // Breed composition (JSON field)
        if (config.genetics.showBreedComposition && geneticsData.breedComposition) {
          result.genetics.breedComposition = geneticsData.breedComposition;
        }

        // Coat color (JSON array of loci)
        if (config.genetics.showCoatColor && geneticsData.coatColorData) {
          result.genetics.coatColor = geneticsData.coatColorData;
        }

        // COI (JSON field with structure { coefficient, percentage, ... })
        if (config.genetics.showCOI && geneticsData.coi) {
          const coiData = geneticsData.coi as any;
          result.genetics.coi = coiData.percentage || coiData.coefficient || null;
        }

        // Predicted adult weight (JSON field)
        if (config.genetics.showPredictedWeight && geneticsData.predictedAdultWeight) {
          const weightData = geneticsData.predictedAdultWeight as any;
          result.genetics.predictedWeight = weightData.value
            ? `${weightData.value} ${weightData.unit || 'lbs'}`
            : null;
        }

        // Health genetics (JSON array)
        if (config.genetics.showHealthGenetics && geneticsData.healthGeneticsData) {
          result.genetics.healthGenetics = geneticsData.healthGeneticsData;
        }

        // Additional genetics fields
        result.genetics.coatType = geneticsData.coatTypeData || null;
        result.genetics.physicalTraits = geneticsData.physicalTraitsData || null;
        result.genetics.eyeColor = geneticsData.eyeColorData || null;
        result.genetics.otherTraits = geneticsData.otherTraitsData || null;
      }
    }

    // Fetch lineage data if enabled
    if (config.lineage?.enabled) {
      const animal = await prisma.animal.findUnique({
        where: { id: animalId },
        select: {
          sireId: true,
          damId: true,
        },
      });

      if (animal) {
        result.lineage = {};

        if (config.lineage.showSire && animal.sireId) {
          const sire = await prisma.animal.findUnique({
            where: { id: animal.sireId },
            select: {
              id: true,
              name: true,
              breed: true,
              photoUrl: true,
            },
          });
          if (sire) result.lineage.sire = sire;
        }

        if (config.lineage.showDam && animal.damId) {
          const dam = await prisma.animal.findUnique({
            where: { id: animal.damId },
            select: {
              id: true,
              name: true,
              breed: true,
              photoUrl: true,
            },
          });
          if (dam) result.lineage.dam = dam;
        }
      }
    }

    // Fetch achievements data if enabled
    if (config.achievements?.enabled) {
      result.achievements = {};

      // Fetch titles
      const titles = await prisma.animalTitle.findMany({
        where: {
          animalId,
          isPublic: true,
        },
        select: {
          id: true,
          titleName: true,
          abbreviation: true,
          dateEarned: true,
        },
      });
      result.achievements.titles = titles.map((t) => ({
        id: t.id,
        name: t.titleName,
        abbreviation: t.abbreviation,
        date: t.dateEarned?.toISOString().split('T')[0],
      }));

      // Fetch competition results
      const competitions = await prisma.animalCompetition.findMany({
        where: {
          animalId,
          isPublic: true,
        },
        select: {
          id: true,
          eventName: true,
          eventDate: true,
          placement: true,
          className: true,
        },
        orderBy: {
          eventDate: 'desc',
        },
        take: 10, // Limit to recent 10
      });
      result.achievements.competitions = competitions.map((c) => ({
        id: c.id,
        eventName: c.eventName,
        date: c.eventDate?.toISOString().split('T')[0],
        placement: c.placement,
        class: c.className,
      }));
    }

    // Fetch health clearances if enabled
    if (config.health?.enabled) {
      const healthTraits = await prisma.animalHealthTrait.findMany({
        where: {
          animalId,
          marketplaceVisible: true,
        },
        select: {
          id: true,
          traitName: true,
          result: true,
          testDate: true,
        },
      });

      result.health = {
        traits: healthTraits.map((t) => ({
          id: t.id,
          name: t.traitName,
          status: t.result,
          testDate: t.testDate?.toISOString().split('T')[0],
        })),
      };
    }

    // Fetch registry information if enabled
    if (config.registry?.enabled) {
      const registrations = await prisma.animalRegistration.findMany({
        where: {
          animalId,
        },
        select: {
          id: true,
          registrationNumber: true,
          organization: true,
          verified: true,
        },
      });

      result.registry = {
        registrations: registrations.map((r) => ({
          id: r.id,
          number: r.registrationNumber,
          organization: r.organization,
          verified: r.verified,
        })),
      };
    }

    // Fetch breeding information if enabled
    if (config.breeding?.enabled && config.breeding.showOffspringCount) {
      const offspringCount = await prisma.animal.count({
        where: {
          OR: [
            { sireId: animalId },
            { damId: animalId },
          ],
        },
      });

      result.breeding = {
        offspringCount,
      };
    }

    return result;
  } catch (err) {
    console.error(`[populateAnimalDataFromConfig] Error for animal ${animalId}:`, err);
    return result; // Return partial data if some sections fail
  }
}

const publicBreedingDiscoveryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /public/breeding-listings - Browse listings
  app.get("/public/breeding-listings", async (req, reply) => {
    try {
      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = {
        publicEnabled: true,
        status: "PUBLISHED",
      };

      // Filters
      if (q.species) where.species = String(q.species).toUpperCase();
      if (q.breed) where.breed = { contains: String(q.breed), mode: "insensitive" };
      if (q.intent) where.intent = String(q.intent).toUpperCase();
      if (q.sex) where.sex = String(q.sex).toUpperCase();
      if (q.locationState) where.locationState = String(q.locationState);

      // Search
      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { headline: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { breed: { contains: search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingListing.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            listingNumber: true,
            publicSlug: true,
            headline: true,
            species: true,
            breed: true,
            sex: true,
            intent: true,
            media: true,
            feeCents: true,
            feeDirection: true,
            locationCity: true,
            locationState: true,
            locationCountry: true,
            publishedAt: true,
            viewCount: true,
            animal: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
                primaryLineType: true,
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.breedingListing.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-discovery]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /public/breeding-listings/:slug - Get listing by slug
  app.get("/public/breeding-listings/:slug", async (req, reply) => {
    try {
      const slug = String((req.params as any).slug);

      const listing = await prisma.breedingListing.findFirst({
        where: {
          publicSlug: slug,
          publicEnabled: true,
          status: "PUBLISHED",
        },
        include: {
          animal: {
            select: {
              id: true,
              name: true,
              species: true,
              sex: true,
              breed: true,
              birthDate: true,
              photoUrl: true,
              primaryLineType: true,
              lineTypes: true,
              lineDescription: true,
              registryIds: {
                select: {
                  identifier: true,
                  registry: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              titles: {
                select: {
                  titleDefinition: {
                    select: {
                      abbreviation: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
          program: {
            select: {
              id: true,
              name: true,
              programNumber: true,
              publicSlug: true,
              publicHeadline: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!listing) return reply.code(404).send({ error: "not_found" });

      // Increment view count
      await prisma.breedingListing.update({
        where: { id: listing.id },
        data: { viewCount: { increment: 1 } },
      });

      reply.send(listing);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-discovery]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /public/breeding-listings/:slug/inquire - Submit inquiry
  app.post("/public/breeding-listings/:slug/inquire", async (req, reply) => {
    try {
      const slug = String((req.params as any).slug);

      const listing = await prisma.breedingListing.findFirst({
        where: {
          publicSlug: slug,
          publicEnabled: true,
          status: "PUBLISHED",
          acceptInquiries: true,
        },
        select: {
          id: true,
          tenantId: true,
          headline: true,
          inquiryEmail: true,
          tenant: {
            select: {
              name: true,
              primaryEmail: true,
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({
          error: "listing_not_found",
          message: "Listing not found or not accepting inquiries",
        });
      }

      const parsed = publicBreedingInquirySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;

      const inquiry = await prisma.$transaction(async (tx) => {
        const created = await tx.breedingInquiry.create({
          data: {
            tenantId: listing.tenantId,
            listingId: listing.id,
            inquirerName: data.inquirerName,
            inquirerEmail: data.inquirerEmail,
            inquirerPhone: data.inquirerPhone ?? null,
            inquirerType: data.inquirerType,
            isBreeder: data.isBreeder ?? false,
            message: data.message,
            interestedInMethod: data.interestedInMethod ?? null,
            referrerUrl: data.referrerUrl ?? null,
            utmSource: data.utmSource ?? null,
            utmMedium: data.utmMedium ?? null,
            utmCampaign: data.utmCampaign ?? null,
          },
        });

        // Increment inquiry count on listing
        await tx.breedingListing.update({
          where: { id: listing.id },
          data: { inquiryCount: { increment: 1 } },
        });

        return created;
      });

      // Send email notifications (non-blocking)
      const breederEmail = listing.inquiryEmail || listing.tenant?.primaryEmail;
      const breederName = listing.tenant?.name || "Breeder";

      // Send confirmation to inquirer
      sendInquiryConfirmationToUser({
        userEmail: data.inquirerEmail,
        userName: data.inquirerName,
        breederName,
        listingTitle: listing.headline || undefined,
        message: data.message,
      }).catch((e) => console.error("Failed to send inquiry confirmation:", e));

      // Send notification to breeder
      if (breederEmail) {
        sendInquiryNotificationToBreeder({
          breederEmail,
          breederName,
          inquirerName: data.inquirerName,
          inquirerEmail: data.inquirerEmail,
          listingTitle: listing.headline || undefined,
          message: data.message,
          threadId: inquiry.id, // Using inquiry ID as reference
          tenantId: listing.tenantId,
        }).catch((e) => console.error("Failed to send inquiry notification to breeder:", e));
      }

      reply.code(201).send({
        success: true,
        inquiryId: inquiry.id,
        message: "Inquiry submitted successfully",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-discovery]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
  // =========================================================================
  // MktListingBreedingBooking - Public Breeding Bookings (stud, lease, etc.)
  // =========================================================================

  // GET /public/breeding-services - Browse published breeding bookings
  app.get("/public/breeding-services", async (req, reply) => {
    try {
      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = {
        status: "LIVE", // Only published listings
      };

      // Filters
      if (q.intent) where.intent = String(q.intent).toLowerCase();
      // Note: Species/breed filtering through animal assignments removed - feature deprecated

      // Fee range filters
      if (q.minFee) {
        const minFee = parseIntStrict(q.minFee);
        if (minFee) where.feeCents = { ...where.feeCents, gte: minFee };
      }
      if (q.maxFee) {
        const maxFee = parseIntStrict(q.maxFee);
        if (maxFee) where.feeCents = { ...where.feeCents, lte: maxFee };
      }

      // Guarantee filter
      if (q.hasGuarantee === "true") {
        where.guaranteeType = { not: null };
      }

      // Search
      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { headline: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.mktListingBreedingBooking.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            slug: true,
            headline: true,
            description: true,
            coverImageUrl: true,
            intent: true,
            feeCents: true,
            feeDirection: true,
            breedingMethods: true,
            guaranteeType: true,
            healthCertRequired: true,
            availableFrom: true,
            availableTo: true,
            acceptingInquiries: true,
            viewCount: true,
            inquiryCount: true,
            publishedAt: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            animals: {
              include: {
                animal: {
                  select: {
                    id: true,
                    name: true,
                    species: true,
                    breed: true,
                    sex: true,
                    photoUrl: true,
                  },
                },
              },
            },
          },
        }),
        prisma.mktListingBreedingBooking.count({ where }),
      ]);

      // Convert BigInt and format response
      const formattedItems = items.map((item: any) => ({
        ...item,
        feeCents: item.feeCents != null ? Number(item.feeCents) : null,
        animals: item.animals?.map((assignment: any) => ({
          id: assignment.animal.id,
          name: assignment.animal.name,
          species: assignment.animal.species,
          breed: assignment.animal.breed,
          sex: assignment.animal.sex,
          photoUrl: assignment.animal.photoUrl,
          featured: assignment.featured,
        })) || [],
      }));

      reply.send({ items: formattedItems, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-services]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /public/breeding-services/:slug - Get single breeding booking by slug
  app.get("/public/breeding-services/:slug", async (req, reply) => {
    try {
      const slug = String((req.params as any).slug);

      const service = await prisma.mktListingBreedingBooking.findFirst({
        where: {
          slug,
          status: "LIVE",
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              region: true,
              country: true,
            },
          },
          animals: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  breed: true,
                  sex: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      if (!service) return reply.code(404).send({ error: "not_found" });

      // Increment view count
      await prisma.mktListingBreedingBooking.update({
        where: { id: service.id },
        data: { viewCount: { increment: 1 } },
      });

      // Format animals array
      const svc = service as any;
      const animals = svc.animals?.map((assignment: any) => ({
        id: assignment.animal.id,
        name: assignment.animal.name,
        species: assignment.animal.species,
        breed: assignment.animal.breed,
        sex: assignment.animal.sex,
        photoUrl: assignment.animal.photoUrl,
        featured: assignment.featured,
        feeOverride: assignment.feeOverride != null ? Number(assignment.feeOverride) : null,
      })) || [];

      // Populate animal data based on dataDrawerConfig
      let animalData = null;
      if (service.dataDrawerConfig && animals.length > 0) {
        const primaryAnimal = animals[0];
        const config = service.dataDrawerConfig as any;

        animalData = await populateAnimalDataFromConfig(
          primaryAnimal.id,
          service.tenantId,
          config
        );
      }

      // Format response
      const response = {
        ...service,
        feeCents: service.feeCents != null ? Number(service.feeCents) : null,
        tenant: {
          ...svc.tenant,
          state: svc.tenant?.region, // Map region to state for frontend compatibility
        },
        animals,
        animalData,
      };

      reply.send(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-services]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default publicBreedingDiscoveryRoutes;
