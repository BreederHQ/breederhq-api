// src/routes/public-breeding-programs.ts
// Public (unauthenticated) breeding program endpoints for marketplace

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";
import { getPublicCdnUrl } from "../services/media-storage.js";
import { trackBoostInquiry } from "../services/listing-boost-service.js";
import type { ListingBoostTarget } from "@prisma/client";

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

// Parent summary for dam/sire display
function toParentSummaryDTO(animal: any) {
  if (!animal) return null;
  return {
    id: animal.id,
    name: animal.name,
    primaryImageUrl: animal.photoUrl || null,
    breed: animal.breed || null,
    sex: animal.sex || null,
  };
}

// Offspring group summary
function toOffspringGroupSummaryDTO(group: any) {
  if (!group) return null;
  const countBorn = group.countBorn ?? group._count?.Offspring ?? 0;
  const countPlaced = group.countPlaced ?? 0;
  const countReserved = group.countReserved ?? 0;
  return {
    id: group.id,
    countBorn,
    countAvailable: Math.max(0, countBorn - countPlaced - countReserved),
    countReserved,
    countPlaced,
  };
}

// Linked plan summary for program detail
function toLinkedPlanDTO(plan: any) {
  return {
    id: plan.id,
    name: plan.name || plan.nickname || `Plan #${plan.id}`,
    status: plan.status,
    expectedBirthDate: plan.expectedBirthDate || plan.offspringGroup?.expectedBirthOn || null,
    actualBirthDate: plan.birthDateActual || plan.offspringGroup?.actualBirthOn || null,
    dam: toParentSummaryDTO(plan.dam),
    sire: toParentSummaryDTO(plan.sire),
    offspringGroup: toOffspringGroupSummaryDTO(plan.offspringGroup),
    coverImageUrl: plan.offspringGroup?.coverImageUrl || null,
  };
}

