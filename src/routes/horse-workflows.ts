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

// Status priority for selecting the "most active" plan (lower index = higher priority)
const STATUS_PRIORITY: string[] = [
  "BRED",
  "PREGNANT",
  "CYCLE",
  "COMMITTED",        // deprecated alias for CYCLE
  "CYCLE_EXPECTED",
  "HORMONE_TESTING",
  "WEANING",
  "BORN",
  "BIRTHED",
  "WEANED",
  "PLACEMENT",
  "PLANNING",
  "ON_HOLD",
];

/** Select the most representative plan from a list using status priority then recency. */
function pickActivePlan(plans: any[]): any | null {
  if (!plans || plans.length === 0) return null;
  return [...plans].sort((a, b) => {
    const aPri = STATUS_PRIORITY.indexOf((a.status || "").toUpperCase());
    const bPri = STATUS_PRIORITY.indexOf((b.status || "").toUpperCase());
    const aIdx = aPri === -1 ? 999 : aPri;
    const bIdx = bPri === -1 ? 999 : bPri;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  })[0];
}

// Numeric uterine edema grade → display label
const EDEMA_LABELS: Record<number, string> = {
  0: "none",
  1: "mild",
  2: "moderate",
  3: "severe",
  4: "marked",
};

/**
 * Derive mare workflow status from the active breeding plan.
 * Plan-driven: status comes from the breeding plan lifecycle, not from
 * the reproductiveCycles table which tracked raw cycle observations.
 */
