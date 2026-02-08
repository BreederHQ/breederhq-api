// src/routes/breeder-services.ts
// Breeder Service Listings Management Routes
// Authenticated routes for breeders to manage their service listings

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

export default async function breederServicesRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/services
   * Get all service listings for the authenticated breeder
   */
  app.get<{
    Querystring: {
      status?: string;
      type?: string;
      limit?: string;
    };
  }>("/", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { status, type, limit } = req.query;

    // Build where clause
    const where: any = {
      tenantId,
      sourceType: "BREEDER",
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (type && type !== "ALL") {
      where.category = type;
    }

    try {
      const services = await prisma.mktListingBreederService.findMany({
        where,
        take: limit ? parseInt(limit, 10) : undefined,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          tenantId: true,
          sourceType: true,
          category: true,
          subcategory: true,
          title: true,
          slug: true,
          description: true,
          status: true,
          city: true,
          state: true,
          zip: true,
          country: true,
          priceCents: true,
          priceType: true,
          priceText: true,
          images: true,
          coverImageUrl: true,
          duration: true,
          availability: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Convert BigInt fields to numbers for JSON serialization
      const serializedServices = services.map((s) => ({
        ...s,
        priceCents: s.priceCents != null ? Number(s.priceCents) : null,
      }));

      return reply.send({
        items: serializedServices,
        total: serializedServices.length,
      });
    } catch (error) {
      console.error("Error fetching breeder services:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to fetch service listings",
      });
    }
  });

  /**
   * GET /api/v1/services/:id
   * Get a specific service listing
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
      const service = await prisma.mktListingBreederService.findFirst({
        where: {
          id: serviceId,
          tenantId,
          sourceType: "BREEDER",
        },
      });

      if (!service) {
        return reply.code(404).send({
          error: "not_found",
          message: "Service not found",
        });
      }

      // Convert BigInt fields to numbers for JSON serialization
      return reply.send({
        ...service,
        priceCents: service.priceCents != null ? Number(service.priceCents) : null,
      });
    } catch (error) {
      console.error("Error fetching breeder service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to fetch service",
      });
    }
  });

  /**
   * POST /api/v1/services
   * Create a new service listing
   */
  app.post<{
    Body: {
      category: string;
      title: string;
      description?: string;
      subcategory?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      priceCents?: number;
      priceType?: string;
      priceText?: string;
      images?: string[];
      coverImageUrl?: string;
      duration?: string;
      availability?: string;
    };
  }>("/", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const { category, title, description, ...rest } = req.body;

    if (!title || !category) {
      return reply.code(400).send({
        error: "validation_error",
        message: "Title and category are required",
      });
    }

    try {
      // Generate slug from title
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const service = await prisma.mktListingBreederService.create({
        data: {
          tenantId,
          sourceType: "BREEDER",
          category,
          title,
          slug: baseSlug,
          description: description || "",
          status: "DRAFT",
          ...rest,
        },
      });

      // Convert BigInt fields to numbers for JSON serialization
      return reply.code(201).send({
        ...service,
        priceCents: service.priceCents != null ? Number(service.priceCents) : null,
      });
    } catch (error) {
      console.error("Error creating breeder service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to create service",
      });
    }
  });

  /**
   * PUT /api/v1/services/:id
   * Update a service listing
   */
  app.put<{
    Params: {
      id: string;
    };
    Body: {
      category?: string;
      subcategory?: string;
      title?: string;
      description?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      priceCents?: number;
      priceType?: string;
      priceText?: string;
      images?: string[];
      coverImageUrl?: string;
      duration?: string;
      availability?: string;
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
      const existing = await prisma.mktListingBreederService.findFirst({
        where: {
          id: serviceId,
          tenantId,
          sourceType: "BREEDER",
        },
      });

      if (!existing) {
        return reply.code(404).send({
          error: "not_found",
          message: "Service not found",
        });
      }

      const service = await prisma.mktListingBreederService.update({
        where: { id: serviceId },
        data: req.body,
      });

      // Convert BigInt fields to numbers for JSON serialization
      return reply.send({
        ...service,
        priceCents: service.priceCents != null ? Number(service.priceCents) : null,
      });
    } catch (error) {
      console.error("Error updating breeder service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to update service",
      });
    }
  });

  /**
   * POST /api/v1/services/:id/publish
   * Publish a service listing
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
      const service = await prisma.mktListingBreederService.updateMany({
        where: {
          id: serviceId,
          tenantId,
          sourceType: "BREEDER",
        },
        data: {
          status: "LIVE",
        },
      });

      if (service.count === 0) {
        return reply.code(404).send({
          error: "not_found",
          message: "Service not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error publishing breeder service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to publish service",
      });
    }
  });

  /**
   * POST /api/v1/services/:id/unpublish
   * Unpublish a service listing
   */
  app.post<{
    Params: {
      id: string;
    };
  }>("/:id/unpublish", async (req, reply) => {
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
      const service = await prisma.mktListingBreederService.updateMany({
        where: {
          id: serviceId,
          tenantId,
          sourceType: "BREEDER",
        },
        data: {
          status: "DRAFT",
        },
      });

      if (service.count === 0) {
        return reply.code(404).send({
          error: "not_found",
          message: "Service not found",
        });
      }

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error unpublishing breeder service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to unpublish service",
      });
    }
  });

  /**
   * DELETE /api/v1/services/:id
   * Delete a service listing
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
      await prisma.mktListingBreederService.deleteMany({
        where: {
          id: serviceId,
          tenantId,
          sourceType: "BREEDER",
        },
      });

      return reply.send({ ok: true });
    } catch (error) {
      console.error("Error deleting breeder service:", error);
      return reply.code(500).send({
        error: "server_error",
        message: "Failed to delete service",
      });
    }
  });
}
