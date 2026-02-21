// src/routes/admin-email-logs.ts
//
// Email log management endpoints:
//
// SUPER ADMIN:
//   GET    /api/v1/admin/email-logs           - List all email logs (filterable)
//   GET    /api/v1/admin/email-logs/stats     - Aggregate stats (by status, daily)
//   GET    /api/v1/admin/email-logs/:id       - Single log detail
//   POST   /api/v1/admin/email-logs/:id/retry - Manual retry
//
// TENANT ADMIN:
//   GET    /api/v1/email-logs                 - List tenant's email logs
//   GET    /api/v1/email-logs/:id             - Single log detail (tenant-scoped)

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";
import { getActorId } from "../utils/session.js";
import { sendEmail } from "../services/email-service.js";

// ============================================================================
// Helpers
// ============================================================================

async function requireSuperAdmin(
  req: any,
  reply: any
): Promise<string | null> {
  const actorId = getActorId(req);
  if (!actorId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { isSuperAdmin: true },
  });

  if (!actor?.isSuperAdmin) {
    reply
      .code(403)
      .send({ error: "forbidden", message: "Super admin access required" });
    return null;
  }

  return actorId;
}

// ============================================================================
// Routes
// ============================================================================

const adminEmailLogRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Super Admin Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/email-logs
   * List all email logs with filtering (super admin only).
   */
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      tenantId?: string;
      templateKey?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      to?: string;
    };
  }>("/admin/email-logs", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (req.query.status) where.status = req.query.status;
    if (req.query.tenantId) where.tenantId = Number(req.query.tenantId);
    if (req.query.templateKey) where.templateKey = req.query.templateKey;
    if (req.query.category) where.category = req.query.category;
    if (req.query.to) where.to = { contains: req.query.to, mode: "insensitive" };

    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.emailSendLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          tenant: { select: { id: true, name: true } },
          party: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.emailSendLog.count({ where }),
    ]);

    return reply.send({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    });
  });

  /**
   * GET /api/v1/admin/email-logs/stats
   * Aggregate email stats by status + daily breakdown (super admin only).
   */
  app.get<{
    Querystring: {
      days?: string;
      tenantId?: string;
    };
  }>("/admin/email-logs/stats", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const days = Math.min(Math.max(1, Number(req.query.days) || 7), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: any = { createdAt: { gte: since } };
    if (req.query.tenantId) where.tenantId = Number(req.query.tenantId);

    const statusCounts = await prisma.emailSendLog.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    });

    const categoryCounts = await prisma.emailSendLog.groupBy({
      by: ["category"],
      where,
      _count: { id: true },
    });

    const totalCount = statusCounts.reduce((sum, s) => sum + s._count.id, 0);
    const byStatus = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.id])
    );
    const byCategory = Object.fromEntries(
      categoryCounts.map((c) => [c.category || "unknown", c._count.id])
    );

    // Pending retries count
    const pendingRetries = await prisma.emailSendLog.count({
      where: {
        status: "failed",
        nextRetryAt: { not: null, gte: new Date() },
      },
    });

    return reply.send({
      period: { days, since: since.toISOString() },
      totals: { total: totalCount, ...byStatus },
      byCategory,
      pendingRetries,
    });
  });

  /**
   * GET /api/v1/admin/email-logs/:id
   * Single email log detail (super admin only).
   */
  app.get<{ Params: { id: string } }>("/admin/email-logs/:id", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const log = await prisma.emailSendLog.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        tenant: { select: { id: true, name: true } },
        party: { select: { id: true, name: true, email: true } },
      },
    });

    if (!log) {
      return reply.code(404).send({ error: "log_not_found" });
    }

    return reply.send({ emailLog: log });
  });

  /**
   * POST /api/v1/admin/email-logs/:id/retry
   * Manually retry a failed email (super admin only).
   */
  app.post<{ Params: { id: string } }>("/admin/email-logs/:id/retry", async (req, reply) => {
    const actorId = await requireSuperAdmin(req, reply);
    if (!actorId) return;

    const logId = Number(req.params.id);
    const log = await prisma.emailSendLog.findUnique({ where: { id: logId } });

    if (!log) {
      return reply.code(404).send({ error: "log_not_found" });
    }

    if (log.status !== "failed" && log.status !== "bounced") {
      return reply.code(400).send({
        error: "not_retriable",
        message: `Email status is '${log.status}', only 'failed' and 'bounced' can be retried`,
      });
    }

    // Reconstruct email body from metadata
    const meta = (log.metadata as Record<string, any>) || {};
    const htmlBody = meta.retryHtml || undefined;
    const textBody = meta.retryText || undefined;

    const result = await sendEmail({
      tenantId: log.tenantId,
      to: log.to,
      subject: log.subject,
      html: htmlBody,
      text: textBody,
      templateKey: log.templateKey || undefined,
      category: (log.category as "transactional" | "marketing") || "transactional",
      from: log.from || undefined,
      replyTo: meta.replyTo || undefined,
      partyId: log.partyId || undefined,
      metadata: {
        manualRetry: true,
        originalLogId: logId,
        retriedBy: actorId,
      },
    });

    return reply.send({
      ok: result.ok,
      originalLogId: logId,
      newProviderMessageId: result.providerMessageId,
      error: result.error,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tenant Admin Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/email-logs
   * Tenant-scoped email log list (auto-filtered by tenantId from auth context).
   * Exposes limited fields — no error details or metadata.
   */
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      templateKey?: string;
      startDate?: string;
      endDate?: string;
    };
  }>("/email-logs", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (req.query.status) where.status = req.query.status;
    if (req.query.templateKey) where.templateKey = req.query.templateKey;
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.emailSendLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          to: true,
          subject: true,
          templateKey: true,
          category: true,
          status: true,
          createdAt: true,
          lastEventAt: true,
        },
      }),
      prisma.emailSendLog.count({ where }),
    ]);

    return reply.send({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    });
  });

  /**
   * GET /api/v1/email-logs/:id
   * Tenant-scoped email log detail. Exposes limited fields.
   */
  app.get<{ Params: { id: string } }>("/email-logs/:id", async (req, reply) => {
    const tenantId = Number((req as any).tenantId);
    if (!tenantId) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const log = await prisma.emailSendLog.findFirst({
      where: { id: Number(req.params.id), tenantId },
      select: {
        id: true,
        to: true,
        subject: true,
        templateKey: true,
        category: true,
        status: true,
        createdAt: true,
        lastEventAt: true,
        deliveryEvents: true,
      },
    });

    if (!log) {
      return reply.code(404).send({ error: "log_not_found" });
    }

    return reply.send({ emailLog: log });
  });
};

export default adminEmailLogRoutes;
