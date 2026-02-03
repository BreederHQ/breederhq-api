// src/routes/genetic-preferences.ts
/**
 * Genetic Notification Preferences API
 *
 * Provides granular control over genetic test notifications (in-app and email).
 * Also handles snooze functionality for "don't remind me" actions.
 *
 * IMPORTANT: Carrier warnings for lethal genes cannot be fully disabled.
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

// Default preferences (used when no record exists)
const DEFAULT_PREFERENCES = {
  inAppMissing: true,
  inAppIncomplete: true,
  inAppCarrier: true,
  inAppPrebreeding: true,
  inAppRegistry: true,
  inAppRecommended: false,
  emailMissing: false,
  emailIncomplete: false,
  emailCarrier: true,
  emailPrebreeding: true,
  emailRegistry: true,
  emailRecommended: false,
};

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

const geneticPreferencesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/users/me/genetic-notification-preferences
   * Get current user's genetic notification preferences
   */
  app.get("/users/me/genetic-notification-preferences", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const prefs = await prisma.geneticNotificationPreference.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    // Return actual preferences or defaults
    if (!prefs) {
      return reply.send({
        ...DEFAULT_PREFERENCES,
        id: null,
        userId,
        tenantId,
      });
    }

    return reply.send({
      id: prefs.id,
      userId: prefs.userId,
      tenantId: prefs.tenantId,
      inAppMissing: prefs.inAppMissing,
      inAppIncomplete: prefs.inAppIncomplete,
      inAppCarrier: prefs.inAppCarrier,
      inAppPrebreeding: prefs.inAppPrebreeding,
      inAppRegistry: prefs.inAppRegistry,
      inAppRecommended: prefs.inAppRecommended,
      emailMissing: prefs.emailMissing,
      emailIncomplete: prefs.emailIncomplete,
      emailCarrier: prefs.emailCarrier,
      emailPrebreeding: prefs.emailPrebreeding,
      emailRegistry: prefs.emailRegistry,
      emailRecommended: prefs.emailRecommended,
    });
  });

  /**
   * PUT /api/v1/users/me/genetic-notification-preferences
   * Update current user's genetic notification preferences
   *
   * IMPORTANT: Cannot disable carrier warnings (inAppCarrier) - enforced at API level
   */
  app.put("/users/me/genetic-notification-preferences", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const body = req.body as Partial<typeof DEFAULT_PREFERENCES>;

    // CRITICAL: Cannot disable in-app carrier warnings for lethal genes
    if (body.inAppCarrier === false) {
      return reply.code(400).send({
        error: "cannot_disable_carrier_warnings",
        message: "In-app carrier warnings for lethal genes cannot be disabled for safety reasons",
      });
    }

    // Build update data - only include provided fields
    const updateData: Record<string, boolean> = {};
    const allowedFields = [
      "inAppMissing",
      "inAppIncomplete",
      "inAppCarrier",
      "inAppPrebreeding",
      "inAppRegistry",
      "inAppRecommended",
      "emailMissing",
      "emailIncomplete",
      "emailCarrier",
      "emailPrebreeding",
      "emailRegistry",
      "emailRecommended",
    ] as const;

    for (const field of allowedFields) {
      if (typeof body[field] === "boolean") {
        updateData[field] = body[field];
      }
    }

    const prefs = await prisma.geneticNotificationPreference.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      create: {
        userId,
        tenantId,
        ...DEFAULT_PREFERENCES,
        ...updateData,
      },
      update: updateData,
    });

    return reply.send({
      id: prefs.id,
      userId: prefs.userId,
      tenantId: prefs.tenantId,
      inAppMissing: prefs.inAppMissing,
      inAppIncomplete: prefs.inAppIncomplete,
      inAppCarrier: prefs.inAppCarrier,
      inAppPrebreeding: prefs.inAppPrebreeding,
      inAppRegistry: prefs.inAppRegistry,
      inAppRecommended: prefs.inAppRecommended,
      emailMissing: prefs.emailMissing,
      emailIncomplete: prefs.emailIncomplete,
      emailCarrier: prefs.emailCarrier,
      emailPrebreeding: prefs.emailPrebreeding,
      emailRegistry: prefs.emailRegistry,
      emailRecommended: prefs.emailRecommended,
    });
  });

  /**
   * GET /api/v1/genetic-notifications/snoozes
   * List current user's snoozed genetic notifications
   */
  app.get("/genetic-notifications/snoozes", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const snoozes = await prisma.geneticNotificationSnooze.findMany({
      where: {
        userId,
        tenantId,
        // Only return active snoozes (permanent or not yet expired)
        OR: [{ snoozedUntil: null }, { snoozedUntil: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ snoozes });
  });

  /**
   * POST /api/v1/genetic-notifications/snooze
   * Snooze notifications for an animal, test, or animal+test combination
   *
   * Body:
   * - snoozeType: "ANIMAL" | "TEST" | "ANIMAL_TEST"
   * - animalId?: number (required for ANIMAL and ANIMAL_TEST)
   * - testCode?: string (required for TEST and ANIMAL_TEST, e.g., "HYPP", "OLWS")
   * - durationDays?: number (null = permanent snooze)
   */
  app.post("/genetic-notifications/snooze", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const body = req.body as {
      snoozeType: "ANIMAL" | "TEST" | "ANIMAL_TEST";
      animalId?: number;
      testCode?: string;
      durationDays?: number | null;
    };

    // Validate snoozeType
    if (!["ANIMAL", "TEST", "ANIMAL_TEST"].includes(body.snoozeType)) {
      return reply.code(400).send({
        error: "invalid_snooze_type",
        message: "snoozeType must be ANIMAL, TEST, or ANIMAL_TEST",
      });
    }

    // Validate required fields based on snoozeType
    if (body.snoozeType === "ANIMAL" && !body.animalId) {
      return reply.code(400).send({
        error: "missing_animal_id",
        message: "animalId is required for ANIMAL snooze type",
      });
    }
    if (body.snoozeType === "TEST" && !body.testCode) {
      return reply.code(400).send({
        error: "missing_test_code",
        message: "testCode is required for TEST snooze type",
      });
    }
    if (body.snoozeType === "ANIMAL_TEST" && (!body.animalId || !body.testCode)) {
      return reply.code(400).send({
        error: "missing_animal_id_or_test_code",
        message: "Both animalId and testCode are required for ANIMAL_TEST snooze type",
      });
    }

    // Calculate snoozedUntil date
    const snoozedUntil =
      body.durationDays != null
        ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000)
        : null; // null = permanent snooze

    // Upsert snooze record
    const snooze = await prisma.geneticNotificationSnooze.upsert({
      where: {
        userId_tenantId_snoozeType_animalId_testCode: {
          userId,
          tenantId,
          snoozeType: body.snoozeType,
          animalId: body.animalId ?? null,
          testCode: body.testCode ?? null,
        } as any,
      },
      create: {
        userId,
        tenantId,
        snoozeType: body.snoozeType,
        animalId: body.animalId ?? null,
        testCode: body.testCode ?? null,
        snoozedUntil,
      },
      update: {
        snoozedUntil,
      },
    });

    return reply.send({ success: true, snooze });
  });

  /**
   * DELETE /api/v1/genetic-notifications/snooze
   * Remove a snooze (resume notifications)
   *
   * Body:
   * - snoozeType: "ANIMAL" | "TEST" | "ANIMAL_TEST"
   * - animalId?: number
   * - testCode?: string
   */
  app.delete("/genetic-notifications/snooze", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const body = req.body as {
      snoozeType: "ANIMAL" | "TEST" | "ANIMAL_TEST";
      animalId?: number;
      testCode?: string;
    };

    // Validate snoozeType
    if (!["ANIMAL", "TEST", "ANIMAL_TEST"].includes(body.snoozeType)) {
      return reply.code(400).send({
        error: "invalid_snooze_type",
        message: "snoozeType must be ANIMAL, TEST, or ANIMAL_TEST",
      });
    }

    try {
      await prisma.geneticNotificationSnooze.delete({
        where: {
          userId_tenantId_snoozeType_animalId_testCode: {
            userId,
            tenantId,
            snoozeType: body.snoozeType,
            animalId: body.animalId ?? null,
            testCode: body.testCode ?? null,
          } as any,
        },
      });

      return reply.send({ success: true });
    } catch (err: any) {
      // Record not found - that's okay, it's already not snoozed
      if (err.code === "P2025") {
        return reply.send({ success: true, message: "snooze_not_found" });
      }
      throw err;
    }
  });

  /**
   * DELETE /api/v1/genetic-notifications/snooze/:id
   * Remove a snooze by ID
   */
  app.delete("/genetic-notifications/snooze/:id", async (req, reply) => {
    const tenantId = await assertTenant(req, reply);
    if (!tenantId) return;

    const userId = await assertUser(req, reply);
    if (!userId) return;

    const snoozeId = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(snoozeId)) {
      return reply.code(400).send({ error: "invalid_id" });
    }

    // Verify ownership before deleting
    const snooze = await prisma.geneticNotificationSnooze.findFirst({
      where: { id: snoozeId, userId, tenantId },
    });

    if (!snooze) {
      return reply.code(404).send({ error: "snooze_not_found" });
    }

    await prisma.geneticNotificationSnooze.delete({
      where: { id: snoozeId },
    });

    return reply.send({ success: true });
  });
};

export default geneticPreferencesRoutes;
