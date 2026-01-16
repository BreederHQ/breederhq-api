// src/routes/breeding-programs.ts
// CRUD endpoints for BreedingProgram (marketplace breeding programs)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { parseVerifiedSession, Surface } from "../utils/session.js";
import { deriveSurface } from "../middleware/actor-context.js";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(tenantId: number, baseName: string): Promise<string> {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.breedingProgram.findFirst({
      where: { tenantId, slug },
      select: { id: true },
    });
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

function resolveTenantIdFromRequest(req: any): number | null {
  const h = req.headers || {};
  const headerTenant =
    parseIntStrict(h["x-tenant-id"]) ??
    parseIntStrict(h["X-Tenant-Id"]) ??
    parseIntStrict(h["x-tenantid"]) ??
    null;
  if (headerTenant) return headerTenant;

  const surface = deriveSurface(req) as Surface;
  const sess = parseVerifiedSession(req, surface);
  if (sess?.tenantId) return sess.tenantId;

  const fromReq =
    parseIntStrict(req.tenantId) ??
    parseIntStrict(req.session?.tenantId) ??
    parseIntStrict(req.user?.tenantId) ??
    parseIntStrict(req.user?.defaultTenantId) ??
    null;
  if (fromReq) return fromReq;

  const memberships =
    req.user?.memberships ||
    req.user?.tenantMemberships ||
    req.session?.memberships ||
    [];
  if (Array.isArray(memberships) && memberships.length) {
    const scored = [...memberships].sort((a: any, b: any) => {
      const score = (m: any) =>
        (m?.isDefault || m?.default ? 3 : 0) +
        (m?.isPrimary ? 2 : 0) +
        (String(m?.role || "").toUpperCase() === "OWNER" ? 1 : 0);
      return score(b) - score(a);
    });
    for (const m of scored) {
      const t = parseIntStrict(m?.tenantId ?? m?.id);
      if (t) return t;
    }
  }

  return null;
}

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[breeding-programs]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

/* ───────── routes ───────── */

const breedingProgramsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Ensure tenant context on all requests
  app.addHook("preHandler", async (req, reply) => {
    let tenantId = parseIntStrict((req as any).tenantId);
    if (!tenantId) {
      tenantId = resolveTenantIdFromRequest(req);
      if (tenantId) (req as any).tenantId = tenantId;
    }
    if (!tenantId) {
      return reply
        .code(400)
        .send({ message: "Missing or invalid tenant context (X-Tenant-Id or session tenant)" });
    }
  });

  /* ───────── List Programs ───────── */
  app.get("/breeding/programs", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const q = (req.query || {}) as any;
      const { page, limit, skip } = parsePaging(q);

      const where: any = { tenantId };

      // Filter by species
      if (q.species) {
        where.species = String(q.species).toUpperCase();
      }

      // Filter by listed status
      if (q.listed === "true") where.listed = true;
      if (q.listed === "false") where.listed = false;

      // Search
      const search = String(q.q || "").trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { breedText: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [programs, total] = await prisma.$transaction([
        prisma.breedingProgram.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            breedingPlans: {
              select: {
                id: true,
                name: true,
                status: true,
                expectedBirthDate: true,
                birthDateActual: true,
                offspringGroup: {
                  select: {
                    id: true,
                    expectedBirthOn: true,
                    actualBirthOn: true,
                    countBorn: true,
                    countLive: true,
                    countPlaced: true,
                    published: true,
                    _count: {
                      select: { Offspring: true },
                    },
                  },
                },
              },
            },
            _count: {
              select: { breedingPlans: true },
            },
          },
        }),
        prisma.breedingProgram.count({ where }),
      ]);

      // Compute summary stats for each program
      const items = programs.map((program) => {
        const plans = program.breedingPlans || [];
        const allGroups = plans.flatMap((p) => p.offspringGroup ? [p.offspringGroup] : []);

        // Count active plans (not completed/cancelled)
        const activePlans = plans.filter((p) =>
          p.status && !["COMPLETED", "CANCELLED", "ARCHIVED"].includes(String(p.status).toUpperCase())
        );

        // Find upcoming litters (expected birth in the future)
        const now = new Date();
        const upcomingLitters = allGroups.filter((g) => {
          const expected = g.expectedBirthOn ? new Date(g.expectedBirthOn) : null;
          return expected && expected > now && !g.actualBirthOn;
        });

        // Find next expected birth date
        const nextExpectedBirth = upcomingLitters
          .map((g) => g.expectedBirthOn)
          .filter(Boolean)
          .sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())[0] || null;

        // Count available offspring (born but not all placed)
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

        // Remove the full breedingPlans array from response (too verbose)
        const { breedingPlans: _, ...programData } = program;

        return {
          ...programData,
          summary: {
            totalPlans: plans.length,
            activePlans: activePlans.length,
            totalLitters: allGroups.length,
            upcomingLitters: upcomingLitters.length,
            nextExpectedBirth,
            availableLitters: availableLitters.length,
            totalAvailable,
          },
        };
      });

      reply.send({ items, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Get Single Program ───────── */
  app.get("/breeding/programs/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const program = await prisma.breedingProgram.findFirst({
        where: { id, tenantId },
        include: {
          media: {
            orderBy: { sortOrder: "asc" },
          },
          breedingPlans: {
            select: {
              id: true,
              name: true,
              status: true,
              expectedBirthDate: true,
              birthDateActual: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          _count: {
            select: { breedingPlans: true },
          },
        },
      });

      if (!program) return reply.code(404).send({ error: "not_found" });
      reply.send(program);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Create Program ───────── */
  app.post("/breeding/programs", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const b = (req.body || {}) as any;

      const name = String(b.name || "").trim();
      if (!name) return reply.code(400).send({ error: "name_required" });

      if (!b.species) return reply.code(400).send({ error: "species_required" });
      const species = String(b.species).toUpperCase();
      const validSpecies = ["DOG", "CAT", "HORSE", "GOAT", "SHEEP", "RABBIT"];
      if (!validSpecies.includes(species)) {
        return reply.code(400).send({ error: "invalid_species" });
      }

      // Generate unique slug
      const slug = await generateUniqueSlug(tenantId, name);

      // Check for soft duplicate (same breed) and warn
      const breedText = String(b.breedText || "").trim() || null;
      if (breedText) {
        const existingWithBreed = await prisma.breedingProgram.findFirst({
          where: {
            tenantId,
            breedText: { equals: breedText, mode: "insensitive" },
          },
          select: { id: true, name: true },
        });
        // We don't block, but could return a warning in response
      }

      const program = await prisma.breedingProgram.create({
        data: {
          tenantId,
          slug,
          name,
          description: b.description ?? null,
          programStory: b.programStory ?? null,
          species: species as any,
          breedText,
          breedId: b.breedId ?? null,
          coverImageUrl: b.coverImageUrl ?? null,
          showCoverImage: b.showCoverImage ?? true,
          listed: b.listed ?? false,
          acceptInquiries: b.acceptInquiries ?? true,
          openWaitlist: b.openWaitlist ?? false,
          acceptReservations: b.acceptReservations ?? false,
          comingSoon: b.comingSoon ?? false,
          pricingTiers: b.pricingTiers ?? null,
          whatsIncluded: b.whatsIncluded ?? null,
          showWhatsIncluded: b.showWhatsIncluded ?? true,
          typicalWaitTime: b.typicalWaitTime ?? null,
          showWaitTime: b.showWaitTime ?? true,
        },
      });

      reply.code(201).send(program);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Update Program ───────── */
  app.put("/breeding/programs/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingProgram.findFirst({
        where: { id, tenantId },
        select: { id: true, slug: true, name: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};

      if (b.name !== undefined) {
        const name = String(b.name || "").trim();
        if (!name) return reply.code(400).send({ error: "name_required" });
        data.name = name;
        // Regenerate slug if name changed
        if (name !== existing.name) {
          data.slug = await generateUniqueSlug(tenantId, name);
        }
      }

      if (b.description !== undefined) data.description = b.description;
      if (b.programStory !== undefined) data.programStory = b.programStory;
      if (b.breedText !== undefined) data.breedText = b.breedText;
      if (b.breedId !== undefined) data.breedId = b.breedId;
      if (b.coverImageUrl !== undefined) data.coverImageUrl = b.coverImageUrl;
      if (b.showCoverImage !== undefined) data.showCoverImage = Boolean(b.showCoverImage);
      if (b.listed !== undefined) {
        data.listed = Boolean(b.listed);
        // Set publishedAt when first published
        if (b.listed && !data.publishedAt) {
          const current = await prisma.breedingProgram.findFirst({
            where: { id, tenantId },
            select: { publishedAt: true },
          });
          if (!current?.publishedAt) {
            data.publishedAt = new Date();
          }
        }
      }
      if (b.acceptInquiries !== undefined) data.acceptInquiries = Boolean(b.acceptInquiries);
      if (b.openWaitlist !== undefined) data.openWaitlist = Boolean(b.openWaitlist);
      if (b.acceptReservations !== undefined) data.acceptReservations = Boolean(b.acceptReservations);
      if (b.comingSoon !== undefined) data.comingSoon = Boolean(b.comingSoon);
      if (b.pricingTiers !== undefined) data.pricingTiers = b.pricingTiers;
      if (b.whatsIncluded !== undefined) data.whatsIncluded = b.whatsIncluded;
      if (b.showWhatsIncluded !== undefined) data.showWhatsIncluded = Boolean(b.showWhatsIncluded);
      if (b.typicalWaitTime !== undefined) data.typicalWaitTime = b.typicalWaitTime;
      if (b.showWaitTime !== undefined) data.showWaitTime = Boolean(b.showWaitTime);

      const updated = await prisma.breedingProgram.update({
        where: { id },
        data,
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Delete Program ───────── */
  app.delete("/breeding/programs/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = parseIntStrict((req.params as any).id);
      if (!id) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingProgram.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      // Check if there are breeding plans linked to this program
      const linkedPlans = await prisma.breedingPlan.count({
        where: { programId: id, tenantId },
      });

      if (linkedPlans > 0) {
        return reply.code(400).send({
          error: "program_has_plans",
          message: `Cannot delete program with ${linkedPlans} linked breeding plan(s). Reassign or delete the plans first.`,
        });
      }

      await prisma.breedingProgram.delete({ where: { id } });

      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  /* ───────── Program Media ───────── */

  // List media for a program
  app.get("/breeding/programs/:id/media", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const programId = parseIntStrict((req.params as any).id);
      if (!programId) return reply.code(400).send({ error: "bad_id" });

      // Verify program belongs to tenant
      const program = await prisma.breedingProgram.findFirst({
        where: { id: programId, tenantId },
        select: { id: true },
      });
      if (!program) return reply.code(404).send({ error: "program_not_found" });

      const media = await prisma.breedingProgramMedia.findMany({
        where: { programId, tenantId },
        orderBy: { sortOrder: "asc" },
      });

      reply.send({ items: media });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // Add media to program
  app.post("/breeding/programs/:id/media", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const programId = parseIntStrict((req.params as any).id);
      if (!programId) return reply.code(400).send({ error: "bad_id" });

      // Verify program belongs to tenant
      const program = await prisma.breedingProgram.findFirst({
        where: { id: programId, tenantId },
        select: { id: true },
      });
      if (!program) return reply.code(404).send({ error: "program_not_found" });

      const b = (req.body || {}) as any;
      if (!b.assetUrl) return reply.code(400).send({ error: "assetUrl_required" });

      // Get max sortOrder
      const maxSort = await prisma.breedingProgramMedia.aggregate({
        where: { programId, tenantId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      const media = await prisma.breedingProgramMedia.create({
        data: {
          programId,
          tenantId,
          assetUrl: b.assetUrl,
          caption: b.caption ?? null,
          sortOrder: b.sortOrder ?? nextSortOrder,
          isPublic: b.isPublic ?? true,
        },
      });

      reply.code(201).send(media);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // Update media item
  app.put("/breeding/programs/:programId/media/:mediaId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const programId = parseIntStrict((req.params as any).programId);
      const mediaId = parseIntStrict((req.params as any).mediaId);
      if (!programId || !mediaId) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingProgramMedia.findFirst({
        where: { id: mediaId, programId, tenantId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      const b = (req.body || {}) as any;
      const data: any = {};

      if (b.assetUrl !== undefined) data.assetUrl = b.assetUrl;
      if (b.caption !== undefined) data.caption = b.caption;
      if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder);
      if (b.isPublic !== undefined) data.isPublic = Boolean(b.isPublic);

      const updated = await prisma.breedingProgramMedia.update({
        where: { id: mediaId },
        data,
      });

      reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // Delete media item
  app.delete("/breeding/programs/:programId/media/:mediaId", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const programId = parseIntStrict((req.params as any).programId);
      const mediaId = parseIntStrict((req.params as any).mediaId);
      if (!programId || !mediaId) return reply.code(400).send({ error: "bad_id" });

      const existing = await prisma.breedingProgramMedia.findFirst({
        where: { id: mediaId, programId, tenantId },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send({ error: "not_found" });

      await prisma.breedingProgramMedia.delete({ where: { id: mediaId } });

      reply.code(204).send();
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });

  // Reorder media items
  app.post("/breeding/programs/:id/media/reorder", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const programId = parseIntStrict((req.params as any).id);
      if (!programId) return reply.code(400).send({ error: "bad_id" });

      const program = await prisma.breedingProgram.findFirst({
        where: { id: programId, tenantId },
        select: { id: true },
      });
      if (!program) return reply.code(404).send({ error: "program_not_found" });

      const b = (req.body || {}) as any;
      if (!Array.isArray(b.order)) {
        return reply.code(400).send({ error: "order_array_required" });
      }

      // b.order is array of media IDs in desired order
      const updates = b.order.map((mediaId: number, index: number) =>
        prisma.breedingProgramMedia.updateMany({
          where: { id: mediaId, programId, tenantId },
          data: { sortOrder: index },
        })
      );

      await prisma.$transaction(updates);

      reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      reply.status(status).send(payload);
    }
  });
};

export default breedingProgramsRoutes;
