// src/routes/horse-workflows.ts
// Horse workflow page API endpoints (paginated, filterable versions for full pages)
//
// GET /api/v1/horses/mare-status          - Mare status page with pagination
// GET /api/v1/horses/mare-status/filters  - Filter options for mare status page
// GET /api/v1/horses/stallion-calendar    - Stallion calendar with date range
// GET /api/v1/horses/pre-foaling          - Pre-foaling alerts page with pagination
//
// NOTE: Ovulation tracking uses existing endpoints:
// - GET  /api/v1/animals/:animalId/test-results?kind=FOLLICLE_EXAM
// - POST /api/v1/animals/:animalId/test-results (with kind: "FOLLICLE_EXAM")
// See docs/codebase/api/MARE-FOLLICLE-EXAMS.md for details

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ───────────────────────── Types ─────────────────────────

// Must match @bhq/types MareWorkflowStatus
type MareWorkflowStatus =
  | "open"
  | "in_heat"
  | "bred_waiting"
  | "pregnant"
  | "foaling_soon"
  | "nursing"
  | "barren"
  | "resting";

// ───────────────────────── Helpers ─────────────────────────

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function parsePaging(q: Record<string, unknown>) {
  const page = Math.max(1, Number(q?.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 20) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function deriveMareWorkflowStatus(
  plan: any,
  hasCycle: boolean,
  reproHistory: any,
  breedingAvailability?: string | null
): MareWorkflowStatus {
  const now = new Date();

  // Check if recently foaled (within 30 days) - nursing
  if (plan?.birthDateActual) {
    const daysSinceBirth = daysBetween(new Date(plan.birthDateActual), now);
    if (daysSinceBirth <= 30) {
      return "nursing";
    }
    if (daysSinceBirth <= 60) {
      return "resting";
    }
  }

  // Check if pregnant with due date
  if (plan?.status === "PREGNANT" && plan?.expectedBirthDate) {
    const dueDate = new Date(plan.expectedBirthDate);
    const daysUntilDue = daysBetween(now, dueDate);

    if (daysUntilDue <= 30) {
      return "foaling_soon";
    }
    return "pregnant";
  }

  // Check if bred (awaiting confirmation)
  if (plan?.status === "BRED" && plan?.breedDateActual) {
    return "bred_waiting";
  }

  // Check if barren (marked in reproductive history)
  if (reproHistory?.isBarren) {
    return "barren";
  }

  // Check if in heat (has active cycle)
  if (hasCycle) {
    return "in_heat";
  }

  // Check for manual status override (only applies when no active breeding activity)
  // This allows breeders to manually toggle between "open" and "resting"
  // Uses Animal.breedingAvailability for all species (generic field)
  if (breedingAvailability === "resting") {
    return "resting";
  }

  // Default: open
  return "open";
}

// Sign type configuration for urgency - must match MilestoneType enum
const SIGN_URGENCY: Record<string, number> = {
  UDDER_DEVELOPMENT: 3,
  WAX_APPEARANCE: 8,
  VULVAR_RELAXATION: 7,
  TAILHEAD_RELAXATION: 6,
  UDDER_FULL: 7,
  MILK_CALCIUM_TEST: 9,
};

const SIGN_LABELS: Record<string, string> = {
  UDDER_DEVELOPMENT: "Udder Development",
  WAX_APPEARANCE: "Waxing",
  VULVAR_RELAXATION: "Vulva Relaxation",
  TAILHEAD_RELAXATION: "Tailhead Relaxation",
  UDDER_FULL: "Udder Full",
  MILK_CALCIUM_TEST: "Calcium Test",
};

// ───────────────────────── Routes ─────────────────────────

const horseWorkflowRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/horses/mare-status
   * Paginated mare status list for full page view
   */
  app.get("/horses/mare-status", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);

      // Parse filters
      const statusFilter = query.status
        ? String(query.status).split(",") as MareWorkflowStatus[]
        : undefined;
      const stallionIdFilter = query.stallionId ? Number(query.stallionId) : undefined;
      const searchFilter = query.search ? String(query.search).toLowerCase() : undefined;
      const sortBy = String(query.sortBy || "statusUpdatedAt");
      const sortOrder = String(query.sortOrder || "desc") as "asc" | "desc";

      // Get all female horses for this tenant
      const mares = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "FEMALE",
          archived: false,
          status: { in: ["ACTIVE", "BREEDING"] },
          ...(searchFilter && {
            name: { contains: searchFilter, mode: "insensitive" as const },
          }),
        },
        include: {
          mareReproductiveHistory: true,
          breedingPlansAsDam: {
            where: {
              status: { notIn: ["COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
              ...(stallionIdFilter && { sireId: stallionIdFilter }),
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sire: { select: { id: true, name: true } },
            },
          },
          reproductiveCycles: {
            orderBy: { cycleStart: "desc" },
            take: 1,
          },
        },
      });

      // Process mares and derive status - match MareStatusEntry interface
      const processedMares = mares.map((mare) => {
        const plan = mare.breedingPlansAsDam[0];
        const hasCycle = mare.reproductiveCycles.length > 0;
        const lastCycle = mare.reproductiveCycles[0];
        const reproductiveStatus = deriveMareWorkflowStatus(plan, hasCycle, mare.mareReproductiveHistory, mare.breedingAvailability);

        // Calculate cycle day if in heat
        let currentCycleDay: number | undefined;
        if (lastCycle?.cycleStart) {
          currentCycleDay = daysBetween(new Date(lastCycle.cycleStart), new Date());
        }

        // Calculate days to foaling if pregnant
        let daysToFoaling: number | undefined;
        if (plan?.expectedBirthDate) {
          daysToFoaling = daysBetween(new Date(), new Date(plan.expectedBirthDate));
        }

        return {
          id: mare.id,
          name: mare.name,
          registrationNumber: mare.microchip || undefined, // Use microchip as registration identifier
          photoUrl: mare.photoUrl || undefined,
          reproductiveStatus,
          statusUpdatedAt: plan?.updatedAt?.toISOString() || mare.updatedAt.toISOString(),
          currentCycleDay,
          lastHeatDate: lastCycle?.cycleStart?.toISOString(),
          assignedStallion: plan?.sire ? { id: plan.sire.id, name: plan.sire.name } : undefined,
          breedingPlanId: plan?.id,
          lastBreedingDate: plan?.breedDateActual?.toISOString(),
          pregnancyConfirmedDate: plan?.status === "PREGNANT" ? plan?.updatedAt?.toISOString() : undefined, // Use plan update time as proxy
          expectedFoalingDate: plan?.expectedBirthDate?.toISOString(),
          daysToFoaling,
        };
      });

      // Filter by status if specified
      let filteredMares = statusFilter
        ? processedMares.filter((m) => statusFilter.includes(m.reproductiveStatus))
        : processedMares;

      // Sort
      filteredMares.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "status":
            comparison = a.reproductiveStatus.localeCompare(b.reproductiveStatus);
            break;
          case "expectedDueDate":
            const aDate = a.expectedFoalingDate ? new Date(a.expectedFoalingDate).getTime() : 0;
            const bDate = b.expectedFoalingDate ? new Date(b.expectedFoalingDate).getTime() : 0;
            comparison = aDate - bDate;
            break;
          case "statusUpdatedAt":
          default:
            const aUpdate = a.statusUpdatedAt ? new Date(a.statusUpdatedAt).getTime() : 0;
            const bUpdate = b.statusUpdatedAt ? new Date(b.statusUpdatedAt).getTime() : 0;
            comparison = aUpdate - bUpdate;
            break;
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Calculate status counts - match MareWorkflowStatus type
      const statusCounts: Record<MareWorkflowStatus, number> = {
        open: 0,
        in_heat: 0,
        bred_waiting: 0,
        pregnant: 0,
        foaling_soon: 0,
        nursing: 0,
        barren: 0,
        resting: 0,
      };
      for (const mare of processedMares) {
        statusCounts[mare.reproductiveStatus]++;
      }

      // Paginate
      const total = filteredMares.length;
      const paginatedMares = filteredMares.slice(skip, skip + limit);

      return reply.send({
        data: paginatedMares,
        total,
        page,
        limit,
        statusCounts,
      });
    } catch (err) {
      console.error("Error fetching mare status:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/horses/mare-status/filters
   * Get filter options for mare status page
   */
  app.get("/horses/mare-status/filters", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get stallions that have breeding plans with mares
      const stallions = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "MALE",
          archived: false,
          breedingPlansAsSire: {
            some: {
              tenantId,
              status: { notIn: ["COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
            },
          },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return reply.send({
        locations: [], // Location filtering not currently supported on Animal model
        stallions,
      });
    } catch (err) {
      console.error("Error fetching mare status filters:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  // NOTE: Breeding availability toggle (open/resting) now uses the generic
  // PATCH /api/v1/animals/:id/breeding-availability endpoint (in animals.ts)
  // which works for all species, not just horses.

  /**
   * GET /api/v1/horses/stallion-calendar
   * Stallion calendar with events for date range
   */
  app.get("/horses/stallion-calendar", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const query = req.query as Record<string, unknown>;
      const startDate = query.startDate ? new Date(String(query.startDate)) : new Date();
      const endDate = query.endDate
        ? new Date(String(query.endDate))
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const stallionIdFilter = query.stallionId ? Number(query.stallionId) : undefined;
      const eventTypesFilter = query.eventTypes
        ? String(query.eventTypes).split(",")
        : undefined;

      // Get stallions with breeding plans in date range
      const stallions = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "MALE",
          archived: false,
          status: { in: ["ACTIVE", "BREEDING"] },
          ...(stallionIdFilter && { id: stallionIdFilter }),
        },
        include: {
          breedingPlansAsSire: {
            where: {
              status: { notIn: ["COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
            },
            include: {
              dam: { select: { id: true, name: true } },
            },
          },
          breedingAttemptsAsSire: {
            where: {
              attemptAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            orderBy: { attemptAt: "asc" },
          },
        },
      });

      // Build events from breeding attempts and plans
      const events: any[] = [];
      const stallionColors = [
        "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
        "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
      ];

      const stallionList = stallions.map((s, idx) => ({
        id: s.id,
        name: s.name,
        color: stallionColors[idx % stallionColors.length],
      }));

      let totalBreedings = 0;
      let totalCollections = 0;
      let upcomingBreedings = 0;
      let bookedMares = 0;

      for (const stallion of stallions) {
        const color = stallionList.find((s) => s.id === stallion.id)?.color || "#9ca3af";

        // Add breeding attempts as events
        for (const attempt of stallion.breedingAttemptsAsSire) {
          if (!attempt.attemptAt) continue; // Skip attempts without dates
          if (!eventTypesFilter || eventTypesFilter.includes("breeding")) {
            events.push({
              id: `breeding-${attempt.id}`,
              type: "breeding" as const,
              date: attempt.attemptAt.toISOString(),
              stallionId: stallion.id,
              stallionName: stallion.name,
              mareId: attempt.planId, // Link to breeding plan
              mareName: "Mare", // Simplified - would need join
              breedingMethod: attempt.method || "ai_fresh",
              status: attempt.success === true ? "completed" : "scheduled",
              color,
            });
            totalBreedings++;
          }
        }

        // Add upcoming breeding plans as events
        for (const plan of stallion.breedingPlansAsSire) {
          if (plan.status === "CYCLE" || plan.status === "BRED") {
            bookedMares++;
            if (!eventTypesFilter || eventTypesFilter.includes("booking")) {
              // Estimate breed date from expected birth - gestation
              const estimatedBreedDate = plan.expectedBirthDate
                ? new Date(new Date(plan.expectedBirthDate).getTime() - 340 * 24 * 60 * 60 * 1000)
                : new Date();

              if (estimatedBreedDate >= startDate && estimatedBreedDate <= endDate) {
                events.push({
                  id: `booking-${plan.id}`,
                  type: "booking" as const,
                  date: estimatedBreedDate.toISOString(),
                  stallionId: stallion.id,
                  stallionName: stallion.name,
                  mareId: plan.dam?.id,
                  mareName: plan.dam?.name || "Unknown",
                  status: plan.status.toLowerCase(),
                  color,
                });
                upcomingBreedings++;
              }
            }
          }
        }
      }

      // Sort events by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return reply.send({
        events,
        stallions: stallionList,
        stats: {
          totalBreedings,
          totalCollections,
          upcomingBreedings,
          bookedMares,
        },
      });
    } catch (err) {
      console.error("Error fetching stallion calendar:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/horses/pre-foaling
   * Pre-foaling alerts with pagination
   */
  app.get("/horses/pre-foaling", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const query = req.query as Record<string, unknown>;
      const { page, limit, skip } = parsePaging(query);
      const daysOut = Number(query.daysOut || 60);
      const onWatchOnly = query.onWatchOnly === "true";
      const sortBy = String(query.sortBy || "dueDate");

      // Get pregnant mares within daysOut of due date
      const now = new Date();
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysOut);

      // Valid MilestoneType values for pre-foaling signs
      const signMilestoneTypes = Object.keys(SIGN_URGENCY) as Array<
        "UDDER_DEVELOPMENT" | "WAX_APPEARANCE" | "VULVAR_RELAXATION" |
        "TAILHEAD_RELAXATION" | "UDDER_FULL" | "MILK_CALCIUM_TEST"
      >;

      const plans = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          species: "HORSE",
          status: "PREGNANT",
          expectedBirthDate: {
            lte: targetDate,
          },
        },
        include: {
          dam: {
            include: {
              mareReproductiveHistory: true,
            },
          },
          breedingMilestones: {
            where: {
              milestoneType: {
                in: signMilestoneTypes,
              },
            },
          },
        },
        orderBy: { expectedBirthDate: "asc" },
      });

      let totalPregnant = plans.length;
      let dueSoon = 0;
      let overdue = 0;
      let onWatch = 0;
      let highUrgencyCount = 0;

      const mares = plans.map((plan) => {
        if (!plan.dam || !plan.expectedBirthDate) {
          return null;
        }

        const daysUntilDue = daysBetween(now, new Date(plan.expectedBirthDate));

        // Track stats
        if (daysUntilDue < 0) overdue++;
        else if (daysUntilDue <= 14) dueSoon++;

        // Build signs array
        const signs = Object.keys(SIGN_URGENCY).map((signType) => {
          const milestone = plan.breedingMilestones.find(
            (m) => m.milestoneType === signType
          );

          return {
            type: signType,
            label: SIGN_LABELS[signType] || signType,
            observed: milestone?.isCompleted ?? false,
            observedAt: milestone?.completedDate?.toISOString(),
            urgencyLevel: SIGN_URGENCY[signType] || 1,
          };
        });

        // Calculate urgency score
        const observedSigns = signs.filter((s) => s.observed);
        const signUrgencySum = observedSigns.reduce((sum, s) => sum + s.urgencyLevel, 0);
        const maxPossibleUrgency = Object.values(SIGN_URGENCY).reduce((a, b) => a + b, 0);

        const signScore = (signUrgencySum / maxPossibleUrgency) * 50;

        let daysScore = 0;
        if (daysUntilDue < 0) {
          daysScore = 50;
        } else if (daysUntilDue <= 7) {
          daysScore = 40 + (7 - daysUntilDue) * (10 / 7);
        } else if (daysUntilDue <= 14) {
          daysScore = 25 + (14 - daysUntilDue) * (15 / 7);
        } else if (daysUntilDue <= 30) {
          daysScore = (30 - daysUntilDue) * (25 / 16);
        }

        const urgencyScore = Math.round(signScore + daysScore);

        if (urgencyScore > 70) {
          highUrgencyCount++;
        }

        // Check if on watch (manual flag or high urgency)
        const isOnWatch = urgencyScore > 50 || observedSigns.length >= 3;
        if (isOnWatch) onWatch++;

        return {
          id: plan.dam.id,
          name: plan.dam.name,
          photoUrl: plan.dam.photoUrl || undefined,
          breedingPlanId: plan.id,
          daysUntilDue,
          expectedDue: plan.expectedBirthDate.toISOString(),
          signs,
          urgencyScore,
          isOnWatch,
          riskScore: plan.dam.mareReproductiveHistory?.riskScore || 0,
          riskFactors: plan.dam.mareReproductiveHistory?.riskFactors || [],
        };
      }).filter((m): m is NonNullable<typeof m> => m !== null);

      // Filter by onWatch if specified
      let filteredMares = onWatchOnly ? mares.filter((m) => m.isOnWatch) : mares;

      // Sort
      filteredMares.sort((a, b) => {
        switch (sortBy) {
          case "name":
            return a.name.localeCompare(b.name);
          case "urgencyScore":
            return b.urgencyScore - a.urgencyScore;
          case "dueDate":
          default:
            return a.daysUntilDue - b.daysUntilDue;
        }
      });

      // Paginate
      const total = filteredMares.length;
      const paginatedMares = filteredMares.slice(skip, skip + limit);

      return reply.send({
        data: paginatedMares,
        total,
        page,
        limit,
        summary: {
          totalPregnant,
          dueSoon,
          overdue,
          onWatch,
        },
        highUrgencyCount,
      });
    } catch (err) {
      console.error("Error fetching pre-foaling data:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default horseWorkflowRoutes;
