// src/routes/mkt-breeding-bookings.ts
// Breeding Bookings Listings Management Routes
// Authenticated routes for breeders to manage breeding booking offerings
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

export default async function mktBreedingBookingsRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/mkt-breeding-bookings
   * Get all breeding booking listings for the authenticated breeder
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
      const bookings = await prisma.mktListingBreedingBooking.findMany({
        where,
        take: limit ? parseInt(limit, 10) : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          animals: {
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
      const items = bookings.map((booking) => ({
        id: booking.id,
        tenantId: booking.tenantId,
        slug: booking.slug,
        headline: booking.headline,
        description: booking.description,
        coverImageUrl: booking.coverImageUrl,
        intent: booking.intent,
        feeCents: booking.feeCents,
        feeDirection: booking.feeDirection,
        breedingMethods: booking.breedingMethods,
        guaranteeType: booking.guaranteeType,
        guaranteeTerms: booking.guaranteeTerms,
        healthCertRequired: booking.healthCertRequired,
        cogginsCurrent: booking.cogginsCurrent,
        cultureRequired: booking.cultureRequired,
        contractRequired: booking.contractRequired,
        customRequirements: booking.customRequirements,
        availableFrom: booking.availableFrom?.toISOString() || null,
        availableTo: booking.availableTo?.toISOString() || null,
        blackoutDates: booking.blackoutDates,
        maxBookingsPerPeriod: booking.maxBookingsPerPeriod,
        acceptingInquiries: booking.acceptingInquiries,
        status: booking.status,
        publishedAt: booking.publishedAt?.toISOString() || null,
        pausedAt: booking.pausedAt?.toISOString() || null,
        viewCount: booking.viewCount,
        inquiryCount: booking.inquiryCount,
        notes: booking.notes,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        animals: booking.animals.map((ba) => ({
          id: ba.animal.id,
          name: ba.animal.name,
          species: ba.animal.species,
          sex: ba.animal.sex,
          photoUrl: ba.animal.photoUrl,
          featured: ba.featured,
          feeOverride: ba.feeOverride,
          maxBookings: ba.maxBookings,
          bookingsClosed: ba.bookingsClosed,
        })),
      }));

      return reply.send({
        items,
        total: items.length,
      });
    } catch (error) {
      console.error("Error fetching breeding bookings:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to fetch breeding booking listings",
      });
    }
  });

  /**
   * GET /api/v1/mkt-breeding-bookings/:id
   * Get a specific breeding booking listing
   */
  app.get<{
    Params: {
      id: string;
    };
  }>("/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid booking ID",
      });
    }

    try {
      const booking = await prisma.mktListingBreedingBooking.findFirst({
        where: {
          id: bookingId,
          tenantId,
        },
        include: {
          animals: {
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

      if (!booking) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding booking not found",
        });
      }

      // Transform animals to match frontend DTO
      const animals = booking.animals.map((ba) => ({
        id: ba.animal.id,
        name: ba.animal.name,
        species: ba.animal.species,
        sex: ba.animal.sex,
        photoUrl: ba.animal.photoUrl,
        featured: ba.featured,
        feeOverride: ba.feeOverride,
        maxBookings: ba.maxBookings,
        bookingsClosed: ba.bookingsClosed,
      }));

      return reply.send({
        ...booking,
        coverImageUrl: booking.coverImageUrl || null,
        availableFrom: booking.availableFrom?.toISOString() || null,
        availableTo: booking.availableTo?.toISOString() || null,
        publishedAt: booking.publishedAt?.toISOString() || null,
        pausedAt: booking.pausedAt?.toISOString() || null,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        animals,
      });
    } catch (error) {
      console.error("Error fetching breeding booking:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to fetch breeding booking",
      });
    }
  });

  /**
   * POST /api/v1/mkt-breeding-bookings
   * Create a new breeding booking listing
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
      // Create booking with a temporary slug and animal assignments
      const booking = await prisma.mktListingBreedingBooking.create({
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
          // Create animal assignments if provided
          animals: animalIds && animalIds.length > 0 ? {
            create: animalIds.map((animalId) => ({
              animalId,
            })),
          } : undefined,
        },
      });

      // Update slug with ID
      const finalSlug = generateSlug(headline, booking.id);
      await prisma.mktListingBreedingBooking.update({
        where: { id: booking.id },
        data: { slug: finalSlug },
      });

      // Fetch the complete booking with animals
      const result = await prisma.mktListingBreedingBooking.findUnique({
        where: { id: booking.id },
        include: {
          animals: {
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

      // Transform animals to match frontend DTO
      const animals = result?.animals.map((ba) => ({
        id: ba.animal.id,
        name: ba.animal.name,
        species: ba.animal.species,
        sex: ba.animal.sex,
        photoUrl: ba.animal.photoUrl,
        featured: ba.featured,
        feeOverride: ba.feeOverride,
        maxBookings: ba.maxBookings,
        bookingsClosed: ba.bookingsClosed,
      })) || [];

      return reply.code(201).send({
        ...result,
        slug: finalSlug,
        coverImageUrl: result?.coverImageUrl || null,
        availableFrom: result?.availableFrom?.toISOString() || null,
        availableTo: result?.availableTo?.toISOString() || null,
        createdAt: result?.createdAt.toISOString(),
        updatedAt: result?.updatedAt.toISOString(),
        animals,
      });
    } catch (error) {
      console.error("Error creating breeding booking:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to create breeding booking",
      });
    }
  });

  /**
   * PUT /api/v1/mkt-breeding-bookings/:id
   * Update a breeding booking listing
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

    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid booking ID",
      });
    }

    try {
      // Verify ownership
      const existing = await prisma.mktListingBreedingBooking.findFirst({
        where: {
          id: bookingId,
          tenantId,
        },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding booking not found",
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

      // Update booking and handle animal assignments if provided
      if (animalIds !== undefined) {
        // Use transaction to delete old assignments and create new ones
        await prisma.$transaction(async (tx) => {
          // Delete all existing assignments
          await tx.mktBreedingBookingAnimal.deleteMany({
            where: { bookingId },
          });

          // Update the booking (without nested animals)
          await tx.mktListingBreedingBooking.update({
            where: { id: bookingId },
            data,
          });

          // Create new animal assignments if any
          if (animalIds.length > 0) {
            await tx.mktBreedingBookingAnimal.createMany({
              data: animalIds.map((animalId) => ({
                bookingId,
                animalId,
              })),
            });
          }
        });
      } else {
        // Just update the booking without touching animals
        await prisma.mktListingBreedingBooking.update({
          where: { id: bookingId },
          data,
        });
      }

      // Fetch updated booking with animals
      const result = await prisma.mktListingBreedingBooking.findUnique({
        where: { id: bookingId },
        include: {
          animals: {
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

      // Transform animals to match frontend DTO
      const animals = result?.animals.map((ba) => ({
        id: ba.animal.id,
        name: ba.animal.name,
        species: ba.animal.species,
        sex: ba.animal.sex,
        photoUrl: ba.animal.photoUrl,
        featured: ba.featured,
        feeOverride: ba.feeOverride,
        maxBookings: ba.maxBookings,
        bookingsClosed: ba.bookingsClosed,
      })) || [];

      return reply.send({
        ...result,
        coverImageUrl: result?.coverImageUrl || null,
        availableFrom: result?.availableFrom?.toISOString() || null,
        availableTo: result?.availableTo?.toISOString() || null,
        publishedAt: result?.publishedAt?.toISOString() || null,
        pausedAt: result?.pausedAt?.toISOString() || null,
        createdAt: result?.createdAt.toISOString(),
        updatedAt: result?.updatedAt.toISOString(),
        animals,
      });
    } catch (error) {
      console.error("Error updating breeding booking:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to update breeding booking",
      });
    }
  });

  /**
   * POST /api/v1/mkt-breeding-bookings/:id/publish
   * Publish a breeding booking listing
   */
  app.post<{
    Params: {
      id: string;
    };
  }>("/:id/publish", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid booking ID",
      });
    }

    try {
      const result = await prisma.mktListingBreedingBooking.updateMany({
        where: {
          id: bookingId,
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
          message: "Breeding booking not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error publishing breeding booking:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to publish breeding booking",
      });
    }
  });

  /**
   * POST /api/v1/mkt-breeding-bookings/:id/pause
   * Pause a breeding booking listing
   */
  app.post<{
    Params: {
      id: string;
    };
  }>("/:id/pause", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid booking ID",
      });
    }

    try {
      const result = await prisma.mktListingBreedingBooking.updateMany({
        where: {
          id: bookingId,
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
          message: "Breeding booking not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error pausing breeding booking:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to pause breeding booking",
      });
    }
  });

  /**
   * DELETE /api/v1/mkt-breeding-bookings/:id
   * Delete a breeding booking listing
   */
  app.delete<{
    Params: {
      id: string;
    };
  }>("/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId)) {
      return reply.code(400).send({
        error: "invalid_id",
        message: "Invalid booking ID",
      });
    }

    try {
      // This will cascade delete animal assignments due to onDelete: Cascade
      const result = await prisma.mktListingBreedingBooking.deleteMany({
        where: {
          id: bookingId,
          tenantId,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: "not_found",
          message: "Breeding booking not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error deleting breeding booking:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to delete breeding booking",
      });
    }
  });
}
