// src/routes/notifications.ts
/**
 * Notifications API - Health & Breeding Alerts
 *
 * Persistent notifications for vaccination and breeding timeline events
 * Integrates with existing ephemeral notification system (messages, invoices, etc.)
 *
 * These endpoints serve the STORED notifications only (health/breeding)
 * Ephemeral notifications (messages, invoices) are fetched from their own endpoints
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import prisma from "../prisma.js";

// ────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────

async function assertTenant(req: any, reply: any): Promise<number | null> {
  const tenantId = Number((req as any).tenantId);
  if (!tenantId) {
    reply.code(400).send({ error: "missing_tenant" });
    return null;
  }
  return tenantId;
}

async function assertUser(req: any, reply: any): Promise<string | null> {
  const userId = (req as any).userId;
  if (!userId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return userId;
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const notificationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/notifications
   * List notifications for current tenant
   *
   * Query params:
   * - status: Filter by status (UNREAD, READ, DISMISSED)
   * - category: Filter by category (health, breeding, all)
   * - limit: Max results (default: 50, max: 100)
   * - offset: Pagination offset (default: 0)
   */
  app.get("/notifications", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const query = req.query as {
      status?: string;
      category?: string;
      limit?: string;
      offset?: string;
    };

    // Parse query params
    const status = query.status?.toUpperCase();
    const category = query.category?.toLowerCase();
    const limit = Math.min(parseInt(query.limit || "50", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    // Build where clause
    const where: any = {
      tenantId,
      OR: [
        { userId: null }, // Broadcast notifications (all users)
        { userId }, // User-specific notifications
      ],
    };

    // Filter by status
    if (status && ["UNREAD", "READ", "DISMISSED"].includes(status)) {
      where.status = status;
    }

    // Filter by category (notification type prefix)
    if (category === "health") {
      where.type = {
        in: [
          "vaccination_expiring_7d",
          "vaccination_expiring_3d",
          "vaccination_expiring_1d",
          "vaccination_overdue",
        ],
      };
    } else if (category === "breeding") {
      where.type = {
        in: [
          "breeding_heat_cycle_expected",
          "breeding_hormone_testing_due",
          "breeding_window_approaching",
          "pregnancy_check_14d",
          "pregnancy_check_30d",
          "pregnancy_check_overdue",
          "foaling_30d",
          "foaling_14d",
          "foaling_7d",
          "foaling_approaching",
          "foaling_overdue",
        ],
      };
    }

    // Fetch notifications
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    // Count unread
    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        status: "UNREAD",
      },
    });

    return reply.send({
      notifications,
      total,
      unreadCount,
      limit,
      offset,
    });
  });

  /**
   * GET /api/v1/notifications/:id
   * Get single notification details
   */
  app.get("/notifications/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const notificationId = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(notificationId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!notification) {
      return reply.code(404).send({ error: "notification_not_found" });
    }

    return reply.send({ notification });
  });

  /**
   * PUT /api/v1/notifications/:id/read
   * Mark notification as read
   */
  app.put("/notifications/:id/read", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const notificationId = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(notificationId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify notification belongs to this tenant/user
    const existing = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "notification_not_found" });
    }

    // Update status
    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    return reply.send({ notification });
  });

  /**
   * PUT /api/v1/notifications/:id/dismiss
   * Dismiss notification
   */
  app.put("/notifications/:id/dismiss", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const notificationId = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(notificationId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify notification belongs to this tenant/user
    const existing = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: "notification_not_found" });
    }

    // Update status
    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "DISMISSED",
        dismissedAt: new Date(),
      },
    });

    return reply.send({ notification });
  });

  /**
   * POST /api/v1/notifications/mark-all-read
   * Mark all unread notifications as read
   */
  app.post("/notifications/mark-all-read", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const result = await prisma.notification.updateMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId }],
        status: "UNREAD",
      },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    return reply.send({
      updated: result.count,
    });
  });

  /**
   * GET /api/v1/notifications/preferences
   * Get user notification preferences
   */
  app.get("/notifications/preferences", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    // Get or create preferences
    let prefs = await prisma.userNotificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create default preferences
      prefs = await prisma.userNotificationPreferences.create({
        data: {
          tenantId,
          userId,
          // All defaults set in schema
        },
      });
    }

    return reply.send({ preferences: prefs });
  });

  /**
   * PUT /api/v1/notifications/preferences
   * Update user notification preferences
   */
  app.put("/notifications/preferences", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const body = req.body as {
      vaccinationExpiring?: boolean;
      vaccinationOverdue?: boolean;
      breedingTimeline?: boolean;
      pregnancyCheck?: boolean;
      foalingApproaching?: boolean;
      heatCycleExpected?: boolean;
      marketplaceInquiry?: boolean;
      waitlistSignup?: boolean;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
    };

    // Get or create preferences
    let prefs = await prisma.userNotificationPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create with provided values
      prefs = await prisma.userNotificationPreferences.create({
        data: {
          tenantId,
          userId,
          ...body,
        },
      });
    } else {
      // Update existing
      prefs = await prisma.userNotificationPreferences.update({
        where: { userId },
        data: body,
      });
    }

    return reply.send({ preferences: prefs });
  });
};

export default notificationsRoutes;
