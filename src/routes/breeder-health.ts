// src/routes/breeder-health.ts
// Breeder-side endpoints for viewing client-shared health data,
// verifying compliance, and aggregated offspring health insights.

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

/* ───────────────────────── helpers ───────────────────────── */

function getTenantId(req: any): number | null {
  const raw = req.headers["x-tenant-id"] ?? req.query?.tenantId;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function idNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function trimToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

const breederHealthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Inject tenantId into every request
  app.addHook("preHandler", async (req, reply) => {
    const tid = getTenantId(req);
    if (!tid) return reply.code(400).send({ error: "missing x-tenant-id" });
    (req as any).tenantId = tid;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Offspring Health Feed (shared data only)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /offspring/:id/health-feed
  app.get("/offspring/:id/health-feed", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      // Verify offspring belongs to this tenant
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, tenantId },
        select: { id: true },
      });
      if (!offspring) return reply.code(404).send({ error: "offspring_not_found" });

      // Fetch shared vaccinations and shared health records in parallel
      const [sharedVaccinations, sharedHealthRecords] = await Promise.all([
        prisma.clientVaccinationRecord.findMany({
          where: { tenantId, offspringId, sharedWithBreeder: true },
          orderBy: { administeredAt: "desc" },
        }),
        prisma.clientHealthRecord.findMany({
          where: { tenantId, offspringId, sharedWithBreeder: true },
          include: {
            Document: { select: { id: true, title: true, mimeType: true } },
          },
          orderBy: { occurredAt: "desc" },
        }),
      ]);

      // Fetch compliance requirements (always visible to breeder per business rules)
      const complianceReqs = await prisma.complianceRequirement.findMany({
        where: { tenantId, offspringId },
        include: {
          ClientHealthRecord: {
            select: { id: true, recordType: true, occurredAt: true, vetClinic: true },
          },
        },
        orderBy: [{ status: "asc" }, { dueBy: "asc" }],
      });

      const now = new Date();
      const complianceStatus = complianceReqs.map((r) => {
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

      return reply.send({
        sharedVaccinations,
        sharedHealthRecords,
        complianceStatus,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /offspring/:id/health-feed failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Compliance Verification (Phase 3)
  // ─────────────────────────────────────────────────────────────────────────────

  // POST /offspring/:id/compliance/:reqId/verify
  app.post("/offspring/:id/compliance/:reqId/verify", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const offspringId = idNum((req.params as any).id);
      const reqId = idNum((req.params as any).reqId);
      if (!offspringId || !reqId) return reply.code(400).send({ error: "invalid_ids" });

      // Verify offspring belongs to this tenant (include parent IDs for portal notification metadata)
      const offspring = await prisma.offspring.findFirst({
        where: { id: offspringId, tenantId },
        select: { id: true, name: true, damId: true, sireId: true, promotedAnimalId: true },
      });
      if (!offspring) return reply.code(404).send({ error: "offspring_not_found" });

      // Verify the requirement exists
      const requirement = await prisma.complianceRequirement.findFirst({
        where: { id: reqId, tenantId, offspringId },
      });
      if (!requirement) return reply.code(404).send({ error: "requirement_not_found" });

      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body.verified !== "boolean") {
        return reply.code(400).send({ error: "verified_required" });
      }

      const verified = body.verified;
      const rejectionReason = verified ? null : trimToNull(body.rejectionReason);

      if (!verified && !rejectionReason) {
        return reply.code(400).send({ error: "rejectionReason_required_when_rejecting" });
      }

      // Get user ID from auth header (JWT sub or session user)
      const userId = (req as any).userId || (req.headers["x-user-id"] as string) || "unknown";

      const data: Record<string, unknown> = {
        verifiedByBreeder: verified,
        updatedAt: new Date(),
      };

      if (verified) {
        data.verifiedAt = new Date();
        data.verifiedBy = String(userId);
        data.rejectionReason = null;
      } else {
        // Rejection: reset status back to pending so client can re-submit
        data.status = "pending";
        data.fulfilledAt = null;
        data.proofRecordId = null;
        data.verifiedAt = null;
        data.verifiedBy = null;
        data.verifiedByBreeder = false;
        data.rejectionReason = rejectionReason;
      }

      const updated = await prisma.complianceRequirement.update({
        where: { id: reqId },
        data,
        include: {
          ClientHealthRecord: {
            select: { id: true, recordType: true, occurredAt: true, vetClinic: true },
          },
        },
      });

      // Create portal notification for buyer (compliance_verified or compliance_rejected)
      const notifType = verified ? "compliance_verified" : "compliance_rejected";
      const notifPriority = verified ? "LOW" : "HIGH";
      const today = new Date().toISOString().slice(0, 10);
      const idempotencyKey = `${notifType}:ComplianceRequirement:${reqId}:${today}`;
      const offspringName = offspring.name || `Offspring #${offspringId}`;
      const animalId = offspring.damId || offspring.sireId || offspring.promotedAnimalId;

      try {
        await prisma.notification.upsert({
          where: { idempotencyKey },
          update: {},
          create: {
            tenantId,
            type: notifType as any,
            priority: notifPriority as any,
            title: verified
              ? `Compliance verified for ${offspringName}`
              : `Compliance proof rejected for ${offspringName}`,
            message: verified
              ? `Your ${requirement.type} compliance for ${offspringName} has been verified by the breeder.`
              : `Your ${requirement.type} compliance proof for ${offspringName} was rejected. Reason: ${rejectionReason || "Not specified"}.`,
            linkUrl: `/offspring/${offspringId}/health`,
            idempotencyKey,
            metadata: {
              animalId,
              damId: offspring.damId,
              sireId: offspring.sireId,
              offspringId,
              complianceRequirementId: reqId,
              requirementType: requirement.type,
            },
          },
        });
      } catch (notifErr: any) {
        // Non-blocking: log but don't fail the verify action
        req.log?.warn?.(notifErr, "Failed to create compliance verification notification");
      }

      return reply.send({
        ...updated,
        proofRecord: updated.ClientHealthRecord ?? null,
        ClientHealthRecord: undefined,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "POST /offspring/:id/compliance/:reqId/verify failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Aggregated Health for Sire/Dam (Phase 5 — stub)
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /animals/:id/offspring-health-summary
  app.get("/animals/:id/offspring-health-summary", async (req, reply) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const animalId = idNum((req.params as any).id);
      if (!animalId) return reply.code(400).send({ error: "invalid_animal_id" });

      // Verify animal belongs to this tenant and get its name
      const animal = await prisma.animal.findFirst({
        where: { id: animalId, tenantId },
        select: { id: true, name: true },
      });
      if (!animal) return reply.code(404).send({ error: "animal_not_found" });

      // Fetch placed offspring (sire or dam) with all related health data in ONE query
      const placedOffspring = await prisma.offspring.findMany({
        where: {
          tenantId,
          placedAt: { not: null },
          OR: [{ sireId: animalId }, { damId: animalId }],
        },
        select: {
          id: true,
          ClientHealthRecord: {
            where: { sharedWithBreeder: true },
            select: { id: true, recordType: true },
          },
          ClientVaccinationRecord: {
            where: { sharedWithBreeder: true },
            select: { id: true, expiresAt: true },
          },
          ComplianceRequirement: {
            select: { id: true, type: true, status: true, verifiedByBreeder: true },
          },
        },
      });

      const totalPlacedOffspring = placedOffspring.length;

      // Edge case: no placed offspring → return zeros
      if (totalPlacedOffspring === 0) {
        return reply.send({
          animalId: animal.id,
          animalName: animal.name,
          totalPlacedOffspring: 0,
          offspringSharingData: 0,
          healthConcerns: [],
          spayNeuterComplianceRate: 0,
          vetCheckComplianceRate: 0,
          vaccinationCurrentRate: 0,
        });
      }

      const now = new Date();

      // Aggregate per-offspring data
      let offspringSharingData = 0;
      const healthConcernMap = new Map<string, { count: number; offspringIds: number[] }>();
      let spayNeuterFulfilled = 0;
      let spayNeuterTotal = 0;
      let vetCheckFulfilled = 0;
      let vetCheckTotal = 0;
      let vaccinationCurrentCount = 0;
      let offspringWithVaccinations = 0;

      for (const o of placedOffspring) {
        const hasSharedData =
          o.ClientHealthRecord.length > 0 || o.ClientVaccinationRecord.length > 0;
        if (hasSharedData) offspringSharingData++;

        // Health concerns: group by recordType
        for (const rec of o.ClientHealthRecord) {
          const existing = healthConcernMap.get(rec.recordType);
          if (existing) {
            existing.count++;
            if (!existing.offspringIds.includes(o.id)) existing.offspringIds.push(o.id);
          } else {
            healthConcernMap.set(rec.recordType, { count: 1, offspringIds: [o.id] });
          }
        }

        // Compliance: spay/neuter
        for (const cr of o.ComplianceRequirement) {
          if (cr.type === "spay" || cr.type === "neuter") {
            spayNeuterTotal++;
            if (cr.status === "fulfilled" && cr.verifiedByBreeder) spayNeuterFulfilled++;
          }
          if (cr.type === "annual_vet_check") {
            vetCheckTotal++;
            if (cr.status === "fulfilled" && cr.verifiedByBreeder) vetCheckFulfilled++;
          }
        }

        // Vaccination currency: ALL shared vaccinations must be current
        if (o.ClientVaccinationRecord.length > 0) {
          offspringWithVaccinations++;
          const allCurrent = o.ClientVaccinationRecord.every(
            (v) => v.expiresAt != null && new Date(v.expiresAt) > now,
          );
          if (allCurrent) vaccinationCurrentCount++;
        }
      }

      // Build healthConcerns array sorted by count desc
      const healthConcerns = Array.from(healthConcernMap.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          percentage: Math.round((data.count / totalPlacedOffspring) * 100),
          offspringIds: data.offspringIds,
        }))
        .sort((a, b) => b.count - a.count);

      return reply.send({
        animalId: animal.id,
        animalName: animal.name,
        totalPlacedOffspring,
        offspringSharingData,
        healthConcerns,
        spayNeuterComplianceRate: spayNeuterTotal > 0
          ? Math.round((spayNeuterFulfilled / spayNeuterTotal) * 100)
          : 0,
        vetCheckComplianceRate: vetCheckTotal > 0
          ? Math.round((vetCheckFulfilled / vetCheckTotal) * 100)
          : 0,
        vaccinationCurrentRate: offspringWithVaccinations > 0
          ? Math.round((vaccinationCurrentCount / offspringWithVaccinations) * 100)
          : 0,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /animals/:id/offspring-health-summary failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default breederHealthRoutes;
