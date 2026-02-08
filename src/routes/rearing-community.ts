// src/routes/rearing-community.ts
// Rearing Protocols API - Community sharing and discovery
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q?.limit ?? "20", 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[rearing-community]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

// Include stages and activities in protocol response
const protocolInclude = {
  stages: {
    orderBy: { order: "asc" as const },
    include: {
      activities: {
        orderBy: { order: "asc" as const },
      },
    },
  },
};

/* ───────────────────────── routes ───────────────────────── */

const rearingCommunityRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-protocols/community - List public protocols (paginated)
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols/community", async (req, reply) => {
    try {
      const q = (req.query as any) ?? {};
      const { page, limit, skip } = parsePaging(q);

      // Filters
      const species = trimToNull(q.species);
      const search = trimToNull(q.search);
      const minRating = q.minRating ? Number(q.minRating) : null;
      const sortBy = q.sortBy || "rating"; // rating, usage, recent

      // Build where clause - exclude benchmark/system protocols
      const where: any = {
        isPublic: true,
        isActive: true,
        deletedAt: null,
        isBenchmark: false, // Only show breeder-shared protocols, not system benchmarks
      };

      if (species) {
        where.species = species;
      }
      if (minRating && minRating > 0) {
        where.rating = { gte: minRating };
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { breederName: { contains: search, mode: "insensitive" } },
        ];
      }

      // Build orderBy based on sortBy
      let orderBy: any;
      switch (sortBy) {
        case "usage":
          orderBy = [{ usageCount: "desc" }, { rating: "desc" }];
          break;
        case "recent":
          orderBy = [{ publishedAt: "desc" }];
          break;
        case "rating":
        default:
          orderBy = [{ rating: "desc" }, { ratingCount: "desc" }];
          break;
      }

      const [total, protocols] = await Promise.all([
        prisma.rearingProtocol.count({ where }),
        prisma.rearingProtocol.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: protocolInclude,
        }),
      ]);

      return reply.send({ protocols, total, page, limit });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-protocols/community/:id - Get community protocol detail
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols/community/:id", async (req, reply) => {
    try {
      const id = idNum((req.params as any).id);

      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const protocol = await prisma.rearingProtocol.findFirst({
        where: {
          id,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
        include: {
          ...protocolInclude,
          ratings: {
            select: {
              rating: true,
              review: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!protocol) {
        return reply.code(404).send({ error: "not_found" });
      }

      return reply.send(protocol);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/community/:id/copy - Copy to tenant
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/community/:id/copy", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;
      const newName = trimToNull(body.name);

      // Get source protocol (must be public)
      const source = await prisma.rearingProtocol.findFirst({
        where: {
          id,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
        include: protocolInclude,
      });

      if (!source) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Debug logging
      console.log("[rearing-community] Copying protocol:", source.id, source.name);
      console.log("[rearing-community] Source stages count:", source.stages?.length ?? 0);
      if (source.stages && source.stages.length > 0) {
        console.log("[rearing-community] First stage:", source.stages[0].name, "activities:", source.stages[0].activities?.length ?? 0);
      }

      // Create copy - only increment usage count for first copy by this tenant
      const copy = await prisma.$transaction(async (tx) => {
        // Check if this tenant has already copied this protocol (unique breeder tracking)
        const existingCopyRecord = await tx.protocolCopyRecord.findUnique({
          where: {
            protocolId_tenantId: {
              protocolId: id,
              tenantId,
            },
          },
        });

        // Only increment usage count if this is the FIRST copy by this tenant
        if (!existingCopyRecord) {
          // Create copy record for unique tracking
          await tx.protocolCopyRecord.create({
            data: {
              protocolId: id,
              tenantId,
            },
          });

          // Increment usage count (now represents unique breeders)
          await tx.rearingProtocol.update({
            where: { id },
            data: { usageCount: { increment: 1 } },
          });
        }

        // Step 1: Create the protocol (without nested stages)
        const newProtocol = await tx.rearingProtocol.create({
          data: {
            tenantId,
            name: newName ?? `${source.name} (Copied)`,
            description: source.description,
            species: source.species,
            targetAgeStart: source.targetAgeStart,
            targetAgeEnd: source.targetAgeEnd,
            estimatedDailyMinutes: source.estimatedDailyMinutes,
            parentProtocolId: source.id,
            // Preserve origin attribution - who originally shared this
            originBreederName: source.breederName,
            copiedAt: new Date(),
            isBenchmark: false,
            isPublic: false,
            isActive: true,
          },
        });

        // Step 2: Create stages with activities explicitly
        const sourceStages = source.stages || [];
        for (const stage of sourceStages) {
          const newStage = await tx.rearingProtocolStage.create({
            data: {
              protocolId: newProtocol.id,
              name: stage.name,
              description: stage.description,
              ageStartDays: stage.ageStartDays,
              ageEndDays: stage.ageEndDays,
              order: stage.order,
            },
          });

          // Step 3: Create activities for this stage
          const stageActivities = stage.activities || [];
          for (const activity of stageActivities) {
            await tx.rearingProtocolActivity.create({
              data: {
                stageId: newStage.id,
                name: activity.name,
                description: activity.description,
                instructions: activity.instructions,
                category: activity.category,
                frequency: activity.frequency,
                durationMinutes: activity.durationMinutes,
                isRequired: activity.isRequired,
                requiresEquipment: activity.requiresEquipment || [],
                order: activity.order,
                checklistItems: activity.checklistItems ?? undefined,
              },
            });
          }
        }

        // Step 4: Fetch the complete protocol with stages and activities
        const result = await tx.rearingProtocol.findUnique({
          where: { id: newProtocol.id },
          include: protocolInclude,
        });

        console.log("[rearing-community] Created protocol:", result?.id, "stages:", result?.stages?.length ?? 0);
        return result;
      });

      return reply.code(201).send(copy);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/community/:id/rate - Rate protocol
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/community/:id/rate", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;
      const rating = Number(body.rating);
      const review = trimToNull(body.review);

      if (isNaN(rating) || rating < 1 || rating > 5) {
        return reply.code(400).send({ error: "rating_must_be_1_to_5" });
      }

      // Verify protocol exists and is public
      const protocol = await prisma.rearingProtocol.findFirst({
        where: {
          id,
          isPublic: true,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!protocol) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Cannot rate own protocol
      if (protocol.tenantId === tenantId) {
        return reply.code(400).send({ error: "cannot_rate_own_protocol" });
      }

      // Upsert rating (one per tenant per protocol)
      await prisma.protocolRating.upsert({
        where: {
          protocolId_tenantId: { protocolId: id, tenantId },
        },
        create: {
          protocolId: id,
          tenantId,
          rating,
          review,
        },
        update: {
          rating,
          review,
        },
      });

      // Recalculate average rating
      const ratings = await prisma.protocolRating.findMany({
        where: { protocolId: id },
        select: { rating: true },
      });

      const avgRating = ratings.length > 0
        ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratings.length
        : 0;

      await prisma.rearingProtocol.update({
        where: { id },
        data: {
          rating: avgRating,
          ratingCount: ratings.length,
        },
      });

      return reply.send({
        rating: avgRating,
        ratingCount: ratings.length,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/:id/share - Publish to community
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/:id/share", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify ownership
      const existing = await prisma.rearingProtocol.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      if (existing.isBenchmark) {
        return reply.code(400).send({ error: "cannot_share_benchmark" });
      }

      if (existing.isPublic) {
        return reply.send({ success: true, alreadyShared: true });
      }

      // Get tenant name for breeder attribution
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      const updated = await prisma.rearingProtocol.update({
        where: { id },
        data: {
          isPublic: true,
          publishedAt: new Date(),
          breederName: tenant?.name ?? "Unknown Breeder",
        },
        include: protocolInclude,
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/:id/unshare - Remove from community
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/:id/unshare", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify ownership
      const existing = await prisma.rearingProtocol.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      if (!existing.isPublic) {
        return reply.send({ success: true, alreadyPrivate: true });
      }

      const updated = await prisma.rearingProtocol.update({
        where: { id },
        data: {
          isPublic: false,
          publishedAt: null,
        },
        include: protocolInclude,
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingCommunityRoutes;
