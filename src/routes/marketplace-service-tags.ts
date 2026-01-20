// src/routes/marketplace-service-tags.ts
// Service Tags API for Service Provider Portal

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../prisma.js";

/**
 * GET /api/v1/marketplace/service-tags
 * List and search service tags
 */
async function getServiceTags(
  request: FastifyRequest<{
    Querystring: {
      q?: string;
      suggested?: string;
      limit?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { q, suggested, limit = "100" } = request.query;

  const parsedLimit = Math.min(parseInt(limit, 10) || 100, 200);

  try {
    // Build where clause
    const where: any = {};

    if (q && q.trim()) {
      where.name = {
        contains: q.trim(),
        mode: "insensitive",
      };
    }

    if (suggested !== undefined) {
      where.suggested = suggested === "true";
    }

    // Fetch tags with sorting
    const tags = await prisma.marketplaceServiceTag.findMany({
      where,
      orderBy: [
        { suggested: "desc" }, // Suggested first
        { usageCount: "desc" }, // Then by popularity
        { name: "asc" }, // Then alphabetically
      ],
      take: parsedLimit,
      select: {
        id: true,
        name: true,
        slug: true,
        usageCount: true,
        suggested: true,
      },
    });

    return reply.send({
      items: tags,
      total: tags.length,
    });
  } catch (error) {
    request.log.error(error, "Failed to fetch service tags");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to fetch service tags",
    });
  }
}

/**
 * POST /api/v1/marketplace/service-tags
 * Create a new service tag
 */
async function createServiceTag(
  request: FastifyRequest<{
    Body: {
      name: string;
    };
  }>,
  reply: FastifyReply
) {
  const { name } = request.body;

  // Validation
  if (!name || typeof name !== "string") {
    return reply.status(400).send({
      error: "invalid_name",
      message: "Tag name is required",
    });
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0 || trimmedName.length > 100) {
    return reply.status(400).send({
      error: "invalid_name",
      message: "Tag name must be between 1 and 100 characters",
    });
  }

  // Generate slug
  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

  if (!slug) {
    return reply.status(400).send({
      error: "invalid_name",
      message: "Tag name must contain at least one alphanumeric character",
    });
  }

  try {
    // Check for duplicate by slug (case-insensitive)
    const existing = await prisma.marketplaceServiceTag.findFirst({
      where: {
        slug: {
          equals: slug,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return reply.status(400).send({
        error: "tag_already_exists",
        message: "A tag with this name already exists",
      });
    }

    // Create new tag
    const tag = await prisma.marketplaceServiceTag.create({
      data: {
        name: trimmedName,
        slug,
        usageCount: 0,
        suggested: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        usageCount: true,
        suggested: true,
      },
    });

    return reply.send(tag);
  } catch (error) {
    request.log.error(error, "Failed to create service tag");
    return reply.status(500).send({
      error: "server_error",
      message: "Failed to create service tag",
    });
  }
}

/**
 * Register routes
 */
export default async function marketplaceServiceTagsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/marketplace/service-tags - List/search tags
  fastify.get("/", {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: "1 minute",
      },
    },
    handler: getServiceTags,
  });

  // POST /api/v1/marketplace/service-tags - Create tag
  fastify.post("/", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
    handler: createServiceTag,
  });
}