// Default program settings (can be overridden per-program in future)
function getProgramSettings(program: any) {
  return {
    offspringDisplayMode: program.offspringDisplayMode || "curated",
    comingSoonWeeksThreshold: program.comingSoonWeeksThreshold ?? 8,
    showParentPhotos: program.showParentPhotos ?? true,
    showOffspringPhotos: program.showOffspringPhotos ?? true,
    showPricing: program.showPricing ?? true,
  };
}

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
        tenantId: program.tenant.id,
        name: program.tenant.name,
        slug: program.tenant.slug || null,
        location: [program.tenant.city, program.tenant.region, program.tenant.country]
          .filter(Boolean)
          .join(", ") || null,
        logoUrl: null, // Logo is on BreederProfile, not Tenant
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

    // Enhanced: Linked breeding plans with dam/sire info
    linkedPlans: activePlans.map(toLinkedPlanDTO),

    // Enhanced: Program display settings
    programSettings: getProgramSettings(program),

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
              id: true,
              name: true,
              slug: true,
              city: true,
              region: true,
              country: true,
              createdAt: true,
            },
          },
          breedingPlans: {
            where: {
              status: { notIn: ["COMPLETE", "CANCELED", "UNSUCCESSFUL"] },
            },
            select: {
              id: true,
              name: true,
              nickname: true,
              status: true,
              expectedBirthDate: true,
              birthDateActual: true,
              dam: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true,
                  breed: true,
                  sex: true,
                },
              },
              sire: {
                select: {
                  id: true,
                  name: true,
                  photoUrl: true,
                  breed: true,
                  sex: true,
                },
              },
              offspringGroup: {
                select: {
                  id: true,
                  expectedBirthOn: true,
                  actualBirthOn: true,
                  countBorn: true,
                  countLive: true,
                  countPlaced: true,
                  coverImageUrl: true,
                  _count: {
                    select: { Offspring: true },
                  },
                },
              },
            },
            orderBy: [
              { expectedBirthDate: "asc" },
              { createdAt: "desc" },
            ],
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

      // FR-46: Track inquiry against active boost (fire-and-forget)
      trackBoostInquiry("BREEDING_PROGRAM" as ListingBoostTarget, program.id).catch(() => {});

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

  /* ───────── Get Plan Detail (for drawer) ───────── */
  app.get("/public/breeding-programs/:slug/plans/:planId", async (req, reply) => {
    try {
      const { slug, planId } = req.params as { slug: string; planId: string };
      const planIdNum = parseIntStrict(planId);

      if (!planIdNum) {
        return reply.code(400).send({ error: "invalid_plan_id" });
      }

      // First verify the program exists and is live
      const program = await prisma.mktListingBreedingProgram.findFirst({
        where: {
          slug,
          status: "LIVE",
        },
        select: {
          id: true,
          tenantId: true,
        },
      });

      if (!program) {
        return reply.code(404).send({ error: "not_found", message: "Program not found" });
      }

      // Fetch the plan with full details
      // Using `as any` for the result since Prisma's typed include can be complex
      const plan = await prisma.breedingPlan.findFirst({
        where: {
          id: planIdNum,
          programId: program.id,
          status: { notIn: ["COMPLETE", "CANCELED", "UNSUCCESSFUL"] },
        },
        include: {
          dam: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              breed: true,
              sex: true,
              birthDate: true,
            },
          },
          sire: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              breed: true,
              sex: true,
              birthDate: true,
            },
          },
          offspringGroup: {
            include: {
              Offspring: {
                where: {
                  marketplaceListed: true,
                },
                select: {
                  id: true,
                  name: true,
                  sex: true,
                  status: true,
                  collarColorName: true,
                  collarColorHex: true,
                  priceCents: true,
                  Attachments: {
                    take: 1,
                    orderBy: { createdAt: "asc" },
                    select: {
                      id: true,
                      storageKey: true,
                      kind: true,
                    },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
          Attachments: {
            where: {
              kind: { in: ["photo", "image", "media"] },
            },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              storageKey: true,
              kind: true,
              filename: true,
            },
          },
        },
      }) as any;

      if (!plan) {
        return reply.code(404).send({ error: "not_found", message: "Plan not found" });
      }

      // Build timeline events
      const timeline: Array<{ event: string; date: string | null; completed: boolean }> = [];

      if (plan.breedDateActual) {
        timeline.push({ event: "BRED", date: plan.breedDateActual.toISOString(), completed: true });
      }
      if (plan.expectedBirthDate) {
        const isBorn = !!plan.birthDateActual;
        timeline.push({ event: "EXPECTED_BIRTH", date: plan.expectedBirthDate.toISOString(), completed: isBorn });
      }
      if (plan.birthDateActual) {
        timeline.push({ event: "BORN", date: plan.birthDateActual.toISOString(), completed: true });
      }

      // Transform offspring with photo URLs
      const offspring = (plan.offspringGroup?.Offspring || []).map((o: any) => {
        const firstAttachment = o.Attachments?.[0];
        return {
          id: o.id,
          name: o.name,
          sex: o.sex?.toLowerCase() || null,
          status: o.status?.toLowerCase() || "available",
          collarColorName: o.collarColorName,
          collarColorHex: o.collarColorHex,
          priceCents: o.priceCents,
          primaryImageUrl: firstAttachment?.storageKey
            ? getPublicCdnUrl(firstAttachment.storageKey)
            : null,
        };
      });

      // Transform plan attachments to media URLs
      const media = (plan.Attachments || []).map((a: any, index: number) => ({
        id: a.id,
        url: getPublicCdnUrl(a.storageKey),
        thumbnailUrl: getPublicCdnUrl(a.storageKey), // Same URL for now, could add thumbnail logic
        caption: a.filename || null,
        sortOrder: index,
        type: "image",
      }));

      // Build response DTO
      const dto = {
        id: plan.id,
        name: plan.name || plan.nickname || `Plan #${plan.id}`,
        status: plan.status,
        description: plan.notes || null,
        expectedBirthDate: plan.expectedBirthDate?.toISOString() || null,
        actualBirthDate: plan.birthDateActual?.toISOString() || null,
        dam: toParentSummaryDTO(plan.dam),
        sire: toParentSummaryDTO(plan.sire),
        timeline,
        media,
        offspring,
        offspringGroup: plan.offspringGroup ? {
          id: plan.offspringGroup.id,
          countBorn: plan.offspringGroup.countBorn ?? 0,
          countAvailable: Math.max(0, (plan.offspringGroup.countBorn ?? 0) - (plan.offspringGroup.countPlaced ?? 0)),
          countPlaced: plan.offspringGroup.countPlaced ?? 0,
        } : null,
        // Default settings until schema supports per-program customization
        displayMode: "curated" as const,
        showParentPhotos: true,
        showOffspringPhotos: true,
        showPricing: true,
        documents: [], // Future: Add document attachments with presigned URLs
      };

      reply.send(dto);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Join Waitlist ───────── */
  app.post(
    "/public/breeding-programs/:slug/waitlist",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
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
            openWaitlist: true,
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
            message: "Program not found or not accepting waitlist signups",
          });
        }

        // Validate required fields
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim();

        if (!name) {
          return reply.code(400).send({ error: "name_required" });
        }
        if (!email || !email.includes("@")) {
          return reply.code(400).send({ error: "valid_email_required" });
        }

        // Create waitlist entry via inquiry (for MVP, reusing inquiry model)
        // In the future, this could use a dedicated WaitlistEntry model
        const inquiry = await prisma.breedingProgramInquiry.create({
          data: {
            programId: program.id,
            tenantId: program.tenantId,
            buyerName: name,
            buyerEmail: email,
            buyerPhone: body.phone ? String(body.phone).trim() : null,
            subject: `Waitlist Signup: ${program.name}`,
            message: body.notes ? String(body.notes).trim() : "I would like to join the waitlist.",
            interestedIn: body.interestedIn ? String(body.interestedIn).trim() : null,
            source: "Waitlist",
            status: "NEW",
          },
        });

        // FR-46: Track waitlist signup against active boost (fire-and-forget)
        trackBoostInquiry("BREEDING_PROGRAM" as ListingBoostTarget, program.id).catch(() => {});

        reply.send({
          success: true,
          message: "You've been added to the waitlist! We'll be in touch soon.",
          waitlistId: inquiry.id,
        });
      } catch (err) {
        const { status, payload } = errorReply(err);
        reply.status(status).send(payload);
      }
    }
  );
};

export default publicBreedingProgramsRoutes;
