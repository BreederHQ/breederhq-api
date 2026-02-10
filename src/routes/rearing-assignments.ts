// src/routes/rearing-assignments.ts
// Rearing Protocols API - Protocol assignments to offspring groups
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
  console.error("[rearing-assignments]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

// Map frontend string IDs to benchmark protocol names in the database
const BENCHMARK_STRING_ID_TO_NAME: Record<string, string> = {
  benchmark_ens: "Early Neurological Stimulation (ENS)",
  benchmark_esi: "Early Scent Introduction (ESI)",
  benchmark_rule_of_7s: "Rule of 7s Socialization",
  benchmark_handling: "Handling Protocol",
  benchmark_sound: "Sound Desensitization",
  benchmark_crate: "Crate Training Introduction",
  benchmark_cat_socialization: "Kitten Socialization Program",
  benchmark_cat_litter: "Litter Training Basics",
  benchmark_horse_imprint: "Foal Imprinting Protocol",
  benchmark_horse_halter: "Halter Training Basics",
  benchmark_goat_handling: "Kid Handling Protocol",
  benchmark_goat_bottle: "Bottle Feeding Protocol",
};

// Include protocol details in assignment response
const assignmentInclude = {
  protocol: {
    include: {
      stages: {
        orderBy: { order: "asc" as const },
        include: {
          activities: {
            orderBy: { order: "asc" as const },
          },
        },
      },
    },
  },
  offspringGroup: {
    select: {
      id: true,
      name: true,
      species: true,
      actualBirthOn: true,
      expectedBirthOn: true,
    },
  },
};

/* ───────────────────────── routes ───────────────────────── */

const rearingAssignmentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /offspring-groups/:groupId/rearing-assignments - List assignments for group
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/offspring-groups/:groupId/rearing-assignments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = idNum((req.params as any).groupId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!groupId) {
        return reply.code(400).send({ error: "invalid_group_id" });
      }

      // Verify group belongs to tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
      });

      if (!group) {
        return reply.code(404).send({ error: "group_not_found" });
      }

      const assignments = await prisma.rearingProtocolAssignment.findMany({
        where: { offspringGroupId: groupId, tenantId },
        include: assignmentInclude,
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ assignments });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /offspring-groups/:groupId/rearing-assignments - Assign protocol to group
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/offspring-groups/:groupId/rearing-assignments", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const groupId = idNum((req.params as any).groupId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!groupId) {
        return reply.code(400).send({ error: "invalid_group_id" });
      }

      const body = req.body as any;
      // Support both camelCase (protocolId) and snake_case (protocol_id)
      const rawProtocolId = body.protocolId ?? body.protocol_id;

      if (!rawProtocolId) {
        return reply.code(400).send({ error: "protocol_id_required" });
      }

      // Handle both numeric IDs (custom protocols) and string IDs (benchmark protocols)
      let protocolId: number | null = null;
      let benchmarkStringId: string | null = null;

      if (typeof rawProtocolId === "number") {
        protocolId = rawProtocolId > 0 ? rawProtocolId : null;
      } else if (typeof rawProtocolId === "string") {
        // Try to parse as number first
        const numId = parseInt(rawProtocolId, 10);
        if (!isNaN(numId) && numId > 0) {
          protocolId = numId;
        } else {
          // It's a string ID (benchmark protocol like "benchmark_rule_of_7s")
          benchmarkStringId = rawProtocolId;
        }
      }

      if (!protocolId && !benchmarkStringId) {
        return reply.code(400).send({ error: "invalid_protocol_id" });
      }

      // Verify group belongs to tenant
      const group = await prisma.offspringGroup.findFirst({
        where: { id: groupId, tenantId, deletedAt: null },
      });

      if (!group) {
        return reply.code(404).send({ error: "group_not_found" });
      }

      // Get protocol (own or benchmark)
      // For benchmark protocols, we look up by name using the string ID mapping
      // For custom protocols, we look up by numeric ID
      let protocolWhere;
      if (benchmarkStringId) {
        const benchmarkName = BENCHMARK_STRING_ID_TO_NAME[benchmarkStringId];
        if (!benchmarkName) {
          return reply.code(400).send({ error: "unknown_benchmark_protocol" });
        }
        protocolWhere = {
          name: benchmarkName,
          isBenchmark: true,
          tenantId: null,
        };
      } else {
        protocolWhere = {
          id: protocolId!,
          OR: [
            { tenantId, deletedAt: null },
            { isBenchmark: true, tenantId: null },
          ],
        };
      }

      const protocol = await prisma.rearingProtocol.findFirst({
        where: protocolWhere,
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              activities: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      if (!protocol) {
        return reply.code(404).send({ error: "protocol_not_found" });
      }

      // Check for existing assignment (use protocol.id which is always the numeric id)
      const existingAssignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { offspringGroupId: groupId, protocolId: protocol.id },
      });

      if (existingAssignment) {
        return reply.code(409).send({ error: "protocol_already_assigned" });
      }

      // Calculate total activities
      const totalActivities = protocol.stages.reduce(
        (sum: number, stage: { activities: unknown[] }) => sum + stage.activities.length,
        0
      );

      // Create assignment with protocol snapshot
      const assignment = await prisma.$transaction(async (tx) => {
        // Increment usage count for non-benchmarks
        if (!protocol.isBenchmark) {
          await tx.rearingProtocol.update({
            where: { id: protocol.id },
            data: { usageCount: { increment: 1 } },
          });
        }

        // Support both camelCase and snake_case for startDate
        const startDateRaw = body.startDate ?? body.start_date;

        return tx.rearingProtocolAssignment.create({
          data: {
            tenantId,
            offspringGroupId: groupId,
            protocolId: protocol.id,
            protocolVersion: protocol.version,
            protocolSnapshot: protocol as any, // Store full protocol JSON
            startDate: startDateRaw ? new Date(startDateRaw) : new Date(),
            status: "ACTIVE",
            totalActivities,
            notes: trimToNull(body.notes),
          },
          include: assignmentInclude,
        });
      });

      return reply.code(201).send(assignment);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-assignments/:id - Get single assignment with protocol
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-assignments/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id, tenantId },
        include: {
          ...assignmentInclude,
          completions: {
            orderBy: { completedAt: "desc" },
            take: 100,
          },
          exceptions: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Check for available upgrade
      let availableUpgrade = null;
      if (assignment.protocol && assignment.protocolVersion < assignment.protocol.version) {
        availableUpgrade = assignment.protocol.version;
      }

      return reply.send({
        ...assignment,
        availableUpgrade,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-assignments/:id - Remove assignment
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-assignments/:id", async (req, reply) => {
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
      const existing = await prisma.rearingProtocolAssignment.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Delete assignment (cascades to completions, exceptions, etc.)
      await prisma.rearingProtocolAssignment.delete({
        where: { id },
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/acknowledge-disclaimer - Acknowledge disclaimer
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/acknowledge-disclaimer", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const userId = (req as any).userId as string;
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify ownership
      const existing = await prisma.rearingProtocolAssignment.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      if (existing.acknowledgedDisclaimer) {
        return reply.send({ success: true, alreadyAcknowledged: true });
      }

      const updated = await prisma.rearingProtocolAssignment.update({
        where: { id },
        data: {
          acknowledgedDisclaimer: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
        },
        include: assignmentInclude,
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/upgrade - Upgrade to latest protocol version
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/upgrade", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Get current assignment
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id, tenantId },
        include: { protocol: { include: { stages: { include: { activities: true } } } } },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Check if upgrade is available
      if (
        !assignment.protocol ||
        assignment.protocolVersion >= assignment.protocol.version
      ) {
        return reply.code(400).send({ error: "no_upgrade_available" });
      }

      // Calculate new total activities
      const totalActivities = assignment.protocol.stages.reduce(
        (sum: number, stage: { activities: unknown[] }) => sum + stage.activities.length,
        0
      );

      // Update assignment with new protocol snapshot
      const updated = await prisma.rearingProtocolAssignment.update({
        where: { id },
        data: {
          protocolVersion: assignment.protocol.version,
          protocolSnapshot: assignment.protocol as any,
          totalActivities,
          availableUpgrade: null,
        },
        include: assignmentInclude,
      });

      return reply.send(updated);
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingAssignmentsRoutes;
