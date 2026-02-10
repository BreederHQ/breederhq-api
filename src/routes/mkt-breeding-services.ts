// src/routes/mkt-breeding-services.ts
// Breeding Services Listings Management Routes
// Authenticated routes for breeders to manage breeding service offerings
// (stud services, mare leasing, breeding arrangements, etc.)

import type { FastifyInstance } from "fastify";
import prisma from "../prisma.js";

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number(req.tenantId);
  if (!tenantId) {
    reply.code(401).send({ error: "unauthorized", message: "Tenant context required" });
    return null;
  }
  return tenantId;
}

/**
 * Generate URL-friendly slug from headline and ID
 */
function generateSlug(headline: string, id: number): string {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `bs-${base}-${id}`;
}

export default async function mktBreedingServicesRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/mkt-breeding-services
   * Get all breeding service listings for the authenticated breeder
   */
  app.get<{
    Querystring: {
      status?: string;
      intent?: string;
      limit?: string;
    };
  }>("/", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { status, intent, limit } = req.query;

    // Build where clause
    const where: any = {
      tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (intent && intent !== "ALL") {
      where.intent = intent.toLowerCase();
    }

    try {
      const services = await prisma.mktListingBreedingService.findMany({
        where,
        take: limit ? parseInt(limit, 10) : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          animalAssignments: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  sex: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      // Transform to DTO
      const items = services.map((service) => ({
        id: service.id,
        tenantId: service.tenantId,
        slug: service.slug,
        headline: service.headline,
        description: service.description,
        coverImageUrl: service.coverImageUrl,
        intent: service.intent,
        feeCents: service.feeCents,
        feeDirection: service.feeDirection,
        breedingMethods: service.breedingMethods,
        guaranteeType: service.guaranteeType,
        guaranteeTerms: service.guaranteeTerms,
        healthCertRequired: service.healthCertRequired,
        cogginsCurrent: service.cogginsCurrent,
        cultureRequired: service.cultureRequired,
        contractRequired: service.contractRequired,
        customRequirements: service.customRequirements,
        availableFrom: service.availableFrom?.toISOString() || null,
        availableTo: service.availableTo?.toISOString() || null,
        blackoutDates: service.blackoutDates,
        maxBookingsPerPeriod: service.maxBookingsPerPeriod,
        acceptingInquiries: service.acceptingInquiries,
        status: service.status,
        publishedAt: service.publishedAt?.toISOString() || null,
        pausedAt: service.pausedAt?.toISOString() || null,
        viewCount: service.viewCount,
        inquiryCount: service.inquiryCount,
        notes: service.notes,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
        animals: service.animalAssignments.map((a) => ({
          id: a.animal.id,
          name: a.animal.name,
          species: a.animal.species,
          sex: a.animal.sex,
          photoUrl: a.animal.photoUrl,
          featured: a.featured,
          feeOverride: a.feeOverride,
          maxBookings: a.maxBookings,
          bookingsClosed: a.bookingsClosed,
        })),
      }));

      return reply.send({
        items,
        total: items.length,
      });
    } catch (error) {
      console.error("Error fetching breeding services:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to fetch breeding service listings",
      });
    }
  });

  /**
   * GET /api/v1/mkt-breeding-services/:id
   * Get a specific breeding service listing
   */
  app.get<{
    Params: {
      id: string;
    };
  }>("/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const serviceId = parseInt(req.params.id, 10);
    if (isNaN(serviceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid service ID",
      });
    }

    try {
      const service = await prisma.mktListingBreedingService.findFirst({
        where: {
          id: serviceId,
          tenantId,
        },
        include: {
          animalAssignments: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  sex: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      if (!service) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding service not found",
        });
      }

      return reply.send({
        ...service,
        coverImageUrl: service.coverImageUrl || null,
        availableFrom: service.availableFrom?.toISOString() || null,
        availableTo: service.availableTo?.toISOString() || null,
        publishedAt: service.publishedAt?.toISOString() || null,
        pausedAt: service.pausedAt?.toISOString() || null,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
        animals: service.animalAssignments.map((a) => ({
          id: a.animal.id,
          name: a.animal.name,
          species: a.animal.species,
          sex: a.animal.sex,
          photoUrl: a.animal.photoUrl,
          featured: a.featured,
          feeOverride: a.feeOverride,
          maxBookings: a.maxBookings,
          bookingsClosed: a.bookingsClosed,
        })),
      });
    } catch (error) {
      console.error("Error fetching breeding service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to fetch breeding service",
      });
    }
  });

  /**
   * POST /api/v1/mkt-breeding-services
   * Create a new breeding service listing
   */
  app.post<{
    Body: {
      headline: string;
      description?: string;
      coverImageUrl?: string;
      intent: string;
      animalIds?: number[];
      feeCents?: number;
      feeDirection?: string;
      breedingMethods?: string[];
      guaranteeType?: string;
      guaranteeTerms?: string;
      healthCertRequired?: boolean;
      cogginsCurrent?: boolean;
      cultureRequired?: boolean;
      contractRequired?: boolean;
      customRequirements?: string[];
      availableFrom?: string;
      availableTo?: string;
      blackoutDates?: string[];
      maxBookingsPerPeriod?: number;
      acceptingInquiries?: boolean;
      notes?: string;
    };
  }>("/", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const {
      headline,
      description,
      coverImageUrl,
      intent,
      animalIds,
      feeCents,
      feeDirection,
      breedingMethods,
      guaranteeType,
      guaranteeTerms,
      healthCertRequired,
      cogginsCurrent,
      cultureRequired,
      contractRequired,
      customRequirements,
      availableFrom,
      availableTo,
      blackoutDates,
      maxBookingsPerPeriod,
      acceptingInquiries,
      notes,
    } = req.body;

    if (!headline || !intent) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Headline and intent are required",
      });
    }

    // Validate intent
    const validIntents = ["offering", "seeking", "lease", "arrangement"];
    if (!validIntents.includes(intent.toLowerCase())) {
      return reply.code(400).send({
        error: "validation_error",
        message: `Intent must be one of: ${validIntents.join(", ")}`,
      });
    }

    try {
      // Create service with a temporary slug
      const service = await prisma.mktListingBreedingService.create({
        data: {
          tenantId,
          slug: `temp-${Date.now()}`,
          headline,
          description: description || null,
          coverImageUrl: coverImageUrl || null,
          intent: intent.toLowerCase(),
          feeCents: feeCents || null,
          feeDirection: feeDirection || null,
          breedingMethods: breedingMethods || [],
          guaranteeType: guaranteeType || null,
          guaranteeTerms: guaranteeTerms || null,
          healthCertRequired: healthCertRequired ?? false,
          cogginsCurrent: cogginsCurrent ?? false,
          cultureRequired: cultureRequired ?? false,
          contractRequired: contractRequired ?? false,
          customRequirements: customRequirements || [],
          availableFrom: availableFrom ? new Date(availableFrom) : null,
          availableTo: availableTo ? new Date(availableTo) : null,
          blackoutDates: blackoutDates || [],
          maxBookingsPerPeriod: maxBookingsPerPeriod || null,
          acceptingInquiries: acceptingInquiries ?? true,
          notes: notes || null,
          status: "DRAFT",
        },
      });

      // Update slug with ID
      const finalSlug = generateSlug(headline, service.id);
      await prisma.mktListingBreedingService.update({
        where: { id: service.id },
        data: { slug: finalSlug },
      });

      // Add animal assignments if provided
      if (animalIds && animalIds.length > 0) {
        // Verify animals belong to this tenant
        const animals = await prisma.animal.findMany({
          where: {
            id: { in: animalIds },
            tenantId,
          },
          select: { id: true },
        });

        const validAnimalIds = animals.map((a) => a.id);

        if (validAnimalIds.length > 0) {
          await prisma.mktBreedingServiceAnimal.createMany({
            data: validAnimalIds.map((animalId) => ({
              serviceId: service.id,
              animalId,
            })),
          });
        }
      }

      // Fetch the complete service with animals
      const result = await prisma.mktListingBreedingService.findUnique({
        where: { id: service.id },
        include: {
          animalAssignments: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  sex: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      return reply.code(201).send({
        ...result,
        slug: finalSlug,
        coverImageUrl: result?.coverImageUrl || null,
        availableFrom: result?.availableFrom?.toISOString() || null,
        availableTo: result?.availableTo?.toISOString() || null,
        createdAt: result?.createdAt.toISOString(),
        updatedAt: result?.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error creating breeding service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to create breeding service",
      });
    }
  });

  /**
   * PUT /api/v1/mkt-breeding-services/:id
   * Update a breeding service listing
   */
  app.put<{
    Params: {
      id: string;
    };
    Body: {
      headline?: string;
      description?: string;
      coverImageUrl?: string;
      intent?: string;
      animalIds?: number[];
      feeCents?: number;
      feeDirection?: string;
      breedingMethods?: string[];
      guaranteeType?: string;
      guaranteeTerms?: string;
      healthCertRequired?: boolean;
      cogginsCurrent?: boolean;
      cultureRequired?: boolean;
      contractRequired?: boolean;
      customRequirements?: string[];
      availableFrom?: string;
      availableTo?: string;
      blackoutDates?: string[];
      maxBookingsPerPeriod?: number;
      acceptingInquiries?: boolean;
      notes?: string;
    };
  }>("/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const serviceId = parseInt(req.params.id, 10);
    if (isNaN(serviceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid service ID",
      });
    }

    try {
      // Verify ownership
      const existing = await prisma.mktListingBreedingService.findFirst({
        where: {
          id: serviceId,
          tenantId,
        },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding service not found",
        });
      }

      const {
        animalIds,
        availableFrom,
        availableTo,
        intent,
        ...updateData
      } = req.body;

      // Build update data
      const data: any = {
        ...updateData,
      };

      if (intent) {
        data.intent = intent.toLowerCase();
      }

      if (availableFrom !== undefined) {
        data.availableFrom = availableFrom ? new Date(availableFrom) : null;
      }

      if (availableTo !== undefined) {
        data.availableTo = availableTo ? new Date(availableTo) : null;
      }

      const service = await prisma.mktListingBreedingService.update({
        where: { id: serviceId },
        data,
      });

      // Update animal assignments if provided
      if (animalIds !== undefined) {
        // Remove existing assignments
        await prisma.mktBreedingServiceAnimal.deleteMany({
          where: { serviceId },
        });

        // Add new assignments
        if (animalIds.length > 0) {
          const animals = await prisma.animal.findMany({
            where: {
              id: { in: animalIds },
              tenantId,
            },
            select: { id: true },
          });

          const validAnimalIds = animals.map((a) => a.id);

          if (validAnimalIds.length > 0) {
            await prisma.mktBreedingServiceAnimal.createMany({
              data: validAnimalIds.map((animalId) => ({
                serviceId,
                animalId,
              })),
            });
          }
        }
      }

      // Fetch updated service with animals
      const result = await prisma.mktListingBreedingService.findUnique({
        where: { id: serviceId },
        include: {
          animalAssignments: {
            include: {
              animal: {
                select: {
                  id: true,
                  name: true,
                  species: true,
                  sex: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      return reply.send({
        ...result,
        coverImageUrl: result?.coverImageUrl || null,
        availableFrom: result?.availableFrom?.toISOString() || null,
        availableTo: result?.availableTo?.toISOString() || null,
        publishedAt: result?.publishedAt?.toISOString() || null,
        pausedAt: result?.pausedAt?.toISOString() || null,
        createdAt: result?.createdAt.toISOString(),
        updatedAt: result?.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error updating breeding service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to update breeding service",
      });
    }
  });

  /**
   * POST /api/v1/mkt-breeding-services/:id/publish
   * Publish a breeding service listing
   */
  app.post<{
    Params: {
      id: string;
    };
  }>("/:id/publish", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const serviceId = parseInt(req.params.id, 10);
    if (isNaN(serviceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid service ID",
      });
    }

    try {
      const result = await prisma.mktListingBreedingService.updateMany({
        where: {
          id: serviceId,
          tenantId,
        },
        data: {
          status: "LIVE",
          publishedAt: new Date(),
          pausedAt: null,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding service not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error publishing breeding service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to publish breeding service",
      });
    }
  });

  /**
   * POST /api/v1/mkt-breeding-services/:id/pause
   * Pause a breeding service listing
   */
  app.post<{
    Params: {
      id: string;
    };
  }>("/:id/pause", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const serviceId = parseInt(req.params.id, 10);
    if (isNaN(serviceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid service ID",
      });
    }

    try {
      const result = await prisma.mktListingBreedingService.updateMany({
        where: {
          id: serviceId,
          tenantId,
        },
        data: {
          status: "PAUSED",
          pausedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding service not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error pausing breeding service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to pause breeding service",
      });
    }
  });

  /**
   * DELETE /api/v1/mkt-breeding-services/:id
   * Delete a breeding service listing
   */
  app.delete<{
    Params: {
      id: string;
    };
  }>("/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const serviceId = parseInt(req.params.id, 10);
    if (isNaN(serviceId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid service ID",
      });
    }

    try {
      // This will cascade delete animal assignments due to onDelete: Cascade
      const result = await prisma.mktListingBreedingService.deleteMany({
        where: {
          id: serviceId,
          tenantId,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding service not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error deleting breeding service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to delete breeding service",
      });
    }
  });
}
