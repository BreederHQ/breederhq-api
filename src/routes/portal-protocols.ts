// src/routes/portal-protocols.ts
// Portal endpoints for Training Protocol continuation (Buyer phase Stages 4-8)
// All endpoints enforce requireClientPartyScope for party-based data isolation

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

/* ───────────────────────── helpers ───────────────────────── */

function idNum(v: any) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

const portalProtocolsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/portal/protocols
  // Returns protocol assignments where the authenticated user is the handoff recipient
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/portal/protocols", async (req, reply) => {
    try {
      const { tenantId, userId } = await requireClientPartyScope(req);

      if (!userId) {
        return reply.code(401).send({ error: "user_required" });
      }

      // Find protocol assignments where this user is the handoff recipient
      const assignments = await prisma.rearingProtocolAssignment.findMany({
        where: {
          tenantId,
          handoffToUserId: userId,
        },
        include: {
          protocol: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          offspring: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
              bornAt: true,
              collarColorName: true,
              BreedingPlan: {
                select: {
                  name: true,
                  birthDateActual: true,
                  dam: {
                    select: { id: true, name: true },
                  },
                  sire: {
                    select: { id: true, name: true },
                  },
                  tenant: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          certificates: {
            where: { isValid: true },
            orderBy: { issuedAt: "desc" },
            select: {
              id: true,
              certificateType: true,
              stageCompleted: true,
              issuedAt: true,
            },
          },
        },
        orderBy: { handoffAt: "desc" },
      });

      // Build response with protocol progress
      const protocols = assignments.map((a) => {
        const birthDate =
          a.offspring?.bornAt || a.offspring?.BreedingPlan?.birthDateActual || null;
        const ageWeeks = birthDate
          ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
          : null;

        // Parse protocol snapshot to get stages
        let stages: any[] = [];
        if (a.protocolSnapshot) {
          const snapshot = a.protocolSnapshot as any;
          stages = snapshot.stages || [];
        }

        // Calculate current stage based on age
        let currentStage = a.handoffFromStage || 3;
        if (ageWeeks !== null) {
          // Gun Dog Protocol stage schedule:
          // Stage 4: Week 8-12, Stage 5: Week 12-20, Stage 6: Week 20-32
          // Stage 7: Week 32-44, Stage 8: Week 44-52
          if (ageWeeks >= 44) currentStage = 8;
          else if (ageWeeks >= 32) currentStage = 7;
          else if (ageWeeks >= 20) currentStage = 6;
          else if (ageWeeks >= 12) currentStage = 5;
          else if (ageWeeks >= 8) currentStage = 4;
        }

        return {
          id: a.id,
          protocol: {
            id: a.protocol?.id,
            name: a.protocol?.name,
            description: a.protocol?.description,
          },
          offspring: {
            id: a.offspring?.id,
            name: a.offspring?.name || `Offspring #${a.offspringId}`,
            species: a.offspring?.species,
            breed: a.offspring?.breed,
            birthDate: birthDate?.toISOString() || null,
            ageWeeks,
            collarColor: a.offspring?.collarColorName,
            dam: a.offspring?.BreedingPlan?.dam,
            sire: a.offspring?.BreedingPlan?.sire,
          },
          breeder: {
            name: a.offspring?.BreedingPlan?.tenant?.name || "Unknown Breeder",
          },
          handoff: {
            at: a.handoffAt?.toISOString(),
            fromStage: a.handoffFromStage,
            notes: a.handoffNotes,
          },
          progress: {
            completedActivities: a.completedActivities,
            totalActivities: a.totalActivities,
            percentComplete:
              a.totalActivities > 0
                ? Math.round((a.completedActivities / a.totalActivities) * 100)
                : 0,
            currentStage,
          },
          certificates: a.certificates.map((c) => ({
            id: c.id,
            type: c.certificateType,
            stageCompleted: c.stageCompleted,
            issuedAt: c.issuedAt.toISOString(),
          })),
          status: a.status,
        };
      });

      return reply.send({ protocols });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal protocols");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/portal/protocols/:id
  // Returns detailed protocol assignment with stages and activities
  // ─────────────────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/portal/protocols/:id", async (req, reply) => {
    try {
      const { tenantId, userId } = await requireClientPartyScope(req);
      const assignmentId = idNum(req.params.id);

      if (!userId) {
        return reply.code(401).send({ error: "user_required" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: {
          id: assignmentId,
          tenantId,
          handoffToUserId: userId,
        },
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
          offspring: {
            select: {
              id: true,
              name: true,
              species: true,
              breed: true,
              bornAt: true,
              collarColorName: true,
              BreedingPlan: {
                select: {
                  name: true,
                  birthDateActual: true,
                  dam: {
                    select: { id: true, name: true },
                  },
                  sire: {
                    select: { id: true, name: true },
                  },
                  tenant: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          completions: {
            orderBy: { completedAt: "asc" },
            select: {
              id: true,
              activityId: true,
              completedAt: true,
              completedBy: true,
              notes: true,
              checklistItemKey: true,
            },
          },
          certificates: {
            where: { isValid: true },
            orderBy: { issuedAt: "desc" },
          },
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "not_found" });
      }

      // Build completion map
      const completionsByActivity = new Map<string, any[]>();
      for (const c of assignment.completions) {
        const existing = completionsByActivity.get(c.activityId) || [];
        existing.push({
          id: c.id,
          completedAt: c.completedAt.toISOString(),
          completedBy: c.completedBy,
          notes: c.notes,
          checklistItemKey: c.checklistItemKey,
        });
        completionsByActivity.set(c.activityId, existing);
      }

      // Get protocol stages from snapshot or live protocol
      const protocolData =
        (assignment.protocolSnapshot as any) || assignment.protocol;
      const stages = (protocolData?.stages || []).map((stage: any) => {
        const activities = (stage.activities || []).map((activity: any) => {
          const completions = completionsByActivity.get(activity.id) || [];
          const isComplete = completions.length > 0;

          return {
            id: activity.id,
            name: activity.name,
            description: activity.description,
            dayStart: activity.dayStart,
            dayEnd: activity.dayEnd,
            checklistItems: activity.checklistItems,
            isComplete,
            completions,
          };
        });

        // Calculate stage progress
        const completedCount = activities.filter((a: any) => a.isComplete).length;
        const totalCount = activities.length;

        return {
          id: stage.id,
          name: stage.name,
          description: stage.description,
          order: stage.order,
          dayStart: stage.dayStart,
          dayEnd: stage.dayEnd,
          activities,
          progress: {
            completed: completedCount,
            total: totalCount,
            percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
          },
        };
      });

      // Calculate current stage
      const birthDate =
        assignment.offspring?.bornAt ||
        assignment.offspring?.BreedingPlan?.birthDateActual;
      const ageWeeks = birthDate
        ? Math.floor(
            (Date.now() - new Date(birthDate).getTime()) / (7 * 24 * 60 * 60 * 1000)
          )
        : null;

      let currentStage = assignment.handoffFromStage || 3;
      if (ageWeeks !== null) {
        if (ageWeeks >= 44) currentStage = 8;
        else if (ageWeeks >= 32) currentStage = 7;
        else if (ageWeeks >= 20) currentStage = 6;
        else if (ageWeeks >= 12) currentStage = 5;
        else if (ageWeeks >= 8) currentStage = 4;
      }

      // Separate breeder phases (1-3) and buyer phases (4-8)
      const breederPhaseStages = stages.filter((s: any) => s.order <= 3);
      const buyerPhaseStages = stages.filter((s: any) => s.order > 3);

      return reply.send({
        assignment: {
          id: assignment.id,
          status: assignment.status,
          protocol: {
            id: protocolData?.id,
            name: protocolData?.name,
            description: protocolData?.description,
            version: assignment.protocolVersion,
          },
          offspring: {
            id: assignment.offspring?.id,
            name: assignment.offspring?.name || `Offspring #${assignment.offspringId}`,
            species: assignment.offspring?.species,
            breed: assignment.offspring?.breed,
            birthDate: birthDate?.toISOString() || null,
            ageWeeks,
            collarColor: assignment.offspring?.collarColorName,
            dam: assignment.offspring?.BreedingPlan?.dam,
            sire: assignment.offspring?.BreedingPlan?.sire,
          },
          breeder: {
            name: assignment.offspring?.BreedingPlan?.tenant?.name || "Unknown Breeder",
          },
          handoff: {
            at: assignment.handoffAt?.toISOString(),
            fromStage: assignment.handoffFromStage,
            notes: assignment.handoffNotes,
            snapshot: assignment.handoffSnapshot,
          },
          progress: {
            completedActivities: assignment.completedActivities,
            totalActivities: assignment.totalActivities,
            percentComplete:
              assignment.totalActivities > 0
                ? Math.round(
                    (assignment.completedActivities / assignment.totalActivities) * 100
                  )
                : 0,
            currentStage,
          },
          breederPhase: {
            isComplete: true,
            stages: breederPhaseStages,
          },
          buyerPhase: {
            isActive: true,
            stages: buyerPhaseStages,
          },
          certificates: assignment.certificates.map((c) => ({
            id: c.id,
            type: c.certificateType,
            stageCompleted: c.stageCompleted,
            offspringName: c.offspringName,
            protocolName: c.protocolName,
            breederName: c.breederName,
            buyerName: c.buyerName,
            completedAt: c.completedAt.toISOString(),
            issuedAt: c.issuedAt.toISOString(),
          })),
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to load portal protocol detail");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/portal/protocols/:id/activities/:activityId/complete
  // Mark an activity as complete (Buyer phase)
  // ─────────────────────────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string; activityId: string };
    Body: { notes?: string; checklistItemKey?: string };
  }>("/portal/protocols/:id/activities/:activityId/complete", async (req, reply) => {
    try {
      const { tenantId, userId, partyId } = await requireClientPartyScope(req);
      const assignmentId = idNum(req.params.id);
      const activityId = req.params.activityId;

      if (!userId) {
        return reply.code(401).send({ error: "user_required" });
      }
      if (!assignmentId || !activityId) {
        return reply.code(400).send({ error: "invalid_params" });
      }

      const body = req.body || {};
      const notes = trimToNull(body.notes);
      const checklistItemKey = trimToNull(body.checklistItemKey);

      // Verify assignment ownership
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: {
          id: assignmentId,
          tenantId,
          handoffToUserId: userId,
        },
        select: {
          id: true,
          offspringId: true,
          totalActivities: true,
          completedActivities: true,
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Check for existing completion
      const existingCompletion = await prisma.activityCompletion.findFirst({
        where: {
          assignmentId,
          activityId,
          offspringId: assignment.offspringId,
          checklistItemKey: checklistItemKey ?? undefined,
        },
      });

      if (existingCompletion) {
        return reply.code(409).send({
          error: "already_completed",
          completionId: existingCompletion.id,
        });
      }

      // Create completion in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create completion record
        const completion = await tx.activityCompletion.create({
          data: {
            tenantId,
            assignmentId,
            activityId,
            scope: "INDIVIDUAL",
            offspringId: assignment.offspringId,
            completedAt: new Date(),
            completedBy: userId,
            checklistItemKey,
            notes,
          },
        });

        // Update assignment progress
        const updatedAssignment = await tx.rearingProtocolAssignment.update({
          where: { id: assignmentId },
          data: {
            completedActivities: { increment: 1 },
          },
          select: {
            completedActivities: true,
            totalActivities: true,
          },
        });

        return { completion, updatedAssignment };
      });

      return reply.code(201).send({
        completion: {
          id: result.completion.id,
          activityId: result.completion.activityId,
          completedAt: result.completion.completedAt.toISOString(),
          notes: result.completion.notes,
          checklistItemKey: result.completion.checklistItemKey,
        },
        progress: {
          completedActivities: result.updatedAssignment.completedActivities,
          totalActivities: result.updatedAssignment.totalActivities,
          percentComplete:
            result.updatedAssignment.totalActivities > 0
              ? Math.round(
                  (result.updatedAssignment.completedActivities /
                    result.updatedAssignment.totalActivities) *
                    100
                )
              : 0,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to complete portal protocol activity");
      return reply.code(500).send({ error: "completion_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/portal/protocols/:id/activities/:activityId/complete
  // Undo a completion (Buyer phase)
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete<{
    Params: { id: string; activityId: string };
    Querystring: { checklistItemKey?: string };
  }>("/portal/protocols/:id/activities/:activityId/complete", async (req, reply) => {
    try {
      const { tenantId, userId } = await requireClientPartyScope(req);
      const assignmentId = idNum(req.params.id);
      const activityId = req.params.activityId;
      const checklistItemKey = trimToNull(req.query.checklistItemKey);

      if (!userId) {
        return reply.code(401).send({ error: "user_required" });
      }
      if (!assignmentId || !activityId) {
        return reply.code(400).send({ error: "invalid_params" });
      }

      // Verify assignment ownership
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: {
          id: assignmentId,
          tenantId,
          handoffToUserId: userId,
        },
        select: {
          id: true,
          offspringId: true,
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Find completion to delete
      const completion = await prisma.activityCompletion.findFirst({
        where: {
          assignmentId,
          activityId,
          offspringId: assignment.offspringId,
          checklistItemKey: checklistItemKey ?? undefined,
        },
      });

      if (!completion) {
        return reply.code(404).send({ error: "completion_not_found" });
      }

      // Delete completion in transaction
      await prisma.$transaction(async (tx) => {
        await tx.activityCompletion.delete({
          where: { id: completion.id },
        });

        await tx.rearingProtocolAssignment.update({
          where: { id: assignmentId },
          data: {
            completedActivities: { decrement: 1 },
          },
        });
      });

      return reply.send({ success: true });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to undo portal protocol activity completion");
      return reply.code(500).send({ error: "undo_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/portal/protocols/:id/certificates
  // List certificates for a protocol assignment
  // ─────────────────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/portal/protocols/:id/certificates", async (req, reply) => {
    try {
      const { tenantId, userId } = await requireClientPartyScope(req);
      const assignmentId = idNum(req.params.id);

      if (!userId) {
        return reply.code(401).send({ error: "user_required" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify assignment ownership
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: {
          id: assignmentId,
          tenantId,
          handoffToUserId: userId,
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      const certificates = await prisma.rearingCertificate.findMany({
        where: {
          assignmentId,
          isValid: true,
        },
        orderBy: { issuedAt: "desc" },
      });

      const baseUrl = process.env.APP_URL || "https://app.breederhq.com";

      return reply.send({
        certificates: certificates.map((c) => ({
          id: c.id,
          type: c.certificateType,
          stageCompleted: c.stageCompleted,
          offspringName: c.offspringName,
          protocolName: c.protocolName,
          breederName: c.breederName,
          buyerName: c.buyerName,
          completedAt: c.completedAt.toISOString(),
          issuedAt: c.issuedAt.toISOString(),
          verificationUrl: `${baseUrl}/verify/${c.id}`,
        })),
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to list portal protocol certificates");
      return reply.code(500).send({ error: "failed_to_load" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/portal/protocols/:id/certificates
  // Generate buyer phase completion certificate
  // ─────────────────────────────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>("/portal/protocols/:id/certificates", async (req, reply) => {
    try {
      const { tenantId, userId, partyId } = await requireClientPartyScope(req);
      const assignmentId = idNum(req.params.id);

      if (!userId) {
        return reply.code(401).send({ error: "user_required" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Get assignment with full details
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: {
          id: assignmentId,
          tenantId,
          handoffToUserId: userId,
        },
        include: {
          protocol: true,
          offspring: {
            select: {
              id: true,
              name: true,
              BreedingPlan: {
                select: {
                  tenant: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          completions: true,
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Check if protocol is complete
      const completionPercent =
        assignment.totalActivities > 0
          ? (assignment.completedActivities / assignment.totalActivities) * 100
          : 0;

      if (completionPercent < 100) {
        return reply.code(400).send({
          error: "incomplete_protocol",
          message: `Protocol is ${Math.round(completionPercent)}% complete. 100% completion required for certificate.`,
          completedActivities: assignment.completedActivities,
          totalActivities: assignment.totalActivities,
        });
      }

      // Check if certificate already exists
      const existingCertificate = await prisma.rearingCertificate.findFirst({
        where: {
          assignmentId,
          certificateType: "BUYER_PHASE",
          isValid: true,
        },
      });

      if (existingCertificate) {
        return reply.code(409).send({
          error: "certificate_already_exists",
          certificateId: existingCertificate.id,
        });
      }

      // Get user name for certificate
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, firstName: true, lastName: true },
      });
      const buyerName =
        user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Buyer";

      // Build stage data
      const stageData = {
        completions: assignment.completions.map((c) => ({
          activityId: c.activityId,
          completedAt: c.completedAt,
          completedBy: c.completedBy,
          notes: c.notes,
        })),
        totalCompletions: assignment.completions.length,
        generatedAt: new Date().toISOString(),
      };

      // Create certificate
      const certificate = await prisma.rearingCertificate.create({
        data: {
          tenantId,
          assignmentId,
          offspringId: assignment.offspringId!,
          offspringName:
            assignment.offspring?.name || `Offspring #${assignment.offspringId}`,
          protocolName: assignment.protocol?.name || "Unknown Protocol",
          breederName:
            assignment.offspring?.BreedingPlan?.tenant?.name || "Unknown Breeder",
          certificateType: "BUYER_PHASE",
          stageCompleted: 8, // Full buyer phase (stages 4-8)
          stageData,
          buyerName,
          buyerUserId: userId,
          completedAt: new Date(),
        },
      });

      // Update assignment status to COMPLETED
      await prisma.rearingProtocolAssignment.update({
        where: { id: assignmentId },
        data: { status: "COMPLETED" },
      });

      const baseUrl = process.env.APP_URL || "https://app.breederhq.com";

      return reply.code(201).send({
        certificate: {
          id: certificate.id,
          type: certificate.certificateType,
          stageCompleted: certificate.stageCompleted,
          offspringName: certificate.offspringName,
          protocolName: certificate.protocolName,
          breederName: certificate.breederName,
          buyerName: certificate.buyerName,
          completedAt: certificate.completedAt.toISOString(),
          issuedAt: certificate.issuedAt.toISOString(),
          verificationUrl: `${baseUrl}/verify/${certificate.id}`,
        },
      });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to generate portal protocol certificate");
      return reply.code(500).send({ error: "certificate_failed" });
    }
  });
};

export default portalProtocolsRoutes;
