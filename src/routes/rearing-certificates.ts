// src/routes/rearing-certificates.ts
// Rearing Protocols API - Certificates
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

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

function errorReply(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[rearing-certificates]", msg);
  return { status: 500, payload: { error: "internal_error", message: msg } };
}

/* ───────────────────────── routes ───────────────────────── */

const rearingCertificatesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-assignments/:id/certificates - List certificates for assignment
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-assignments/:id/certificates", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const assignmentId = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      // Verify assignment belongs to tenant
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      const certificates = await prisma.rearingCertificate.findMany({
        where: { assignmentId, tenantId },
        orderBy: { issuedAt: "desc" },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      return reply.send({ certificates });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /rearing-assignments/:id/certificates - Generate certificate
  // Supports certificate types: FULL_PROTOCOL (default), BREEDER_PHASE, BUYER_PHASE
  // ─────────────────────────────────────────────────────────────────────────────
  app.post("/rearing-assignments/:id/certificates", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const assignmentId = idNum((req.params as any).id);

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!assignmentId) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;
      const offspringId = idNum(body.offspringId);
      const certificateType = trimToNull(body.certificateType) ?? "FULL_PROTOCOL";
      const stageCompleted = idNum(body.stageCompleted);
      const buyerName = trimToNull(body.buyerName);
      const buyerUserId = trimToNull(body.buyerUserId);

      if (!offspringId) {
        return reply.code(400).send({ error: "offspring_id_required" });
      }

      // Validate certificate type
      const validTypes = ["FULL_PROTOCOL", "BREEDER_PHASE", "BUYER_PHASE"];
      if (!validTypes.includes(certificateType)) {
        return reply.code(400).send({
          error: "invalid_certificate_type",
          validTypes,
        });
      }

      // Get assignment with protocol and breeding plan details
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
        include: {
          protocol: true,
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

      // For FULL_PROTOCOL, require 100% completion
      // For BREEDER_PHASE or BUYER_PHASE, allow partial completion
      if (certificateType === "FULL_PROTOCOL") {
        const completionPercent =
          assignment.totalActivities > 0
            ? (assignment.completedActivities / assignment.totalActivities) * 100
            : 0;

        if (completionPercent < 100) {
          return reply.code(400).send({
            error: "incomplete_protocol",
            message: `Protocol is ${Math.round(completionPercent)}% complete. 100% completion required for full certificate.`,
            completedActivities: assignment.completedActivities,
            totalActivities: assignment.totalActivities,
          });
        }
      }

      // Verify offspring - check both plan-level and individual-level assignments
      let offspring;
      if (assignment.breedingPlanId) {
        offspring = await prisma.offspring.findFirst({
          where: { id: offspringId, breedingPlanId: assignment.breedingPlanId, tenantId },
        });
      } else if (assignment.offspringId) {
        offspring = await prisma.offspring.findFirst({
          where: { id: offspringId, tenantId },
        });
      }

      if (!offspring) {
        return reply.code(404).send({ error: "offspring_not_found" });
      }

      // Check if certificate already exists for this offspring and type
      const existingCertificate = await prisma.rearingCertificate.findFirst({
        where: {
          assignmentId,
          offspringId,
          certificateType: certificateType as any,
          isValid: true,
        },
      });

      if (existingCertificate) {
        return reply.code(409).send({
          error: "certificate_already_exists",
          certificateId: existingCertificate.id,
          certificateType: existingCertificate.certificateType,
        });
      }

      // Build stage data snapshot
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
          offspringId,
          offspringName: offspring.name ?? `Offspring #${offspring.id}`,
          protocolName: assignment.protocol?.name ?? "Unknown Protocol",
          breederName: assignment.BreedingPlan?.tenant?.name ?? "Unknown Breeder",
          certificateType: certificateType as any,
          stageCompleted: stageCompleted ?? (certificateType === "BREEDER_PHASE" ? 3 : null),
          stageData,
          buyerName,
          buyerUserId,
          completedAt: new Date(),
        },
        include: {
          offspring: {
            select: { id: true, name: true },
          },
        },
      });

      // Generate verification URL
      const baseUrl = process.env.APP_URL || "https://app.breederhq.com";
      const verificationUrl = `${baseUrl}/verify/${certificate.id}`;

      return reply.code(201).send({
        ...certificate,
        verificationUrl,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-certificates/:id - Get certificate
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/rearing-certificates/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = (req.params as any).id as string;

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const certificate = await prisma.rearingCertificate.findFirst({
        where: { id, tenantId },
        include: {
          offspring: {
            select: { id: true, name: true, species: true },
          },
          assignment: {
            select: {
              id: true,
              protocol: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      });

      if (!certificate) {
        return reply.code(404).send({ error: "not_found" });
      }

      const baseUrl = process.env.APP_URL || "https://app.breederhq.com";
      const verificationUrl = `${baseUrl}/verify/${certificate.id}`;

      return reply.send({
        ...certificate,
        verificationUrl,
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /rearing-certificates/:id/verify - PUBLIC (no auth) - Verify certificate
  // ─────────────────────────────────────────────────────────────────────────────
  // Note: This endpoint should be registered in the public (non-tenant) subtree
  app.get("/rearing-certificates/:id/verify", async (req, reply) => {
    try {
      const id = (req.params as any).id as string;

      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const certificate = await prisma.rearingCertificate.findUnique({
        where: { id },
        include: {
          offspring: {
            select: { name: true, species: true },
          },
        },
      });

      if (!certificate) {
        return reply.send({
          isValid: false,
          invalidReason: "Certificate not found",
        });
      }

      if (!certificate.isValid) {
        return reply.send({
          isValid: false,
          invalidReason: "Certificate has been revoked",
          revokedAt: certificate.revokedAt,
          revokedReason: certificate.revokedReason,
        });
      }

      return reply.send({
        isValid: true,
        certificate: {
          id: certificate.id,
          offspringName: certificate.offspringName,
          protocolName: certificate.protocolName,
          breederName: certificate.breederName,
          certificateType: certificate.certificateType,
          stageCompleted: certificate.stageCompleted,
          buyerName: certificate.buyerName,
          completedAt: certificate.completedAt,
          issuedAt: certificate.issuedAt,
          species: certificate.offspring?.species,
        },
      });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /rearing-certificates/:id - Revoke certificate
  // ─────────────────────────────────────────────────────────────────────────────
  app.delete("/rearing-certificates/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      const id = (req.params as any).id as string;

      if (!tenantId) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (!id) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      const body = req.body as any;
      const reason = trimToNull(body.reason);

      // Verify ownership
      const existing = await prisma.rearingCertificate.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return reply.code(404).send({ error: "not_found" });
      }

      if (!existing.isValid) {
        return reply.send({ success: true, alreadyRevoked: true });
      }

      await prisma.rearingCertificate.updateMany({
        where: { id, tenantId },
        data: {
          isValid: false,
          revokedAt: new Date(),
          revokedReason: reason ?? "Revoked by breeder",
        },
      });

      return reply.send({ success: true });
    } catch (err) {
      const { status, payload } = errorReply(err);
      return reply.status(status).send(payload);
    }
  });
};

export default rearingCertificatesRoutes;
