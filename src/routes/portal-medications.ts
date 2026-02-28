// src/routes/portal-medications.ts
// Portal endpoints for Client Medication Viewing (read-only)
// Mirrors portal-health.ts pattern — enforces requireClientPartyScope for party-based data isolation

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { requireClientPartyScope } from "../middleware/actor-context.js";

/* ───────────────────────── helpers ───────────────────────── */

function idNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
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
    select: { id: true, species: true, promotedAnimalId: true },
  });
  if (!offspring) {
    throw { statusCode: 404, error: "not_found", message: "Offspring not found" };
  }
  return offspring;
}

const portalMedicationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // GET /portal/offspring/:id/medications
  // Read-only: Returns medication courses + doses with withdrawal status
  // for client-owned offspring. The offspring must have a promoted animal to
  // look up medication data (medications are recorded on the Animal, not Offspring).
  // ─────────────────────────────────────────────────────────────────────────────
  app.get("/portal/offspring/:id/medications", async (req, reply) => {
    try {
      const { tenantId, partyId } = await requireClientPartyScope(req);
      const offspringId = idNum((req.params as any).id);
      if (!offspringId) return reply.code(400).send({ error: "invalid_offspring_id" });

      const offspring = await verifyOffspringOwnership(tenantId, offspringId, partyId);

      // Medications are recorded on the promoted Animal record, not on Offspring directly
      if (!offspring.promotedAnimalId) {
        return reply.send({ courses: [], summary: null });
      }

      const animalId = offspring.promotedAnimalId;

      // Fetch active/completed medication courses with their doses
      const courses = await prisma.medicationCourse.findMany({
        where: {
          tenantId,
          animalId,
          deletedAt: null,
        },
        include: {
          MedicationDose: {
            orderBy: { administeredAt: "desc" },
          },
        },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
      });

      const now = new Date();

      // Enrich courses with computed fields
      const enriched = courses.map((course) => {
        const doses = course.MedicationDose || [];
        const isOverdue = course.nextDueDate
          ? new Date(course.nextDueDate) < now && course.status === "ACTIVE"
          : false;
        const withdrawalActive = course.withdrawalExpiryDate
          ? new Date(course.withdrawalExpiryDate) > now
          : false;
        const withdrawalDaysRemaining = course.withdrawalExpiryDate
          ? Math.max(0, Math.ceil((new Date(course.withdrawalExpiryDate).getTime() - now.getTime()) / 86_400_000))
          : null;

        return {
          id: course.id,
          animalId: course.animalId,
          medicationName: course.medicationName,
          category: course.category,
          isControlledSubstance: course.isControlledSubstance,
          dosageAmount: course.dosageAmount,
          dosageUnit: course.dosageUnit,
          administrationRoute: course.administrationRoute,
          frequency: course.frequency,
          startDate: course.startDate,
          endDate: course.endDate,
          nextDueDate: course.nextDueDate,
          totalDoses: course.totalDoses,
          completedDoses: course.completedDoses,
          prescribingVet: course.prescribingVet,
          clinic: course.clinic,
          withdrawalPeriodDays: course.withdrawalPeriodDays,
          withdrawalExpiryDate: course.withdrawalExpiryDate,
          status: course.status,
          notes: course.notes,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
          // Computed fields
          isOverdue,
          withdrawalActive,
          withdrawalDaysRemaining,
          // Doses (read-only)
          doses: doses.map((d) => ({
            id: d.id,
            courseId: d.courseId,
            animalId: d.animalId,
            doseNumber: d.doseNumber,
            administeredAt: d.administeredAt,
            actualDosage: d.actualDosage,
            givenBy: d.givenBy,
            adverseReaction: d.adverseReaction,
            notes: d.notes,
            createdAt: d.createdAt,
          })),
        };
      });

      // Compute summary
      const active = enriched.filter((c) => c.status === "ACTIVE").length;
      const scheduled = enriched.filter((c) => c.status === "SCHEDULED").length;
      const withdrawalActiveCount = enriched.filter((c) => c.withdrawalActive).length;
      const overdueCount = enriched.filter((c) => c.isOverdue).length;
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const completedLast30Days = enriched.filter(
        (c) => c.status === "COMPLETED" && new Date(c.updatedAt) > thirtyDaysAgo
      ).length;
      const controlledSubstanceCount = enriched.filter((c) => c.isControlledSubstance).length;

      return reply.send({
        courses: enriched,
        summary: {
          active,
          scheduled,
          withdrawalActive: withdrawalActiveCount,
          overdueCount,
          completedLast30Days,
          controlledSubstanceCount,
        },
      });
    } catch (err: any) {
      if (err.statusCode) return reply.code(err.statusCode).send({ error: err.error || err.message });
      req.log?.error?.(err, "GET /portal/offspring/:id/medications failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default portalMedicationsRoutes;
