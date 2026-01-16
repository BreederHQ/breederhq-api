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
    if (!status || !["DRAFT", "ACTIVE", "PAUSED"].includes(status)) {
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
      where.published = published === "true";
    }

    if (templateType) {
      where.templateType = templateType.toUpperCase();
    }

    try {
      const [programs, total] = await Promise.all([
        prisma.animalProgram.findMany({
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
        prisma.animalProgram.count({ where }),
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
      const program = await prisma.animalProgram.findFirst({
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
    const existingWithSlug = await prisma.animalProgram.findFirst({
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
        program = await prisma.animalProgram.update({
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
          const newProgram = await tx.animalProgram.create({
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
                status: "ACTIVE",
              })),
            });

            // Refetch with participants to get the complete data
            const programWithParticipants = await tx.animalProgram.findUnique({
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
      await prisma.animalProgram.updateMany({
        where: { id, tenantId },
        data: { published },
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
        where: { animalProgramId: id },
      });

      // Delete media
      await prisma.animalProgramMedia.deleteMany({
        where: { animalProgramId: id },
      });

      // Delete program
      await prisma.animalProgram.deleteMany({
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
      const program = await prisma.animalProgram.findFirst({
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
          animalProgramId: programId,
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
      const program = await prisma.animalProgram.findFirst({
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
          animalProgramId: programId,
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
}
