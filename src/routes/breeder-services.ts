// src/routes/breeder-services.ts
// CRUD API endpoints for breeder service listings (training, stud services, etc.)

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ListingType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";

// ============================================================================
// Types
// ============================================================================

// Service types available to breeders (subset of ListingType enum)
const BREEDER_SERVICE_TYPES: ListingType[] = [
  "STUD_SERVICE",
  "TRAINING",
  "GROOMING",
  "TRANSPORT",
  "BOARDING",
  "OTHER_SERVICE",
];

type BreederServiceType = (typeof BREEDER_SERVICE_TYPES)[number];

interface ServiceListingInput {
  listingType: BreederServiceType;
  title: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  priceCents?: number;
  priceType?: "fixed" | "starting_at" | "contact";
  images?: string[];
  videoUrl?: string;
  metadata?: Record<string, unknown>;
}

interface ServiceListingResponse {
  id: number;
  listingType: string;
  title: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  state: string | null;
  country: string;
  priceCents: number | null;
  priceType: string | null;
  images: string[] | null;
  videoUrl: string | null;
  status: string;
  slug: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function isValidServiceType(type: string): type is BreederServiceType {
  return BREEDER_SERVICE_TYPES.includes(type as BreederServiceType);
}

function generateSlug(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base}-${id}`;
}

function toServiceResponse(listing: any): ServiceListingResponse {
  return {
    id: listing.id,
    listingType: listing.listingType,
    title: listing.title,
    description: listing.description,
    contactName: listing.contactName,
    contactEmail: listing.contactEmail,
    contactPhone: listing.contactPhone,
    city: listing.city,
    state: listing.state,
    country: listing.country,
    priceCents: listing.priceCents,
    priceType: listing.priceType,
    images: listing.images as string[] | null,
    videoUrl: listing.videoUrl,
    status: listing.status,
    slug: listing.slug,
    metadata: listing.metadata as Record<string, unknown> | null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

// ============================================================================
// Routes
// ============================================================================

export default async function breederServicesRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /services - List breeder's service listings
  // --------------------------------------------------------------------------
  app.get<{
    Querystring: { status?: string; type?: string };
  }>("/services", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const { status, type } = req.query;

    const where: any = {
      tenantId,
      listingType: { in: BREEDER_SERVICE_TYPES },
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    if (type && isValidServiceType(type.toUpperCase())) {
      where.listingType = type.toUpperCase();
    }

    const listings = await prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return reply.send({
      items: listings.map(toServiceResponse),
      total: listings.length,
    });
  });

  // --------------------------------------------------------------------------
  // GET /services/:id - Get a single service listing
  // --------------------------------------------------------------------------
  app.get<{
    Params: { id: string };
  }>("/services/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id,
        tenantId,
        listingType: { in: BREEDER_SERVICE_TYPES },
      },
    });

    if (!listing) {
      return reply.code(404).send({ error: "not_found" });
    }

    return reply.send(toServiceResponse(listing));
  });

  // --------------------------------------------------------------------------
  // POST /services - Create a new service listing
  // --------------------------------------------------------------------------
  app.post<{
    Body: ServiceListingInput;
  }>("/services", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const {
      listingType,
      title,
      description,
      contactName,
      contactEmail,
      contactPhone,
      city,
      state,
      priceCents,
      priceType,
      images,
      videoUrl,
      metadata,
    } = req.body;

    // Validate required fields
    if (!listingType || !title) {
      return reply.code(400).send({
        error: "missing_required_fields",
        required: ["listingType", "title"],
      });
    }

    if (!isValidServiceType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        allowed: BREEDER_SERVICE_TYPES,
      });
    }

    // Create the listing
    const listing = await prisma.marketplaceListing.create({
      data: {
        tenantId,
        listingType,
        title: title.trim(),
        description: description?.trim() || null,
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        priceCents: priceCents ?? null,
        priceType: priceType || null,
        images: images ? (images as Prisma.InputJsonValue) : Prisma.JsonNull,
        videoUrl: videoUrl?.trim() || null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: "DRAFT",
      },
    });

    // Generate and set slug
    const slug = generateSlug(title, listing.id);
    const updatedListing = await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { slug },
    });

    return reply.code(201).send(toServiceResponse(updatedListing));
  });

  // --------------------------------------------------------------------------
  // PUT /services/:id - Update a service listing
  // --------------------------------------------------------------------------
  app.put<{
    Params: { id: string };
    Body: Partial<ServiceListingInput>;
  }>("/services/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify ownership
    const existing = await prisma.marketplaceListing.findFirst({
      where: {
        id,
        tenantId,
        listingType: { in: BREEDER_SERVICE_TYPES },
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const {
      listingType,
      title,
      description,
      contactName,
      contactEmail,
      contactPhone,
      city,
      state,
      priceCents,
      priceType,
      images,
      videoUrl,
      metadata,
    } = req.body;

    // Validate listing type if provided
    if (listingType && !isValidServiceType(listingType)) {
      return reply.code(400).send({
        error: "invalid_listing_type",
        allowed: BREEDER_SERVICE_TYPES,
      });
    }

    // Build update data
    const updateData: Prisma.MarketplaceListingUpdateInput = {};
    if (listingType) updateData.listingType = listingType;
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (contactName !== undefined) updateData.contactName = contactName?.trim() || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail?.trim() || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (priceCents !== undefined) updateData.priceCents = priceCents ?? null;
    if (priceType !== undefined) updateData.priceType = priceType || null;
    if (images !== undefined) updateData.images = images ? (images as Prisma.InputJsonValue) : Prisma.JsonNull;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl?.trim() || null;
    if (metadata !== undefined) updateData.metadata = metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull;

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: updateData,
    });

    return reply.send(toServiceResponse(listing));
  });

  // --------------------------------------------------------------------------
  // POST /services/:id/publish - Publish a service listing
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
  }>("/services/:id/publish", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: {
        id,
        tenantId,
        listingType: { in: BREEDER_SERVICE_TYPES },
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    // Validate required fields for publishing
    if (!existing.title) {
      return reply.code(400).send({ error: "title_required_to_publish" });
    }

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: "ACTIVE",
        publishedAt: new Date(),
      },
    });

    return reply.send(toServiceResponse(listing));
  });

  // --------------------------------------------------------------------------
  // POST /services/:id/unpublish - Unpublish (pause) a service listing
  // --------------------------------------------------------------------------
  app.post<{
    Params: { id: string };
  }>("/services/:id/unpublish", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: {
        id,
        tenantId,
        listingType: { in: BREEDER_SERVICE_TYPES },
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: "PAUSED",
      },
    });

    return reply.send(toServiceResponse(listing));
  });

  // --------------------------------------------------------------------------
  // DELETE /services/:id - Delete a service listing
  // --------------------------------------------------------------------------
  app.delete<{
    Params: { id: string };
  }>("/services/:id", async (req, reply) => {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const existing = await prisma.marketplaceListing.findFirst({
      where: {
        id,
        tenantId,
        listingType: { in: BREEDER_SERVICE_TYPES },
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }

    await prisma.marketplaceListing.delete({
      where: { id },
    });

    return reply.code(204).send();
  });
}
