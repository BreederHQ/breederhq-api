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

      if (!offspringId) {
        return reply.code(400).send({ error: "offspring_id_required" });
      }

      // Get assignment with protocol and offspring group details
      const assignment = await prisma.rearingProtocolAssignment.findFirst({
        where: { id: assignmentId, tenantId },
        include: {
          protocol: true,
          offspringGroup: {
            include: {
              tenant: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!assignment) {
        return reply.code(404).send({ error: "assignment_not_found" });
      }

      // Check completion progress
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

      // Verify offspring belongs to the assignment's group
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, groupId: assignment.offspringGroupId, tenantId },
      });

      if (!offspring) {
        return reply.code(404).send({ error: "offspring_not_found" });
      }

      // Check if certificate already exists for this offspring
      const existingCertificate = await prisma.rearingCertificate.findFirst({
        where: { assignmentId, offspringId, isValid: true },
      });

      if (existingCertificate) {
        return reply.code(409).send({
          error: "certificate_already_exists",
          certificateId: existingCertificate.id,
        });
      }

      // Create certificate
      const certificate = await prisma.rearingCertificate.create({
        data: {
          tenantId,
          assignmentId,
          offspringId,
          offspringName: offspring.name ?? `Offspring #${offspring.id}`,
          protocolName: assignment.protocol?.name ?? "Unknown Protocol",
          breederName: assignment.offspringGroup?.tenant?.name ?? "Unknown Breeder",
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

      await prisma.rearingCertificate.update({
        where: { id },
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