function deriveMareWorkflowStatus(
  plan: any,
  breedingAvailability?: string | null,
  isBarren?: boolean | null,
): MareWorkflowStatus {
  const now = new Date();

  if (!plan) {
    // No active plan — check manual overrides
    if (isBarren) return "barren";
    if (breedingAvailability === "resting") return "resting";
    return "open";
  }

  const status = (plan.status || "PLANNING").toUpperCase();

  // Active cycle monitoring → in_heat
  if (["CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING"].includes(status)) {
    return "in_heat";
  }

  // Bred, awaiting pregnancy confirmation
  if (status === "BRED") return "bred_waiting";

  // Confirmed pregnant
  if (status === "PREGNANT") {
    if (plan.expectedBirthDate) {
      const daysUntilDue = daysBetween(now, new Date(plan.expectedBirthDate));
      if (daysUntilDue <= 30) return "foaling_soon";
    }
    return "pregnant";
  }

  // Post-birth states — nursing or resting based on days since birth
  if (["BIRTHED", "BORN", "WEANING"].includes(status)) {
    if (plan.birthDateActual) {
      const daysSinceBirth = daysBetween(new Date(plan.birthDateActual), now);
      if (daysSinceBirth <= 30) return "nursing";
      if (daysSinceBirth <= 60) return "resting";
      // > 60 days post-birth: fall through to open/resting manual check
    } else {
      // Status is post-birth but no date recorded — default to nursing
      return "nursing";
    }
  }

  // Weaned / placement — mare has been through birth cycle, now resting
  if (["WEANED", "PLACEMENT"].includes(status)) {
    return "resting";
  }

  // PLANNING, terminal, or unknown status — check manual overrides
  if (isBarren) return "barren";
  if (breedingAvailability === "resting") return "resting";
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

      // Get all female horses for this tenant.
      // If a stallion filter is set, restrict to mares with active plans for that stallion.
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
          ...(stallionIdFilter && {
            breedingPlansAsDam: {
              some: {
                sireId: stallionIdFilter,
                status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
              },
            },
          }),
        },
        include: {
          mareReproductiveHistory: true,
          breedingPlansAsDam: {
            where: {
              status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
              ...(stallionIdFilter && { sireId: stallionIdFilter }),
            },
            orderBy: { updatedAt: "desc" },
            include: {
              sire: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Batch-fetch most recent follicle exam per mare (avoids N+1 anti-pattern)
      const mareIds = mares.map((m) => m.id);
      const follicleExams = mareIds.length > 0
        ? await prisma.testResult.findMany({
            where: {
              animalId: { in: mareIds },
              kind: "FOLLICLE_EXAM",
            },
            orderBy: { collectedAt: "desc" },
            select: { animalId: true, data: true, collectedAt: true },
          })
        : [];

      // Build map: animalId → most recent exam (results are desc so first wins)
      const latestExamByMare = new Map<number, { data: unknown; collectedAt: Date }>();
      for (const exam of follicleExams) {
        if (exam.animalId == null) continue;
        if (!latestExamByMare.has(exam.animalId)) {
          latestExamByMare.set(exam.animalId, exam);
        }
      }

      // Process mares: derive status from breeding plans (plan-driven approach)
      const processedMares = mares.map((mare) => {
        const plan = pickActivePlan(mare.breedingPlansAsDam);
        const reproductiveStatus = deriveMareWorkflowStatus(
          plan,
          mare.breedingAvailability,
          mare.mareReproductiveHistory?.isBarren,
        );

        const planStatus = (plan?.status || "").toUpperCase();

        // Cycle day — computed from plan.cycleStartDateActual (plan-driven)
        let currentCycleDay: number | undefined;
        let isInBreedingWindow: boolean | undefined;
        if (
          plan?.cycleStartDateActual &&
          ["CYCLE", "COMMITTED", "CYCLE_EXPECTED", "HORMONE_TESTING"].includes(planStatus)
        ) {
          currentCycleDay = Math.max(1, daysBetween(new Date(plan.cycleStartDateActual), new Date()));
          // Horse optimal breeding window: days 4–6 of estrus
          isInBreedingWindow = currentCycleDay >= 4 && currentCycleDay <= 6;
        }

        // Days to foaling (only for pregnant/foaling_soon mares)
        let daysToFoaling: number | undefined;
        if (plan?.expectedBirthDate && planStatus === "PREGNANT") {
          daysToFoaling = Math.max(0, daysBetween(new Date(), new Date(plan.expectedBirthDate)));
        }

        // Follicle exam data from batch query
        const latestExam = latestExamByMare.get(mare.id);
        const examData = latestExam?.data as any;
        const follicle = examData?.dominantFollicle;
        const lastFollicleSize: number | undefined = follicle?.sizeMm ?? undefined;
        const lastFollicleOvary: "LEFT" | "RIGHT" | undefined = follicle?.ovary ?? undefined;
        const edemaNum = typeof examData?.uterineEdema === "number" ? examData.uterineEdema : null;
        const lastUterineEdema = edemaNum != null ? (EDEMA_LABELS[edemaNum] || undefined) : undefined;
        const lastExamDate = latestExam?.collectedAt?.toISOString();

        return {
          id: mare.id,
          name: mare.name,
          registrationNumber: mare.microchip || undefined,
          photoUrl: mare.photoUrl || undefined,
          reproductiveStatus,
          statusUpdatedAt: plan?.updatedAt?.toISOString() || mare.updatedAt.toISOString(),
          currentCycleDay,
          lastHeatDate: plan?.cycleStartDateActual?.toISOString(),
          isInBreedingWindow,
          breedingWindowStart: 4,  // horse standard: day 4 of estrus
          breedingWindowEnd: 6,    // horse standard: day 6 of estrus
          assignedStallion: plan?.sire ? { id: plan.sire.id, name: plan.sire.name } : undefined,
          breedingPlanId: plan?.id,
          lastBreedingDate: plan?.breedDateActual?.toISOString(),
          expectedFoalingDate: plan?.expectedBirthDate?.toISOString(),
          daysToFoaling,
          lastFollicleSize,
          lastFollicleOvary,
          lastUterineEdema,
          lastExamDate,
          noteCount: 0,
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
          case "expectedFoalingDate":
          case "expectedDueDate": {
            const aDate = a.expectedFoalingDate ? new Date(a.expectedFoalingDate).getTime() : 0;
            const bDate = b.expectedFoalingDate ? new Date(b.expectedFoalingDate).getTime() : 0;
            comparison = aDate - bDate;
            break;
          }
          case "statusUpdatedAt":
          default: {
            const aUpdate = a.statusUpdatedAt ? new Date(a.statusUpdatedAt).getTime() : 0;
            const bUpdate = b.statusUpdatedAt ? new Date(b.statusUpdatedAt).getTime() : 0;
            comparison = aUpdate - bUpdate;
            break;
          }
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Calculate status counts
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
              status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
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
              status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
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

      // Valid MilestoneType values for pre-foaling signs + manual watch sentinel
      const signMilestoneTypes = Object.keys(SIGN_URGENCY) as Array<
        "UDDER_DEVELOPMENT" | "WAX_APPEARANCE" | "VULVAR_RELAXATION" |
        "TAILHEAD_RELAXATION" | "UDDER_FULL" | "MILK_CALCIUM_TEST"
      >;
      const fetchedMilestoneTypes = [
        ...signMilestoneTypes,
        "BEGIN_MONITORING" as const,
      ];

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
          sire: {
            select: { id: true, name: true },
          },
          breedingMilestones: {
            where: {
              milestoneType: { in: fetchedMilestoneTypes },
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

        // Check if on watch: manual flag takes precedence, otherwise auto-derive from urgency
        const manualWatchMilestone = plan.breedingMilestones.find(
          (m) => m.notes === "FOALING_WATCH_MANUAL"
        );
        const isManualWatch = manualWatchMilestone?.isCompleted ?? false;
        const isOnWatch = isManualWatch || urgencyScore > 50 || observedSigns.length >= 3;
        if (isOnWatch) onWatch++;

        // Calculate gestation days from breed date
        const breedDate = plan.breedDateActual;
        const gestationDays = breedDate
          ? daysBetween(new Date(breedDate), now)
          : 0;

        // Derive foalingIndicators from milestone signs
        const udderMilestone = plan.breedingMilestones.find((m) => m.milestoneType === "UDDER_DEVELOPMENT");
        const udderFullMilestone = plan.breedingMilestones.find((m) => m.milestoneType === "UDDER_FULL");
        const waxMilestone = plan.breedingMilestones.find((m) => m.milestoneType === "WAX_APPEARANCE");
        const vulvaMilestone = plan.breedingMilestones.find((m) => m.milestoneType === "VULVAR_RELAXATION");
        const tailMilestone = plan.breedingMilestones.find((m) => m.milestoneType === "TAILHEAD_RELAXATION");

        let udderDevelopment: "none" | "filling" | "full" | "waxing" = "none";
        if (waxMilestone?.isCompleted) udderDevelopment = "waxing";
        else if (udderFullMilestone?.isCompleted) udderDevelopment = "full";
        else if (udderMilestone?.isCompleted) udderDevelopment = "filling";

        const vulvaRelaxation: "none" | "slight" | "significant" =
          vulvaMilestone?.isCompleted ? "significant" : "none";
        const tailHeadRelaxation: "none" | "slight" | "significant" =
          tailMilestone?.isCompleted ? "significant" : "none";

        // Find the most recent check timestamp from any observed milestone
        const lastCheckedMilestone = plan.breedingMilestones
          .filter((m) => m.completedDate)
          .sort((a, b) =>
            new Date(b.completedDate!).getTime() - new Date(a.completedDate!).getTime()
          )[0];

        return {
          id: plan.dam.id,
          name: plan.dam.name,
          photoUrl: plan.dam.photoUrl || undefined,
          breedingPlanId: plan.id,

          // Breeding info
          bredToStallion: plan.sire
            ? { id: plan.sire.id, name: plan.sire.name }
            : { id: 0, name: "Unknown" },
          breedingDate: breedDate ? breedDate.toISOString() : "",
          breedingMethod: "ai_fresh",

          // Pregnancy timeline — use field names matching PreFoalingEntry
          gestationDays,
          expectedFoalingDate: plan.expectedBirthDate.toISOString(),
          daysToFoaling: daysUntilDue,
          pregnancyConfirmedDate: plan.updatedAt.toISOString(),

          // Foaling indicators (derived from milestone signs)
          foalingIndicators: {
            udderDevelopment,
            vulvaRelaxation,
            tailHeadRelaxation,
            behaviorChanges: [] as string[],
            lastCheckedAt: lastCheckedMilestone?.completedDate
              ? new Date(lastCheckedMilestone.completedDate).toISOString()
              : undefined,
            lastCheckedBy: undefined as string | undefined,
          },

          // Watch status
          onFoalingWatch: isOnWatch,

          // Location & history
          currentLocation: "",
          previousFoalings: 0,
          averageGestation: undefined as number | undefined,

          // Extra fields (not in PreFoalingEntry but useful for UI)
          urgencyScore,
          riskScore: plan.dam.mareReproductiveHistory?.riskScore || 0,
          riskFactors: plan.dam.mareReproductiveHistory?.riskFactors || [],
        };
      }).filter((m): m is NonNullable<typeof m> => m !== null);

      // Filter by onWatch if specified
      let filteredMares = onWatchOnly ? mares.filter((m) => m.onFoalingWatch) : mares;

      // Sort
      filteredMares.sort((a, b) => {
        switch (sortBy) {
          case "name":
            return a.name.localeCompare(b.name);
          case "urgencyScore":
            return b.urgencyScore - a.urgencyScore;
          case "gestationDays":
            return b.gestationDays - a.gestationDays;
          case "dueDate":
          default:
            return a.daysToFoaling - b.daysToFoaling;
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

  /**
   * PATCH /api/v1/horses/:mareId/foaling-watch
   * Toggle manual foaling watch on/off for a pregnant mare.
   * State is stored as a BreedingMilestone with notes="FOALING_WATCH_MANUAL".
   */
  app.patch("/horses/:mareId/foaling-watch", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const mareId = Number((req.params as any).mareId);
      if (!mareId) {
        return reply.code(400).send({ error: "invalid_mare_id" });
      }

      const body = req.body as { onWatch: boolean; watchNotes?: string };
      const { onWatch } = body;

      // Find the active PREGNANT plan for this mare
      const plan = await prisma.breedingPlan.findFirst({
        where: {
          tenantId,
          damId: mareId,
          status: "PREGNANT",
          archived: false,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!plan) {
        return reply.code(404).send({ error: "no_active_pregnant_plan" });
      }

      // Upsert the manual watch milestone
      const existing = await prisma.breedingMilestone.findFirst({
        where: {
          tenantId,
          breedingPlanId: plan.id,
          notes: "FOALING_WATCH_MANUAL",
        },
      });

      if (existing) {
        await prisma.breedingMilestone.update({
          where: { id: existing.id },
          data: {
            isCompleted: onWatch,
            completedDate: onWatch ? new Date() : null,
          },
        });
      } else if (onWatch) {
        await prisma.breedingMilestone.create({
          data: {
            tenantId,
            breedingPlanId: plan.id,
            milestoneType: "BEGIN_MONITORING",
            scheduledDate: new Date(),
            isCompleted: true,
            completedDate: new Date(),
            notes: "FOALING_WATCH_MANUAL",
          },
        });
      }

      return reply.send({ success: true, onWatch });
    } catch (err) {
      console.error("Error updating foaling watch:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * POST /api/v1/horses/:mareId/foaling-check
   * Record a foaling check observation (physical signs + behavior) for a pregnant mare.
   * Dual-writes to BreedingMilestone to keep urgency scoring current.
   */
  app.post("/horses/:mareId/foaling-check", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const mareId = Number((req.params as any).mareId);
      if (!mareId) {
        return reply.code(400).send({ error: "invalid_mare_id" });
      }

      const body = req.body as {
        udderDevelopment?: string;
        vulvaRelaxation?: string;
        tailHeadRelaxation?: string;
        temperature?: number;
        behaviorNotes?: string[];
        additionalNotes?: string;
        foalingImminent?: boolean;
        checkedAt?: string;
      };

      const udderDevelopment = body.udderDevelopment || "none";
      const vulvaRelaxation = body.vulvaRelaxation || "none";
      const tailHeadRelaxation = body.tailHeadRelaxation || "none";
      const behaviorNotes = body.behaviorNotes || [];
      const checkedAt = body.checkedAt ? new Date(body.checkedAt) : new Date();
      const userId = (req as any).userId as string | undefined;

      // Find the active PREGNANT plan for this mare
      const plan = await prisma.breedingPlan.findFirst({
        where: {
          tenantId,
          damId: mareId,
          status: "PREGNANT",
          archived: false,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!plan) {
        return reply.code(404).send({ error: "no_active_pregnant_plan" });
      }

      // Build milestone upserts — dual-write so urgency scoring stays accurate
      type MilestoneUpsert = {
        milestoneType: "UDDER_DEVELOPMENT" | "WAX_APPEARANCE" | "VULVAR_RELAXATION" | "TAILHEAD_RELAXATION" | "UDDER_FULL" | "MILK_CALCIUM_TEST";
        completedDate: Date;
      };

      const milestoneUpdates: MilestoneUpsert[] = [];

      if (udderDevelopment !== "none") {
        milestoneUpdates.push({ milestoneType: "UDDER_DEVELOPMENT", completedDate: checkedAt });
      }
      if (udderDevelopment === "full" || udderDevelopment === "waxing") {
        milestoneUpdates.push({ milestoneType: "UDDER_FULL", completedDate: checkedAt });
      }
      if (udderDevelopment === "waxing") {
        milestoneUpdates.push({ milestoneType: "WAX_APPEARANCE", completedDate: checkedAt });
      }
      if (vulvaRelaxation !== "none") {
        milestoneUpdates.push({ milestoneType: "VULVAR_RELAXATION", completedDate: checkedAt });
      }
      if (tailHeadRelaxation !== "none") {
        milestoneUpdates.push({ milestoneType: "TAILHEAD_RELAXATION", completedDate: checkedAt });
      }
      if (behaviorNotes.includes("milk_dripping")) {
        milestoneUpdates.push({ milestoneType: "MILK_CALCIUM_TEST", completedDate: checkedAt });
      }

      const now = new Date();

      // Create the check record + upsert milestones in a transaction
      const check = await prisma.$transaction(async (tx) => {
        const created = await tx.foalingCheck.create({
          data: {
            tenantId,
            breedingPlanId: plan.id,
            checkedAt,
            checkedByUserId: userId || null,
            udderDevelopment,
            vulvaRelaxation,
            tailHeadRelaxation,
            temperature: body.temperature != null ? body.temperature : null,
            behaviorNotes,
            additionalNotes: body.additionalNotes || null,
            foalingImminent: body.foalingImminent ?? false,
            updatedAt: now,
          },
        });

        // Upsert each milestone sign — only advance forward (never un-complete)
        for (const update of milestoneUpdates) {
          const existing = await tx.breedingMilestone.findFirst({
            where: { tenantId, breedingPlanId: plan.id, milestoneType: update.milestoneType },
          });

          if (existing) {
            if (!existing.isCompleted) {
              await tx.breedingMilestone.update({
                where: { id: existing.id },
                data: { isCompleted: true, completedDate: update.completedDate, updatedAt: now },
              });
            }
          } else {
            await tx.breedingMilestone.create({
              data: {
                tenantId,
                breedingPlanId: plan.id,
                milestoneType: update.milestoneType,
                scheduledDate: checkedAt,
                isCompleted: true,
                completedDate: update.completedDate,
                updatedAt: now,
              },
            });
          }
        }

        return created;
      });

      return reply.code(201).send(check);
    } catch (err) {
      console.error("Error recording foaling check:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/horses/:mareId/foaling-checks
   * Returns paginated foaling check history for a mare's current pregnant plan,
   * ordered most-recent first.
   */
  app.get("/horses/:mareId/foaling-checks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const mareId = Number((req.params as any).mareId);
      if (!mareId) {
        return reply.code(400).send({ error: "invalid_mare_id" });
      }

      const query = req.query as Record<string, unknown>;
      const limit = Math.min(Number(query.limit || 20), 100);
      const offset = Number(query.offset || 0);

      // Find the active PREGNANT plan for this mare
      const plan = await prisma.breedingPlan.findFirst({
        where: {
          tenantId,
          damId: mareId,
          status: "PREGNANT",
          archived: false,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      // No plan = no checks, return empty gracefully
      if (!plan) {
        return reply.send({ data: [], total: 0 });
      }

      const [checks, total] = await prisma.$transaction([
        prisma.foalingCheck.findMany({
          where: { breedingPlanId: plan.id, tenantId },
          orderBy: { checkedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.foalingCheck.count({
          where: { breedingPlanId: plan.id, tenantId },
        }),
      ]);

      return reply.send({ data: checks, total });
    } catch (err) {
      console.error("Error fetching foaling checks:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default horseWorkflowRoutes;
