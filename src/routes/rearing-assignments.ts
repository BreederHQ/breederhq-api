// src/routes/rearing-assignments.ts
// Rearing Protocols API - Protocol assignments to breeding plans
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
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

// Map frontend string IDs to benchmark protocol names in the database.
// IMPORTANT: These names MUST exactly match what the seed script inserts
// (seed-rearing-benchmarks.ts) and the frontend config (rearing-protocols.config.ts).
const BENCHMARK_STRING_ID_TO_NAME: Record<string, string> = {
  // Dogs
  benchmark_ens: "Early Neurological Stimulation (ENS)",
  benchmark_esi: "Early Scent Introduction (ESI)",
  benchmark_rule_of_7s: "Rule of 7s Socialization",
  benchmark_handling: "Handling Habituation",
  benchmark_sound: "Sound Desensitization",
  benchmark_crate: "Crate Introduction",
  benchmark_gun_conditioning: "Gun Conditioning for Hunting Dogs",
  benchmark_kvs_gundog: "BreederHQ Gun Dog Development Protocol",
  // NOTE: Volhard PAT removed — assessments are now a first-class offspring feature
  // Cats
  benchmark_cat_socialization: "Kitten Socialization",
  benchmark_cat_litter: "Litter Training",
  // Horses
  benchmark_horse_imprint: "Foal Imprint Training",
  benchmark_horse_halter: "Early Halter Training",
  // Goats/Sheep
  benchmark_goat_handling: "Kid/Lamb Handling",
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
  BreedingPlan: {
    select: {
      id: true,
      name: true,
      species: true,
      birthDateActual: true,
      expectedBirthDate: true,
      tenant: {
        select: { name: true },
      },
    },
  },
};

/* ───────────────────────── routes ───────────────────────── */

const rearingAssignmentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /plans/:planId/rearing-assignments - List assignments for a breeding plan
  // ─────────────────────────────────────────────────────────────────────────────
  async function planRearingAssignmentsGet(req: any, reply: any) {
    try {
      const tenantId = Number(req.tenantId);
      const planId = idNum(req.params.planId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!planId) {
        return reply.code(400).send({ error: "invalid_plan_id" });
      }

      // Verify breedingPlan belongs to tenant
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId },
      });

      if (!plan) {
        return reply.code(404).send({ error: "plan_not_found" });
      }

      const assignments = await prisma.rearingProtocolAssignment.findMany({
        where: { breedingPlanId: planId, tenantId },
        include: assignmentInclude,
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ assignments });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  }

  app.get("/plans/:planId/rearing-assignments", planRearingAssignmentsGet);

  // Deprecated alias — remove after frontend migrates
  app.get("/offspring-groups/:groupId/rearing-assignments", async (req, reply) => {
    (req.params as any).planId = (req.params as any).groupId;
    return planRearingAssignmentsGet(req, reply);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /plans/:planId/rearing-assignments - Assign protocol to a breeding plan
  // ─────────────────────────────────────────────────────────────────────────────
  async function planRearingAssignmentsPost(req: any, reply: any) {
    try {
      const tenantId = Number(req.tenantId);
      const planId = idNum(req.params.planId);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!planId) {
        return reply.code(400).send({ error: "invalid_plan_id" });
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

      // Verify breedingPlan belongs to tenant
      const plan = await prisma.breedingPlan.findFirst({
        where: { id: planId, tenantId },
      });

      if (!plan) {
        return reply.code(404).send({ error: "plan_not_found" });
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
        where: { breedingPlanId: planId, protocolId: protocol.id },
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
            breedingPlanId: planId,
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
  }

  app.post("/plans/:planId/rearing-assignments", planRearingAssignmentsPost);

  // Deprecated alias — remove after frontend migrates
  app.post("/offspring-groups/:groupId/rearing-assignments", async (req, reply) => {
    (req.params as any).planId = (req.params as any).groupId;
    return planRearingAssignmentsPost(req, reply);
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
  // POST /rearing-assignments/:id/handoff - Hand off protocol to buyer (Client Portal)
  // Used when a puppy is placed and the buyer continues Stages 4-8 via Portal
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/handoff", async (req, reply) => {
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

      const body = req.body as any;
      const offspringId = idNum(body.offspringId);
      const buyerUserId = trimToNull(body.buyerUserId);
      const handoffFromStage = idNum(body.handoffFromStage) ?? 3; // Default to stage 3
      const handoffNotes = trimToNull(body.notes);
      const generateCertificate = body.generateCertificate !== false; // Default true

      if (!offspringId) {
        return reply.code(400).send({ error: "offspring_id_required" });
      }

      // Get assignment with completions and protocol
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id, tenantId },
        include: {
          protocol: {
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
          },
          BreedingPlan: {
            include: {
              tenant: {
                select: { name: true },
              },
            },
          },
          completions: {
            where: { offspringId },
            orderBy: { completedAt: "asc" },
          },
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Check if already handed off
      if (assignment.handoffToUserId) {
        return reply.code(409).send({
          error: "already_handed_off",
          handoffAt: assignment.handoffAt,
          handoffToUserId: assignment.handoffToUserId,
        });
      }

      // Verify offspring belongs to the assignment's breeding plan
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, breedingPlanId: assignment.breedingPlanId!, tenantId },
        include: {
          buyerParty: {
            include: {
              portalInvites: {
                where: { usedAt: { not: null } },
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "offspring_not_found" });
      }

      // Determine buyer user ID
      let resolvedBuyerUserId = buyerUserId;
      if (!resolvedBuyerUserId && offspring.buyerParty?.portalInvites?.length) {
        // Get the user ID from accepted portal invite
        resolvedBuyerUserId = offspring.buyerParty.portalInvites[0].userId ?? null;
      }

      if (!resolvedBuyerUserId) {
        return reply.code(400).send({
          error: "buyer_user_required",
          message: "No buyer user found. Ensure the buyer has accepted their portal invite, or provide buyerUserId.",
        });
      }

      // Build progress snapshot
      const completionsByActivity: Record<string, any> = {};
      for (const completion of assignment.completions) {
        completionsByActivity[completion.activityId] = {
          completedAt: completion.completedAt,
          completedBy: completion.completedBy,
          notes: completion.notes,
        };
      }

      const handoffSnapshot = {
        handoffAt: new Date().toISOString(),
        breederPhaseComplete: true,
        stagesCompleted: handoffFromStage,
        completions: completionsByActivity,
        protocol: {
          id: assignment.protocol?.id,
          name: assignment.protocol?.name,
          version: assignment.protocolVersion,
        },
      };

      // Create handoff in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create individual offspring assignment for portal continuation
        const offspringAssignment = await tx.rearingProtocolAssignment.create({
          data: {
            tenantId,
            offspringId,
            protocolId: assignment.protocolId,
            protocolVersion: assignment.protocolVersion,
            protocolSnapshot: assignment.protocolSnapshot ?? Prisma.DbNull,
            startDate: assignment.startDate,
            status: "ACTIVE",
            totalActivities: assignment.totalActivities,
            completedActivities: assignment.completions.length,
            handoffToUserId: resolvedBuyerUserId,
            handoffAt: new Date(),
            handoffFromStage,
            handoffByUserId: userId,
            handoffNotes,
            handoffSnapshot,
          },
        });

        // Copy completions to the new offspring-level assignment
        if (assignment.completions.length > 0) {
          await tx.activityCompletion.createMany({
            data: assignment.completions.map((c) => ({
              tenantId,
              assignmentId: offspringAssignment.id,
              activityId: c.activityId,
              scope: c.scope,
              offspringId: c.offspringId,
              completedAt: c.completedAt,
              completedBy: c.completedBy,
              checklistItemKey: c.checklistItemKey,
              notes: c.notes,
            })),
          });
        }

        // Generate breeder phase certificate if requested
        let certificate = null;
        if (generateCertificate) {
          certificate = await tx.rearingCertificate.create({
            data: {
              tenantId,
              assignmentId: offspringAssignment.id,
              offspringId,
              offspringName: offspring.name ?? `Offspring #${offspring.id}`,
              protocolName: assignment.protocol?.name ?? "Unknown Protocol",
              breederName: assignment.BreedingPlan?.tenant?.name ?? "Unknown Breeder",
              certificateType: "BREEDER_PHASE",
              stageCompleted: handoffFromStage,
              stageData: handoffSnapshot,
              completedAt: new Date(),
            },
          });
        }

        return { offspringAssignment, certificate };
      });

      return reply.code(201).send({
        success: true,
        handoff: {
          assignmentId: result.offspringAssignment.id,
          offspringId,
          buyerUserId: resolvedBuyerUserId,
          handoffAt: result.offspringAssignment.handoffAt,
          handoffFromStage,
        },
        certificate: result.certificate
          ? {
              id: result.certificate.id,
              certificateType: result.certificate.certificateType,
              stageCompleted: result.certificate.stageCompleted,
            }
          : null,
      });
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
