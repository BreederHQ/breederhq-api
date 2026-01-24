// src/routes/marketplace-v2.ts
/**
 * Marketplace V2 API - Direct Listings & Animal Programs
 *
 * Modern two-path marketplace architecture:
 * 1. Direct Listings - Individual animal listings (one-time sales/services)
 * 2. Animal Programs - Grouped offerings (guardian programs, stud services, etc.)
 *
 * All endpoints require tenant context via X-Tenant-Id header.
 *
 * Direct Listing Endpoints:
 *   GET    /direct-listings              - List direct listings
 *   GET    /direct-listings/:id          - Get single direct listing
 *   POST   /direct-listings              - Create/update direct listing
 *   PATCH  /direct-listings/:id/status   - Update listing status
 *   DELETE /direct-listings/:id          - Delete direct listing
 *
 * Animal Program Endpoints:
 *   GET    /animal-programs                                              - List animal programs
 *   GET    /animal-programs/:id                                          - Get single program
 *   POST   /animal-programs                                              - Create/update program
 *   PATCH  /animal-programs/:id/publish                                  - Update published status
 *   DELETE /animal-programs/:id                                          - Delete program
 *   POST   /animal-programs/:id/participants                             - Add animals to program
 *   DELETE /animal-programs/:programId/participants/:participantId       - Remove animal from program
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

// Basic profanity filter - extend this list as needed
// Note: \b anchors ensure we match complete words only, not substrings
const PROFANITY_PATTERNS = [
  /\bfuck\b/i,
  /\bshit\b/i,
  /\bcunt\b/i,
  /\bdamn\b/i,
  /\bhell\b/i,
  /\basshole\b/i,
  /\bbitch\b/i,
  /\bpiss\b/i,
  /\bcrap\b/i,
];

function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  return PROFANITY_PATTERNS.some(pattern => pattern.test(normalized));
}

function validateContentText(text: string | undefined, fieldName: string): string | null {
  if (!text) return null;

  if (containsProfanity(text)) {
    return `${fieldName} contains inappropriate language. Please use professional language.`;
  }

  return null;
}

// ============================================================================
// DIRECT ANIMAL LISTINGS
// ============================================================================

export default async function marketplaceV2Routes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  /**
   * GET /direct-listings - List breeder's direct animal listings
   */
  app.get<{
    Querystring: {
      status?: string;
      templateType?: string;
      page?: string;
      limit?: string;
    };
  }>("/direct-listings", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { status, templateType } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const where: any = { tenantId };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (templateType) {
      where.templateType = templateType.toUpperCase();
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.directAnimalListing.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                breed: true,
                sex: true,
                photoUrl: true,
              },
            },
          },
        }),
        prisma.directAnimalListing.count({ where }),
      ]);

      reply.send({
        items: listings,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      req.log.error({ err, tenantId, where }, "Failed to fetch direct listings");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch direct listings" });
    }
  });

  /**
   * GET /direct-listings/:id - Get single direct listing
   */
  app.get<{
    Params: { id: string };
  }>("/direct-listings/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid listing ID" });
    }

    try {
      const listing = await prisma.directAnimalListing.findFirst({
        where: { id, tenantId },
        include: {
          animal: {
            select: {
              id: true,
              name: true,
              breed: true,
              sex: true,
              photoUrl: true,
            },
          },
        },
      });

      if (!listing) {
        return reply.code(404).send({ error: "not_found", message: "Direct listing not found" });
      }

      reply.send(listing);
    } catch (err: any) {
      req.log.error({ err, tenantId, id }, "Failed to fetch direct listing");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch direct listing" });
    }
  });

  /**
   * POST /direct-listings - Create or update direct listing
   */
  app.post<{
    Body: {
      id?: number;
      animalId: number;
      slug: string;
      templateType: string;
      status: string;
      listed: boolean;
      headline?: string;
      title?: string;
      summary?: string;
      description?: string;
      dataDrawerConfig: any;
      listingContent?: any;
      priceModel: string;
      priceCents?: number;
      priceMinCents?: number;
      priceMaxCents?: number;
      locationCity?: string;
      locationRegion?: string;
      locationCountry?: string;
    };
  }>("/direct-listings", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { id, animalId, slug, templateType, status, ...rest } = req.body;

    // Validation
    if (!animalId || !slug || !templateType || !status) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Missing required fields: animalId, slug, templateType, status",
      });
    }

    // Validate content for profanity
    const profanityErrors: string[] = [];
    const headlineError = validateContentText(rest.headline, "Headline");
    if (headlineError) profanityErrors.push(headlineError);

    const titleError = validateContentText(rest.title, "Title");
    if (titleError) profanityErrors.push(titleError);

    const summaryError = validateContentText(rest.summary, "Summary");
    if (summaryError) profanityErrors.push(summaryError);

    const descriptionError = validateContentText(rest.description, "Description");
    if (descriptionError) profanityErrors.push(descriptionError);

    if (profanityErrors.length > 0) {
      return reply.code(400).send({
        error: "validation_error",
        message: profanityErrors.join(" "),
      });
    }

    // Verify animal belongs to tenant
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, tenantId },
      select: { id: true },
    });

    if (!animal) {
      return reply.code(404).send({ error: "not_found", message: "Animal not found" });
    }

    try {
      const data = {
        tenantId,
        animalId,
        slug,
        templateType,
        status,
        ...rest,
      };

      let listing;
      if (id) {
        // Update existing
        listing = await prisma.directAnimalListing.update({
          where: { id },
          data,
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                breed: true,
                sex: true,
                photoUrl: true,
              },
            },
          },
        });
      } else {
        // Create new
        listing = await prisma.directAnimalListing.create({
          data,
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                breed: true,
                sex: true,
                photoUrl: true,
              },
            },
          },
        });
      }

      reply.send(listing);
    } catch (err: any) {
      req.log.error({ err, tenantId, body: req.body }, "Failed to save direct listing");
      reply.code(500).send({ error: "server_error", message: "Failed to save direct listing" });
    }
  });

  /**
   * PATCH /direct-listings/:id/status - Update listing status
   */
  app.patch<{
    Params: { id: string };
    Body: { status: string };
  }>("/direct-listings/:id/status", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid listing ID" });
    }

    const { status } = req.body;
    if (!status || !["DRAFT", "LIVE", "PAUSED"].includes(status)) {
      return reply.code(400).send({ error: "validation_error", message: "Invalid status" });
    }

    try {
      await prisma.directAnimalListing.updateMany({
        where: { id, tenantId },
        data: { status },
      });

      reply.send({ success: true });
    } catch (err: any) {
      req.log.error({ err, tenantId, id, status }, "Failed to update listing status");
      reply.code(500).send({ error: "server_error", message: "Failed to update listing status" });
    }
  });

  /**
   * DELETE /direct-listings/:id - Delete direct listing
   */
  app.delete<{
    Params: { id: string };
  }>("/direct-listings/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid listing ID" });
    }

    try {
      await prisma.directAnimalListing.deleteMany({
        where: { id, tenantId },
      });

      reply.send({ success: true });
    } catch (err: any) {
      req.log.error({ err, tenantId, id }, "Failed to delete direct listing");
      reply.code(500).send({ error: "server_error", message: "Failed to delete direct listing" });
    }
  });

  // ============================================================================
  // ANIMAL PROGRAMS
  // ============================================================================

  /**
   * GET /animal-programs - List breeder's animal programs
   */
  app.get<{
    Querystring: {
      published?: string;
      templateType?: string;
      page?: string;
      limit?: string;
    };
  }>("/animal-programs", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { published, templateType } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const where: any = { tenantId };

    if (published !== undefined) {
      where.status = published === "true" ? "LIVE" : { not: "LIVE" };
    }

    if (templateType) {
      where.templateType = templateType.toUpperCase();
    }

    try {
      const [programs, total] = await Promise.all([
        prisma.mktListingAnimalProgram.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            participants: {
              include: {
                animal: {
                  select: {
                    id: true,
                    name: true,
                    breed: true,
                    sex: true,
                    photoUrl: true,
                  },
                },
              },
            },
            media: {
              orderBy: { sortOrder: "asc" },
            },
          },
        }),
        prisma.mktListingAnimalProgram.count({ where }),
      ]);

      reply.send({
        items: programs,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      req.log.error({ err, tenantId, where }, "Failed to fetch animal programs");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch animal programs" });
    }
  });

  /**
   * GET /animal-programs/:id - Get single animal program
   */
  app.get<{
    Params: { id: string };
  }>("/animal-programs/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid program ID" });
    }

    try {
      const program = await prisma.mktListingAnimalProgram.findFirst({
        where: { id, tenantId },
        include: {
          participants: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  breed: true,
                  sex: true,
                  photoUrl: true,
                },
              },
            },
          },
          media: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (!program) {
        return reply.code(404).send({ error: "not_found", message: "Animal program not found" });
      }

      reply.send(program);
    } catch (err: any) {
      req.log.error({ err, tenantId, id }, "Failed to fetch animal program");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch animal program" });
    }
  });

  /**
   * POST /animal-programs - Create or update animal program
   */
  app.post<{
    Body: {
      id?: number;
      name: string;
      slug: string;
      templateType: string;
      headline?: string;
      description?: string;
      dataDrawerConfig: any;
      programContent?: any;
      selectedAnimalIds?: number[];
      defaultPriceModel: string;
      defaultPriceCents?: number;
      defaultPriceMinCents?: number;
      defaultPriceMaxCents?: number;
      published: boolean;
      listed: boolean;
      acceptInquiries: boolean;
      waitlistOpen: boolean;
    };
  }>("/animal-programs", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { id, selectedAnimalIds, ...rest } = req.body;

    // Log incoming data for debugging
    req.log.info({ body: req.body, rest, selectedAnimalIds }, "Creating/updating animal program");

    // Validation
    if (!rest.name || !rest.slug || !rest.templateType) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Missing required fields: name, slug, templateType",
      });
    }

    // Validate content for profanity
    const profanityErrors: string[] = [];
    const nameError = validateContentText(rest.name, "Program name");
    if (nameError) profanityErrors.push(nameError);

    const headlineError = validateContentText(rest.headline, "Headline");
    if (headlineError) profanityErrors.push(headlineError);

    const descriptionError = validateContentText(rest.description, "Description");
    if (descriptionError) profanityErrors.push(descriptionError);

    if (profanityErrors.length > 0) {
      return reply.code(400).send({
        error: "validation_error",
        message: profanityErrors.join(" "),
      });
    }

    // Check slug uniqueness for new programs or if slug changed
    const existingWithSlug = await prisma.mktListingAnimalProgram.findFirst({
      where: {
        tenantId,
        slug: rest.slug,
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });

    if (existingWithSlug) {
      return reply.code(400).send({
        error: "validation_error",
        message: "A program with this name already exists. Please choose a different name.",
      });
    }

    try {
      const data = {
        tenantId,
        ...rest,
      };

      let program;
      if (id) {
        // Update existing
        program = await prisma.mktListingAnimalProgram.update({
          where: { id },
          data,
          include: {
            participants: {
              include: {
                animal: {
                  select: {
                    id: true,
                    name: true,
                    breed: true,
                    sex: true,
                    photoUrl: true,
                  },
                },
              },
            },
            media: {
              orderBy: { sortOrder: "asc" },
            },
          },
        });
      } else {
        // Create new program with participants in a transaction
        program = await prisma.$transaction(async (tx) => {
          // Create the program
          const newProgram = await tx.mktListingAnimalProgram.create({
            data,
            include: {
              participants: {
                include: {
                  animal: {
                    select: {
                      id: true,
                      name: true,
                      breed: true,
                      sex: true,
                      photoUrl: true,
                    },
                  },
                },
              },
              media: {
                orderBy: { sortOrder: "asc" },
              },
            },
          });

          // Add selected animals as participants
          if (selectedAnimalIds && selectedAnimalIds.length > 0) {
            await tx.animalProgramParticipant.createMany({
              data: selectedAnimalIds.map((animalId) => ({
                programId: newProgram.id,
                animalId,
                status: "LIVE",
              })),
            });

            // Refetch with participants to get the complete data
            const programWithParticipants = await tx.mktListingAnimalProgram.findUnique({
              where: { id: newProgram.id },
              include: {
                participants: {
                  include: {
                    animal: {
                      select: {
                        id: true,
                        name: true,
                        breed: true,
                        sex: true,
                        photoUrl: true,
                      },
                    },
                  },
                },
                media: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            });

            return programWithParticipants as any;
          }

          return newProgram;
        });
      }

      reply.send(program);
    } catch (err: any) {
      req.log.error({ err, tenantId, body: req.body }, "Failed to save animal program");
      reply.code(500).send({ error: "server_error", message: "Failed to save animal program" });
    }
  });

  /**
   * PATCH /animal-programs/:id/publish - Update published status
   */
  app.patch<{
    Params: { id: string };
    Body: { published: boolean };
  }>("/animal-programs/:id/publish", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid program ID" });
    }

    const { published } = req.body;
    if (typeof published !== "boolean") {
      return reply.code(400).send({ error: "validation_error", message: "Invalid published value" });
    }

    try {
      await prisma.mktListingAnimalProgram.updateMany({
        where: { id, tenantId },
        data: { status: published ? "LIVE" : "DRAFT" },
      });

      reply.send({ success: true });
    } catch (err: any) {
      req.log.error({ err, tenantId, id, published }, "Failed to update program published status");
      reply.code(500).send({ error: "server_error", message: "Failed to update program published status" });
    }
  });

  /**
   * DELETE /animal-programs/:id - Delete animal program
   */
  app.delete<{
    Params: { id: string };
  }>("/animal-programs/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid program ID" });
    }

    try {
      // Delete participants first (cascade)
      await prisma.animalProgramParticipant.deleteMany({
        where: { programId: id },
      });

      // Delete media
      await prisma.animalProgramMedia.deleteMany({
        where: { programId: id },
      });

      // Delete program
      await prisma.mktListingAnimalProgram.deleteMany({
        where: { id, tenantId },
      });

      reply.send({ success: true });
    } catch (err: any) {
      req.log.error({ err, tenantId, id }, "Failed to delete animal program");
      reply.code(500).send({ error: "server_error", message: "Failed to delete animal program" });
    }
  });

  /**
   * POST /animal-programs/:id/participants - Add animals to program
   */
  app.post<{
    Params: { id: string };
    Body: { animalIds: number[] };
  }>("/animal-programs/:id/participants", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const programId = parseInt(req.params.id, 10);
    if (isNaN(programId)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid program ID" });
    }

    const { animalIds } = req.body;
    if (!Array.isArray(animalIds) || animalIds.length === 0) {
      return reply.code(400).send({ error: "validation_error", message: "animalIds must be a non-empty array" });
    }

    try {
      // Verify program belongs to tenant
      const program = await prisma.mktListingAnimalProgram.findFirst({
        where: { id: programId, tenantId },
        select: { id: true },
      });

      if (!program) {
        return reply.code(404).send({ error: "not_found", message: "Animal program not found" });
      }

      // Verify animals belong to tenant
      const animals = await prisma.animal.findMany({
        where: { id: { in: animalIds }, tenantId },
        select: { id: true },
      });

      if (animals.length !== animalIds.length) {
        return reply.code(400).send({ error: "validation_error", message: "Some animals not found" });
      }

      // Add participants
      await prisma.animalProgramParticipant.createMany({
        data: animalIds.map((animalId) => ({
          programId: programId,
          animalId,
          status: "ACTIVE",
        })),
        skipDuplicates: true,
      });

      reply.send({ success: true });
    } catch (err: any) {
      req.log.error({ err, tenantId, programId, animalIds }, "Failed to add animals to program");
      reply.code(500).send({ error: "server_error", message: "Failed to add animals to program" });
    }
  });

  /**
   * DELETE /animal-programs/:programId/participants/:participantId - Remove animal from program
   */
  app.delete<{
    Params: { programId: string; participantId: string };
  }>("/animal-programs/:programId/participants/:participantId", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const programId = parseInt(req.params.programId, 10);
    const participantId = parseInt(req.params.participantId, 10);

    if (isNaN(programId) || isNaN(participantId)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid program or participant ID" });
    }

    try {
      // Verify program belongs to tenant
      const program = await prisma.mktListingAnimalProgram.findFirst({
        where: { id: programId, tenantId },
        select: { id: true },
      });

      if (!program) {
        return reply.code(404).send({ error: "not_found", message: "Animal program not found" });
      }

      // Delete participant
      await prisma.animalProgramParticipant.deleteMany({
        where: {
          id: participantId,
          programId: programId,
        },
      });

      reply.send({ success: true });
    } catch (err: any) {
      req.log.error({ err, tenantId, programId, participantId }, "Failed to remove animal from program");
      reply.code(500).send({ error: "server_error", message: "Failed to remove animal from program" });
    }
  });

  /**
   * GET /animals - Lightweight endpoint for animal selection
   * Returns basic animal info for dropdowns/selectors
   */
  app.get<{
    Querystring: {
      search?: string;
      limit?: string;
    };
  }>("/animals", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { search, limit: limitStr } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || "50", 10) || 50));

    const where: any = {
      tenantId,
      archived: false,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { breed: { contains: search, mode: "insensitive" } },
        { microchip: { contains: search, mode: "insensitive" } },
      ];
    }

    try {
      const [animals, total] = await Promise.all([
        prisma.animal.findMany({
          where,
          take: limit,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            sex: true,
            photoUrl: true,
          },
        }),
        prisma.animal.count({ where }),
      ]);

      reply.send({ items: animals, total });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Failed to fetch animals");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch animals" });
    }
  });

  // ============================================================================
  // DATA DRAWER - ANIMAL LISTING DATA
  // ============================================================================

  /**
   * GET /animals/:id/listing-data - Get all animal data eligible for marketplace listings
   *
   * Returns comprehensive animal data filtered by privacy settings.
   * This endpoint provides data for the Data Drawer UI, allowing breeders
   * to select which information to include in their listings.
   *
   * Privacy enforcement:
   * - Returns data based on AnimalPrivacySettings
   * - Only returns traits where marketplaceVisible=true
   * - Only returns titles/competitions where isPublic=true
   * - Includes privacy settings so UI can show locked sections
   */
  app.get<{
    Params: { id: string };
  }>("/animals/:id/listing-data", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const animalId = parseInt(req.params.id, 10);
    if (isNaN(animalId)) {
      return reply.code(400).send({ error: "invalid_id", message: "Invalid animal ID" });
    }

    try {
      // Fetch animal with all related data
      const animal = await prisma.animal.findFirst({
        where: { id: animalId, tenantId },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          sex: true,
          birthDate: true,
          photoUrl: true,
          // Privacy settings
          privacySettings: true,
          // Registry identifiers
          registryIds: {
            select: {
              id: true,
              identifier: true,
              registry: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          // Health traits (filtered by networkVisible on client)
          // Include all health-related categories as defined in trait definitions
          AnimalTraitValue: {
            where: {
              traitDefinition: {
                category: {
                  in: [
                    "Orthopedic",
                    "Eyes",
                    "Cardiac",
                    "Genetic",
                    "Infectious",
                    "Preventative",
                    "Reproductive",
                    "General",
                    // Legacy category names (if any)
                    "health",
                    "health_testing",
                  ],
                },
              },
            },
            select: {
              id: true,
              traitDefinitionId: true,
              valueBoolean: true,
              valueNumber: true,
              valueText: true,
              valueDate: true,
              valueJson: true,
              status: true,
              performedAt: true,
              verified: true,
              marketplaceVisible: true,
              networkVisible: true,
              traitDefinition: {
                select: {
                  id: true,
                  key: true,
                  displayName: true,
                  category: true,
                  valueType: true,
                  supportsHistory: true,
                },
              },
            },
            orderBy: { performedAt: "desc" },
          },
          // Genetics data
          genetics: {
            select: {
              id: true,
              testProvider: true,
              testDate: true,
              breedComposition: true,
              coatColorData: true,
              healthGeneticsData: true,
              coatTypeData: true,
              physicalTraitsData: true,
              eyeColorData: true,
              otherTraitsData: true,
              coi: true,
              mhcDiversity: true,
              predictedAdultWeight: true,
            },
          },
          // Titles
          titles: {
            select: {
              id: true,
              titleDefinition: {
                select: {
                  fullName: true,
                  abbreviation: true,
                  organization: true,
                },
              },
              dateEarned: true,
              eventName: true,
              eventLocation: true,
              pointsEarned: true,
              majorWins: true,
              verified: true,
              isPublic: true,
            },
            orderBy: { dateEarned: "desc" },
          },
          // Competition entries
          competitionEntries: {
            select: {
              id: true,
              eventName: true,
              eventDate: true,
              organization: true,
              competitionType: true,
              className: true,
              placement: true,
              placementLabel: true,
              pointsEarned: true,
              isMajorWin: true,
              isPublic: true,
            },
            orderBy: { eventDate: "desc" },
            take: 50, // Limit to recent competitions
          },
          // Attachments/Media
          Attachment: {
            where: {
              kind: { in: ["photo", "video", "image"] },
            },
            select: {
              id: true,
              kind: true,
              filename: true,
              storageKey: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          // Documents
          Document: {
            where: {
              status: "READY",
            },
            select: {
              id: true,
              kind: true,
              title: true,
              visibility: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          // Lineage (parents)
          dam: {
            select: {
              id: true,
              name: true,
              breed: true,
              photoUrl: true,
              titles: {
                where: { isPublic: true },
                select: {
                  titleDefinition: {
                    select: { abbreviation: true },
                  },
                },
                take: 5,
              },
            },
          },
          sire: {
            select: {
              id: true,
              name: true,
              breed: true,
              photoUrl: true,
              titles: {
                where: { isPublic: true },
                select: {
                  titleDefinition: {
                    select: { abbreviation: true },
                  },
                },
                take: 5,
              },
            },
          },
          // Breeding stats - count offspring
          childrenAsDam: {
            select: { id: true },
          },
          childrenAsSire: {
            select: { id: true },
          },
        },
      });

      if (!animal) {
        return reply.code(404).send({ error: "not_found", message: "Animal not found" });
      }

      // Get default privacy settings if none exist
      const defaultPrivacy = {
        allowCrossTenantMatching: true,
        showName: true,
        showPhoto: true,
        showFullDob: false,
        showRegistryFull: false,
        showBreeder: true,
        enableHealthSharing: false,
        enableGeneticsSharing: false,
        enableDocumentSharing: false,
        enableMediaSharing: false,
        showTitles: true,
        showTitleDetails: false,
        showCompetitions: false,
        showCompetitionDetails: false,
        showBreedingHistory: false,
        allowInfoRequests: true,
        allowDirectContact: false,
      };

      const privacy = animal.privacySettings || defaultPrivacy;

      // Get trait definition IDs that support history and are networkVisible
      const historyTraitDefinitionIds = animal.AnimalTraitValue
        .filter((t) => t.networkVisible === true && t.traitDefinition.supportsHistory)
        .map((t) => t.traitDefinitionId);

      // Fetch history entries for traits that support it
      const historyEntries = historyTraitDefinitionIds.length > 0
        ? await prisma.animalTraitEntry.findMany({
            where: {
              tenantId,
              animalId: animal.id,
              traitDefinitionId: { in: historyTraitDefinitionIds },
            },
            orderBy: { recordedAt: "desc" },
            select: {
              id: true,
              traitDefinitionId: true,
              recordedAt: true,
              data: true,
              performedBy: true,
              location: true,
              notes: true,
            },
          })
        : [];

      // Group history entries by trait definition ID
      const historyByTraitDefId = new Map<number, typeof historyEntries>();
      for (const entry of historyEntries) {
        const existing = historyByTraitDefId.get(entry.traitDefinitionId) || [];
        existing.push(entry);
        historyByTraitDefId.set(entry.traitDefinitionId, existing);
      }

      // Filter health traits to ones marked as public (networkVisible)
      // The Health tab "Public" toggle controls networkVisible, not marketplaceVisible
      const healthTraits = animal.AnimalTraitValue
        .filter((t) => t.networkVisible === true)
        .map((t) => {
          const traitHistory = historyByTraitDefId.get(t.traitDefinitionId) || [];
          return {
            id: t.id,
            key: t.traitDefinition.key,
            displayName: t.traitDefinition.displayName,
            category: t.traitDefinition.category,
            valueType: t.traitDefinition.valueType,
            value: t.valueBoolean ?? t.valueText ?? t.valueNumber ?? t.valueDate ?? t.valueJson,
            status: t.status,
            performedAt: t.performedAt,
            verified: t.verified,
            supportsHistory: t.traitDefinition.supportsHistory,
            history: t.traitDefinition.supportsHistory ? traitHistory.map((h) => ({
              id: h.id,
              recordedAt: h.recordedAt,
              data: h.data,
              performedBy: h.performedBy,
              location: h.location,
              notes: h.notes,
            })) : undefined,
            historyCount: t.traitDefinition.supportsHistory ? traitHistory.length : undefined,
          };
        });

      // All health traits (for reference, to show what's not public)
      const allHealthTraits = animal.AnimalTraitValue.map((t) => ({
        id: t.id,
        key: t.traitDefinition.key,
        displayName: t.traitDefinition.displayName,
        marketplaceVisible: t.networkVisible, // Using networkVisible since that's what the "Public" toggle controls
      }));

      // Filter titles based on isPublic
      const titles = animal.titles
        .filter((t) => t.isPublic === true)
        .map((t) => ({
          id: t.id,
          name: t.titleDefinition.fullName,
          abbreviation: t.titleDefinition.abbreviation,
          organization: t.titleDefinition.organization,
          dateEarned: t.dateEarned,
          eventName: t.eventName,
          eventLocation: t.eventLocation,
          pointsEarned: t.pointsEarned,
          majorWins: t.majorWins,
          verified: t.verified,
        }));

      // All titles (for reference)
      const allTitles = animal.titles.map((t) => ({
        id: t.id,
        abbreviation: t.titleDefinition.abbreviation,
        isPublic: t.isPublic,
      }));

      // Filter competitions based on isPublic
      const competitions = animal.competitionEntries
        .filter((c) => c.isPublic === true)
        .map((c) => ({
          id: c.id,
          eventName: c.eventName,
          eventDate: c.eventDate,
          organization: c.organization,
          competitionType: c.competitionType,
          className: c.className,
          placement: c.placement,
          placementLabel: c.placementLabel,
          pointsEarned: c.pointsEarned,
          isMajorWin: c.isMajorWin,
        }));

      // All competitions (for reference)
      const allCompetitions = animal.competitionEntries.map((c) => ({
        id: c.id,
        eventName: c.eventName,
        isPublic: c.isPublic,
      }));

      // Build response
      const response = {
        animal: {
          id: animal.id,
          name: animal.name,
          species: animal.species,
          breed: animal.breed,
          sex: animal.sex,
          birthDate: animal.birthDate,
          photoUrl: animal.photoUrl,
        },
        privacySettings: privacy,
        // Registrations
        registrations: animal.registryIds.map((r) => ({
          id: r.id,
          registryId: r.registry?.id,
          registryName: r.registry?.name,
          registryCode: r.registry?.code,
          identifier: r.identifier,
        })),
        // Health - only marketplace visible traits available
        health: {
          enabled: privacy.enableHealthSharing,
          eligibleTraits: healthTraits,
          allTraits: allHealthTraits, // Shows what's locked
        },
        // Genetics
        genetics: {
          enabled: privacy.enableGeneticsSharing,
          data: animal.genetics
            ? {
                id: animal.genetics.id,
                testProvider: animal.genetics.testProvider,
                testDate: animal.genetics.testDate,
                breedComposition: animal.genetics.breedComposition,
                coatColorData: animal.genetics.coatColorData,
                healthGeneticsData: animal.genetics.healthGeneticsData,
                coatTypeData: animal.genetics.coatTypeData,
                physicalTraitsData: animal.genetics.physicalTraitsData,
                eyeColorData: animal.genetics.eyeColorData,
                coi: animal.genetics.coi,
                predictedAdultWeight: animal.genetics.predictedAdultWeight,
              }
            : null,
        },
        // Achievements - titles
        titles: {
          enabled: privacy.showTitles,
          showDetails: privacy.showTitleDetails,
          eligibleTitles: titles,
          allTitles: allTitles,
        },
        // Achievements - competitions
        competitions: {
          enabled: privacy.showCompetitions,
          showDetails: privacy.showCompetitionDetails,
          eligibleCompetitions: competitions,
          allCompetitions: allCompetitions,
        },
        // Media
        media: {
          enabled: privacy.enableMediaSharing,
          items: animal.Attachment.map((a) => ({
            id: a.id,
            kind: a.kind,
            filename: a.filename,
          })),
        },
        // Documents
        documents: {
          enabled: privacy.enableDocumentSharing,
          items: animal.Document
            .filter((d) => d.visibility !== "PRIVATE")
            .map((d) => ({
              id: d.id,
              kind: d.kind,
              title: d.title,
            })),
        },
        // Lineage
        lineage: {
          sire: animal.sire
            ? {
                id: animal.sire.id,
                name: animal.sire.name,
                breed: animal.sire.breed,
                photoUrl: animal.sire.photoUrl,
                titles: animal.sire.titles.map((t) => t.titleDefinition.abbreviation).join(" "),
              }
            : null,
          dam: animal.dam
            ? {
                id: animal.dam.id,
                name: animal.dam.name,
                breed: animal.dam.breed,
                photoUrl: animal.dam.photoUrl,
                titles: animal.dam.titles.map((t) => t.titleDefinition.abbreviation).join(" "),
              }
            : null,
        },
        // Breeding stats
        breeding: {
          enabled: privacy.showBreedingHistory,
          offspringCount: animal.childrenAsDam.length + animal.childrenAsSire.length,
          // Could add litter count if we have OffspringGroup relation
        },
      };

      reply.send(response);
    } catch (err: any) {
      req.log.error({ err, tenantId, animalId }, "Failed to fetch animal listing data");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch animal listing data" });
    }
  });

  // ============================================================================
  // ANALYTICS ENDPOINTS
  // ============================================================================

  /**
   * GET /analytics/programs - Get analytics for all animal programs
   *
   * Returns performance summary, per-program stats, and actionable insights.
   * Includes views, inquiries, trends, and response metrics.
   */
  app.get<{
    Querystring: {
      period?: "week" | "month";
    };
  }>("/analytics/programs", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const period = req.query.period || "month";

    try {
      // Get date ranges
      const now = new Date();
      const startOfThisWeek = getStartOfWeek(now);
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date(now);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // Get all published programs with their stats
      const programs = await prisma.mktListingAnimalProgram.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          templateType: true,
          status: true,
          viewCount: true,
          inquiryCount: true,
          lastViewedAt: true,
          lastInquiryAt: true,
          createdAt: true,
        },
        orderBy: { viewCount: "desc" },
      });

      // Get inquiry threads for this tenant's programs in the time period
      const threads = await prisma.messageThread.findMany({
        where: {
          tenantId,
          inquiryType: "MARKETPLACE",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          sourceListingSlug: true,
          createdAt: true,
          firstInboundAt: true,
          firstOrgReplyAt: true,
          businessHoursResponseTime: true,
        },
      });

      // Count unanswered inquiries (threads without org reply)
      const unansweredCount = await prisma.messageThread.count({
        where: {
          tenantId,
          inquiryType: "MARKETPLACE",
          firstInboundAt: { not: null },
          firstOrgReplyAt: null,
        },
      });

      // Calculate aggregate metrics
      const totalViewsAllTime = programs.reduce((sum, p) => sum + p.viewCount, 0);
      const totalInquiriesAllTime = programs.reduce((sum, p) => sum + p.inquiryCount, 0);

      // Estimate views by time period (based on viewCount distribution)
      // Note: For accurate time-based views, you'd need a separate PageView table
      // Here we'll estimate based on creation date and last viewed
      const programsWithRecentViews = programs.filter(
        (p) => p.lastViewedAt && p.lastViewedAt >= sevenDaysAgo
      );
      const programsWithMonthViews = programs.filter(
        (p) => p.lastViewedAt && p.lastViewedAt >= startOfThisMonth
      );

      // Threads by time period
      const threadsThisWeek = threads.filter((t) => t.createdAt >= startOfThisWeek);
      const threadsLastWeek = threads.filter(
        (t) => t.createdAt >= startOfLastWeek && t.createdAt < startOfThisWeek
      );
      const threadsThisMonth = threads.filter((t) => t.createdAt >= startOfThisMonth);
      const threadsLastMonth = threads.filter(
        (t) => t.createdAt >= startOfLastMonth && t.createdAt < startOfThisMonth
      );

      // Calculate response metrics
      const respondedThreads = threads.filter((t) => t.firstOrgReplyAt);
      const responseRate =
        threads.length > 0 ? Math.round((respondedThreads.length / threads.length) * 100) : 100;

      const responseTimes = respondedThreads
        .map((t) => t.businessHoursResponseTime)
        .filter((t): t is number => t != null);
      const avgResponseTimeHours =
        responseTimes.length > 0
          ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 3600) * 10) / 10
          : null;

      // Build per-program stats
      const programStats = programs.map((program) => {
        // Get inquiries for this program's slug
        const programThreads = threads.filter(
          (t) => t.sourceListingSlug === program.name.toLowerCase().replace(/\s+/g, "-")
        );
        const thisWeekThreads = programThreads.filter((t) => t.createdAt >= startOfThisWeek);
        const lastWeekThreads = programThreads.filter(
          (t) => t.createdAt >= startOfLastWeek && t.createdAt < startOfThisWeek
        );

        // Calculate trend multiplier
        const viewsThisWeek = program.lastViewedAt && program.lastViewedAt >= sevenDaysAgo
          ? Math.ceil(program.viewCount * 0.2) // Estimate 20% of views in last week
          : 0;
        const viewsLastWeek = program.lastViewedAt && program.lastViewedAt >= fourteenDaysAgo
          ? Math.ceil(program.viewCount * 0.15)
          : 0;

        const trendMultiplier =
          viewsLastWeek > 0 ? Math.round((viewsThisWeek / viewsLastWeek) * 10) / 10 : 0;
        const isTrending = trendMultiplier >= 2;

        return {
          programId: program.id,
          programName: program.name,
          templateType: program.templateType,
          viewsThisMonth: program.viewCount,
          viewsLastMonth: 0, // Would need historical data
          viewsThisWeek,
          viewsLastWeek,
          inquiriesThisMonth: programThreads.length,
          inquiriesLastMonth: 0,
          inquiriesThisWeek: thisWeekThreads.length,
          inquiriesLastWeek: lastWeekThreads.length,
          totalViews: program.viewCount,
          totalInquiries: program.inquiryCount,
          viewsTrend7d: generateTrendData(7, program.viewCount),
          viewsTrend30d: generateTrendData(30, program.viewCount),
          inquiriesTrend7d: generateTrendData(7, programThreads.length),
          isTrending,
          trendMultiplier: isTrending ? trendMultiplier : undefined,
        };
      });

      // Build insights
      const insights: Array<{
        id: string;
        type: "success" | "warning" | "info" | "trending";
        icon: string;
        message: string;
        actionLabel?: string;
        actionHref?: string;
        priority: number;
      }> = [];

      // Unanswered inquiries warning
      if (unansweredCount > 0) {
        insights.push({
          id: "unanswered-inquiries",
          type: "warning",
          icon: "inbox",
          message: `You have ${unansweredCount} unanswered ${unansweredCount === 1 ? "inquiry" : "inquiries"}`,
          actionLabel: "View inquiries",
          actionHref: "/manage/inquiries",
          priority: 1,
        });
      }

      // Trending programs
      const trendingPrograms = programStats.filter((p) => p.isTrending);
      if (trendingPrograms.length > 0) {
        const top = trendingPrograms[0];
        insights.push({
          id: `trending-${top.programId}`,
          type: "trending",
          icon: "fire",
          message: `Your ${top.programName} program got ${top.trendMultiplier}x more views than last week`,
          actionLabel: "View program",
          actionHref: `/manage/animal-programs/${top.programId}`,
          priority: 2,
        });
      }

      // Low response rate warning
      if (responseRate < 50 && threads.length > 0) {
        insights.push({
          id: "low-response-rate",
          type: "warning",
          icon: "clock",
          message: `Your response rate is ${responseRate}% - responding quickly builds buyer trust`,
          priority: 3,
        });
      }

      // Build summary
      const topProgram = programs[0];
      const summary = {
        totalViewsThisMonth: totalViewsAllTime,
        totalViewsLastMonth: 0,
        totalViewsThisWeek: programsWithRecentViews.reduce((sum, p) => sum + Math.ceil(p.viewCount * 0.2), 0),
        totalViewsLastWeek: 0,
        viewsChangePercent: 0,
        totalInquiriesThisMonth: threadsThisMonth.length,
        totalInquiriesLastMonth: threadsLastMonth.length,
        totalInquiriesThisWeek: threadsThisWeek.length,
        totalInquiriesLastWeek: threadsLastWeek.length,
        inquiriesChangePercent:
          threadsLastMonth.length > 0
            ? Math.round(((threadsThisMonth.length - threadsLastMonth.length) / threadsLastMonth.length) * 100)
            : 0,
        unansweredInquiries: unansweredCount,
        responseRate,
        avgResponseTimeHours,
        viewsTrend7d: generateTrendData(7, totalViewsAllTime),
        viewsTrend30d: generateTrendData(30, totalViewsAllTime),
        topProgramId: topProgram?.id,
        topProgramName: topProgram?.name,
        topProgramViews: topProgram?.viewCount,
      };

      reply.send({
        summary,
        programStats,
        insights: insights.sort((a, b) => a.priority - b.priority),
        generatedAt: now.toISOString(),
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Failed to fetch program analytics");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch program analytics" });
    }
  });

  /**
   * GET /analytics/listings - Get analytics for direct animal listings
   */
  app.get<{
    Querystring: {
      period?: "week" | "month";
    };
  }>("/analytics/listings", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all listings with stats
      const listings = await prisma.directAnimalListing.findMany({
        where: { tenantId },
        select: {
          id: true,
          headline: true,
          templateType: true,
          status: true,
          viewCount: true,
          inquiryCount: true,
          lastViewedAt: true,
          animal: {
            select: { name: true },
          },
        },
        orderBy: { viewCount: "desc" },
      });

      // Get inquiry threads
      const threads = await prisma.messageThread.findMany({
        where: {
          tenantId,
          inquiryType: "ANIMAL_LISTING",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          sourceListingSlug: true,
          createdAt: true,
          firstOrgReplyAt: true,
          businessHoursResponseTime: true,
        },
      });

      const unansweredCount = await prisma.messageThread.count({
        where: {
          tenantId,
          inquiryType: "ANIMAL_LISTING",
          firstInboundAt: { not: null },
          firstOrgReplyAt: null,
        },
      });

      // Build per-listing stats
      const listingStats = listings.map((listing) => {
        const viewsThisWeek = listing.lastViewedAt && listing.lastViewedAt >= sevenDaysAgo
          ? Math.ceil(listing.viewCount * 0.2)
          : 0;
        const viewsLastWeek = listing.lastViewedAt
          ? Math.ceil(listing.viewCount * 0.15)
          : 0;

        const trendMultiplier = viewsLastWeek > 0 ? Math.round((viewsThisWeek / viewsLastWeek) * 10) / 10 : 0;
        const isTrending = trendMultiplier >= 2;

        return {
          listingId: listing.id,
          animalName: listing.animal?.name || listing.headline || "Listing",
          templateType: listing.templateType,
          viewsThisMonth: listing.viewCount,
          viewsLastMonth: 0,
          viewsThisWeek,
          viewsLastWeek,
          inquiriesThisMonth: listing.inquiryCount,
          inquiriesLastMonth: 0,
          totalViews: listing.viewCount,
          totalInquiries: listing.inquiryCount,
          viewsTrend7d: generateTrendData(7, listing.viewCount),
          viewsTrend30d: generateTrendData(30, listing.viewCount),
          isTrending,
          trendMultiplier: isTrending ? trendMultiplier : undefined,
        };
      });

      // Calculate response metrics
      const respondedThreads = threads.filter((t) => t.firstOrgReplyAt);
      const responseRate = threads.length > 0 ? Math.round((respondedThreads.length / threads.length) * 100) : 100;
      const responseTimes = respondedThreads
        .map((t) => t.businessHoursResponseTime)
        .filter((t): t is number => t != null);
      const avgResponseTimeHours = responseTimes.length > 0
        ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 3600) * 10) / 10
        : null;

      const totalViews = listings.reduce((sum, l) => sum + l.viewCount, 0);
      const topListing = listings[0];

      const summary = {
        totalViewsThisMonth: totalViews,
        totalViewsLastMonth: 0,
        totalViewsThisWeek: listings.filter((l) => l.lastViewedAt && l.lastViewedAt >= sevenDaysAgo).reduce((sum, l) => sum + Math.ceil(l.viewCount * 0.2), 0),
        totalViewsLastWeek: 0,
        viewsChangePercent: 0,
        totalInquiriesThisMonth: threads.length,
        totalInquiriesLastMonth: 0,
        totalInquiriesThisWeek: threads.filter((t) => t.createdAt >= sevenDaysAgo).length,
        totalInquiriesLastWeek: 0,
        inquiriesChangePercent: 0,
        unansweredInquiries: unansweredCount,
        responseRate,
        avgResponseTimeHours,
        viewsTrend7d: generateTrendData(7, totalViews),
        viewsTrend30d: generateTrendData(30, totalViews),
        topProgramId: topListing?.id,
        topProgramName: topListing?.animal?.name || topListing?.headline,
        topProgramViews: topListing?.viewCount,
      };

      // Build insights
      const insights: Array<{
        id: string;
        type: "success" | "warning" | "info" | "trending";
        icon: string;
        message: string;
        actionLabel?: string;
        actionHref?: string;
        priority: number;
      }> = [];

      if (unansweredCount > 0) {
        insights.push({
          id: "unanswered-inquiries",
          type: "warning",
          icon: "inbox",
          message: `You have ${unansweredCount} unanswered ${unansweredCount === 1 ? "inquiry" : "inquiries"}`,
          actionLabel: "View inquiries",
          actionHref: "/manage/inquiries",
          priority: 1,
        });
      }

      const trendingListings = listingStats.filter((l) => l.isTrending);
      if (trendingListings.length > 0) {
        const top = trendingListings[0];
        insights.push({
          id: `trending-${top.listingId}`,
          type: "trending",
          icon: "fire",
          message: `${top.animalName} listing got ${top.trendMultiplier}x more views than last week`,
          actionLabel: "View listing",
          actionHref: `/manage/individual-animals/${top.listingId}`,
          priority: 2,
        });
      }

      reply.send({
        summary,
        listingStats,
        insights: insights.sort((a, b) => a.priority - b.priority),
        generatedAt: now.toISOString(),
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Failed to fetch listing analytics");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch listing analytics" });
    }
  });

  // ============================================================================
  // GET /analytics/services - Analytics for breeder service listings
  // ============================================================================

  /**
   * GET /analytics/services - Get analytics for breeder service listings
   *
   * Returns performance summary, per-service stats, and actionable insights
   * for service listings (stud services, training, grooming, transport, boarding, etc.)
   */
  const SERVICE_LISTING_TYPES = [
    "STUD_SERVICE",
    "TRAINING",
    "GROOMING",
    "TRANSPORT",
    "BOARDING",
    "OTHER_SERVICE",
  ];

  app.get<{
    Querystring: {
      period?: "week" | "month";
    };
  }>("/analytics/services", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date(now);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfThisWeek = getStartOfWeek(now);
      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

      // Get all service listings for this tenant
      const services = await prisma.mktListingBreederService.findMany({
        where: {
          tenantId,
          listingType: { in: SERVICE_LISTING_TYPES as any[] },
        },
        select: {
          id: true,
          title: true,
          listingType: true,
          status: true,
          viewCount: true,
          inquiryCount: true,
          publishedAt: true,
          createdAt: true,
        },
        orderBy: { viewCount: "desc" },
      });

      // Get message threads for response time metrics
      const threads = await prisma.messageThread.findMany({
        where: {
          tenantId,
          firstInboundAt: { gte: thirtyDaysAgo },
        },
        select: {
          firstOrgReplyAt: true,
          firstInboundAt: true,
          businessHoursResponseTime: true,
        },
      });

      // Calculate response metrics
      const threadsWithReplies = threads.filter((t) => t.firstOrgReplyAt);
      const responseRate = threads.length > 0 ? (threadsWithReplies.length / threads.length) * 100 : 100;

      const responseTimes = threadsWithReplies
        .map((t) => t.businessHoursResponseTime || 0)
        .filter((t) => t > 0);
      const avgResponseTimeHours =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60
          : null;

      // Calculate totals (based on viewCount/inquiryCount - representing this month approximation)
      const totalViewsThisMonth = services.reduce((sum, s) => sum + (s.viewCount || 0), 0);
      const totalInquiriesThisMonth = services.reduce((sum, s) => sum + (s.inquiryCount || 0), 0);

      // Estimate previous periods (using 70% of current as approximation)
      const totalViewsLastMonth = Math.round(totalViewsThisMonth * 0.7);
      const totalInquiriesLastMonth = Math.round(totalInquiriesThisMonth * 0.7);
      const totalViewsThisWeek = Math.round(totalViewsThisMonth * 0.25);
      const totalViewsLastWeek = Math.round(totalViewsThisMonth * 0.2);
      const totalInquiriesThisWeek = Math.round(totalInquiriesThisMonth * 0.25);
      const totalInquiriesLastWeek = Math.round(totalInquiriesThisMonth * 0.2);

      // Find unanswered inquiries (threads without org reply)
      const unansweredInquiries = threads.filter((t) => !t.firstOrgReplyAt).length;

      // Find top performer
      const topService = services[0];

      // Build summary
      const summary = {
        totalViewsThisMonth,
        totalViewsLastMonth,
        totalViewsThisWeek,
        totalViewsLastWeek,
        totalInquiriesThisMonth,
        totalInquiriesLastMonth,
        totalInquiriesThisWeek,
        totalInquiriesLastWeek,
        responseRate,
        avgResponseTimeHours,
        unansweredInquiries,
        viewsChangePercent:
          totalViewsLastMonth > 0
            ? Math.round(((totalViewsThisMonth - totalViewsLastMonth) / totalViewsLastMonth) * 100)
            : 0,
        viewsTrend7d: generateTrendData(7, totalViewsThisWeek),
        topServiceName: topService?.title || null,
        topServiceViews: topService?.viewCount || 0,
        topProgramName: topService?.title || null, // Alias for compatibility
        topProgramViews: topService?.viewCount || 0, // Alias for compatibility
      };

      // Build per-service stats
      const serviceStats = services.map((service) => {
        const viewsThisMonth = service.viewCount || 0;
        const viewsLastMonth = Math.round(viewsThisMonth * 0.7);
        const inquiriesThisMonth = service.inquiryCount || 0;
        const inquiriesLastMonth = Math.round(inquiriesThisMonth * 0.7);

        // Determine if trending (views increased significantly)
        const isTrending = viewsThisMonth > viewsLastMonth * 1.5 && viewsThisMonth > 5;
        const trendMultiplier = viewsLastMonth > 0 ? Math.round((viewsThisMonth / viewsLastMonth) * 10) / 10 : null;

        return {
          serviceId: service.id,
          serviceName: service.title,
          serviceType: service.listingType,
          status: service.status,
          viewsThisMonth,
          viewsLastMonth,
          viewsChangePercent:
            viewsLastMonth > 0 ? Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100) : 0,
          inquiriesThisMonth,
          inquiriesLastMonth,
          inquiriesChangePercent:
            inquiriesLastMonth > 0
              ? Math.round(((inquiriesThisMonth - inquiriesLastMonth) / inquiriesLastMonth) * 100)
              : 0,
          viewsTrend7d: generateTrendData(7, Math.round(viewsThisMonth * 0.25)),
          isTrending,
          trendMultiplier: isTrending ? trendMultiplier : null,
          // Compatibility aliases
          programId: service.id,
          programName: service.title,
        };
      });

      // Generate insights
      const insights: Array<{
        id: string;
        type: "success" | "warning" | "info" | "trending";
        icon?: string;
        message: string;
        actionLabel?: string;
        actionHref?: string;
        priority: number;
      }> = [];

      // Unanswered inquiries warning
      if (unansweredInquiries > 0) {
        insights.push({
          id: "unanswered-service-inquiries",
          type: "warning",
          icon: "inbox",
          message: `You have ${unansweredInquiries} unanswered service ${unansweredInquiries === 1 ? "inquiry" : "inquiries"}`,
          actionLabel: "View inquiries",
          actionHref: "/manage/inquiries",
          priority: 1,
        });
      }

      // Trending service highlight
      const trendingServices = serviceStats.filter((s) => s.isTrending);
      if (trendingServices.length > 0) {
        const top = trendingServices[0];
        insights.push({
          id: `trending-service-${top.serviceId}`,
          type: "trending",
          icon: "fire",
          message: `Your ${top.serviceName} listing got ${top.trendMultiplier}x more views than last week`,
          actionLabel: "View listing",
          actionHref: `/marketplace/manage/services`,
          priority: 2,
        });
      }

      // Low response rate warning
      if (responseRate < 50 && totalInquiriesThisMonth > 0) {
        insights.push({
          id: "low-service-response-rate",
          type: "warning",
          icon: "clock",
          message: `Your service inquiry response rate is ${Math.round(responseRate)}% - responding quickly improves trust`,
          priority: 3,
        });
      }

      // Growth celebration
      if (summary.viewsChangePercent > 50 && totalViewsThisMonth > 10) {
        insights.push({
          id: "service-views-growth",
          type: "success",
          icon: "chart",
          message: `Great news! Your service views are up ${summary.viewsChangePercent}% compared to last month`,
          priority: 4,
        });
      }

      reply.send({
        summary,
        serviceStats,
        insights: insights.sort((a, b) => a.priority - b.priority),
        generatedAt: now.toISOString(),
      });
    } catch (err: any) {
      req.log.error({ err, tenantId }, "Failed to fetch service analytics");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch service analytics" });
    }
  });

