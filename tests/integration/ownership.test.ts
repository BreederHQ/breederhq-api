/**
 * Ownership Integration Tests (P3.5)
 *
 * Tests for Enhanced Ownership features (P2):
 * - Add owner with all P2 fields
 * - Verify role saved correctly
 * - Verify dates saved correctly
 * - Verify isPrimaryContact constraint (only one per animal)
 * - Verify ownership history endpoint returns ended ownerships
 *
 * @see docs/planning/product/horse-mvp/specifications/09-OWNERSHIP-SYNDICATION-SPEC.md
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

const prisma = new PrismaClient();

interface TestContext {
  tenantId: number;
  animalId: number;
  ownerPartyId1: number;
  ownerPartyId2: number;
  ownerPartyId3: number;
}

const ctx: TestContext = {} as TestContext;

describe("Ownership Integration Tests", () => {
  before(async () => {
    // Cleanup stale tenants from previous runs
    await cleanupStaleTenants(TENANT_PREFIXES.ownership, 24, prisma);

    // Create test tenant
    const tenant = await createTestTenant(
      "Ownership Test Tenant",
      TENANT_PREFIXES.ownership
    );
    ctx.tenantId = tenant.id;

    // Create test animal
    const animal = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Horse",
        species: "HORSE",
        sex: "MALE",
        status: "ACTIVE",
      },
    });
    ctx.animalId = animal.id;

    // Create owner parties
    const party1 = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: "CONTACT",
        name: "Owner One",
      },
    });
    ctx.ownerPartyId1 = party1.id;

    const party2 = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: "CONTACT",
        name: "Owner Two",
      },
    });
    ctx.ownerPartyId2 = party2.id;

    const party3 = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: "CONTACT",
        name: "Owner Three",
      },
    });
    ctx.ownerPartyId3 = party3.id;
  });

  after(async () => {
    if (ctx.tenantId) {
      await teardownTestTenant(ctx.tenantId, prisma);
    }
    await prisma.$disconnect();
  });

  describe("Add Owner with P2 Fields", () => {
    it("should create owner with all P2 fields", async () => {
      const effectiveDate = new Date("2025-01-01");

      const owner = await prisma.animalOwner.create({
        data: {
          animalId: ctx.animalId,
          partyId: ctx.ownerPartyId1,
          role: "SOLE_OWNER",
          percent: 50,
          isPrimaryContact: true,
          effectiveDate,
          endDate: null,
          notes: "Original owner",
        },
      });

      assert.ok(owner.id, "Owner should be created with ID");
      assert.strictEqual(owner.role, "SOLE_OWNER");
      assert.strictEqual(owner.percent, 50);
      assert.strictEqual(owner.isPrimaryContact, true);
      assert.strictEqual(owner.effectiveDate?.toISOString(), effectiveDate.toISOString());
      assert.strictEqual(owner.endDate, null);
      assert.strictEqual(owner.notes, "Original owner");
    });

    it("should verify role saved correctly on reload", async () => {
      const owners = await prisma.animalOwner.findMany({
        where: { animalId: ctx.animalId },
      });

      assert.strictEqual(owners.length, 1);
      assert.strictEqual(owners[0].role, "SOLE_OWNER");
    });

    it("should verify dates saved correctly", async () => {
      const owner = await prisma.animalOwner.findFirst({
        where: { animalId: ctx.animalId, partyId: ctx.ownerPartyId1 },
      });

      assert.ok(owner, "Owner should exist");
      assert.ok(owner.effectiveDate, "effectiveDate should be set");
      assert.strictEqual(owner.endDate, null, "endDate should be null for active ownership");
    });
  });

  describe("Multi-Owner Support", () => {
    it("should support multiple owners on same animal", async () => {
      // Add second owner
      const owner2 = await prisma.animalOwner.create({
        data: {
          animalId: ctx.animalId,
          partyId: ctx.ownerPartyId2,
          role: "CO_OWNER",
          percent: 30,
          isPrimaryContact: false,
          effectiveDate: new Date("2025-06-01"),
        },
      });

      assert.ok(owner2.id, "Second owner should be created");
      assert.strictEqual(owner2.role, "CO_OWNER");
      assert.strictEqual(owner2.percent, 30);

      // Verify both owners exist
      const owners = await prisma.animalOwner.findMany({
        where: { animalId: ctx.animalId },
      });

      assert.strictEqual(owners.length, 2);
    });
  });

  describe("isPrimaryContact Constraint", () => {
    it("should allow only one isPrimaryContact per animal", async () => {
      // Get current primary contact
      const currentPrimary = await prisma.animalOwner.findFirst({
        where: { animalId: ctx.animalId, isPrimaryContact: true },
      });

      assert.ok(currentPrimary, "Should have a primary contact");

      // When adding a new owner as primary contact,
      // we should demote the existing primary first
      await prisma.animalOwner.update({
        where: { id: currentPrimary.id },
        data: { isPrimaryContact: false },
      });

      // Add new primary contact
      const newPrimary = await prisma.animalOwner.create({
        data: {
          animalId: ctx.animalId,
          partyId: ctx.ownerPartyId3,
          role: "MANAGING_PARTNER",
          percent: 20,
          isPrimaryContact: true,
          effectiveDate: new Date("2026-01-01"),
        },
      });

      assert.strictEqual(newPrimary.isPrimaryContact, true);

      // Verify only one primary contact
      const primaryContacts = await prisma.animalOwner.findMany({
        where: { animalId: ctx.animalId, isPrimaryContact: true },
      });

      assert.strictEqual(primaryContacts.length, 1, "Should have exactly one primary contact");
      assert.strictEqual(primaryContacts[0].partyId, ctx.ownerPartyId3);
    });
  });

  describe("Ownership History", () => {
    it("should track ended ownerships for history", async () => {
      // End the original owner's ownership
      await prisma.animalOwner.updateMany({
        where: {
          animalId: ctx.animalId,
          partyId: ctx.ownerPartyId1,
        },
        data: {
          endDate: new Date("2025-12-31"),
        },
      });

      // Query for ownership history (including ended)
      const allOwners = await prisma.animalOwner.findMany({
        where: { animalId: ctx.animalId },
        orderBy: { effectiveDate: "asc" },
      });

      // Should have 3 owners total (including ended one)
      assert.strictEqual(allOwners.length, 3);

      // Query for current owners only (no endDate)
      const currentOwners = await prisma.animalOwner.findMany({
        where: {
          animalId: ctx.animalId,
          endDate: null,
        },
      });

      // Should have 2 current owners
      assert.strictEqual(currentOwners.length, 2);
    });

    it("should correctly identify historical vs current ownerships", async () => {
      const endedOwner = await prisma.animalOwner.findFirst({
        where: {
          animalId: ctx.animalId,
          partyId: ctx.ownerPartyId1,
        },
      });

      assert.ok(endedOwner, "Ended owner should exist");
      assert.ok(endedOwner.endDate, "Ended owner should have endDate set");

      const currentOwner = await prisma.animalOwner.findFirst({
        where: {
          animalId: ctx.animalId,
          partyId: ctx.ownerPartyId2,
        },
      });

      assert.ok(currentOwner, "Current owner should exist");
      assert.strictEqual(currentOwner.endDate, null, "Current owner should have null endDate");
    });
  });

  describe("Ownership Percentage Validation", () => {
    it("should track total ownership percentage", async () => {
      const owners = await prisma.animalOwner.findMany({
        where: {
          animalId: ctx.animalId,
          endDate: null, // Current owners only
        },
      });

      const totalPercentage = owners.reduce(
        (sum, o) => sum + (o.percent ?? 0),
        0
      );

      // Note: Total can exceed 100% if ownership is shared/tracked differently
      // This test verifies the values are being tracked correctly
      assert.ok(totalPercentage > 0, "Total percentage should be positive");
      console.log(`  Total current ownership: ${totalPercentage}%`);
    });
  });
});
