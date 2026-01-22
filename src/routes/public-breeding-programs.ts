// src/routes/public-breeding-programs.ts
// Public (unauthenticated) breeding program endpoints for marketplace

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";

/* ───────── utils ───────── */

function parseIntStrict(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePaging(q: any) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 25) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[public-breeding-programs]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

/* ───────── DTO transformers ───────── */

function toPublicProgramDTO(program: any) {
  // Compute stats from related data
  const plans = program.breedingPlans || [];
  const allGroups = plans.flatMap((p: any) => (p.offspringGroup ? [p.offspringGroup] : []));

  const activePlans = plans.filter(
    (p: any) => p.status && !["COMPLETED", "CANCELLED", "ARCHIVED"].includes(String(p.status).toUpperCase())
  );

  const now = new Date();
  const upcomingLitters = allGroups.filter((g: any) => {
    const expected = g.expectedBirthOn ? new Date(g.expectedBirthOn) : null;
    return expected && expected > now && !g.actualBirthOn;
  });

  const availableLitters = allGroups.filter((g: any) => {
    const born = g.actualBirthOn;
    const placed = g.countPlaced ?? 0;
    const total = g.countLive ?? g.countBorn ?? g._count?.Offspring ?? 0;
    return born && placed < total;
  });

  const totalAvailable = availableLitters.reduce((sum: number, g: any) => {
    const placed = g.countPlaced ?? 0;
    const total = g.countLive ?? g.countBorn ?? g._count?.Offspring ?? 0;
    return sum + Math.max(0, total - placed);
  }, 0);

  // Get tenant info for breeder details
  const breeder = program.tenant
    ? {
        name: program.tenant.name,
        location: "", // TODO: Add location field to tenant if needed
        yearsExperience: null, // TODO: Calculate from tenant.createdAt if needed
        profileImageUrl: null, // TODO: Add profile image if available
      }
    : null;

  return {
    id: program.id,
    slug: program.slug,
    name: program.name,
    description: program.description,
    programStory: program.programStory,
    species: program.species,
    breedText: program.breedText,
    coverImageUrl: program.coverImageUrl,
    showCoverImage: program.showCoverImage,

    listed: program.listed,
    acceptInquiries: program.acceptInquiries,
    openWaitlist: program.openWaitlist,
    acceptReservations: program.acceptReservations,
    comingSoon: program.comingSoon,

    pricingTiers: program.pricingTiers,
    whatsIncluded: program.whatsIncluded,
    showWhatsIncluded: program.showWhatsIncluded,
    typicalWaitTime: program.typicalWaitTime,
    showWaitTime: program.showWaitTime,

    media: (program.media || [])
      .filter((m: any) => m.isPublic)
      .map((m: any) => ({
        id: m.id,
        assetUrl: m.assetUrl,
        caption: m.caption,
        sortOrder: m.sortOrder,
      })),

    breeder,

    stats: {
      activeBreedingPlans: activePlans.length,
      upcomingLitters: upcomingLitters.length,
      availableLitters: availableLitters.length,
      totalAvailable,
    },

    publishedAt: program.publishedAt,
    createdAt: program.createdAt,
  };
}

function toPublicProgramSummaryDTO(program: any, stats: any) {
  const breeder = program.tenant
    ? {
        name: program.tenant.name,
        location: "",
      }
    : null;

  return {
    id: program.id,
    slug: program.slug,
    name: program.name,
    description: program.description,
    species: program.species,
    breedText: program.breedText,
    coverImageUrl: program.coverImageUrl,
    pricingTiers: program.pricingTiers,
    breeder,
    stats: {
      upcomingLitters: stats.upcomingLitters,
      availableLitters: stats.availableLitters,
      totalAvailable: stats.totalAvailable,
    },
    publishedAt: program.publishedAt,
  };
}

/* ───────── routes ───────── */

const publicBreedingProgramsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /* ───────── Get Public Program by Slug ───────── */
  app.get("/public/breeding-programs/:slug", async (req, reply) => {
    try {
      const { slug } = req.params as { slug: string };

      const program = await prisma.mktListingBreedingProgram.findFirst({
        where: {
          slug,
          status: "LIVE",
        },
        include: {
          media: {
            where: { isPublic: true },
            orderBy: { sortOrder: "asc" },
          },
          tenant: {
            select: {
              name: true,
              createdAt: true,
            },
          },
          breedingPlans: {
            select: {
              id: true,
              status: true,
              offspringGroup: {
                select: {
                  expectedBirthOn: true,
                  actualBirthOn: true,
                  countBorn: true,
                  countLive: true,
                  countPlaced: true,
                  _count: {
                    select: { Offspring: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!program) {
        return reply.code(404).send({ error: "not_found", message: "Program not found" });
      }

      const dto = toPublicProgramDTO(program);
      reply.send(dto);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── List Public Programs (Marketplace) ───────── */
  app.get("/public/breeding-programs", async (req, reply) => {
    try {
      const q = (req.query || {}) as any;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { status: "LIVE" };

      // Filter by species
      if (q.species) {
        where.species = String(q.species).toUpperCase();
      }

      // Filter by breed (substring match)
      if (q.breed) {
        where.breedText = {
          contains: String(q.breed).trim(),
          mode: "insensitive",
        };
      }

      // Search query (name, description, breedText)
      const search = String(q.search || "").trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { breedText: { contains: search, mode: "insensitive" } },
        ];
      }

      // Filter by availability
      if (q.hasAvailable === "true") {
        // TODO: Need to join with offspring groups to filter properly
        // For now, skip this filter
      }

      // Sorting
      let orderBy: any = { createdAt: "desc" };
      if (q.sort === "newest") {
        orderBy = { publishedAt: "desc" };
      } else if (q.sort === "name") {
        orderBy = { name: "asc" };
      }

      const [programs, total] = await prisma.$transaction([
        prisma.mktListingBreedingProgram.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            tenant: {
              select: {
                name: true,
              },
            },
            breedingPlans: {
              select: {
                id: true,
                status: true,
                offspringGroup: {
                  select: {
                    expectedBirthOn: true,
                    actualBirthOn: true,
                    countBorn: true,
                    countLive: true,
                    countPlaced: true,
                    _count: {
                      select: { Offspring: true },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.mktListingBreedingProgram.count({ where }),
      ]);

      // Transform to summary DTOs with stats
      const items = programs.map((program) => {
        const plans = program.breedingPlans || [];
        const allGroups = plans.flatMap((p) => (p.offspringGroup ? [p.offspringGroup] : []));

        const now = new Date();
        const upcomingLitters = allGroups.filter((g) => {
          const expected = g.expectedBirthOn ? new Date(g.expectedBirthOn) : null;
          return expected && expected > now && !g.actualBirthOn;
        });

        const availableLitters = allGroups.filter((g) => {
          const born = g.actualBirthOn;
          const placed = g.countPlaced ?? 0;
          const total = g.countLive ?? g.countBorn ?? g._count?.Offspring ?? 0;
          return born && placed < total;
        });

        const totalAvailable = availableLitters.reduce((sum, g) => {
          const placed = g.countPlaced ?? 0;
          const total = g.countLive ?? g.countBorn ?? g._count?.Offspring ?? 0;
          return sum + Math.max(0, total - placed);
        }, 0);

        return toPublicProgramSummaryDTO(program, {
          upcomingLitters: upcomingLitters.length,
          availableLitters: availableLitters.length,
          totalAvailable,
        });
      });

      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Submit Inquiry ───────── */
  app.post(
    "/public/breeding-programs/:slug/inquiries",
    {
      config: {
        rateLimit: {
          max: 10, // 10 requests
          timeWindow: "1 minute", // per minute
        },
      },
    },
    async (req, reply) => {
    try {
      const { slug } = req.params as { slug: string };
      const body = (req.body || {}) as any;

      // Find program
      const program = await prisma.mktListingBreedingProgram.findFirst({
        where: {
          slug,
          status: "LIVE",
          acceptInquiries: true,
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
        },
      });

      if (!program) {
        return reply.code(404).send({
          error: "not_found",
          message: "Program not found or not accepting inquiries",
        });
      }

      // Validate required fields
      const buyerName = String(body.buyerName || "").trim();
      const buyerEmail = String(body.buyerEmail || "").trim();
      const subject = String(body.subject || "").trim();
      const message = String(body.message || "").trim();

      if (!buyerName) {
        return reply.code(400).send({ error: "buyer_name_required" });
      }
      if (!buyerEmail || !buyerEmail.includes("@")) {
        return reply.code(400).send({ error: "valid_buyer_email_required" });
      }
      if (!subject) {
        return reply.code(400).send({ error: "subject_required" });
      }
      if (!message) {
        return reply.code(400).send({ error: "message_required" });
      }

      // Create inquiry
      const inquiry = await prisma.breedingProgramInquiry.create({
        data: {
          programId: program.id,
          tenantId: program.tenantId,
          buyerName,
          buyerEmail,
          buyerPhone: body.buyerPhone ? String(body.buyerPhone).trim() : null,
          subject,
          message,
          interestedIn: body.interestedIn ? String(body.interestedIn).trim() : null,
          priceRange: body.priceRange ? String(body.priceRange).trim() : null,
          timeline: body.timeline ? String(body.timeline).trim() : null,
          source: body.source ? String(body.source).trim() : "Marketplace",
          utmSource: body.utmSource ? String(body.utmSource).trim() : null,
          utmMedium: body.utmMedium ? String(body.utmMedium).trim() : null,
          utmCampaign: body.utmCampaign ? String(body.utmCampaign).trim() : null,
          status: "NEW",
        },
      });

      reply.send({
        id: inquiry.id,
        status: inquiry.status,
        message: "Thank you for your inquiry! We'll respond within 24 hours.",
        createdAt: inquiry.createdAt,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  }
  );

  /* ───────── Join Waitlist ───────── */
  // NOTE: For MVP, using inquiries to handle both inquiries and waitlist signups
  // Future enhancement: Add programId to WaitlistEntry model for dedicated waitlist tracking
};

export default publicBreedingProgramsRoutes;