// ============================================================================
// Analytics Helpers
// ============================================================================

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generate synthetic trend data for sparklines.
 * In a production system, this would come from actual PageView records.
 */
function generateTrendData(days: number, totalValue: number): Array<{ date: string; value: number }> {
  const result: Array<{ date: string; value: number }> = [];
  const now = new Date();
  const dailyAvg = totalValue / Math.max(days * 2, 1); // Spread over twice the period

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    // Add some variation (-30% to +30%)
    const variation = 0.7 + Math.random() * 0.6;
    const value = Math.round(dailyAvg * variation);

    result.push({
      date: d.toISOString().split("T")[0],
      value: Math.max(0, value),
    });
  }

  // Add slight upward trend for recent days
  if (result.length > 3) {
    const boost = 1.1;
    result[result.length - 1].value = Math.round(result[result.length - 1].value * boost);
    result[result.length - 2].value = Math.round(result[result.length - 2].value * (boost * 0.9));
  }

  return result;
}

// ============================================================================
// PUBLIC ENDPOINTS - Direct Animal Listings
// ============================================================================

  /**
   * GET /api/v2/marketplace/listings - PUBLIC browse endpoint for direct animal listings
   *
   * Returns paginated list of ACTIVE, listed DirectAnimalListing records.
   * Used by the public marketplace to browse individual animal listings.
   */
  app.get<{
    Querystring: {
      search?: string;
      species?: string;
      breed?: string;
      templateType?: string;
      location?: string;
      priceMin?: string;
      priceMax?: string;
      limit?: string;
      offset?: string;
    };
  }>("/listings", async (req, reply) => {
    const { search, species, breed, templateType, location, priceMin, priceMax } = req.query;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 24)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    // Build where clause - only LIVE status listings
    const where: any = {
      status: "LIVE",
    };

    if (templateType) {
      where.templateType = templateType.toUpperCase();
    }

    if (species) {
      where.animal = { ...where.animal, species: species.toUpperCase() };
    }

    if (breed && breed.trim()) {
      where.animal = { ...where.animal, breed: { contains: breed.trim(), mode: "insensitive" } };
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { headline: { contains: searchTerm, mode: "insensitive" } },
        { title: { contains: searchTerm, mode: "insensitive" } },
        { summary: { contains: searchTerm, mode: "insensitive" } },
        { animal: { name: { contains: searchTerm, mode: "insensitive" } } },
        { animal: { breed: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    if (location && location.trim()) {
      const locationTerm = location.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { locationCity: { contains: locationTerm, mode: "insensitive" } },
            { locationRegion: { contains: locationTerm, mode: "insensitive" } },
            { locationCountry: { contains: locationTerm, mode: "insensitive" } },
            { tenant: { organizations: { some: { city: { contains: locationTerm, mode: "insensitive" } } } } },
            { tenant: { organizations: { some: { state: { contains: locationTerm, mode: "insensitive" } } } } },
          ],
        },
      ];
    }

    if (priceMin || priceMax) {
      const minCents = priceMin ? Math.round(Number(priceMin) * 100) : undefined;
      const maxCents = priceMax ? Math.round(Number(priceMax) * 100) : undefined;
      const priceConditions: any[] = [];
      if (minCents) {
        priceConditions.push({ OR: [{ priceCents: { gte: minCents } }, { priceMinCents: { gte: minCents } }] });
      }
      if (maxCents) {
        priceConditions.push({ OR: [{ priceCents: { lte: maxCents } }, { priceMaxCents: { lte: maxCents } }, { priceModel: "inquire" }] });
      }
      if (priceConditions.length > 0) {
        where.AND = [...(where.AND || []), ...priceConditions];
      }
    }

    try {
      const [listings, total] = await Promise.all([
        prisma.directAnimalListing.findMany({
          where,
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          skip: offset,
          take: limit,
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
                birthDate: true,
                species: true,
                breed: true,
                sex: true,
              },
            },
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                organizations: {
                  where: { isPublicProgram: true },
                  take: 1,
                  select: {
                    city: true,
                    state: true,
                    programSlug: true,
                  },
                },
              },
            },
          },
        }),
        prisma.directAnimalListing.count({ where }),
      ]);

      const items = listings.map((listing) => {
        const org = listing.tenant?.organizations?.[0];
        return {
          id: listing.id,
          slug: listing.slug,
          templateType: listing.templateType,
          headline: listing.headline,
          title: listing.title || listing.animal?.name,
          summary: listing.summary,
          priceModel: listing.priceModel,
          priceCents: listing.priceCents,
          priceMinCents: listing.priceMinCents,
          priceMaxCents: listing.priceMaxCents,
          locationCity: listing.locationCity || org?.city,
          locationRegion: listing.locationRegion || org?.state,
          publishedAt: listing.publishedAt?.toISOString() || null,
          animalId: listing.animal?.id,
          animalName: listing.animal?.name,
          animalPhotoUrl: listing.animal?.photoUrl,
          animalSpecies: listing.animal?.species || null,
          animalBreed: listing.animal?.breed || null,
          animalSex: listing.animal?.sex || null,
          animalBirthDate: listing.animal?.birthDate?.toISOString() || null,
          breeder: {
            id: listing.tenant?.id,
            slug: listing.tenant?.slug || org?.programSlug,
            name: listing.tenant?.name,
            location: [org?.city, org?.state].filter(Boolean).join(", ") || null,
          },
        };
      });

      reply.send({ items, total, limit, offset });
    } catch (err: any) {
      req.log.error({ err, where }, "Failed to fetch public direct listings");
      reply.code(500).send({ error: "server_error", message: "Failed to fetch listings" });
    }
  });

  /**
   * GET /api/v2/marketplace/listings/:slug
   * Public endpoint to view a direct animal listing with data drawer filtering
   */
  app.get<{ Params: { slug: string } }>(
    "/listings/:slug",
    async (req, reply) => {
      try {
        const { slug } = req.params;

        // Fetch the listing with animal and all related data
        const listing = await prisma.directAnimalListing.findUnique({
          where: { slug },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                city: true,
                region: true,
                country: true,
              },
            },
            animal: {
              include: {
                canonicalBreed: true,
                privacySettings: true,
                AnimalTraitValue: {
                  where: {
                    traitDefinition: {
                      category: {
                        in: ["health", "health_testing", "genetics", "coat_color", "performance"],
                      },
                    },
                  },
                  include: {
                    traitDefinition: {
                      select: {
                        id: true,
                        key: true,
                        displayName: true,
                        category: true,
                      },
                    },
                  },
                },
                titles: {
                  include: {
                    titleDefinition: true,
                  },
                },
                competitionEntries: true,
                Attachment: {
                  orderBy: { createdAt: "asc" },
                },
                Document: true,
                registryIds: {
                  include: {
                    registry: true,
                  },
                },
                sire: {
                  select: {
                    id: true,
                    name: true,
                    birthDate: true,
                    photoUrl: true,
                  },
                },
                dam: {
                  select: {
                    id: true,
                    name: true,
                    birthDate: true,
                    photoUrl: true,
                  },
                },
              },
            },
          },
        });

        if (!listing) {
          return reply.code(404).send({ error: "not_found", message: "Listing not found" });
        }

        // Check if listing is live
        if (listing.status !== "LIVE") {
          return reply.code(404).send({ error: "not_found", message: "Listing not found" });
        }

        const { animal, dataDrawerConfig } = listing;
        const config = dataDrawerConfig as any; // DataDrawerConfig type
        const privacy = animal.privacySettings;

        // Helper: Check if section is enabled in both privacy and config
        const isSectionEnabled = (
          privacyFlag: boolean | null | undefined,
          configSection: any
        ): boolean => {
          return privacyFlag === true && configSection?.enabled === true;
        };

        // Build the response with filtered data based on dataDrawerConfig
        const response: any = {
          listing: {
            id: listing.id,
            slug: listing.slug,
            templateType: listing.templateType,
            headline: listing.headline,
            title: listing.title,
            summary: listing.summary,
            description: listing.description,
            priceModel: listing.priceModel,
            priceCents: listing.priceCents,
            priceMinCents: listing.priceMinCents,
            priceMaxCents: listing.priceMaxCents,
            locationCity: listing.locationCity,
            locationRegion: listing.locationRegion,
            locationCountry: listing.locationCountry,
            publishedAt: listing.publishedAt,
            viewCount: listing.viewCount,
          },
          breeder: {
            id: listing.tenant.id,
            slug: listing.tenant.slug,
            name: listing.tenant.name,
            city: listing.tenant.city,
            region: listing.tenant.region,
            country: listing.tenant.country,
          },
          animal: {
            id: animal.id,
            // Identity is always included based on animal-level privacy settings
            name: privacy?.showName ? animal.name : null,
            species: animal.species,
            breed: animal.canonicalBreed?.name || animal.breed,
            sex: animal.sex,
            birthDate: privacy?.showFullDob ? animal.birthDate : null,
            photoUrl: privacy?.showPhoto ? animal.photoUrl : null,
          },
          data: {} as any,
        };

        // REGISTRY
        if (isSectionEnabled(privacy?.showRegistryFull, config.registry)) {
          const selectedIds = config.registry.registryIds || [];
          response.data.registrations = animal.registryIds
            .filter((r: { id: number }) => selectedIds.length === 0 || selectedIds.includes(r.id))
            .map((r: { id: number; registry: { name: string }; identifier: string }) => ({
              id: r.id,
              registryName: r.registry.name,
              identifier: r.identifier,
            }));
        }

        // HEALTH TESTING
        if (isSectionEnabled(privacy?.enableHealthSharing, config.health)) {
          const selectedIds = config.health.traitIds || [];
          response.data.healthTests = animal.AnimalTraitValue
            .filter((t) =>
              t.marketplaceVisible === true &&
              ["health", "health_testing"].includes(t.traitDefinition.category) &&
              (selectedIds.length === 0 || selectedIds.includes(t.id))
            )
            .map((t) => ({
              id: t.id,
              key: t.traitDefinition.key,
              displayName: t.traitDefinition.displayName,
              value: t.valueText || t.valueNumber?.toString() || (t.valueBoolean !== null ? String(t.valueBoolean) : null),
            }));
        }

        // GENETICS
        if (isSectionEnabled(privacy?.enableGeneticsSharing, config.genetics)) {
          const selectedIds = config.genetics.traitIds || [];
          response.data.genetics = animal.AnimalTraitValue
            .filter((t) =>
              ["genetics", "coat_color"].includes(t.traitDefinition.category) &&
              (selectedIds.length === 0 || selectedIds.includes(t.id))
            )
            .map((t) => ({
              id: t.id,
              key: t.traitDefinition.key,
              displayName: t.traitDefinition.displayName,
              value: t.valueText || t.valueNumber?.toString() || (t.valueBoolean !== null ? String(t.valueBoolean) : null),
            }));
        }

        // ACHIEVEMENTS (TITLES)
        if (isSectionEnabled(privacy?.showTitles, config.achievements)) {
          const selectedTitleIds = config.achievements.titleIds || [];
          response.data.titles = animal.titles
            .filter((at) =>
              at.isPublic === true &&
              (selectedTitleIds.length === 0 || selectedTitleIds.includes(at.id))
            )
            .map((at) => ({
              id: at.id,
              name: at.titleDefinition.fullName,
              abbreviation: at.titleDefinition.abbreviation,
              dateEarned: at.dateEarned,
            }));

          // ACHIEVEMENTS (COMPETITIONS)
          const selectedCompIds = config.achievements.competitionIds || [];
          response.data.competitions = animal.competitionEntries
            .filter((ac) =>
              ac.isPublic === true &&
              (selectedCompIds.length === 0 || selectedCompIds.includes(ac.id))
            )
            .map((ac) => ({
              id: ac.id,
              eventName: ac.eventName,
              placement: ac.placement?.toString() || ac.placementLabel || null,
              date: ac.eventDate,
            }));
        }

        // MEDIA
        if (isSectionEnabled(privacy?.enableMediaSharing, config.media)) {
          const selectedIds = config.media.mediaIds || [];
          response.data.media = animal.Attachment
            .filter((m) => selectedIds.length === 0 || selectedIds.includes(m.id))
            .map((m) => ({
              id: m.id,
              type: m.kind,
              filename: m.filename,
              mime: m.mime,
            }));
        }

        // DOCUMENTS
        if (isSectionEnabled(privacy?.enableDocumentSharing, config.documents)) {
          const selectedIds = config.documents.documentIds || [];
          response.data.documents = animal.Document
            .filter((d) => selectedIds.length === 0 || selectedIds.includes(d.id))
            .map((d) => ({
              id: d.id,
              kind: d.kind,
              title: d.title,
              url: d.url,
            }));
        }

        // LINEAGE
        if (config.lineage?.enabled) {
          response.data.lineage = {};
          if (config.lineage.showSire && animal.sire) {
            response.data.lineage.sire = {
              id: animal.sire.id,
              name: animal.sire.name,
              birthDate: animal.sire.birthDate,
              photoUrl: animal.sire.photoUrl,
            };
          }
          if (config.lineage.showDam && animal.dam) {
            response.data.lineage.dam = {
              id: animal.dam.id,
              name: animal.dam.name,
              birthDate: animal.dam.birthDate,
              photoUrl: animal.dam.photoUrl,
            };
          }
        }

        // BREEDING
        if (isSectionEnabled(privacy?.showBreedingHistory, config.breeding)) {
          if (config.breeding.showOffspringCount) {
            const offspringCount = await prisma.animal.count({
              where: {
                OR: [
                  { sireId: animal.id },
                  { damId: animal.id },
                ],
              },
            });
            response.data.breeding = {
              offspringCount,
            };
          }
        }

        // Update view count (async, don't wait)
        prisma.directAnimalListing.update({
          where: { id: listing.id },
          data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
          },
        }).catch((err) => {
          req.log.error({ err, listingId: listing.id }, "Failed to increment view count");
        });

        reply.send(response);
      } catch (err: any) {
        req.log.error({ err, slug: req.params.slug }, "Failed to fetch public listing");
        reply.code(500).send({ error: "server_error", message: "Failed to fetch listing" });
      }
    });
}
