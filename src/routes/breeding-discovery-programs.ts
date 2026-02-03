// src/routes/breeding-discovery-programs.ts
// Breeding Discovery: Program CRUD

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { generateProgramNumber } from "../utils/breeding-discovery-numbers.js";
import {
  breedingDiscoveryProgramCreateSchema,
  breedingDiscoveryProgramUpdateSchema,
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

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.breedingDiscoveryProgram.findFirst({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

const breedingDiscoveryProgramsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /breeding-discovery/programs
  app.get("/breeding-discovery/programs", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const q = (req.query || {}) as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { tenantId };

      if (q.species) where.species = String(q.species).toUpperCase();
      if (q.status) where.status = String(q.status).toUpperCase();

      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await prisma.$transaction([
        prisma.breedingDiscoveryProgram.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            _count: { select: { listings: true } },
          },
        }),
        prisma.breedingDiscoveryProgram.count({ where }),
      ]);

      reply.send({ items, total, page, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-programs]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // POST /breeding-discovery/programs
  app.post("/breeding-discovery/programs", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const parsed = breedingDiscoveryProgramCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;
      const programNumber = await generateProgramNumber();
      const publicSlug = data.publicEnabled ? await generateUniqueSlug(data.name) : null;

      const program = await prisma.breedingDiscoveryProgram.create({
        data: {
          tenantId,
          programNumber,
          name: data.name,
          description: data.description ?? null,
          species: data.species as any,
          programType: data.programType,
          defaultBreedingMethods: data.defaultBreedingMethods ?? [],
          defaultGuaranteeType: data.defaultGuaranteeType ?? null,
          defaultGuaranteeTerms: data.defaultGuaranteeTerms ?? null,
          defaultRequiresHealthTesting: data.defaultRequiresHealthTesting ?? false,
          defaultRequiredTests: data.defaultRequiredTests ?? [],
          defaultRequiresContract: data.defaultRequiresContract ?? false,
          publicEnabled: data.publicEnabled ?? false,
          publicSlug,
          publicEnabledAt: data.publicEnabled ? new Date() : null,
          publicHeadline: data.publicHeadline ?? null,
          publicDescription: data.publicDescription ?? null,
          media: data.media ?? [],
          locationCity: data.locationCity ?? null,
          locationState: data.locationState ?? null,
          locationCountry: data.locationCountry ?? null,
        },
      });

      reply.code(201).send(program);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-programs]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // GET /breeding-discovery/programs/:id
  app.get("/breeding-discovery/programs/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const program = await prisma.breedingDiscoveryProgram.findFirst({
        where: { id, tenantId },
        include: {
          listings: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              listingNumber: true,
              headline: true,
              status: true,
              intent: true,
              species: true,
              breed: true,
              createdAt: true,
            },
          },
          _count: { select: { listings: true } },
        },
      });

      if (!program) return reply.code(404).send({ error: "not_found" });
      reply.send(program);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-programs]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // PUT /breeding-discovery/programs/:id
  app.put("/breeding-discovery/programs/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingDiscoveryProgram.findFirst({
        where: { id, tenantId },
        select: { id: true, publicSlug: true, publicEnabled: true, name: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const parsed = breedingDiscoveryProgramUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }

      const data = parsed.data;
      const updateData: any = {};

      // Map all provided fields
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) updateData[key] = value;
      }

      // Handle slug regeneration if name changes
      if (data.name && data.name !== existing.name && existing.publicEnabled) {
        updateData.publicSlug = await generateUniqueSlug(data.name);
      }

      // Handle publicEnabled transitions
      if (data.publicEnabled === true && !existing.publicEnabled) {
        updateData.publicEnabledAt = new Date();
        if (!updateData.publicSlug) {
          updateData.publicSlug = await generateUniqueSlug(data.name || existing.name);
        }
      }

      const updated = await prisma.breedingDiscoveryProgram.update({
        where: { id },
        data: updateData,
      });

      reply.send(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-programs]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });

  // DELETE /breeding-discovery/programs/:id
  app.delete("/breeding-discovery/programs/:id", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) return reply.code(401).send({ error: "unauthorized" });

      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingDiscoveryProgram.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const linkedListings = await prisma.breedingListing.count({
        where: { programId: id },
      });

      if (linkedListings > 0) {
        return reply.code(400).send({
          error: "program_has_listings",
          message: `Cannot delete program with ${linkedListings} linked listing(s). Remove or reassign them first.`,
        });
      }

      await prisma.breedingDiscoveryProgram.delete({ where: { id } });
      reply.code(204).send();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[breeding-discovery-programs]", msg);
      reply.code(500).send({ error: "internal_error", message: msg });
    }
  });
};

export default breedingDiscoveryProgramsRoutes;
