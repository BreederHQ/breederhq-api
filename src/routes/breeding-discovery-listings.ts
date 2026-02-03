// src/routes/breeding-discovery-listings.ts
// Breeding Discovery: Listing CRUD + lifecycle

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { generateListingNumber } from "../utils/breeding-discovery-numbers.js";
import {
  breedingListingCreateSchema,
  breedingListingUpdateSchema,
  validateIntentFeeDirection,
} from "../validation/breeding-discovery.js";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(headline: string): Promise<string> {
  const baseSlug = slugify(headline);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.breedingListing.findFirst({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

const listingInclude = {
  animal: {
    select: {
      id: true,
      name: true,
      species: true,
      sex: true,
      breed: true,
      photoUrl: true,
      primaryLineType: true,
      lineTypes: true,
    },
  },
  program: {
    select: {
      id: true,
      name: true,
      programNumber: true,
    },
  },
  _count: {
    select: { inquiries: true, bookings: true },
  },
};

const breedingDiscoveryListingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /breeding-discovery/listings
  app.get("/breeding-discovery/listings", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { tenantId };

      if (q.status) where.status = String(q.status).toUpperCase();
      if (q.intent) where.intent = String(q.intent).toUpperCase();
      if (q.species) where.species = String(q.species).toUpperCase();
      if (q.programId) {
        const pid = parseIntStrict(q.programId);
        if (pid) where.programId = pid;
      }

      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { headline: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { animal: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingListing.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: listingInclude,
        }),
        prisma.breedingListing.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-discovery/listings
  app.post("/breeding-discovery/listings", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = breedingListingCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;

      const feeError = validateIntentFeeDirection(data.intent, data.feeDirection);
      if (feeError) return reply.code(400).send({ error: "validation_error", message: feeError });

      const animal = await prisma.animal.findFirst({
        where: { id: data.animalId, tenantId },
        select: { id: true, species: true, sex: true, breed: true },
      });
      if (!animal) return reply.code(404).send({ error: "animal_not_found" });

      if (data.programId) {
        const program = await prisma.breedingDiscoveryProgram.findFirst({
          where: { id: data.programId, tenantId },
          select: { id: true },
        });
        if (!program) return reply.code(404).send({ error: "program_not_found" });
      }

      const listingNumber = await generateListingNumber();

      const listing = await prisma.breedingListing.create({
        data: {
          tenantId,
          listingNumber,
          animalId: data.animalId,
          programId: data.programId ?? null,
          species: animal.species,
          breed: animal.breed ?? null,
          sex: animal.sex,
          intent: data.intent as any,
          headline: data.headline,
          description: data.description ?? null,
          media: data.media ?? [],
          feeCents: data.feeCents ?? null,
          feeDirection: data.feeDirection as any ?? null,
          feeNotes: data.feeNotes ?? null,
          availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
          availableTo: data.availableTo ? new Date(data.availableTo) : null,
          seasonName: data.seasonName ?? null,
          breedingMethods: data.breedingMethods ?? [],
          maxBookings: data.maxBookings ?? null,
          guaranteeType: data.guaranteeType ?? null,
          guaranteeTerms: data.guaranteeTerms ?? null,
          requiresHealthTesting: data.requiresHealthTesting ?? false,
          requiredTests: data.requiredTests ?? [],
          requiresContract: data.requiresContract ?? false,
          additionalRequirements: data.additionalRequirements ?? null,
          publicShowPedigree: data.publicShowPedigree ?? true,
          publicPedigreeDepth: data.publicPedigreeDepth ?? 2,
          publicShowTitles: data.publicShowTitles ?? true,
          publicShowHealthTesting: data.publicShowHealthTesting ?? true,
          publicShowLineType: data.publicShowLineType ?? true,
          publicShowProducingStats: data.publicShowProducingStats ?? false,
          publicShowBreederName: data.publicShowBreederName ?? true,
          publicShowBreederLocation: data.publicShowBreederLocation ?? true,
          publicShowFee: data.publicShowFee ?? true,
          metaTitle: data.metaTitle ?? null,
          metaDescription: data.metaDescription ?? null,
          acceptInquiries: data.acceptInquiries ?? true,
          inquiryEmail: data.inquiryEmail ?? null,
          inquiryPhone: data.inquiryPhone ?? null,
          inquiryInstructions: data.inquiryInstructions ?? null,
          locationCity: data.locationCity ?? null,
          locationState: data.locationState ?? null,
          locationCountry: data.locationCountry ?? null,
          locationLat: data.locationLat ?? null,
          locationLng: data.locationLng ?? null,
          createdBy: (req as any).userId ? Number((req as any).userId) : null,
        },
        include: listingInclude,
      });

      reply.code(201).send(listing);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-discovery/listings/:id
  app.get("/breeding-discovery/listings/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const listing = await prisma.breedingListing.findFirst({
        where: { id, tenantId },
        include: listingInclude,
      });

      if (!listing) return reply.code(404).send({ error: "not_found" });
      reply.send(listing);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // PUT /breeding-discovery/listings/:id
  app.put("/breeding-discovery/listings/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingListing.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const parsed = breedingListingUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;

      if (data.intent && data.feeDirection) {
        const feeError = validateIntentFeeDirection(data.intent, data.feeDirection);
        if (feeError) return reply.code(400).send({ error: "validation_error", message: feeError });
      }

      const updateData: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          if (key === "availableFrom" || key === "availableTo") {
            updateData[key] = value ? new Date(value as string) : null;
          } else {
            updateData[key] = value;
          }
        }
      }

      const updated = await prisma.breedingListing.update({
        where: { id },
        data: updateData,
        include: listingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // DELETE /breeding-discovery/listings/:id
  app.delete("/breeding-discovery/listings/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingListing.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      if (!["DRAFT", "CLOSED"].includes(existing.status)) {
        return reply.code(400).send({
          error: "cannot_delete",
          message: "Can only delete listings in DRAFT or CLOSED status",
        });
      }

      await prisma.$transaction([
        prisma.breedingInquiry.deleteMany({ where: { listingId: id } }),
        prisma.breedingListing.delete({ where: { id } }),
      ]);

      reply.code(204).send();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-discovery/listings/:id/publish
  app.post("/breeding-discovery/listings/:id/publish", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingListing.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true, headline: true, publicSlug: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      if (!["DRAFT", "PAUSED"].includes(existing.status)) {
        return reply.code(400).send({
          error: "invalid_status",
          message: `Cannot publish from ${existing.status} status`,
        });
      }

      const slug = existing.publicSlug || await generateUniqueSlug(existing.headline);

      const updated = await prisma.breedingListing.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publicEnabled: true,
          publicSlug: slug,
          publicEnabledAt: new Date(),
        },
        include: listingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-discovery/listings/:id/pause
  app.post("/breeding-discovery/listings/:id/pause", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingListing.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      if (existing.status !== "PUBLISHED") {
        return reply.code(400).send({
          error: "invalid_status",
          message: "Can only pause published listings",
        });
      }

      const updated = await prisma.breedingListing.update({
        where: { id },
        data: {
          status: "PAUSED",
          pausedAt: new Date(),
          publicEnabled: false,
        },
        include: listingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-discovery/listings/:id/close
  app.post("/breeding-discovery/listings/:id/close", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingListing.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      if (existing.status === "CLOSED") {
        return reply.code(400).send({ error: "already_closed" });
      }

      const body = (req.body || {}) as any;
      const updated = await prisma.breedingListing.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedReason: body.reason ?? null,
          publicEnabled: false,
        },
        include: listingInclude,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-listings]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default breedingDiscoveryListingsRoutes;
