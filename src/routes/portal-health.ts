// src/routes/portal-health.ts
// Portal endpoints for Client Health Portal (vaccination tracking, health records, compliance)
// All endpoints enforce requireClientPartyScope for party-based data isolation

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

/* ───────────────────────── helpers ───────────────────────── */

const VALID_HEALTH_RECORD_TYPES = new Set([
  "wellness_exam", "vaccination", "spay_neuter", "illness", "injury",
  "surgery", "dental", "diagnostic_test", "chronic_condition", "allergy",
  "behavioral", "emergency", "weight_check", "other",
]);

function idNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDateIso(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parseDecimal(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Verify that an offspring belongs to the given party (buyer) within the tenant.
 * Throws 404 if not found or not owned by this party.
 */
async function verifyOffspringOwnership(
  tenantId: number,
  offspringId: number,
  partyId: number,
) {
  const offspring = await prisma.offspring.findFirst({
    where: { id: offspringId, tenantId, buyerPartyId: partyId },
    select: { id: true, species: true },
  });
  if (!offspring) {
    throw { statusCode: 404, error: "not_found", message: "Offspring not found" };
  }
  return offspring;
}

const portalHealthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 1: Vaccinations
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /portal/offspring/:id/vaccinations
  app.get("/portal/offspring/:id/vaccinations", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const records = await prisma.clientVaccinationRecord.findMany({
        where: { tenantId, offspringId },
        orderBy: { administeredAt: "desc" },
      });

      return reply.send({ vaccinations: records });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /portal/offspring/:id/vaccinations failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // POST /portal/offspring/:id/vaccinations
  app.post("/portal/offspring/:id/vaccinations", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const body = req.body as Record<string, unknown> | null;
      if (!body) return reply.code(400).send({ error: "missing_body" });

      const protocolKey = trimToNull(body.protocolKey);
      if (!protocolKey) return reply.code(400).send({ error: "protocolKey_required" });

      const administeredAt = parseDateIso(body.administeredAt);
      if (!administeredAt) return reply.code(400).send({ error: "administeredAt_required" });

      const sharedWithBreeder = body.sharedWithBreeder !== false; // defaults to true

      const record = await prisma.clientVaccinationRecord.create({
        data: {
          tenantId,
          offspringId,
          contactId: partyId,
          protocolKey,
          administeredAt,
          expiresAt: parseDateIso(body.expiresAt),
          veterinarian: trimToNull(body.veterinarian),
          clinic: trimToNull(body.clinic),
          batchLotNumber: trimToNull(body.batchLotNumber),
          notes: trimToNull(body.notes),
          documentId: idNum(body.documentId),
          sharedWithBreeder,
          sharedAt: sharedWithBreeder ? new Date() : null,
        },
      });

      return reply.code(201).send(record);
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "POST /portal/offspring/:id/vaccinations failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // PATCH /portal/offspring/:id/vaccinations/:recordId
  app.patch("/portal/offspring/:id/vaccinations/:recordId", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      const recordId = idNum((req.params as any).recordId);
      if (!offspringId || !recordId) return reply.code(400).send({ error: "invalid_ids" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      // Verify the record belongs to this contact
      const existing = await prisma.clientVaccinationRecord.findFirst({
        where: { id: recordId, tenantId, offspringId, contactId: partyId },
      });
      if (!existing) return reply.code(404).send({ error: "record_not_found" });

      const body = req.body as Record<string, unknown> | null;
      if (!body) return reply.code(400).send({ error: "missing_body" });

      // Build update data — only include fields that are present in body
      const data: Record<string, unknown> = {};
      if ("protocolKey" in body) {
        const pk = trimToNull(body.protocolKey);
        if (!pk) return reply.code(400).send({ error: "protocolKey_cannot_be_empty" });
        data.protocolKey = pk;
      }
      if ("administeredAt" in body) {
        const dt = parseDateIso(body.administeredAt);
        if (!dt) return reply.code(400).send({ error: "administeredAt_invalid" });
        data.administeredAt = dt;
      }
      if ("expiresAt" in body) data.expiresAt = parseDateIso(body.expiresAt);
      if ("veterinarian" in body) data.veterinarian = trimToNull(body.veterinarian);
      if ("clinic" in body) data.clinic = trimToNull(body.clinic);
      if ("batchLotNumber" in body) data.batchLotNumber = trimToNull(body.batchLotNumber);
      if ("notes" in body) data.notes = trimToNull(body.notes);
      if ("documentId" in body) data.documentId = idNum(body.documentId);

      // Handle sharedWithBreeder toggle
      if ("sharedWithBreeder" in body) {
        const shared = body.sharedWithBreeder === true;
        data.sharedWithBreeder = shared;
        // Set sharedAt when sharing for the first time (was false, now true)
        if (shared && !existing.sharedWithBreeder) {
          data.sharedAt = new Date();
        }
      }

      data.updatedAt = new Date();

      const updated = await prisma.clientVaccinationRecord.update({
        where: { id: recordId },
        data,
      });

      return reply.send(updated);
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "PATCH /portal/offspring/:id/vaccinations/:recordId failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // DELETE /portal/offspring/:id/vaccinations/:recordId
  app.delete("/portal/offspring/:id/vaccinations/:recordId", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      const recordId = idNum((req.params as any).recordId);
      if (!offspringId || !recordId) return reply.code(400).send({ error: "invalid_ids" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      // Verify the record belongs to this contact
      const existing = await prisma.clientVaccinationRecord.findFirst({
        where: { id: recordId, tenantId, offspringId, contactId: partyId },
      });
      if (!existing) return reply.code(404).send({ error: "record_not_found" });

      await prisma.clientVaccinationRecord.delete({ where: { id: recordId } });

      return reply.code(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "DELETE /portal/offspring/:id/vaccinations/:recordId failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 2: Health Records
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /portal/offspring/:id/health-records
  app.get("/portal/offspring/:id/health-records", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const records = await prisma.clientHealthRecord.findMany({
        where: { tenantId, offspringId },
        include: {
          Document: { select: { id: true, title: true, mimeType: true } },
        },
        orderBy: { occurredAt: "desc" },
      });

      return reply.send({ healthRecords: records });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /portal/offspring/:id/health-records failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // POST /portal/offspring/:id/health-records
  app.post("/portal/offspring/:id/health-records", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const body = req.body as Record<string, unknown> | null;
      if (!body) return reply.code(400).send({ error: "missing_body" });

      const recordType = trimToNull(body.recordType);
      if (!recordType || !VALID_HEALTH_RECORD_TYPES.has(recordType)) {
        return reply.code(400).send({ error: "invalid_record_type" });
      }

      const occurredAt = parseDateIso(body.occurredAt);
      if (!occurredAt) return reply.code(400).send({ error: "occurredAt_required" });

      const sharedWithBreeder = body.sharedWithBreeder !== false; // defaults to true

      const record = await prisma.clientHealthRecord.create({
        data: {
          tenantId,
          offspringId,
          contactId: partyId,
          recordType,
          occurredAt,
          vetClinic: trimToNull(body.vetClinic),
          veterinarian: trimToNull(body.veterinarian),
          weight: parseDecimal(body.weight),
          weightUnit: trimToNull(body.weightUnit),
          findings: trimToNull(body.findings),
          recommendations: trimToNull(body.recommendations),
          documentId: idNum(body.documentId),
          sharedWithBreeder,
          sharedAt: sharedWithBreeder ? new Date() : null,
        },
        include: {
          Document: { select: { id: true, title: true, mimeType: true } },
        },
      });

      return reply.code(201).send(record);
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "POST /portal/offspring/:id/health-records failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // PATCH /portal/offspring/:id/health-records/:recordId
  app.patch("/portal/offspring/:id/health-records/:recordId", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      const recordId = idNum((req.params as any).recordId);
      if (!offspringId || !recordId) return reply.code(400).send({ error: "invalid_ids" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const existing = await prisma.clientHealthRecord.findFirst({
        where: { id: recordId, tenantId, offspringId, contactId: partyId },
      });
      if (!existing) return reply.code(404).send({ error: "record_not_found" });

      const body = req.body as Record<string, unknown> | null;
      if (!body) return reply.code(400).send({ error: "missing_body" });

      const data: Record<string, unknown> = {};
      if ("recordType" in body) {
        const rt = trimToNull(body.recordType);
        if (!rt || !VALID_HEALTH_RECORD_TYPES.has(rt)) {
          return reply.code(400).send({ error: "invalid_record_type" });
        }
        data.recordType = rt;
      }
      if ("occurredAt" in body) {
        const dt = parseDateIso(body.occurredAt);
        if (!dt) return reply.code(400).send({ error: "occurredAt_invalid" });
        data.occurredAt = dt;
      }
      if ("vetClinic" in body) data.vetClinic = trimToNull(body.vetClinic);
      if ("veterinarian" in body) data.veterinarian = trimToNull(body.veterinarian);
      if ("weight" in body) data.weight = parseDecimal(body.weight);
      if ("weightUnit" in body) data.weightUnit = trimToNull(body.weightUnit);
      if ("findings" in body) data.findings = trimToNull(body.findings);
      if ("recommendations" in body) data.recommendations = trimToNull(body.recommendations);
      if ("documentId" in body) data.documentId = idNum(body.documentId);

      if ("sharedWithBreeder" in body) {
        const shared = body.sharedWithBreeder === true;
        data.sharedWithBreeder = shared;
        if (shared && !existing.sharedWithBreeder) {
          data.sharedAt = new Date();
        }
      }

      data.updatedAt = new Date();

      const updated = await prisma.clientHealthRecord.update({
        where: { id: recordId },
        data,
        include: {
          Document: { select: { id: true, title: true, mimeType: true } },
        },
      });

      return reply.send(updated);
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "PATCH /portal/offspring/:id/health-records/:recordId failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // DELETE /portal/offspring/:id/health-records/:recordId
  app.delete("/portal/offspring/:id/health-records/:recordId", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      const recordId = idNum((req.params as any).recordId);
      if (!offspringId || !recordId) return reply.code(400).send({ error: "invalid_ids" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const existing = await prisma.clientHealthRecord.findFirst({
        where: { id: recordId, tenantId, offspringId, contactId: partyId },
      });
      if (!existing) return reply.code(404).send({ error: "record_not_found" });

      await prisma.clientHealthRecord.delete({ where: { id: recordId } });

      return reply.code(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "DELETE /portal/offspring/:id/health-records/:recordId failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // PATCH /portal/offspring/:id/health-records/:recordId/share
  app.patch("/portal/offspring/:id/health-records/:recordId/share", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      const recordId = idNum((req.params as any).recordId);
      if (!offspringId || !recordId) return reply.code(400).send({ error: "invalid_ids" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const existing = await prisma.clientHealthRecord.findFirst({
        where: { id: recordId, tenantId, offspringId, contactId: partyId },
      });
      if (!existing) return reply.code(404).send({ error: "record_not_found" });

      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body.sharedWithBreeder !== "boolean") {
        return reply.code(400).send({ error: "sharedWithBreeder_required" });
      }

      const shared = body.sharedWithBreeder;
      const data: Record<string, unknown> = {
        sharedWithBreeder: shared,
        updatedAt: new Date(),
      };
      // Set sharedAt when toggling ON for the first time
      if (shared && !existing.sharedWithBreeder) {
        data.sharedAt = new Date();
      }

      const updated = await prisma.clientHealthRecord.update({
        where: { id: recordId },
        data,
        include: {
          Document: { select: { id: true, title: true, mimeType: true } },
        },
      });

      return reply.send(updated);
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "PATCH /portal/offspring/:id/health-records/:recordId/share failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 2: Health Summary (combined endpoint)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /portal/offspring/:id/health
  app.get("/portal/offspring/:id/health", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      // Fetch vaccinations, health records, and compliance in parallel (avoid N+1)
      const [vaccinations, healthRecords, complianceReqs] = await Promise.all([
        prisma.clientVaccinationRecord.findMany({
          where: { tenantId, offspringId },
          orderBy: { administeredAt: "desc" },
        }),
        prisma.clientHealthRecord.findMany({
          where: { tenantId, offspringId },
          include: {
            Document: { select: { id: true, title: true, mimeType: true } },
          },
          orderBy: { occurredAt: "desc" },
        }),
        prisma.complianceRequirement.findMany({
          where: { tenantId, offspringId },
          include: {
            ClientHealthRecord: {
              select: { id: true, recordType: true, occurredAt: true, vetClinic: true },
            },
          },
          orderBy: [{ status: "asc" }, { dueBy: "asc" }],
        }),
      ]);

      // Compute vaccination summary
      const now = new Date();
      let current = 0, dueSoon = 0, expired = 0;
      for (const v of vaccinations) {
        if (!v.expiresAt) { current++; continue; }
        const daysLeft = Math.ceil((v.expiresAt.getTime() - now.getTime()) / 86_400_000);
        if (daysLeft < 0) expired++;
        else if (daysLeft <= 30) dueSoon++;
        else current++;
      }

      // Compute compliance summary
      let fulfilled = 0, pending = 0, overdue = 0;
      const compliance = complianceReqs.map((r) => {
        let daysUntilDue: number | null = null;
        if (r.dueBy) {
          daysUntilDue = Math.ceil((r.dueBy.getTime() - now.getTime()) / 86_400_000);
        }
        // Count by status (overdue computed from dueBy)
        if (r.status === "fulfilled") fulfilled++;
        else if (r.dueBy && daysUntilDue !== null && daysUntilDue < 0) overdue++;
        else pending++;

        return {
          ...r,
          daysUntilDue,
          proofRecord: r.ClientHealthRecord ?? null,
          ClientHealthRecord: undefined,
        };
      });

      return reply.send({
        vaccinations,
        vaccinationSummary: { current, dueSoon, expired, notRecorded: 0 },
        healthRecords,
        compliance,
        complianceSummary: { total: complianceReqs.length, fulfilled, pending, overdue },
      });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /portal/offspring/:id/health failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 3: Compliance Requirements
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /portal/offspring/:id/compliance
  app.get("/portal/offspring/:id/compliance", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const requirements = await prisma.complianceRequirement.findMany({
        where: { tenantId, offspringId },
        include: {
          ClientHealthRecord: {
            select: { id: true, recordType: true, occurredAt: true, vetClinic: true },
          },
        },
        orderBy: [{ status: "asc" }, { dueBy: "asc" }],
      });

      // Compute daysUntilDue for each requirement
      const now = new Date();
      const enriched = requirements.map((r) => {
        let daysUntilDue: number | null = null;
        if (r.dueBy) {
          daysUntilDue = Math.ceil((r.dueBy.getTime() - now.getTime()) / 86_400_000);
        }
        return {
          ...r,
          daysUntilDue,
          proofRecord: r.ClientHealthRecord ?? null,
          ClientHealthRecord: undefined,
        };
      });

      return reply.send({ requirements: enriched });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /portal/offspring/:id/compliance failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // POST /portal/offspring/:id/compliance/:reqId/fulfill
  app.post("/portal/offspring/:id/compliance/:reqId/fulfill", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      const reqId = idNum((req.params as any).reqId);
      if (!offspringId || !reqId) return reply.code(400).send({ error: "invalid_ids" });

      await verifyOffspringOwnership(tenantId, offspringId, partyId);

      const body = req.body as Record<string, unknown> | null;
      if (!body) return reply.code(400).send({ error: "missing_body" });

      const proofRecordId = idNum(body.proofRecordId);
      if (!proofRecordId) return reply.code(400).send({ error: "proofRecordId_required" });

      // Verify the requirement exists and belongs to this offspring
      const requirement = await prisma.complianceRequirement.findFirst({
        where: { id: reqId, tenantId, offspringId },
      });
      if (!requirement) return reply.code(404).send({ error: "requirement_not_found" });

      // Verify the proof record belongs to the same offspring and contact
      const proofRecord = await prisma.clientHealthRecord.findFirst({
        where: { id: proofRecordId, tenantId, offspringId, contactId: partyId },
      });
      if (!proofRecord) return reply.code(404).send({ error: "proof_record_not_found" });

      // Get offspring details for notification metadata
      const offspring = await prisma.offspring.findUnique({
        where: { id: offspringId },
        select: { id: true, name: true, damId: true, sireId: true, promotedAnimalId: true },
      });

      // Update requirement to fulfilled
      const updated = await prisma.complianceRequirement.update({
        where: { id: reqId },
        data: {
          status: "fulfilled",
          fulfilledAt: new Date(),
          proofRecordId,
          updatedAt: new Date(),
        },
        include: {
          ClientHealthRecord: {
            select: { id: true, recordType: true, occurredAt: true, vetClinic: true },
          },
        },
      });

      // Create compliance_fulfilled notification for the breeder
      const offspringName = offspring?.name || `Offspring #${offspringId}`;
      const animalId = offspring?.damId || offspring?.sireId || offspring?.promotedAnimalId;
      const today = new Date().toISOString().slice(0, 10);
      const idempotencyKey = `compliance_fulfilled:ComplianceRequirement:${reqId}:${today}`;

      try {
        await prisma.notification.upsert({
          where: { idempotencyKey },
          update: {},
          create: {
            tenantId,
            type: "compliance_fulfilled" as any,
            priority: "MEDIUM" as any,
            title: `Compliance proof submitted for ${offspringName}`,
            message: `A client has submitted ${requirement.type} compliance proof for ${offspringName}. Please review and verify.`,
            linkUrl: `/offspring/${offspringId}/health`,
            idempotencyKey,
            metadata: {
              animalId,
              damId: offspring?.damId,
              sireId: offspring?.sireId,
              offspringId,
              complianceRequirementId: reqId,
              requirementType: requirement.type,
            },
          },
        });
      } catch (notifErr: any) {
        // Non-blocking: log but don't fail the fulfill action
        req.log?.warn?.(notifErr, "Failed to create compliance_fulfilled notification");
      }

      return reply.send({
        ...updated,
        proofRecord: updated.ClientHealthRecord ?? null,
        ClientHealthRecord: undefined,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "POST /portal/offspring/:id/compliance/:reqId/fulfill failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default portalHealthRoutes;
