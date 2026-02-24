// src/routes/dashboard.ts
// Dashboard API routes for the "Mission Control" dashboard
//
// GET /api/v1/dashboard/counts           - Core metrics (animals, active plans, etc.)
// GET /api/v1/dashboard/alerts           - Critical action items
// GET /api/v1/dashboard/agenda           - Today's scheduled items
// GET /api/v1/dashboard/offspring-summary - Active offspring groups
// GET /api/v1/dashboard/waitlist-pressure - Waitlist demand vs supply
// GET /api/v1/dashboard/kpis             - Program KPIs
// GET /api/v1/dashboard/feed             - Recent activity feed

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ───────────────────────── Types ─────────────────────────

type AlertSeverity = "critical" | "warning" | "info";

type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  entityType?: "plan" | "animal" | "offspring" | "contact" | "invoice";
  entityId?: string;
  dismissible: boolean;
  createdAt: string;
};

type AgendaItemKind =
  | "breeding_appt"
  | "health_check"
  | "placement"
  | "contract"
  | "reminder"
  | "vaccination"
  | "weigh_in";

type AgendaItem = {
  id: string;
  kind: AgendaItemKind;
  title: string;
  scheduledAt: string;
  entityType?: string;
  entityId?: string;
  completed: boolean;
  severity: "normal" | "important" | "critical";
};

// ───────────────────────── Helpers ─────────────────────────

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// ───────────────────────── Routes ─────────────────────────

const dashboardRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/dashboard/counts
   * Core metrics for the dashboard
   */
  app.get("/dashboard/counts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const [animals, activePlans, offspringInCare, upcomingBreedings] = await Promise.all([
        // Total animals (not archived)
        prisma.animal.count({
          where: { tenantId, archived: false },
        }),

        // Active breeding plans (not terminal, not archived)
        prisma.breedingPlan.count({
          where: {
            tenantId,
            archived: false,
            status: { notIn: ["PLAN_COMPLETE", "COMPLETE", "CANCELED", "UNSUCCESSFUL"] },
          },
        }),

        // Breeding plans with born offspring still in care (birthed but not all placed)
        prisma.breedingPlan.count({
          where: {
            tenantId,
            archived: false,
            birthDateActual: { not: null },
            placementCompletedDateActual: null,
            status: { in: ["BIRTHED", "BORN", "WEANED", "PLACEMENT"] },
          },
        }),

        // Upcoming breedings (plans in PLANNING or CYCLE status with expected dates in next 30 days)
        prisma.breedingPlan.count({
          where: {
            tenantId,
            archived: false,
            status: { in: ["PLANNING", "CYCLE", "COMMITTED"] },
            expectedBreedDate: {
              gte: new Date(),
              lte: addDays(new Date(), 30),
            },
          },
        }),
      ]);

      return reply.send({
        animals,
        activeCycles: activePlans,
        littersInCare: offspringInCare,
        upcomingBreedings,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard counts");
      return reply.code(500).send({ error: "get_counts_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/alerts
   * Critical and warning items that need attention
   */
  app.get("/dashboard/alerts", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const alerts: AlertItem[] = [];
      const now = new Date();

      // Check for overdue tasks
      const overdueTasks = await prisma.task.findMany({
        where: {
          tenantId,
          dueAt: { lt: now },
          status: "open",
        },
        include: {
          offspring: { select: { id: true, name: true } },
        },
        take: 5,
      });

      for (const task of overdueTasks) {
        alerts.push({
          id: `task-${task.id}`,
          severity: "warning",
          title: "Overdue Task",
          message: `${task.title}: was due ${task.dueAt?.toLocaleDateString()}`,
          actionLabel: "View Task",
          actionHref: `/tasks`,
          dismissible: true,
          createdAt: task.createdAt?.toISOString() || now.toISOString(),
        });
      }

      // Check for unpaid invoices past due
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ["issued", "partially_paid"] },
          dueAt: { lt: now },
        },
        take: 5,
      });

      for (const inv of overdueInvoices) {
        const amountDue = Number(inv.balanceCents || 0) / 100;
        alerts.push({
          id: `invoice-${inv.id}`,
          severity: "critical",
          title: "Overdue Invoice",
          message: `Invoice #${inv.invoiceNumber || inv.id} is past due - $${amountDue.toFixed(2)} outstanding`,
          actionLabel: "View Invoice",
          actionHref: `/finance/invoices/${inv.id}`,
          entityType: "invoice",
          entityId: String(inv.id),
          dismissible: true,
          createdAt: inv.createdAt?.toISOString() || now.toISOString(),
        });
      }

      // Check for breeding plans needing attention (in heat window NOW)
      const activePlansNeedingAttention = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          archived: false,
          status: { in: ["PLANNING", "CYCLE", "COMMITTED"] },
          lockedCycleStart: {
            gte: addDays(now, -3),
            lte: addDays(now, 7),
          },
        },
        include: { dam: { select: { id: true, name: true } } },
        take: 3,
      });

      for (const plan of activePlansNeedingAttention) {
        alerts.push({
          id: `plan-${plan.id}`,
          severity: "warning",
          title: "Active Breeding Window",
          message: `${plan.dam?.name || plan.name || "Breeding plan"} is in or near breeding window`,
          actionLabel: "View Plan",
          actionHref: `/breeding/${plan.id}`,
          entityType: "plan",
          entityId: String(plan.id),
          dismissible: true,
          createdAt: plan.updatedAt?.toISOString() || now.toISOString(),
        });
      }

      // Check for microchip registrations expiring soon or expired
      const fourteenDaysFromNow = addDays(now, 14);
      const expiringRegistrations = await prisma.animalMicrochipRegistration.findMany({
        where: {
          tenantId,
          expirationDate: {
            not: null,
            lte: fourteenDaysFromNow,
          },
          registry: {
            renewalType: { in: ["ANNUAL", "UNKNOWN"] },
          },
        },
        include: {
          registry: { select: { name: true, website: true } },
          animal: { select: { id: true, name: true, status: true } },
          offspring: { select: { id: true, name: true, status: true } },
        },
        take: 5,
      });

      for (const reg of expiringRegistrations) {
        // Skip deceased animals
        if (reg.animal?.status === "DECEASED" || reg.offspring?.status === "DECEASED") continue;

        const entityName = reg.animal?.name || reg.offspring?.name || `Microchip ${reg.microchipNumber}`;
        const entityHref = reg.animalId ? `/animals/${reg.animalId}` : `/offspring/${reg.offspringId}`;
        const entityType = reg.animalId ? "animal" : "offspring";
        const entityId = String(reg.animalId || reg.offspringId);

        const expirationDate = reg.expirationDate!;
        const daysUntil = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let severity: AlertSeverity;
        let title: string;
        let message: string;

        if (daysUntil <= 0) {
          severity = "critical";
          title = "Microchip Registration Expired";
          message = `${entityName}'s registration with ${reg.registry.name} has expired`;
        } else if (daysUntil <= 7) {
          severity = "warning";
          title = "Microchip Expiring Soon";
          message = `${entityName}'s registration with ${reg.registry.name} expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
        } else {
          severity = "info";
          title = "Microchip Renewal Due";
          message = `${entityName}'s registration with ${reg.registry.name} expires in ${daysUntil} days`;
        }

        alerts.push({
          id: `microchip-${reg.id}`,
          severity,
          title,
          message,
          actionLabel: "View",
          actionHref: entityHref,
          entityType: entityType as "animal" | "offspring",
          entityId,
          dismissible: true,
          createdAt: reg.updatedAt?.toISOString() || now.toISOString(),
        });
      }

      // Sort by severity (critical first) then by date
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => {
        const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return reply.send(alerts);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard alerts");
      return reply.code(500).send({ error: "get_alerts_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/agenda
   * Today's scheduled items
   */
  app.get("/dashboard/agenda", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const dateParam = (req.query as any)?.date;
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      const dayStart = startOfDay(targetDate);
      const dayEnd = endOfDay(targetDate);

      const agenda: AgendaItem[] = [];

      // Get scheduled tasks for today
      const tasks = await prisma.task.findMany({
        where: {
          tenantId,
          dueAt: { gte: dayStart, lte: dayEnd },
          status: "open",
        },
        include: {
          offspring: { select: { id: true, name: true } },
        },
      });

      for (const task of tasks) {
        const isOverdue = task.dueAt && task.dueAt < new Date();
        const entityName = task.offspring?.name || "";
        agenda.push({
          id: `task-${task.id}`,
          kind: "reminder",
          title: entityName ? `${entityName}: ${task.title}` : task.title,
          scheduledAt: task.dueAt?.toISOString() || dayStart.toISOString(),
          completed: false,
          severity: isOverdue ? "critical" : "normal",
        });
      }

      // Get breeding plans with activities today
      const breedingPlans = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          archived: false,
          OR: [
            { expectedBreedDate: { gte: dayStart, lte: dayEnd } },
            { lockedOvulationDate: { gte: dayStart, lte: dayEnd } },
          ],
        },
        include: { dam: { select: { id: true, name: true } } },
      });

      for (const plan of breedingPlans) {
        agenda.push({
          id: `breeding-${plan.id}`,
          kind: "breeding_appt",
          title: `${plan.dam?.name || plan.name || "Breeding"}: Breeding appointment`,
          scheduledAt: (plan.expectedBreedDate || plan.lockedOvulationDate || dayStart).toISOString(),
          entityType: "plan",
          entityId: String(plan.id),
          completed: false,
          severity: "important",
        });
      }

      // Get placements scheduled for today (breeding plans entering placement phase)
      const placements = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          archived: false,
          placementStartDateActual: { gte: dayStart, lte: dayEnd },
          placementCompletedDateActual: null,
        },
      });

      for (const plan of placements) {
        agenda.push({
          id: `placement-${plan.id}`,
          kind: "placement",
          title: `${plan.name || "Breeding plan"}: Placement day`,
          scheduledAt: plan.placementStartDateActual?.toISOString() || dayStart.toISOString(),
          entityType: "plan",
          entityId: String(plan.id),
          completed: false,
          severity: "important",
        });
      }

      // Get vaccination records that are expired or due soon (within 30 days)
      // We need to check against protocol intervals since expiresAt may not be set
      const thirtyDaysFromNow = addDays(new Date(), 30);
      const vaccinationRecords = await (prisma as any).vaccinationRecord?.findMany?.({
        where: {
          tenantId,
          animal: { archived: false },
        },
        include: {
          animal: { select: { id: true, name: true } },
        },
        orderBy: { administeredAt: "desc" },
      }).catch(() => []) || [];

      // Process vaccination records - find expired or due soon
      // Group by animal + protocolKey to get the latest record for each
      const latestByAnimalProtocol = new Map<string, any>();
      for (const rec of vaccinationRecords) {
        const key = `${rec.animalId}-${rec.protocolKey}`;
        if (!latestByAnimalProtocol.has(key)) {
          latestByAnimalProtocol.set(key, rec);
        }
      }

      // Protocol intervals (simplified - matches static data in animal-vaccinations.ts)
      const PROTOCOL_INTERVALS: Record<string, number> = {
        "dog.rabies": 36, "dog.dhpp": 12, "dog.bordetella": 12, "dog.leptospirosis": 12,
        "dog.lyme": 12, "dog.canine_influenza": 12,
        "cat.rabies": 36, "cat.fvrcp": 36, "cat.felv": 12,
        "horse.rabies": 12, "horse.tetanus": 12, "horse.ewt": 12, "horse.west_nile": 12,
        "horse.influenza": 6, "horse.rhinopneumonitis": 6, "horse.strangles": 12,
        "goat.cdt": 12, "goat.rabies": 12, "sheep.cdt": 12,
      };

      for (const [_key, rec] of latestByAnimalProtocol) {
        const intervalMonths = PROTOCOL_INTERVALS[rec.protocolKey] || 12;
        const administeredAt = new Date(rec.administeredAt);
        const expiresAt = rec.expiresAt ? new Date(rec.expiresAt) : addMonths(administeredAt, intervalMonths);
        const now = new Date();
        const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Only show expired or due within 30 days
        if (daysRemaining <= 30) {
          const animalName = rec.animal?.name || "Animal";
          const protocolName = rec.protocolKey.split(".").pop()?.replace(/_/g, " ") || rec.protocolKey;
          const isExpired = daysRemaining < 0;

          agenda.push({
            id: `vaccination-${rec.id}`,
            kind: "vaccination",
            title: isExpired
              ? `${animalName}: ${protocolName} vaccine expired`
              : `${animalName}: ${protocolName} vaccine due in ${daysRemaining} days`,
            scheduledAt: expiresAt.toISOString(),
            entityType: "animal",
            entityId: String(rec.animalId),
            completed: false,
            severity: isExpired ? "critical" : daysRemaining < 7 ? "important" : "normal",
          });
        }
      }

      // Sort by scheduled time
      agenda.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

      return reply.send(agenda);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard agenda");
      return reply.code(500).send({ error: "get_agenda_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/offspring-summary
   * Active offspring groups with placement progress
   */
  app.get("/dashboard/offspring-summary", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const plans = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          archived: false,
          birthDateActual: { not: null },
          placementCompletedDateActual: null,
          status: { in: ["BIRTHED", "BORN", "WEANED", "PLACEMENT"] },
        },
        include: {
          dam: { select: { id: true, name: true } },
          sire: { select: { id: true, name: true } },
          Offspring: {
            select: {
              id: true,
              status: true,
              placementState: true,
            },
          },
        },
        orderBy: { birthDateActual: "desc" },
        take: 10,
      });

      const summaries = plans.map((plan) => {
        const total = plan.Offspring?.length || 0;
        const placed = plan.Offspring?.filter((o) => o.status === "PLACED").length || 0;
        const reserved = plan.Offspring?.filter((o) => o.placementState === "RESERVED").length || 0;
        const available = total - placed - reserved;

        // Calculate age in weeks
        let ageWeeks: number | null = null;
        if (plan.birthDateActual) {
          const diffMs = Date.now() - new Date(plan.birthDateActual).getTime();
          ageWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
        }

        // Determine status
        let status: "in_care" | "placement_active" | "nearly_complete" = "in_care";
        if (placed > 0 && placed < total) status = "placement_active";
        if (placed >= total * 0.8) status = "nearly_complete";

        return {
          id: plan.id,
          identifier: plan.name || `Plan ${plan.id}`,
          damName: plan.dam?.name || "Unknown",
          sireName: plan.sire?.name || "Unknown",
          species: plan.species || "Dog",
          birthedAt: plan.birthDateActual?.toISOString() || null,
          ageWeeks,
          counts: { total, placed, available, reserved },
          financialSummary: {
            totalInvoicedCents: 0, // Would need invoice aggregation
            totalPaidCents: 0,
          },
          placementProgress: total > 0 ? Math.round((placed / total) * 100) : 0,
          status,
        };
      });

      return reply.send(summaries);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get offspring summary");
      return reply.code(500).send({ error: "get_offspring_summary_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/waitlist-pressure
   * Waitlist demand vs available supply
   */
  app.get("/dashboard/waitlist-pressure", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Count active waitlist entries (approved and in various stages)
      const activeWaitlist = await prisma.waitlistEntry.count({
        where: {
          tenantId,
          status: { in: ["APPROVED", "DEPOSIT_DUE", "DEPOSIT_PAID", "READY", "ALLOCATED"] },
        },
      });

      // Count pending waitlist entries (awaiting breeder review - INQUIRY status)
      const pendingWaitlist = await prisma.waitlistEntry.count({
        where: {
          tenantId,
          status: "INQUIRY",
        },
      });

      // Total includes both
      const totalWaitlist = activeWaitlist + pendingWaitlist;

      // Count available offspring (not placed, keeper intent is AVAILABLE)
      const totalAvailable = await prisma.offspring.count({
        where: {
          tenantId,
          keeperIntent: "AVAILABLE",
          placementState: { notIn: ["PLACED", "TRANSFERRED"] },
        },
      });

      // Estimate expected in next 90 days from committed plans
      const expectedNext90Days = await prisma.breedingPlan.count({
        where: {
          tenantId,
          archived: false,
          status: { in: ["CYCLE", "COMMITTED", "BRED", "PREGNANT"] },
          expectedBirthDate: {
            gte: new Date(),
            lte: addDays(new Date(), 90),
          },
        },
      });

      // Calculate ratio and status
      const supply = totalAvailable + expectedNext90Days;
      const ratio = supply > 0 ? totalWaitlist / supply : totalWaitlist > 0 ? 999 : 0;

      let status: "low_demand" | "balanced" | "high_demand" | "oversubscribed" = "balanced";
      if (ratio < 0.5) status = "low_demand";
      else if (ratio > 3) status = "oversubscribed";
      else if (ratio > 1.5) status = "high_demand";

      const result = {
        totalWaitlist,
        activeWaitlist,
        pendingWaitlist,
        totalAvailable,
        expectedNext90Days,
        ratio: Math.round(ratio * 100) / 100,
        status,
        bySpecies: [], // Could aggregate by species if needed
      };

      req.log?.info?.({ tenantId, result }, "Dashboard waitlist-pressure response");

      return reply.send(result);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get waitlist pressure");
      return reply.code(500).send({ error: "get_waitlist_pressure_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/kpis
   * Program key performance indicators
   */
  app.get("/dashboard/kpis", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const windowParam = (req.query as any)?.window || "6m";
      const windowMonths = windowParam === "3m" ? 3 : windowParam === "12m" ? 12 : 6;
      const windowStart = new Date();
      windowStart.setMonth(windowStart.getMonth() - windowMonths);

      const kpis: { key: string; label: string; value: number; unit?: string; trend?: "up" | "down" | "flat" }[] = [];

      // Breeding success rate (plans that reached PREGNANT from BRED)
      const bredPlans = await prisma.breedingPlan.count({
        where: {
          tenantId,
          status: { in: ["BRED", "PREGNANT", "BIRTHED", "PLAN_COMPLETE"] },
          createdAt: { gte: windowStart },
        },
      });

      const confirmedPlans = await prisma.breedingPlan.count({
        where: {
          tenantId,
          status: { in: ["PREGNANT", "BIRTHED", "PLAN_COMPLETE"] },
          createdAt: { gte: windowStart },
        },
      });

      const successRate = bredPlans > 0 ? Math.round((confirmedPlans / bredPlans) * 100) : 0;
      kpis.push({
        key: "breeding_success_rate",
        label: "Breeding Success Rate",
        value: successRate,
        unit: "%",
      });

      // Average litter size
      const plansWithOffspring = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          birthDateActual: { gte: windowStart },
        },
        include: {
          _count: { select: { Offspring: true } },
        },
      });

      const avgLitterSize =
        plansWithOffspring.length > 0
          ? Math.round(
              (plansWithOffspring.reduce((sum, p) => sum + (p._count?.Offspring || 0), 0) /
                plansWithOffspring.length) *
                10
            ) / 10
          : 0;

      kpis.push({
        key: "avg_litter_size",
        label: "Average Litter Size",
        value: avgLitterSize,
      });

      // Placement rate (% of offspring placed)
      const totalOffspring = await prisma.offspring.count({
        where: {
          tenantId,
          createdAt: { gte: windowStart },
        },
      });

      const placedOffspring = await prisma.offspring.count({
        where: {
          tenantId,
          status: "PLACED",
          createdAt: { gte: windowStart },
        },
      });

      const placementRate = totalOffspring > 0 ? Math.round((placedOffspring / totalOffspring) * 100) : 0;
      kpis.push({
        key: "placement_rate",
        label: "Placement Rate",
        value: placementRate,
        unit: "%",
      });

      // Active breeding animals
      const breedingAnimals = await prisma.animal.count({
        where: {
          tenantId,
          archived: false,
          status: { in: ["ACTIVE", "BREEDING"] },
        },
      });

      kpis.push({
        key: "active_breeding_animals",
        label: "Active Breeding Animals",
        value: breedingAnimals,
      });

      return reply.send(kpis);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard KPIs");
      return reply.code(500).send({ error: "get_kpis_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/feed
   * Recent activity feed
   */
  app.get("/dashboard/feed", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const limit = Math.min(Number((req.query as any)?.limit) || 25, 100);
      const feed: { id: string; when: string; who?: string; text: string; link?: string }[] = [];

      // Get recent breeding plan updates
      const recentPlans = await prisma.breedingPlan.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          dam: { select: { name: true } },
        },
      });

      for (const plan of recentPlans) {
        feed.push({
          id: `plan-${plan.id}`,
          when: plan.updatedAt?.toISOString() || new Date().toISOString(),
          text: `Breeding plan "${plan.dam?.name || plan.name || "Unknown"}" updated to ${plan.status}`,
          link: `/breeding/${plan.id}`,
        });
      }

      // Get recent breeding plan updates related to offspring
      const recentPlansWithBirths = await prisma.breedingPlan.findMany({
        where: {
          tenantId,
          birthDateActual: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          updatedAt: true,
          birthDateActual: true,
        },
      });

      for (const plan of recentPlansWithBirths) {
        feed.push({
          id: `plan-birth-${plan.id}`,
          when: plan.updatedAt?.toISOString() || new Date().toISOString(),
          text: `Breeding plan "${plan.name || "Unknown"}" birth recorded`,
          link: `/breeding/${plan.id}`,
        });
      }

      // Get recent invoice activity
      const recentInvoices = await prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          updatedAt: true,
        },
      });

      for (const inv of recentInvoices) {
        feed.push({
          id: `invoice-${inv.id}`,
          when: inv.updatedAt?.toISOString() || new Date().toISOString(),
          text: `Invoice #${inv.invoiceNumber || inv.id} ${inv.status?.toLowerCase() || "updated"}`,
          link: `/finance/invoices/${inv.id}`,
        });
      }

      // Sort by date descending and limit
      feed.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      const trimmedFeed = feed.slice(0, limit);

      return reply.send(trimmedFeed);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get dashboard feed");
      return reply.code(500).send({ error: "get_feed_failed" });
    }
  });

  /**
   * POST /api/v1/dashboard/alerts/:id/dismiss
   * Dismiss an alert (stored client-side, this is just for tracking)
   */
  app.post("/dashboard/alerts/:id/dismiss", async (req, reply) => {
    // For now, this is a no-op since dismissals are stored client-side
    // Could be extended to store in a user preferences table
    return reply.send({ ok: true });
  });

  /**
   * POST /api/v1/dashboard/agenda/:id/complete
   * Mark an agenda item as complete
   */
  app.post("/dashboard/agenda/:id/complete", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const itemId = (req.params as any).id;
      if (!itemId) {
        return reply.code(400).send({ error: "missing_id" });
      }

      // Parse the item ID to determine type and actual ID
      const [type, id] = itemId.split("-");

      // Health events don't have a completedAt field, so we'll just acknowledge
      // the completion request for now. In the future, this could update a task instead.
      if (type === "task" && id) {
        await prisma.task.update({
          where: { id: Number(id) },
          data: { status: "done" },
        });
      }

      // Other types could be handled here

      return reply.send({ ok: true });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to complete agenda item");
      return reply.code(500).send({ error: "complete_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/contact-tasks
   * Contact follow-up tasks for the dashboard widget
   * Aggregates: overdue events, upcoming events, upcoming milestones, overdue invoices
   */
  app.get("/dashboard/contact-tasks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const now = new Date();
      const today = startOfDay(now);
      const in7Days = addDays(today, 7);
      const in30Days = addDays(today, 30);

      type ContactTask = {
        id: string;
        kind: "follow_up" | "event" | "milestone" | "overdue_invoice";
        title: string;
        description?: string;
        partyId: number;
        partyName: string;
        partyKind: "CONTACT" | "ORGANIZATION";
        dueDate: string;
        severity: "info" | "warning" | "overdue";
        eventId?: number;
        milestoneId?: number;
        invoiceId?: number;
      };

      const tasks: ContactTask[] = [];

      // 1. Get overdue and upcoming events (SCHEDULED status)
      const events = await prisma.partyEvent.findMany({
        where: {
          tenantId,
          status: "SCHEDULED",
          scheduledAt: { lte: in7Days },
        },
        include: {
          party: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { scheduledAt: "asc" },
        take: 20,
      });

      for (const event of events) {
        const isOverdue = event.scheduledAt < today;
        const isWarning = !isOverdue && event.scheduledAt < addDays(today, 3);

        tasks.push({
          id: `event-${event.id}`,
          kind: event.kind === "FOLLOW_UP" ? "follow_up" : "event",
          title: event.title,
          description: event.notes || undefined,
          partyId: event.partyId,
          partyName: event.party?.name || "Unknown",
          partyKind: event.party?.type === "ORGANIZATION" ? "ORGANIZATION" : "CONTACT",
          dueDate: event.scheduledAt.toISOString(),
          severity: isOverdue ? "overdue" : isWarning ? "warning" : "info",
          eventId: event.id,
        });
      }

      // 2. Get upcoming annual milestones (within 30 days based on month/day)
      // This is a bit tricky - we need to check if the milestone date's month/day is coming up
      const allMilestones = await prisma.partyMilestone.findMany({
        where: {
          tenantId,
          annual: true,
        },
        include: {
          party: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      for (const milestone of allMilestones) {
        const milestoneDate = new Date(milestone.date);
        const thisYearDate = new Date(
          now.getFullYear(),
          milestoneDate.getMonth(),
          milestoneDate.getDate()
        );

        // If this year's occurrence has passed, check next year
        let nextOccurrence = thisYearDate;
        if (thisYearDate < today) {
          nextOccurrence = new Date(
            now.getFullYear() + 1,
            milestoneDate.getMonth(),
            milestoneDate.getDate()
          );
        }

        // Only include if within 30 days
        if (nextOccurrence <= in30Days) {
          const isToday = nextOccurrence.getTime() === today.getTime();
          const isWarning = nextOccurrence < addDays(today, 7);

          tasks.push({
            id: `milestone-${milestone.id}`,
            kind: "milestone",
            title: milestone.label,
            description: milestone.notes || undefined,
            partyId: milestone.partyId,
            partyName: milestone.party?.name || "Unknown",
            partyKind: milestone.party?.type === "ORGANIZATION" ? "ORGANIZATION" : "CONTACT",
            dueDate: nextOccurrence.toISOString(),
            severity: isToday ? "warning" : isWarning ? "warning" : "info",
            milestoneId: milestone.id,
          });
        }
      }

      // 3. Get overdue invoices linked to parties
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ["issued", "partially_paid"] },
          dueAt: { lt: now },
          clientPartyId: { not: null },
        },
        include: {
          clientParty: {
            select: { id: true, name: true, type: true },
          },
        },
        take: 10,
      });

      for (const inv of overdueInvoices) {
        if (!inv.clientPartyId || !inv.clientParty) continue;

        const daysPastDue = Math.floor(
          (now.getTime() - (inv.dueAt?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
        );

        tasks.push({
          id: `invoice-${inv.id}`,
          kind: "overdue_invoice",
          title: `Invoice #${inv.invoiceNumber || inv.id} overdue`,
          description: `$${(Number(inv.balanceCents || 0) / 100).toFixed(2)} outstanding - ${daysPastDue} days past due`,
          partyId: inv.clientPartyId,
          partyName: inv.clientParty.name || "Unknown",
          partyKind: inv.clientParty.type === "ORGANIZATION" ? "ORGANIZATION" : "CONTACT",
          dueDate: inv.dueAt?.toISOString() || now.toISOString(),
          severity: "overdue",
          invoiceId: inv.id,
        });
      }

      // Sort by severity (overdue first) then by date
      const severityOrder = { overdue: 0, warning: 1, info: 2 };
      tasks.sort((a, b) => {
        const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      return reply.send(tasks);
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get contact tasks");
      return reply.code(500).send({ error: "get_contact_tasks_failed" });
    }
  });

  /**
   * POST /api/v1/dashboard/contact-tasks/:id/complete
   * Mark a contact task as complete (completes the underlying event)
   */
  app.post("/dashboard/contact-tasks/:id/complete", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const taskId = (req.params as any).id;
      if (!taskId) {
        return reply.code(400).send({ error: "missing_id" });
      }

      // Parse the task ID to determine type and actual ID
      const [type, idStr] = taskId.split("-");
      const id = Number(idStr);

      if (!id || isNaN(id)) {
        return reply.code(400).send({ error: "invalid_id" });
      }

      if (type === "event") {
        await prisma.partyEvent.update({
          where: { id, tenantId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }
      // Milestones and invoices can't be "completed" in the same way
      // but we acknowledge the request

      return reply.send({ ok: true });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return reply.code(404).send({ error: "task_not_found" });
      }
      req.log?.error?.({ err }, "Failed to complete contact task");
      return reply.code(500).send({ error: "complete_task_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/protocol-progress
   * Rearing protocol progress across active litters (Dog-specific widget)
   */
  app.get("/dashboard/protocol-progress", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      const today = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());

      // Get active protocol assignments with their breeding plans and protocols
      const assignments = await prisma.rearingProtocolAssignment.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
        },
        include: {
          BreedingPlan: {
            select: {
              id: true,
              name: true,
              birthDateActual: true,
              species: true,
              _count: { select: { Offspring: true } },
            },
          },
          protocol: {
            select: {
              id: true,
              name: true,
              stages: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  name: true,
                  ageStartDays: true,
                  ageEndDays: true,
                  order: true,
                  activities: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      name: true,
                      frequency: true,
                      isRequired: true,
                    },
                  },
                },
              },
            },
          },
          completions: {
            select: {
              id: true,
              activityId: true,
              completedAt: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
        take: 10,
      });

      // Calculate current stage and progress for each assignment
      const protocols = assignments.map((assignment) => {
        const plan = assignment.BreedingPlan;
        if (!plan) return null;
        const birthDate = plan.birthDateActual;
        const ageInDays = birthDate
          ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Find current stage based on age
        const stages = assignment.protocol.stages || [];
        const currentStage = stages.find(
          (s) => ageInDays >= s.ageStartDays && ageInDays <= s.ageEndDays
        ) || stages[0];

        // Calculate total activities and completed
        const totalActivities = stages.reduce(
          (sum, stage) => sum + (stage.activities?.length || 0),
          0
        );
        const completedActivities = assignment.completions?.length || 0;
        const progress = totalActivities > 0
          ? Math.round((completedActivities / totalActivities) * 100)
          : 0;

        // Find activities due today (in current stage, not completed today)
        const completedToday = new Set(
          assignment.completions
            ?.filter((c) => {
              const completedDate = new Date(c.completedAt);
              return completedDate >= today && completedDate <= todayEnd;
            })
            .map((c) => c.activityId)
        );

        const activitiesDueToday = (currentStage?.activities || [])
          .filter((a) => !completedToday.has(a.id))
          .map((a) => ({
            id: a.id,
            name: a.name,
            isRequired: a.isRequired,
          }));

        return {
          id: assignment.id,
          protocolId: assignment.protocol.id,
          protocolName: assignment.protocol.name,
          breedingPlanId: plan.id,
          breedingPlanName: plan.name || `Plan ${plan.id}`,
          species: plan.species,
          offspringCount: plan._count?.Offspring || 0,
          ageInDays,
          currentStage: currentStage
            ? {
                id: currentStage.id,
                name: currentStage.name,
                order: currentStage.order,
                totalStages: stages.length,
              }
            : null,
          progress,
          completedActivities,
          totalActivities,
          activitiesDueToday,
          startDate: assignment.startDate.toISOString(),
        };
      }).filter((p): p is NonNullable<typeof p> => p !== null);

      // Calculate summary stats
      const totalActiveProtocols = protocols.length;
      const avgProgress = protocols.length > 0
        ? Math.round(protocols.reduce((sum, p) => sum + p.progress, 0) / protocols.length)
        : 0;
      const totalDueToday = protocols.reduce((sum, p) => sum + p.activitiesDueToday.length, 0);

      return reply.send({
        protocols,
        summary: {
          totalActiveProtocols,
          avgProgress,
          totalDueToday,
        },
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get protocol progress");
      return reply.code(500).send({ error: "get_protocol_progress_failed" });
    }
  });

  /**
   * GET /api/v1/dashboard/gun-dog-aptitude
   * Gun dog aptitude test results with placement recommendations (Dog-specific widget)
   */
  app.get("/dashboard/gun-dog-aptitude", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) {
        return reply.code(400).send({ error: "missing_tenant" });
      }

      // Get assessment results - look for gun dog aptitude assessments
      // These could be CUSTOM type with gun dog scores or a dedicated assessment type
      const assessments = await prisma.assessmentResult.findMany({
        where: {
          tenantId,
          // Look for assessments with gun dog aptitude indicators in scores
          OR: [
            { assessmentType: "CUSTOM" },
            { assessmentType: "VOLHARD_PAT" }, // Volhard can indicate gun dog potential
          ],
        },
        include: {
          offspring: {
            select: {
              id: true,
              name: true,
              sex: true,
              status: true,
              placementState: true,
              species: true,
              BreedingPlan: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          assignment: {
            select: {
              id: true,
              protocol: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { assessedAt: "desc" },
        take: 50,
      });

      // Filter to only dog species and process scores
      const dogAssessments = assessments.filter(
        (a) => a.offspring?.species === "DOG"
      );

      // Calculate placement recommendation based on scores
      const calculatePlacement = (scores: any): string => {
        if (!scores || typeof scores !== "object") return "UNKNOWN";

        // Check for gun dog specific scores
        const gunDogFields = [
          "birdDrive",
          "retrievingInstinct",
          "waterWillingness",
          "pointingInstinct",
          "searchPattern",
          "boldness",
          "trainability",
        ];

        const hasGunDogScores = gunDogFields.some((f) => scores[f] !== undefined);

        if (hasGunDogScores) {
          // Calculate average of gun dog scores (1-5 scale typically)
          const gunDogValues = gunDogFields
            .map((f) => scores[f])
            .filter((v) => typeof v === "number");

          if (gunDogValues.length === 0) return "UNKNOWN";

          const avg = gunDogValues.reduce((a, b) => a + b, 0) / gunDogValues.length;

          if (avg >= 4.5) return "COMPETITION";
          if (avg >= 3.5) return "HUNTING";
          if (avg >= 2.5) return "PET_ACTIVE";
          return "PET_COMPANION";
        }

        // Fall back to Volhard PAT interpretation for gun dog potential
        const volhardFields = [
          "socialAttraction",
          "following",
          "restraint",
          "socialDominance",
          "elevationDominance",
          "retrieving",
          "touchSensitivity",
          "soundSensitivity",
          "sightSensitivity",
          "stability",
        ];

        const hasVolhardScores = volhardFields.some((f) => scores[f] !== undefined);

        if (hasVolhardScores) {
          // For gun dogs: high retrieving, moderate stability, good sound tolerance
          const retrieving = scores.retrieving || 3;
          const stability = scores.stability || 3;
          const soundSensitivity = scores.soundSensitivity || 3;

          // Lower scores in Volhard = better (1-2 is ideal for most traits)
          // Except for retrieving where 1 is best (eager retriever)
          if (retrieving <= 2 && stability <= 3 && soundSensitivity <= 3) {
            return "HUNTING";
          }
          if (retrieving <= 3 && stability <= 4) {
            return "PET_ACTIVE";
          }
          return "PET_COMPANION";
        }

        return "UNKNOWN";
      };

      // Process assessments into results
      const results = dogAssessments.map((assessment) => {
        const scores = assessment.scores as any;
        const placement = calculatePlacement(scores);

        // Calculate an overall score (0-100)
        let overallScore = 50;
        if (scores && typeof scores === "object") {
          const allValues = Object.values(scores).filter(
            (v) => typeof v === "number"
          ) as number[];
          if (allValues.length > 0) {
            // Normalize to 0-100 scale (assuming 1-5 or 1-6 input)
            const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
            const maxScore = Math.max(...allValues) > 5 ? 6 : 5;
            overallScore = Math.round((avg / maxScore) * 100);
          }
        }

        return {
          id: assessment.id,
          offspringId: assessment.offspring?.id,
          offspringName: assessment.offspring?.name || "Unknown",
          sex: assessment.offspring?.sex,
          groupId: assessment.offspring?.BreedingPlan?.id,
          groupName: assessment.offspring?.BreedingPlan?.name,
          assessedAt: assessment.assessedAt.toISOString(),
          assessmentType: assessment.assessmentType,
          scores,
          overallScore,
          placement,
          placementState: assessment.offspring?.placementState,
          status: assessment.offspring?.status,
        };
      });

      // Get offspring awaiting assessment (in active groups with dog protocols, no assessment yet)
      const offspringWithoutAssessment = await prisma.offspring.findMany({
        where: {
          tenantId,
          species: "DOG",
          BreedingPlan: {
            placementCompletedDateActual: null,
          },
          rearingAssessments: { none: {} },
        },
        include: {
          BreedingPlan: {
            select: {
              id: true,
              name: true,
              birthDateActual: true,
            },
          },
        },
        take: 20,
      });

      const awaitingAssessment = offspringWithoutAssessment.map((o) => ({
        id: o.id,
        name: o.name || `Offspring ${o.id}`,
        sex: o.sex,
        groupId: o.BreedingPlan?.id,
        groupName: o.BreedingPlan?.name,
        ageInDays: o.BreedingPlan?.birthDateActual
          ? Math.floor(
              (Date.now() - new Date(o.BreedingPlan.birthDateActual).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      }));

      // Calculate placement distribution
      const placementCounts: Record<string, number> = {
        COMPETITION: 0,
        HUNTING: 0,
        PET_ACTIVE: 0,
        PET_COMPANION: 0,
        UNKNOWN: 0,
      };

      for (const r of results) {
        placementCounts[r.placement] = (placementCounts[r.placement] || 0) + 1;
      }

      // Get top performers (highest overall scores)
      const topPerformers = [...results]
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 5);

      return reply.send({
        results,
        awaitingAssessment,
        summary: {
          totalAssessed: results.length,
          awaitingCount: awaitingAssessment.length,
          placementDistribution: placementCounts,
        },
        topPerformers,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get gun dog aptitude data");
      return reply.code(500).send({ error: "get_gun_dog_aptitude_failed" });
    }
  });
};

export default dashboardRoutes;
