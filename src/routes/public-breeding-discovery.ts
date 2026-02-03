// src/routes/public-breeding-discovery.ts
// Breeding Discovery: Public marketplace endpoints (no auth required)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { publicBreedingInquirySchema } from "../validation/breeding-discovery.js";

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
        select: { id: true, tenantId: true },
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

  // GET /public/breeding-programs - Browse programs
  app.get("/public/breeding-programs", async (req, reply) => {
    try {
      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = {
        publicEnabled: true,
        status: "ACTIVE",
      };

      if (q.species) where.species = String(q.species).toUpperCase();

      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { publicHeadline: { contains: search, mode: "insensitive" } },
          { publicDescription: { contains: search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingDiscoveryProgram.findMany({
          where,
          orderBy: { publicEnabledAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            programNumber: true,
            publicSlug: true,
            name: true,
            publicHeadline: true,
            species: true,
            programType: true,
            media: true,
            locationCity: true,
            locationState: true,
            locationCountry: true,
            _count: {
              select: { listings: true },
            },
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.breedingDiscoveryProgram.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-discovery]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /public/breeding-programs/:slug - Get program by slug
  app.get("/public/breeding-programs/:slug", async (req, reply) => {
    try {
      const slug = String((req.params as any).slug);

      const program = await prisma.breedingDiscoveryProgram.findFirst({
        where: {
          publicSlug: slug,
          publicEnabled: true,
          status: "ACTIVE",
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          listings: {
            where: {
              publicEnabled: true,
              status: "PUBLISHED",
            },
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
              locationCity: true,
              locationState: true,
              animal: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true,
                  primaryLineType: true,
                },
              },
            },
            orderBy: { publishedAt: "desc" },
            take: 20,
          },
          _count: {
            select: { listings: true },
          },
        },
      });

      if (!program) return reply.code(404).send({ error: "not_found" });

      reply.send(program);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[public-breeding-discovery]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default publicBreedingDiscoveryRoutes;
