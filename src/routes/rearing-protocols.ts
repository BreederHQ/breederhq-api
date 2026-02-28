// src/routes/rearing-protocols.ts
// Rearing Protocols API - Protocol template CRUD
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function parsePaging(q: any) {
  const page = Math.max(1, parseInt(q?.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q?.limit ?? "25", 10) || 25));
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
  console.error("[rearing-protocols]", msg);
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

const rearingProtocolsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-protocols - List protocols (tenant + benchmarks)
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const q = (req.query as any) ?? {};
      const { page, limit, skip } = parsePaging(q);

      // Filters
      const species = trimToNull(q.species)?.toUpperCase();
      const activeOnly = q.active === "true" || q.active === true;

      // Build where clause: (tenantId OR benchmark) AND optional filters
      const where: any = {
        OR: [
          { tenantId, deletedAt: null },
          { isBenchmark: true, tenantId: null },
        ],
      };

      if (species) {
        where.species = species;
      }
      if (activeOnly) {
        where.isActive = true;
      }

      const [total, protocols] = await Promise.all([
        prisma.rearingProtocol.count({ where }),
        prisma.rearingProtocol.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ isBenchmark: "desc" }, { name: "asc" }],
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
  // GET /rearing-protocols/benchmarks - List benchmark protocols only
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols/benchmarks", async (req, reply) => {
    try {
      const q = (req.query as any) ?? {};
      const species = trimToNull(q.species);

      const where: any = {
        isBenchmark: true,
        tenantId: null,
        isActive: true,
      };

      if (species) {
        where.species = species;
      }

      const protocols = await prisma.rearingProtocol.findMany({
        where,
        orderBy: [{ species: "asc" }, { name: "asc" }],
        include: protocolInclude,
      });

      return reply.send({ protocols });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-protocols/:id - Get single protocol with stages/activities
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-protocols/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Allow access to own protocols OR benchmarks
      const protocol = await prisma.rearingProtocol.findFirst({
        where: {
          id,
          OR: [
            { tenantId, deletedAt: null },
            { isBenchmark: true, tenantId: null },
          ],
        },
        include: protocolInclude,
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
  // POST /rearing-protocols - Create custom protocol
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const body = req.body as any;

      // Validate required fields
      const name = trimToNull(body.name);
      const species = trimToNull(body.species);
      const targetAgeStart = Number(body.targetAgeStart);
      const targetAgeEnd = Number(body.targetAgeEnd);

      if (!name) {
        return reply.code(400).send({ error: "name_required" });
      }
      if (!species) {
        return reply.code(400).send({ error: "species_required" });
      }
      if (isNaN(targetAgeStart) || isNaN(targetAgeEnd)) {
        return reply.code(400).send({ error: "age_range_required" });
      }

      const protocol = await prisma.rearingProtocol.create({
        data: {
          tenantId,
          name,
          description: trimToNull(body.description),
          species: species as any,
          targetAgeStart,
          targetAgeEnd,
          estimatedDailyMinutes: body.estimatedDailyMinutes
            ? Number(body.estimatedDailyMinutes)
            : null,
          isBenchmark: false,
          isPublic: false,
          isActive: true,
          // Create nested stages and activities if provided
          stages: body.stages
            ? {
                create: (body.stages as any[]).map((stage: any, si: number) => ({
                  name: stage.name,
                  description: trimToNull(stage.description),
                  ageStartDays: Number(stage.ageStartDays),
                  ageEndDays: Number(stage.ageEndDays),
                  order: stage.order ?? si,
                  activities: stage.activities
                    ? {
                        create: (stage.activities as any[]).map(
                          (activity: any, ai: number) => ({
                            name: activity.name,
                            description: trimToNull(activity.description),
                            instructions: trimToNull(activity.instructions),
                            category: activity.category,
                            frequency: activity.frequency,
                            durationMinutes: activity.durationMinutes
                              ? Number(activity.durationMinutes)
                              : null,
                            isRequired: activity.isRequired ?? true,
                            requiresEquipment: activity.requiresEquipment ?? [],
                            order: activity.order ?? ai,
                            checklistItems: activity.checklistItems ?? null,
                          })
                        ),
                      }
                    : undefined,
                })),
              }
            : undefined,
        },
        include: protocolInclude,
      });

      return reply.code(201).send(protocol);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /rearing-protocols/:id - Update protocol (increments version)
  // ─────────────────────────────────────────────────────────────────────────────
  app.put("/rearing-protocols/:id", async (req, reply) => {
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

      // Verify ownership
      const existing = await prisma.rearingProtocol.findFirst({
        where: { id, tenantId, deletedAt: null },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Cannot edit benchmark protocols
      if (existing.isBenchmark) {
        return reply.code(403).send({ error: "cannot_edit_benchmark" });
      }

      // Update protocol with version increment
      const protocol = await prisma.$transaction(async (tx) => {
        // Only delete existing stages if new stages are provided
        // This allows partial updates (e.g., just renaming) without losing stages
        if (body.stages) {
          await tx.rearingProtocolStage.deleteMany({
            where: { protocolId: id },
          });
        }

        // Update protocol (only recreate stages if body.stages is provided)
        return tx.rearingProtocol.update({
          where: { id },
          data: {
            name: trimToNull(body.name) ?? existing.name,
            description: trimToNull(body.description),
            species: body.species ?? existing.species,
            targetAgeStart:
              body.targetAgeStart !== undefined
                ? Number(body.targetAgeStart)
                : existing.targetAgeStart,
            targetAgeEnd:
              body.targetAgeEnd !== undefined
                ? Number(body.targetAgeEnd)
                : existing.targetAgeEnd,
            estimatedDailyMinutes:
              body.estimatedDailyMinutes !== undefined
                ? Number(body.estimatedDailyMinutes)
                : existing.estimatedDailyMinutes,
            isActive: body.isActive ?? existing.isActive,
            version: existing.version + 1,
            // Recreate stages
            stages: body.stages
              ? {
                  create: (body.stages as any[]).map((stage: any, si: number) => ({
                    name: stage.name,
                    description: trimToNull(stage.description),
                    ageStartDays: Number(stage.ageStartDays),
                    ageEndDays: Number(stage.ageEndDays),
                    order: stage.order ?? si,
                    activities: stage.activities
                      ? {
                          create: (stage.activities as any[]).map(
                            (activity: any, ai: number) => ({
                              name: activity.name,
                              description: trimToNull(activity.description),
                              instructions: trimToNull(activity.instructions),
                              category: activity.category,
                              frequency: activity.frequency,
                              durationMinutes: activity.durationMinutes
                                ? Number(activity.durationMinutes)
                                : null,
                              isRequired: activity.isRequired ?? true,
                              requiresEquipment: activity.requiresEquipment ?? [],
                              order: activity.order ?? ai,
                              checklistItems: activity.checklistItems ?? null,
                            })
                          ),
                        }
                      : undefined,
                  })),
                }
              : undefined,
          },
          include: protocolInclude,
        });
      });

      return reply.send(protocol);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-protocols/:id - Soft delete protocol
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-protocols/:id", async (req, reply) => {
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

      // Cannot delete benchmark protocols
      if (existing.isBenchmark) {
        return reply.code(403).send({ error: "cannot_delete_benchmark" });
      }

      // Soft delete
      await prisma.rearingProtocol.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-protocols/:id/duplicate - Clone protocol
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-protocols/:id/duplicate", async (req, reply) => {
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

      // Get source protocol (own or benchmark)
      const source = await prisma.rearingProtocol.findFirst({
        where: {
          id,
          OR: [
            { tenantId, deletedAt: null },
            { isBenchmark: true, tenantId: null },
          ],
        },
        include: protocolInclude,
      });

      if (!source) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Create duplicate
      const duplicate = await prisma.rearingProtocol.create({
        data: {
          tenantId,
          name: newName ?? `${source.name} (Copy)`,
          description: source.description,
          species: source.species,
          targetAgeStart: source.targetAgeStart,
          targetAgeEnd: source.targetAgeEnd,
          estimatedDailyMinutes: source.estimatedDailyMinutes,
          parentProtocolId: source.id,
          isBenchmark: false,
          isPublic: false,
          isActive: true,
          stages: {
            create: source.stages.map((stage: any) => ({
              name: stage.name,
              description: stage.description,
              ageStartDays: stage.ageStartDays,
              ageEndDays: stage.ageEndDays,
              order: stage.order,
              activities: {
                create: stage.activities.map((activity: any) => ({
                  name: activity.name,
                  description: activity.description,
                  instructions: activity.instructions,
                  category: activity.category,
                  frequency: activity.frequency,
                  durationMinutes: activity.durationMinutes,
                  isRequired: activity.isRequired,
                  requiresEquipment: activity.requiresEquipment,
                  order: activity.order,
                  checklistItems: activity.checklistItems,
                })),
              },
            })),
          },
        },
        include: protocolInclude,
      });

      return reply.code(201).send(duplicate);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingProtocolsRoutes;
