// src/routes/buyer-analytics.ts
// Buyer CRM analytics and lead scoring routes (P5)
//
// All routes are prefixed with /api/v1/buyer-analytics
// GET /api/v1/buyer-analytics/lead-scores        - Get lead scores for all buyers
// GET /api/v1/buyer-analytics/lead-score/:id     - Get lead score for specific buyer
// GET /api/v1/buyer-analytics/stale-buyers       - Get buyers with no recent activity
// GET /api/v1/buyer-analytics/pipeline           - Get pipeline summary stats
// GET /api/v1/buyer-analytics/conversion         - Get conversion metrics
// POST /api/v1/buyer-analytics/generate-tasks    - Generate follow-up tasks

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import {
  calculateLeadScore,
  getBuyerLeadScores,
  getStaleBuyers,
  generateFollowUpTasksForTenant,
  generateFollowUpTasksForBuyer,
} from "../services/buyer-automation-service.js";

// ───────────────────────── Helpers ─────────────────────────

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ───────────────────────── Routes ─────────────────────────

const buyerAnalyticsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ─────────────────────────────────────────────────────────
  // LEAD SCORING
  // ─────────────────────────────────────────────────────────

  // GET /buyer-analytics/lead-scores - Get lead scores for all active buyers
  app.get("/buyer-analytics/lead-scores", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const minScore = query.minScore ? Number(query.minScore) : undefined;
      const maxScore = query.maxScore ? Number(query.maxScore) : undefined;
      const gradesParam = query.grades as string | undefined;
      const grades = gradesParam
        ? (gradesParam.split(",").filter((g) => ["A", "B", "C", "D", "F"].includes(g)) as Array<"A" | "B" | "C" | "D" | "F">)
        : undefined;
      const limit = query.limit ? Math.min(100, Number(query.limit)) : undefined;

      const scores = await getBuyerLeadScores(tenantId, {
        minScore,
        maxScore,
        grades,
        limit,
      });

      // Calculate grade distribution
      const gradeDistribution = {
        A: scores.filter((s) => s.score.grade === "A").length,
        B: scores.filter((s) => s.score.grade === "B").length,
        C: scores.filter((s) => s.score.grade === "C").length,
        D: scores.filter((s) => s.score.grade === "D").length,
        F: scores.filter((s) => s.score.grade === "F").length,
      };

      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.score.score, 0) / scores.length)
        : 0;

      return reply.send({
        items: scores,
        total: scores.length,
        summary: {
          averageScore: avgScore,
          gradeDistribution,
        },
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get lead scores");
      return reply.code(500).send({ error: "get_lead_scores_failed" });
    }
  });

  // GET /buyer-analytics/lead-score/:id - Get lead score for specific buyer
  app.get("/buyer-analytics/lead-score/:id", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const buyerId = toNum((req.params as any).id);
      if (!buyerId) return reply.code(400).send({ error: "invalid_buyer_id" });

      const score = await calculateLeadScore(tenantId, buyerId);
      if (!score) {
        return reply.code(404).send({ error: "buyer_not_found" });
      }

      return reply.send({ buyerId, score });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get lead score");
      return reply.code(500).send({ error: "get_lead_score_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // STALE BUYERS
  // ─────────────────────────────────────────────────────────

  // GET /buyer-analytics/stale-buyers - Get buyers with no recent activity
  app.get("/buyer-analytics/stale-buyers", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const daysSinceActivity = query.days ? Math.max(1, Number(query.days)) : 14;

      const staleBuyers = await getStaleBuyers(tenantId, daysSinceActivity);

      return reply.send({
        items: staleBuyers,
        total: staleBuyers.length,
        threshold: daysSinceActivity,
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get stale buyers");
      return reply.code(500).send({ error: "get_stale_buyers_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // PIPELINE ANALYTICS
  // ─────────────────────────────────────────────────────────

  // GET /buyer-analytics/pipeline - Get pipeline summary stats
  app.get("/buyer-analytics/pipeline", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      // Get buyer counts by status
      const buyersByStatus = await prisma.buyer.groupBy({
        by: ["status"],
        where: { tenantId, archivedAt: null },
        _count: { id: true },
      });

      const statusCounts = buyersByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get deal counts by stage
      const dealsByStage = await prisma.deal.groupBy({
        by: ["stage"],
        where: { tenantId },
        _count: { id: true },
        _sum: { askingPrice: true, offerPrice: true, finalPrice: true },
      });

      const stageCounts = dealsByStage.reduce(
        (acc, item) => {
          acc[item.stage] = {
            count: item._count.id,
            totalAskingPrice: Number(item._sum.askingPrice || 0),
            totalOfferPrice: Number(item._sum.offerPrice || 0),
            totalFinalPrice: Number(item._sum.finalPrice || 0),
          };
          return acc;
        },
        {} as Record<string, { count: number; totalAskingPrice: number; totalOfferPrice: number; totalFinalPrice: number }>
      );

      // Get total pipeline value (sum of asking prices for non-closed deals)
      const pipelineValue = await prisma.deal.aggregate({
        where: {
          tenantId,
          stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
        },
        _sum: { askingPrice: true },
        _count: { id: true },
      });

      // Get won deals this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const wonThisMonth = await prisma.deal.aggregate({
        where: {
          tenantId,
          outcome: "WON",
          closedAt: { gte: startOfMonth },
        },
        _sum: { finalPrice: true },
        _count: { id: true },
      });

      // Get new buyers this month
      const newBuyersThisMonth = await prisma.buyer.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth },
        },
      });

      // Get task stats
      const taskStats = await prisma.buyerTask.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { id: true },
      });

      const overdueTasks = await prisma.buyerTask.count({
        where: {
          tenantId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueAt: { lt: new Date() },
        },
      });

      return reply.send({
        buyers: {
          byStatus: statusCounts,
          totalActive: Object.values(statusCounts).reduce((a, b) => a + b, 0),
          newThisMonth: newBuyersThisMonth,
        },
        deals: {
          byStage: stageCounts,
          pipelineValue: Number(pipelineValue._sum.askingPrice || 0),
          activeDeals: pipelineValue._count.id,
          wonThisMonth: {
            count: wonThisMonth._count.id,
            value: Number(wonThisMonth._sum.finalPrice || 0),
          },
        },
        tasks: {
          byStatus: taskStats.reduce(
            (acc, item) => {
              acc[item.status] = item._count.id;
              return acc;
            },
            {} as Record<string, number>
          ),
          overdue: overdueTasks,
        },
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get pipeline analytics");
      return reply.code(500).send({ error: "get_pipeline_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // CONVERSION METRICS
  // ─────────────────────────────────────────────────────────

  // GET /buyer-analytics/conversion - Get conversion metrics
  app.get("/buyer-analytics/conversion", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;

      // Default to last 90 days
      const daysBack = query.days ? Math.max(1, Number(query.days)) : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Deals closed in period
      const closedDeals = await prisma.deal.findMany({
        where: {
          tenantId,
          closedAt: { gte: startDate },
          outcome: { not: null },
        },
        select: {
          outcome: true,
          finalPrice: true,
          askingPrice: true,
          createdAt: true,
          closedAt: true,
        },
      });

      const wonDeals = closedDeals.filter((d) => d.outcome === "WON");
      const lostDeals = closedDeals.filter((d) => d.outcome === "LOST");

      // Calculate metrics
      const winRate = closedDeals.length > 0
        ? Math.round((wonDeals.length / closedDeals.length) * 100)
        : 0;

      const avgDealValue = wonDeals.length > 0
        ? Math.round(
            wonDeals.reduce((sum, d) => sum + Number(d.finalPrice || 0), 0) / wonDeals.length
          )
        : 0;

      // Calculate average days to close
      const avgDaysToClose = wonDeals.length > 0
        ? Math.round(
            wonDeals.reduce((sum, d) => {
              const created = new Date(d.createdAt).getTime();
              const closed = new Date(d.closedAt!).getTime();
              return sum + (closed - created) / (1000 * 60 * 60 * 24);
            }, 0) / wonDeals.length
          )
        : 0;

      // Buyers created in period
      const buyersCreated = await prisma.buyer.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      });

      // Buyers who became deals in period
      const buyersWithDeals = await prisma.deal.groupBy({
        by: ["buyerId"],
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      });

      const leadToDealRate = buyersCreated > 0
        ? Math.round((buyersWithDeals.length / buyersCreated) * 100)
        : 0;

      return reply.send({
        period: {
          days: daysBack,
          startDate: startDate.toISOString(),
        },
        deals: {
          total: closedDeals.length,
          won: wonDeals.length,
          lost: lostDeals.length,
          winRate,
          avgDealValue,
          avgDaysToClose,
          totalRevenue: wonDeals.reduce((sum, d) => sum + Number(d.finalPrice || 0), 0),
        },
        leads: {
          created: buyersCreated,
          convertedToDeals: buyersWithDeals.length,
          conversionRate: leadToDealRate,
        },
      });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get conversion metrics");
      return reply.code(500).send({ error: "get_conversion_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // AUTOMATION
  // ─────────────────────────────────────────────────────────

  // POST /buyer-analytics/generate-tasks - Generate follow-up tasks
  app.post("/buyer-analytics/generate-tasks", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const body = req.body as Record<string, unknown>;
      const buyerId = toNum(body.buyerId);

      let result;
      if (buyerId) {
        // Generate for specific buyer
        const tasksCreated = await generateFollowUpTasksForBuyer(tenantId, buyerId);
        result = { buyerId, tasksCreated };
      } else {
        // Generate for all active buyers
        result = await generateFollowUpTasksForTenant(tenantId);
      }

      return reply.send({ ok: true, ...result });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to generate follow-up tasks");
      return reply.code(500).send({ error: "generate_tasks_failed" });
    }
  });

  // ─────────────────────────────────────────────────────────
  // ACTIVITY TIMELINE
  // ─────────────────────────────────────────────────────────

  // GET /buyer-analytics/recent-activity - Get recent activity across all buyers
  app.get("/buyer-analytics/recent-activity", async (req, reply) => {
    try {
      const tenantId = Number((req as any).tenantId);
      if (!tenantId) return reply.code(400).send({ error: "missing_tenant" });

      const query = req.query as Record<string, unknown>;
      const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));

      // Get all buyer party IDs
      const buyers = await prisma.buyer.findMany({
        where: { tenantId, archivedAt: null },
        select: { id: true, partyId: true, party: { select: { name: true } } },
      });

      const partyIdToBuyer = new Map(buyers.map((b) => [b.partyId, { id: b.id, name: b.party.name }]));
      const partyIds = buyers.map((b) => b.partyId);

      // Get recent activities for all buyer parties
      const activities = await prisma.partyActivity.findMany({
        where: {
          tenantId,
          partyId: { in: partyIds },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      // Enrich with buyer info
      const enrichedActivities = activities.map((activity) => ({
        ...activity,
        buyer: partyIdToBuyer.get(activity.partyId) || null,
      }));

      return reply.send({ items: enrichedActivities, total: enrichedActivities.length });
    } catch (err) {
      req.log?.error?.({ err }, "Failed to get recent activity");
      return reply.code(500).send({ error: "get_activity_failed" });
    }
  });
};

export default buyerAnalyticsRoutes;
