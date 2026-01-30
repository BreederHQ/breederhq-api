/**
 * Guarantee Notifications Integration Tests (P3.5)
 *
 * Tests for guarantee expiration notifications (P3.3, P3.4):
 * - Create breeding attempt with guarantee expiring in 7 days
 * - Run scanner
 * - Verify notification created with correct type
 * - Verify notification not duplicated on re-run
 *
 * @see docs/planning/product/horse-mvp/specifications/08-STALLION-REVENUE-MANAGEMENT-SPEC.md
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  TENANT_PREFIXES,
  createTestTenant,
  teardownTestTenant,
  cleanupStaleTenants,
} from "../helpers/tenant-helpers.js";
import {
  scanGuaranteeExpirations,
  createGuaranteeNotifications,
} from "../../src/services/notification-scanner.js";

const prisma = new PrismaClient();

interface TestContext {
  tenantId: number;
  damId: number;
  sireId: number;
  breedingPlanId: number;
  breedingAttemptId: number;
}

const ctx: TestContext = {} as TestContext;

/**
 * Helper to add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Helper to get start of day
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

describe("Guarantee Notifications Integration Tests", () => {
  before(async () => {
    // Cleanup stale tenants from previous runs
    await cleanupStaleTenants(TENANT_PREFIXES.guaranteeNotifications, 24, prisma);

    // Create test tenant
    const tenant = await createTestTenant(
      "Guarantee Notifications Test Tenant",
      TENANT_PREFIXES.guaranteeNotifications
    );
    ctx.tenantId = tenant.id;

    // Create dam
    const dam = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Mare",
        species: "HORSE",
        sex: "FEMALE",
        status: "BREEDING",
      },
    });
    ctx.damId = dam.id;

    // Create sire
    const sire = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Stallion",
        species: "HORSE",
        sex: "MALE",
        status: "BREEDING",
      },
    });
    ctx.sireId = sire.id;

    // Create breeding plan
    const plan = await prisma.breedingPlan.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Breeding Plan",
        species: "HORSE",
        damId: ctx.damId,
        sireId: ctx.sireId,
        status: "BRED",
        archived: false,
      },
    });
    ctx.breedingPlanId = plan.id;
  });

  after(async () => {
    // Clean up notifications first
    await prisma.notification.deleteMany({
      where: { tenantId: ctx.tenantId },
    });

    if (ctx.tenantId) {
      await teardownTestTenant(ctx.tenantId, prisma);
    }
    await prisma.$disconnect();
  });

  describe("Guarantee Expiring in 7 Days", () => {
    it("should create breeding attempt with guarantee expiring in 7 days", async () => {
      const today = startOfDay(new Date());
      const expiresIn7Days = addDays(today, 7);

      const attempt = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.breedingPlanId,
          damId: ctx.damId,
          sireId: ctx.sireId,
          method: "NATURAL",
          guaranteeType: "LIVE_FOAL",
          guaranteeExpiresAt: expiresIn7Days,
          guaranteeTriggered: false,
          guaranteeResolution: null,
        },
      });

      ctx.breedingAttemptId = attempt.id;

      assert.ok(attempt.id, "Breeding attempt should be created");
      assert.strictEqual(attempt.guaranteeType, "LIVE_FOAL");
      assert.ok(attempt.guaranteeExpiresAt, "guaranteeExpiresAt should be set");
      assert.strictEqual(attempt.guaranteeTriggered, false);
      assert.strictEqual(attempt.guaranteeResolution, null);
    });

    it("should scan and find the expiring guarantee", async () => {
      const alerts = await scanGuaranteeExpirations();

      // Find our specific alert
      const ourAlert = alerts.find(
        (a) => a.breedingAttemptId === ctx.breedingAttemptId
      );

      assert.ok(ourAlert, "Should find our breeding attempt in alerts");
      assert.strictEqual(ourAlert.guaranteeType, "LIVE_FOAL");
      assert.strictEqual(ourAlert.daysUntilExpiration, 7);
      assert.strictEqual(ourAlert.damName, "Test Mare");
      assert.strictEqual(ourAlert.sireName, "Test Stallion");
    });

    it("should create notification with correct type", async () => {
      const alerts = await scanGuaranteeExpirations();
      const created = await createGuaranteeNotifications(alerts);

      // Should create at least 1 notification
      assert.ok(created >= 1, `Should create notifications, got ${created}`);

      // Verify notification exists
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.tenantId,
          type: "guarantee_expiring_7d",
        },
      });

      assert.ok(notification, "Notification should exist");
      assert.strictEqual(notification.type, "guarantee_expiring_7d");
      assert.strictEqual(notification.priority, "HIGH");
      assert.ok(
        notification.title?.includes("Expires in 7 Days"),
        `Title should mention 7 days: ${notification.title}`
      );
    });
  });

  describe("Notification Deduplication", () => {
    it("should not duplicate notification on re-run", async () => {
      // Count existing notifications
      const beforeCount = await prisma.notification.count({
        where: {
          tenantId: ctx.tenantId,
          type: "guarantee_expiring_7d",
        },
      });

      // Run scanner again
      const alerts = await scanGuaranteeExpirations();
      const created = await createGuaranteeNotifications(alerts);

      // Should not create new notifications (idempotent)
      const afterCount = await prisma.notification.count({
        where: {
          tenantId: ctx.tenantId,
          type: "guarantee_expiring_7d",
        },
      });

      assert.strictEqual(
        afterCount,
        beforeCount,
        "Should not create duplicate notifications"
      );
      assert.strictEqual(created, 0, "createGuaranteeNotifications should return 0 for duplicates");
    });
  });

  describe("30-Day Warning", () => {
    it("should create notification for guarantee expiring in 30 days", async () => {
      const today = startOfDay(new Date());
      const expiresIn30Days = addDays(today, 30);

      // Create another breeding attempt expiring in 30 days
      const attempt30d = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.breedingPlanId,
          damId: ctx.damId,
          sireId: ctx.sireId,
          method: "AI_TCI",
          guaranteeType: "STANDS_AND_NURSES",
          guaranteeExpiresAt: expiresIn30Days,
          guaranteeTriggered: false,
          guaranteeResolution: null,
        },
      });

      // Run scanner
      const alerts = await scanGuaranteeExpirations();
      await createGuaranteeNotifications(alerts);

      // Verify notification created
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.tenantId,
          type: "guarantee_expiring_30d",
        },
      });

      assert.ok(notification, "30-day notification should exist");
      assert.strictEqual(notification.type, "guarantee_expiring_30d");
      assert.strictEqual(notification.priority, "MEDIUM");

      // Cleanup
      await prisma.breedingAttempt.delete({ where: { id: attempt30d.id } });
    });
  });

  describe("Expired Guarantee", () => {
    it("should create urgent notification for expired guarantee", async () => {
      const today = startOfDay(new Date());
      const expiredYesterday = addDays(today, -1);

      // Create breeding attempt that expired yesterday
      const expiredAttempt = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.breedingPlanId,
          damId: ctx.damId,
          sireId: ctx.sireId,
          method: "NATURAL",
          guaranteeType: "SIXTY_DAY_PREGNANCY",
          guaranteeExpiresAt: expiredYesterday,
          guaranteeTriggered: false,
          guaranteeResolution: null,
        },
      });

      // Run scanner
      const alerts = await scanGuaranteeExpirations();
      await createGuaranteeNotifications(alerts);

      // Verify notification created
      const notification = await prisma.notification.findFirst({
        where: {
          tenantId: ctx.tenantId,
          type: "guarantee_expired",
        },
      });

      assert.ok(notification, "Expired notification should exist");
      assert.strictEqual(notification.type, "guarantee_expired");
      assert.strictEqual(notification.priority, "URGENT");
      assert.ok(
        notification.title?.includes("Action Required"),
        `Title should indicate action required: ${notification.title}`
      );

      // Cleanup
      await prisma.breedingAttempt.delete({ where: { id: expiredAttempt.id } });
    });
  });

  describe("Resolved Guarantees Not Scanned", () => {
    it("should not scan guarantees that have been resolved", async () => {
      const today = startOfDay(new Date());
      const expiresIn7Days = addDays(today, 7);

      // Create breeding attempt with resolved guarantee
      const resolvedAttempt = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.breedingPlanId,
          damId: ctx.damId,
          sireId: ctx.sireId,
          method: "NATURAL",
          guaranteeType: "LIVE_FOAL",
          guaranteeExpiresAt: expiresIn7Days,
          guaranteeTriggered: true,
          guaranteeResolution: "RETURN_BREEDING_GRANTED",
        },
      });

      // Run scanner
      const alerts = await scanGuaranteeExpirations();

      // Should not find the resolved attempt
      const foundResolved = alerts.find(
        (a) => a.breedingAttemptId === resolvedAttempt.id
      );

      assert.strictEqual(
        foundResolved,
        undefined,
        "Should not scan resolved guarantees"
      );

      // Cleanup
      await prisma.breedingAttempt.delete({ where: { id: resolvedAttempt.id } });
    });
  });

  describe("NO_GUARANTEE Not Scanned", () => {
    it("should not scan breeding attempts with NO_GUARANTEE", async () => {
      const today = startOfDay(new Date());
      const expiresIn7Days = addDays(today, 7);

      // Create breeding attempt with no guarantee
      const noGuaranteeAttempt = await prisma.breedingAttempt.create({
        data: {
          tenantId: ctx.tenantId,
          planId: ctx.breedingPlanId,
          damId: ctx.damId,
          sireId: ctx.sireId,
          method: "NATURAL",
          guaranteeType: "NO_GUARANTEE",
          guaranteeExpiresAt: expiresIn7Days,
          guaranteeTriggered: false,
          guaranteeResolution: null,
        },
      });

      // Run scanner
      const alerts = await scanGuaranteeExpirations();

      // Should not find the NO_GUARANTEE attempt
      const foundNoGuarantee = alerts.find(
        (a) => a.breedingAttemptId === noGuaranteeAttempt.id
      );

      assert.strictEqual(
        foundNoGuarantee,
        undefined,
        "Should not scan NO_GUARANTEE attempts"
      );

      // Cleanup
      await prisma.breedingAttempt.delete({ where: { id: noGuaranteeAttempt.id } });
    });
  });
});
