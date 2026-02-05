// src/routes/horse-dashboard.ts
// Horse-specific dashboard widget API endpoints
//
// GET /api/v1/dashboard/horse/mare-status       - Mare status grid data
// GET /api/v1/dashboard/horse/pre-foaling-signs - Pre-foaling alerts
// GET /api/v1/dashboard/horse/foaling-analytics - Foaling trends and analytics
// GET /api/v1/dashboard/horse/ovulation-tracking - Ovulation tracker data
// GET /api/v1/dashboard/horse/mare-performance   - Mare performance stats
// GET /api/v1/dashboard/horse/stallion-calendar  - Stallion breeding calendar
// GET /api/v1/dashboard/horse/genetic-overview   - Genetic intelligence data
// GET /api/v1/dashboard/horse/stallion-revenue   - Stallion revenue tracking
// GET /api/v1/dashboard/horse/foals-ytd         - Foals born year-to-date count
// GET /api/v1/dashboard/horse/season-bookings   - Season stallion booking utilization

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ───────────────────────── Types ─────────────────────────

type MareReproductiveStatus =
  | "open"
  | "in-heat"
  | "bred"
  | "pregnant"
  | "due-soon"
  | "imminent"
  | "overdue"
  | "foaled";

interface MareStatusItem {
  id: number;
  name: string;
  photoUrl?: string;
  status: MareReproductiveStatus;
  daysInStatus: number;
  expectedDue?: string;
  daysUntilDue?: number;
  stallionName?: string;
  riskScore?: number;
  riskFactors?: string[];
  breedingPlanId?: number;
}

interface PreFoalingSign {
  type: string;
  label: string;
  observed: boolean;
  observedAt?: string;
  urgencyLevel: number;
}

interface PreFoalingMare {
  id: number;
  name: string;
  daysUntilDue: number;
  expectedDue: string;
  signs: PreFoalingSign[];
  urgencyScore: number;
  breedingPlanId: number;
}

// ───────────────────────── Helpers ─────────────────────────

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function deriveMareStatus(
  plan: any,
  reproHistory: any,
  hasCycle: boolean
): { status: MareReproductiveStatus; daysInStatus: number } {
  const now = new Date();

  // Check if recently foaled (within 30 days)
  if (plan?.birthDateActual) {
    const daysSinceBirth = daysBetween(new Date(plan.birthDateActual), now);
    if (daysSinceBirth <= 30) {
      return { status: "foaled", daysInStatus: daysSinceBirth };
    }
  }

  // Check if pregnant with due date
  if (plan?.status === "PREGNANT" && plan?.expectedBirthDate) {
    const dueDate = new Date(plan.expectedBirthDate);
    const daysUntilDue = daysBetween(now, dueDate);

    if (daysUntilDue < 0) {
      return { status: "overdue", daysInStatus: Math.abs(daysUntilDue) };
    }
    if (daysUntilDue <= 7) {
      return { status: "imminent", daysInStatus: daysUntilDue };
    }
    if (daysUntilDue <= 30) {
      return { status: "due-soon", daysInStatus: daysUntilDue };
    }
    // Count days pregnant
    const breedDate = plan.breedDateActual ? new Date(plan.breedDateActual) : null;
    const daysPregnant = breedDate ? daysBetween(breedDate, now) : 0;
    return { status: "pregnant", daysInStatus: daysPregnant };
  }

  // Check if bred (awaiting confirmation)
  if (plan?.status === "BRED" && plan?.breedDateActual) {
    const daysSinceBred = daysBetween(new Date(plan.breedDateActual), now);
    return { status: "bred", daysInStatus: daysSinceBred };
  }

  // Check if in heat (has active cycle)
  if (hasCycle) {
    return { status: "in-heat", daysInStatus: 0 };
  }

  // Default: open
  return { status: "open", daysInStatus: 0 };
}

// Sign type configuration for urgency
const SIGN_URGENCY: Record<string, number> = {
  UDDER_DEVELOPMENT: 3,
  WAX_APPEARANCE: 8,
  MILK_DRIPPING: 9,
  VULVAR_RELAXATION: 7,
  BELLY_DROP: 5,
  RESTLESSNESS: 6,
  SWEATING: 8,
  TAIL_WRAPPING: 4,
  TAILHEAD_RELAXATION: 6,
  UDDER_FULL: 7,
  MILK_CALCIUM_TEST: 5,
};

const SIGN_LABELS: Record<string, string> = {
  UDDER_DEVELOPMENT: "Udder Development",
  WAX_APPEARANCE: "Waxing",
  MILK_DRIPPING: "Milk Dripping",
  VULVAR_RELAXATION: "Vulva Relaxation",
  BELLY_DROP: "Belly Drop",
  RESTLESSNESS: "Restlessness",
  SWEATING: "Sweating",
  TAIL_WRAPPING: "Tail Wrapping",
  TAILHEAD_RELAXATION: "Tailhead Relaxation",
  UDDER_FULL: "Udder Full",
  MILK_CALCIUM_TEST: "Calcium Test",
};

// ───────────────────────── Routes ─────────────────────────

const horseDashboardRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/dashboard/horse/mare-status
   * Visual kanban of all mares by reproductive status
   */
  app.get("/dashboard/horse/mare-status", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get all female horses for this tenant
      const mares = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "FEMALE",
          archived: false,
          status: { in: ["ACTIVE", "BREEDING"] },
        },
        include: {
          mareReproductiveHistory: true,
          breedingPlansAsDam: {
            where: {
              status: { notIn: ["COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
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

      // Build status map
      const byStatus: Record<MareReproductiveStatus, MareStatusItem[]> = {
        open: [],
        "in-heat": [],
        bred: [],
        pregnant: [],
        "due-soon": [],
        imminent: [],
        overdue: [],
        foaled: [],
      };

      const counts = {
        open: 0,
        inHeat: 0,
        bred: 0,
        pregnant: 0,
        dueSoon: 0,
        imminent: 0,
        overdue: 0,
        foaled: 0,
      };

      for (const mare of mares) {
        const plan = mare.breedingPlansAsDam[0];
        const reproHistory = mare.mareReproductiveHistory;
        const hasCycle = mare.reproductiveCycles.length > 0;

        const { status, daysInStatus } = deriveMareStatus(plan, reproHistory, hasCycle);

        const item: MareStatusItem = {
          id: mare.id,
          name: mare.name,
          photoUrl: mare.photoUrl || undefined,
          status,
          daysInStatus,
          expectedDue: plan?.expectedBirthDate?.toISOString(),
          daysUntilDue: plan?.expectedBirthDate
            ? daysBetween(new Date(), new Date(plan.expectedBirthDate))
            : undefined,
          stallionName: plan?.sire?.name,
          riskScore: reproHistory?.riskScore ?? undefined,
          riskFactors: reproHistory?.riskFactors ?? undefined,
          breedingPlanId: plan?.id,
        };

        byStatus[status].push(item);

        // Update counts
        switch (status) {
          case "open":
            counts.open++;
            break;
          case "in-heat":
            counts.inHeat++;
            break;
          case "bred":
            counts.bred++;
            break;
          case "pregnant":
            counts.pregnant++;
            break;
          case "due-soon":
            counts.dueSoon++;
            break;
          case "imminent":
            counts.imminent++;
            break;
          case "overdue":
            counts.overdue++;
            break;
          case "foaled":
            counts.foaled++;
            break;
        }
      }

      return reply.send({
        byStatus,
        totalMares: mares.length,
        counts,
      });
    } catch (err) {
      console.error("Error fetching mare status:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/pre-foaling-signs
   * Physical sign tracking with urgency scoring
   */
  app.get("/dashboard/horse/pre-foaling-signs", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get pregnant mares within 60 days of due date
      const now = new Date();
      const sixtyDaysOut = new Date(now);
      sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);

      const plans = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          species: "HORSE",
          status: "PREGNANT",
          expectedBirthDate: {
            lte: sixtyDaysOut,
          },
        },
        include: {
          dam: {
            select: { id: true, name: true },
          },
          breedingMilestones: {
            where: {
              milestoneType: {
                in: [
                  "UDDER_DEVELOPMENT",
                  "UDDER_FULL",
                  "WAX_APPEARANCE",
                  "VULVAR_RELAXATION",
                  "TAILHEAD_RELAXATION",
                  "MILK_CALCIUM_TEST",
                ],
              },
            },
          },
        },
        orderBy: { expectedBirthDate: "asc" },
      });

      const mares: PreFoalingMare[] = [];
      let highUrgencyCount = 0;

      for (const plan of plans) {
        if (!plan.dam || !plan.expectedBirthDate) continue;

        const daysUntilDue = daysBetween(now, new Date(plan.expectedBirthDate));

        // Build signs array
        const signs: PreFoalingSign[] = [];
        const allSignTypes = Object.keys(SIGN_URGENCY);

        for (const signType of allSignTypes) {
          const milestone = plan.breedingMilestones.find(
            (m) => m.milestoneType === signType
          );

          signs.push({
            type: signType,
            label: SIGN_LABELS[signType] || signType,
            observed: milestone?.isCompleted ?? false,
            observedAt: milestone?.completedDate?.toISOString(),
            urgencyLevel: SIGN_URGENCY[signType] || 1,
          });
        }

        // Calculate urgency score based on observed signs and days until due
        const observedSigns = signs.filter((s) => s.observed);
        const signUrgencySum = observedSigns.reduce((sum, s) => sum + s.urgencyLevel, 0);
        const maxPossibleUrgency = Object.values(SIGN_URGENCY).reduce((a, b) => a + b, 0);

        // Base score from signs (0-50 points)
        const signScore = (signUrgencySum / maxPossibleUrgency) * 50;

        // Days-based urgency (0-50 points)
        let daysScore = 0;
        if (daysUntilDue < 0) {
          daysScore = 50; // Overdue
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

        mares.push({
          id: plan.dam.id,
          name: plan.dam.name,
          daysUntilDue,
          expectedDue: plan.expectedBirthDate.toISOString(),
          signs,
          urgencyScore,
          breedingPlanId: plan.id,
        });
      }

      // Sort by urgency score descending
      mares.sort((a, b) => b.urgencyScore - a.urgencyScore);

      return reply.send({
        mares,
        highUrgencyCount,
      });
    } catch (err) {
      console.error("Error fetching pre-foaling signs:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/foaling-analytics
   * YoY trends and seasonality data
   */
  app.get("/dashboard/horse/foaling-analytics", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const currentYear = new Date().getFullYear();

      // Get foaling data for current and previous years
      const foalings = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          species: "HORSE",
          birthDateActual: { not: null },
        },
        select: {
          id: true,
          birthDateActual: true,
          expectedBirthDate: true,
          status: true,
          foalingOutcome: {
            select: {
              hadComplications: true,
            },
          },
        },
      });

      // Build yearly and monthly stats
      const yearlyStats: Record<number, { total: number; live: number; complications: number }> = {};
      const monthlyDistribution: Record<number, number> = {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
        7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
      };

      for (const foaling of foalings) {
        if (!foaling.birthDateActual) continue;

        const birthDate = new Date(foaling.birthDateActual);
        const year = birthDate.getFullYear();
        const month = birthDate.getMonth() + 1;

        if (!yearlyStats[year]) {
          yearlyStats[year] = { total: 0, live: 0, complications: 0 };
        }

        yearlyStats[year].total++;
        // Count as live foal if plan completed successfully (BIRTHED, WEANED, COMPLETE)
        if (["BIRTHED", "WEANED", "COMPLETE"].includes(foaling.status)) {
          yearlyStats[year].live++;
        }
        if (foaling.foalingOutcome?.hadComplications) {
          yearlyStats[year].complications++;
        }

        // Only count current and previous year for monthly distribution
        if (year >= currentYear - 1) {
          monthlyDistribution[month]++;
        }
      }

      // Build year-over-year comparison
      const years = Object.keys(yearlyStats)
        .map(Number)
        .sort((a, b) => b - a)
        .slice(0, 5);

      const yoyData = years.map((year) => ({
        year,
        totalFoalings: yearlyStats[year]?.total || 0,
        liveFoals: yearlyStats[year]?.live || 0,
        complicationRate:
          yearlyStats[year]?.total > 0
            ? Math.round((yearlyStats[year].complications / yearlyStats[year].total) * 100)
            : 0,
      }));

      // Calculate trend
      const currentYearStats = yearlyStats[currentYear] || { total: 0 };
      const prevYearStats = yearlyStats[currentYear - 1] || { total: 0 };
      const trend =
        prevYearStats.total > 0
          ? Math.round(((currentYearStats.total - prevYearStats.total) / prevYearStats.total) * 100)
          : 0;

      return reply.send({
        yearOverYear: yoyData,
        monthlyDistribution: Object.entries(monthlyDistribution).map(([month, count]) => ({
          month: parseInt(month),
          count,
        })),
        currentYearTotal: currentYearStats.total,
        trend,
        peakMonth: Object.entries(monthlyDistribution).reduce(
          (max, [month, count]) => (count > max.count ? { month: parseInt(month), count } : max),
          { month: 0, count: 0 }
        ).month,
      });
    } catch (err) {
      console.error("Error fetching foaling analytics:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/ovulation-tracking
   * Progesterone curves and LH detection with confidence scoring
   */
  app.get("/dashboard/horse/ovulation-tracking", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get mares with active breeding plans in CYCLE or BRED status
      const plans = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          species: "HORSE",
          status: { in: ["CYCLE", "BRED"] },
        },
        include: {
          dam: {
            select: { id: true, name: true },
          },
          TestResults: {
            where: {
              kind: { in: ["PROGESTERONE", "LH"] },
            },
            orderBy: { collectedAt: "desc" },
            take: 10,
          },
        },
      });

      const now = new Date();
      let maresInHeat = 0;
      let expectedOvulationsToday = 0;

      const mares = plans.map((plan) => {
        const tests = plan.TestResults.map((t) => ({
          date: t.collectedAt.toISOString(),
          type: t.kind.toLowerCase() as "progesterone" | "LH",
          value: t.valueNumber ?? 0,
        }));

        // Determine phase based on test results and plan status
        type Phase = "proestrus" | "estrus" | "ovulation" | "diestrus" | "anestrus";
        let currentPhase: Phase = "anestrus";
        let estimatedOvulation: string | null = null;
        let hoursUntilOvulation: number | null = null;
        let confidenceScore = 50; // Default medium confidence

        const lastProgesterone = tests.find((t) => t.type === "progesterone")?.value ?? null;
        const lastLH = tests.find((t) => t.type === "LH")?.value ?? null;

        // Simple phase detection logic based on progesterone levels
        if (lastProgesterone !== null) {
          if (lastProgesterone < 1) {
            currentPhase = "estrus";
            maresInHeat++;
            confidenceScore = 70;

            // Estimate ovulation if LH surge detected
            if (lastLH && lastLH > 10) {
              currentPhase = "ovulation";
              estimatedOvulation = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
              hoursUntilOvulation = 24;
              confidenceScore = 85;
              expectedOvulationsToday++;
            }
          } else if (lastProgesterone >= 1 && lastProgesterone < 2) {
            currentPhase = "proestrus";
            confidenceScore = 60;
          } else {
            currentPhase = "diestrus";
            confidenceScore = 75;
          }
        }

        // Adjust confidence based on number of tests
        if (tests.length >= 5) {
          confidenceScore = Math.min(95, confidenceScore + 10);
        } else if (tests.length < 2) {
          confidenceScore = Math.max(30, confidenceScore - 20);
        }

        return {
          id: plan.dam?.id ?? 0,
          name: plan.dam?.name ?? "Unknown",
          breedingPlanId: plan.id,
          currentPhase,
          estimatedOvulation,
          hoursUntilOvulation,
          confidenceScore,
          lastProgesterone,
          lastLH,
          tests: tests.slice(0, 7), // Last 7 tests for sparkline
        };
      });

      return reply.send({
        mares,
        maresInHeat,
        expectedOvulationsToday,
      });
    } catch (err) {
      console.error("Error fetching ovulation tracking:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/mare-performance
   * Lifetime mare stats, complication patterns, and risk scores
   */
  app.get("/dashboard/horse/mare-performance", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get mares with reproductive history
      const mares = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "FEMALE",
          archived: false,
        },
        include: {
          mareReproductiveHistory: true,
        },
      });

      // Calculate program averages
      let totalFoals = 0;
      let totalMares = 0;
      let totalSuccessRate = 0;
      let totalGestationDays = 0;
      let gestationCount = 0;

      const mareStats = mares
        .filter((m) => m.mareReproductiveHistory)
        .map((mare) => {
          const history = mare.mareReproductiveHistory!;

          const lifetimeFoals = history.totalFoalings || 0;
          const liveFoals = history.totalLiveFoals || 0;
          const complications = history.totalComplicatedFoalings || 0;

          const successRate = lifetimeFoals > 0 ? Math.round((liveFoals / lifetimeFoals) * 100) : 0;
          const complicationRate =
            lifetimeFoals > 0 ? Math.round((complications / lifetimeFoals) * 100) : 0;

          // Update averages
          if (lifetimeFoals > 0) {
            totalFoals += lifetimeFoals;
            totalMares++;
            totalSuccessRate += successRate;
          }

          return {
            id: mare.id,
            name: mare.name,
            photoUrl: mare.photoUrl || undefined,
            lifetimeFoals,
            successRate,
            avgGestationDays: 340, // Default horse gestation
            complicationRate,
            riskScore: history.riskScore || 0,
            riskFactors: history.riskFactors || [],
            lastFoalingDate: history.lastFoalingDate?.toISOString(),
            status: mare.status?.toLowerCase() as "active" | "retired" | "rest",
          };
        });

      // Separate into top performers and at-risk
      const topPerformers = mareStats
        .filter((m) => m.successRate >= 80 && m.lifetimeFoals >= 2)
        .sort((a, b) => b.successRate - a.successRate || b.lifetimeFoals - a.lifetimeFoals)
        .slice(0, 5);

      const atRisk = mareStats
        .filter((m) => m.riskScore >= 50 || m.complicationRate >= 30)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 5);

      return reply.send({
        topPerformers,
        atRisk,
        programAverages: {
          avgFoalsPerMare: totalMares > 0 ? totalFoals / totalMares : 0,
          avgSuccessRate: totalMares > 0 ? Math.round(totalSuccessRate / totalMares) : 0,
          avgGestationDays: 340, // Horse average
        },
      });
    } catch (err) {
      console.error("Error fetching mare performance:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/stallion-calendar
   * Stallion breeding schedule and availability
   */
  app.get("/dashboard/horse/stallion-calendar", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get stallions with active breeding plans
      const stallions = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "MALE",
          archived: false,
          status: { in: ["ACTIVE", "BREEDING"] },
        },
        include: {
          breedingPlansAsSire: {
            where: {
              status: { notIn: ["COMPLETE", "UNSUCCESSFUL", "CANCELED"] },
            },
            include: {
              dam: { select: { id: true, name: true } },
            },
            orderBy: { expectedBirthDate: "asc" },
          },
          breedingAttemptsAsSire: {
            orderBy: { attemptAt: "desc" },
            take: 10,
          },
        },
      });

      const now = new Date();
      const thirtyDaysOut = new Date(now);
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

      const stallionData = stallions.map((stallion) => {
        const activePlans = stallion.breedingPlansAsSire.length;
        const attempts = stallion.breedingAttemptsAsSire;

        // Calculate success rate from attempts
        const confirmedPregnancies = attempts.filter((a) => a.success === true).length;
        const successRate =
          attempts.length > 0 ? Math.round((confirmedPregnancies / attempts.length) * 100) : 0;

        // Get upcoming mares (breeding plans in CYCLE or BRED status)
        const upcomingMares = stallion.breedingPlansAsSire
          .filter((p) => p.status === "CYCLE" || p.status === "BRED")
          .map((p) => ({
            id: p.dam?.id ?? 0,
            name: p.dam?.name ?? "Unknown",
            expectedBreedDate: p.expectedBirthDate
              ? new Date(
                  new Date(p.expectedBirthDate).getTime() - 340 * 24 * 60 * 60 * 1000
                ).toISOString()
              : null,
            status: p.status.toLowerCase(),
            breedingPlanId: p.id,
          }));

        // Check availability (no overlapping breeding dates within 3 days)
        const recentAttemptDate = attempts[0]?.attemptAt;
        const daysSinceLastBreeding = recentAttemptDate
          ? daysBetween(new Date(recentAttemptDate), now)
          : 999;
        const isAvailable = daysSinceLastBreeding >= 3;

        return {
          id: stallion.id,
          name: stallion.name,
          photoUrl: stallion.photoUrl || undefined,
          activePlans,
          successRate,
          totalAttempts: attempts.length,
          upcomingMares,
          isAvailable,
          lastBreedingDate: recentAttemptDate?.toISOString(),
          nextAvailableDate: isAvailable
            ? now.toISOString()
            : new Date(
                new Date(recentAttemptDate!).getTime() + 3 * 24 * 60 * 60 * 1000
              ).toISOString(),
        };
      });

      return reply.send({
        stallions: stallionData,
        totalStallions: stallions.length,
        availableCount: stallionData.filter((s) => s.isAvailable).length,
      });
    } catch (err) {
      console.error("Error fetching stallion calendar:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/genetic-overview
   * COI heatmap and diversity scoring
   */
  app.get("/dashboard/horse/genetic-overview", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get horses with genetic data
      const horses = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          archived: false,
        },
        include: {
          genetics: true,
        },
      });

      // Build COI distribution
      const coiRanges = {
        veryLow: 0, // < 3%
        low: 0, // 3-6%
        moderate: 0, // 6-12%
        high: 0, // 12-25%
        veryHigh: 0, // > 25%
      };

      const horsesWithCoi = horses.filter((h) => h.coiPercent !== null);

      for (const horse of horsesWithCoi) {
        const coi = horse.coiPercent!;
        if (coi < 3) coiRanges.veryLow++;
        else if (coi < 6) coiRanges.low++;
        else if (coi < 12) coiRanges.moderate++;
        else if (coi < 25) coiRanges.high++;
        else coiRanges.veryHigh++;
      }

      // Calculate program diversity score (inverse of average COI)
      const avgCoi =
        horsesWithCoi.length > 0
          ? horsesWithCoi.reduce((sum, h) => sum + (h.coiPercent || 0), 0) / horsesWithCoi.length
          : 0;
      const diversityScore = Math.max(0, Math.round(100 - avgCoi * 4)); // Higher is better

      // Get horses with high COI for alerts
      const highCoiAlerts = horsesWithCoi
        .filter((h) => (h.coiPercent || 0) > 12)
        .map((h) => ({
          id: h.id,
          name: h.name,
          coiPercent: h.coiPercent,
          sex: h.sex,
        }))
        .sort((a, b) => (b.coiPercent || 0) - (a.coiPercent || 0))
        .slice(0, 5);

      // Get breeding-age horses for pairing suggestions
      const breedingMares = horses.filter(
        (h) => h.sex === "FEMALE" && h.status === "BREEDING" && h.coiPercent !== null
      );
      const breedingStallions = horses.filter(
        (h) => h.sex === "MALE" && h.status === "BREEDING" && h.coiPercent !== null
      );

      // Generate simple pairing recommendations (lowest combined COI)
      const recommendedPairings = [];
      for (const mare of breedingMares.slice(0, 3)) {
        const bestStallion = breedingStallions
          .map((s) => ({
            stallion: s,
            combinedCoi: ((mare.coiPercent || 0) + (s.coiPercent || 0)) / 2,
          }))
          .sort((a, b) => a.combinedCoi - b.combinedCoi)[0];

        if (bestStallion) {
          recommendedPairings.push({
            mare: { id: mare.id, name: mare.name, coiPercent: mare.coiPercent },
            stallion: {
              id: bestStallion.stallion.id,
              name: bestStallion.stallion.name,
              coiPercent: bestStallion.stallion.coiPercent,
            },
            estimatedOffspringCoi: bestStallion.combinedCoi,
            confidence: 70, // Simple estimate
          });
        }
      }

      return reply.send({
        coiDistribution: coiRanges,
        diversityScore,
        averageCoi: Math.round(avgCoi * 10) / 10,
        horsesWithGeneticData: horsesWithCoi.length,
        totalHorses: horses.length,
        highCoiAlerts,
        recommendedPairings,
      });
    } catch (err) {
      console.error("Error fetching genetic overview:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/breeding-revenue (preferred, species-neutral)
   * GET /api/v1/dashboard/horse/stallion-revenue (legacy alias)
   * Revenue tracking by stallion with booking status
   * Per spec: 08-STALLION-REVENUE-MANAGEMENT-SPEC.md
   */
  async function handleBreedingRevenue(req: any, reply: any) {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);

      // Get stallions with breeding attempts and plans
      const stallions = await prisma.animal.findMany({
        where: {
          tenantId,
          species: "HORSE",
          sex: "MALE",
          archived: false,
          status: { in: ["ACTIVE", "BREEDING"] },
        },
        include: {
          breedingAttemptsAsSire: {
            where: {
              attemptAt: { gte: yearStart },
            },
            orderBy: { attemptAt: "desc" },
          },
          breedingPlansAsSire: {
            where: {
              status: { notIn: ["CANCELED", "UNSUCCESSFUL"] },
              createdAt: { gte: yearStart },
            },
          },
          // studServiceListings removed - old marketplace listing system deprecated
        },
      });

      // Type for stallion with included relations
      type StallionWithRelations = (typeof stallions)[number];

      // Calculate per-stallion stats
      let totalRevenueCents = 0;
      let totalBreedings = 0;
      let completedBreedings = 0;

      const byStallion = stallions.map((stallion: StallionWithRelations) => {
        const attempts = stallion.breedingAttemptsAsSire;

        // Count breedings
        const breedingCount = attempts.length;
        totalBreedings += breedingCount;

        // Successful breedings (where outcome is positive)
        const successfulBreedings = attempts.filter((a: { success: boolean | null }) => a.success === true).length;
        completedBreedings += successfulBreedings;

        // Success rate
        const successRate =
          breedingCount > 0 ? Math.round((successfulBreedings / breedingCount) * 100) : 0;

        // Revenue calculation removed (old marketplace listing system deprecated)
        // Revenue should be tracked through breeding attempts or booking transactions
        const revenueCents = 0;

        return {
          stallionId: stallion.id,
          name: stallion.name,
          photoUrl: stallion.photoUrl || undefined,
          totalRevenueCents: revenueCents,
          breedingCount,
          successRate,
          activeListingId: undefined,
          availableSlots: undefined,
        };
      });

      // Sort by revenue descending, then by breeding count
      byStallion.sort((a, b) => {
        if (b.totalRevenueCents !== a.totalRevenueCents) {
          return b.totalRevenueCents - a.totalRevenueCents;
        }
        return b.breedingCount - a.breedingCount;
      });

      // Average fee calculation removed (old marketplace listing system deprecated)
      const avgFeeCents = 0;

      return reply.send({
        summary: {
          totalRevenueCents,
          totalBreedings,
          completedBreedings,
          avgFeeCents,
        },
        byStallion,
        recentPayments: [], // TODO: Populate from BreedingBooking payment records
      });
    } catch (err) {
      console.error("Error fetching breeding revenue:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  }

  app.get("/dashboard/breeding-revenue", handleBreedingRevenue);
  app.get("/dashboard/horse/stallion-revenue", handleBreedingRevenue); // legacy alias

  /**
   * GET /api/v1/dashboard/horse/foals-ytd
   * Returns count of foals born year-to-date for the horse breeder KPI tile
   */
  app.get("/dashboard/horse/foals-ytd", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);

      // Count foals (horses born this year) where either dam or sire belongs to tenant
      const foalCount = await prisma.animal.count({
        where: {
          species: "HORSE",
          birthDate: { gte: yearStart },
          archived: false,
          OR: [
            { dam: { tenantId } },
            { sire: { tenantId } },
            { tenantId }, // Also include foals directly owned by tenant
          ],
        },
      });

      return reply.send({
        foalCount,
        year: currentYear,
      });
    } catch (err) {
      console.error("Error fetching foals YTD:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  /**
   * GET /api/v1/dashboard/horse/season-bookings
   * Returns aggregated stallion breeding bookings for the season
   */
  app.get("/dashboard/horse/season-bookings", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Stud service listings removed (old marketplace listing system deprecated)
      // Booking data should now come from BreedingBooking table
      return reply.send({
        bookingsReceived: 0,
        maxBookings: null,
      });
    } catch (err) {
      console.error("Error fetching season bookings:", err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });
};

export default horseDashboardRoutes;
