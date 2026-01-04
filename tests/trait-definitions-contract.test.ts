/**
 * Trait Definitions Contract Tests
 *
 * Verifies the backend contract for Health trait definitions:
 * 1. Trait definitions exist for DOG species (seeded data)
 * 2. All expected categories are present with at least one trait each
 * 3. Marketplace visibility persists correctly when set
 *
 * These tests ensure the Health tab and Marketplace visibility controls
 * always work without frontend fallbacks.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, Species } from "@prisma/client";
import {
  TENANT_PREFIXES,
  createTestTenant,
  teardownTestTenant,
  cleanupStaleTenants,
} from "./helpers/tenant-helpers.js";

const prisma = new PrismaClient();

// Expected DOG trait categories - must all be present
const EXPECTED_DOG_CATEGORIES = [
  "Orthopedic",
  "Eyes",
  "Cardiac",
  "Genetic",
  "Infectious",
  "Preventative",
  "Reproductive",
  "General",
];

// ============================================================================
// Test Context
// ============================================================================

type TestContext = {
  tenantId: number;
  animalId: number;
};

const ctx: TestContext = {} as TestContext;

describe("Trait Definitions Contract Tests", () => {
  before(async () => {
    // Cleanup stale test tenants from previous runs
    await cleanupStaleTenants(TENANT_PREFIXES.traitDefinitions, 24, prisma);

    // Create test tenant
    const tenant = await createTestTenant(
      "Trait Definition Contract Test Tenant",
      TENANT_PREFIXES.traitDefinitions
    );
    ctx.tenantId = tenant.id;

    // Create a DOG animal for testing
    const animal = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Dog for Traits",
        species: Species.DOG,
        sex: "MALE",
        status: "ACTIVE",
      },
    });
    ctx.animalId = animal.id;
  });

  after(async () => {
    // Cleanup test data
    try {
      await teardownTestTenant(ctx.tenantId, prisma);
    } catch (error) {
      console.warn("Teardown warning:", error);
    }
    await prisma.$disconnect();
  });

  // ==========================================================================
  // Task 2: Backend Contract Test - Trait Definitions Exist
  // ==========================================================================

  describe("DOG Trait Definitions Contract", () => {
    it("should have global trait definitions for DOG species", async () => {
      const dogTraits = await prisma.traitDefinition.findMany({
        where: {
          species: Species.DOG,
          tenantId: null, // Global definitions only
        },
      });

      assert.ok(
        dogTraits.length > 0,
        `CRITICAL: No DOG trait definitions found! Run 'npm run db:dev:seed:traits' to seed trait definitions.`
      );
    });

    it("should have all expected categories for DOG", async () => {
      const dogTraits = await prisma.traitDefinition.findMany({
        where: {
          species: Species.DOG,
          tenantId: null,
        },
        select: { category: true },
      });

      const presentCategories = new Set(dogTraits.map((t) => t.category));

      for (const expectedCategory of EXPECTED_DOG_CATEGORIES) {
        assert.ok(
          presentCategories.has(expectedCategory),
          `Missing category: ${expectedCategory}. Found: ${Array.from(presentCategories).join(", ")}`
        );
      }
    });

    it("should have at least one trait per category for DOG", async () => {
      const dogTraits = await prisma.traitDefinition.groupBy({
        by: ["category"],
        where: {
          species: Species.DOG,
          tenantId: null,
        },
        _count: { id: true },
      });

      const categoryCountMap = new Map(
        dogTraits.map((row) => [row.category, row._count.id])
      );

      for (const expectedCategory of EXPECTED_DOG_CATEGORIES) {
        const count = categoryCountMap.get(expectedCategory) ?? 0;
        assert.ok(
          count >= 1,
          `Category ${expectedCategory} has no traits. Expected at least 1.`
        );
      }
    });

    it("should return trait definitions via service query (simulating GET /animals/:id/traits)", async () => {
      // This simulates the exact query used by the animal-traits route
      const animal = await prisma.animal.findUnique({
        where: { id: ctx.animalId },
        select: { species: true },
      });

      assert.ok(animal, "Test animal not found");

      const definitions = await prisma.traitDefinition.findMany({
        where: {
          species: animal.species,
          OR: [{ tenantId: null }, { tenantId: ctx.tenantId }],
        },
        orderBy: [{ sortOrder: "asc" }, { category: "asc" }],
      });

      // Group by category (same logic as animal-traits route)
      const categoryMap = new Map<string, any[]>();
      for (const def of definitions) {
        if (!categoryMap.has(def.category)) categoryMap.set(def.category, []);
        categoryMap.get(def.category)!.push(def);
      }

      const categories = Array.from(categoryMap.entries()).map(
        ([category, items]) => ({ category, items })
      );

      // Verify categories.length > 0
      assert.ok(
        categories.length > 0,
        "Service query returned 0 categories for DOG animal"
      );

      // Verify expected categories are present
      const categoryNames = categories.map((c) => c.category);
      for (const expected of EXPECTED_DOG_CATEGORIES) {
        assert.ok(
          categoryNames.includes(expected),
          `Service query missing category: ${expected}`
        );
      }

      // Verify each category has at least one trait
      for (const cat of categories) {
        assert.ok(
          cat.items.length >= 1,
          `Category ${cat.category} has no items in service query result`
        );
      }
    });
  });

  // ==========================================================================
  // Task 3: Marketplace Visibility Persistence Test
  // ==========================================================================

  describe("Marketplace Visibility Persistence", () => {
    it("should persist marketplaceVisible = true when setting a trait value", async () => {
      // Get a trait definition to test with
      const traitDef = await prisma.traitDefinition.findFirst({
        where: {
          species: Species.DOG,
          tenantId: null,
          valueType: "ENUM", // Use an ENUM type for easy testing
        },
      });

      assert.ok(traitDef, "No ENUM trait definition found for DOG");

      // Upsert a trait value with marketplaceVisible = true
      const enumValues = Array.isArray(traitDef.enumValues)
        ? traitDef.enumValues
        : [];
      const testValue = enumValues[0] ?? "Normal";

      await prisma.animalTraitValue.upsert({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
        update: {
          valueText: testValue,
          marketplaceVisible: true,
        },
        create: {
          tenantId: ctx.tenantId,
          animalId: ctx.animalId,
          traitDefinitionId: traitDef.id,
          valueText: testValue,
          marketplaceVisible: true,
        },
      });

      // Reload and verify persistence
      const reloaded = await prisma.animalTraitValue.findUnique({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
      });

      assert.ok(reloaded, "Trait value was not persisted");
      assert.strictEqual(
        reloaded.marketplaceVisible,
        true,
        "marketplaceVisible was not persisted as true"
      );
    });

    it("should persist marketplaceVisible = false when explicitly set", async () => {
      // Get a different trait definition
      const traitDef = await prisma.traitDefinition.findFirst({
        where: {
          species: Species.DOG,
          tenantId: null,
          valueType: "BOOLEAN",
        },
      });

      assert.ok(traitDef, "No BOOLEAN trait definition found for DOG");

      // Create with marketplaceVisible = false
      await prisma.animalTraitValue.upsert({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
        update: {
          valueBoolean: true,
          marketplaceVisible: false,
        },
        create: {
          tenantId: ctx.tenantId,
          animalId: ctx.animalId,
          traitDefinitionId: traitDef.id,
          valueBoolean: true,
          marketplaceVisible: false,
        },
      });

      // Reload and verify
      const reloaded = await prisma.animalTraitValue.findUnique({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
      });

      assert.ok(reloaded, "Trait value was not persisted");
      assert.strictEqual(
        reloaded.marketplaceVisible,
        false,
        "marketplaceVisible was not persisted as false"
      );
    });

    it("should toggle marketplaceVisible from false to true", async () => {
      // Get any trait definition that doesn't have a value yet
      const traitDef = await prisma.traitDefinition.findFirst({
        where: {
          species: Species.DOG,
          tenantId: null,
          valueType: "TEXT",
        },
      });

      assert.ok(traitDef, "No TEXT trait definition found for DOG");

      // Create with marketplaceVisible = false
      await prisma.animalTraitValue.upsert({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
        update: {
          valueText: "Test Value",
          marketplaceVisible: false,
        },
        create: {
          tenantId: ctx.tenantId,
          animalId: ctx.animalId,
          traitDefinitionId: traitDef.id,
          valueText: "Test Value",
          marketplaceVisible: false,
        },
      });

      // Toggle to true
      await prisma.animalTraitValue.update({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
        data: {
          marketplaceVisible: true,
        },
      });

      // Reload and verify
      const reloaded = await prisma.animalTraitValue.findUnique({
        where: {
          tenantId_animalId_traitDefinitionId: {
            tenantId: ctx.tenantId,
            animalId: ctx.animalId,
            traitDefinitionId: traitDef.id,
          },
        },
      });

      assert.ok(reloaded, "Trait value was not persisted after toggle");
      assert.strictEqual(
        reloaded.marketplaceVisible,
        true,
        "marketplaceVisible was not toggled to true"
      );
    });
  });

  // ==========================================================================
  // Guardrails: Fail-Fast Verification
  // ==========================================================================

  describe("Guardrails: Seed Verification", () => {
    it("should have minimum expected number of DOG traits (fail-fast)", async () => {
      const count = await prisma.traitDefinition.count({
        where: {
          species: Species.DOG,
          tenantId: null,
        },
      });

      // We expect at least 15 DOG traits based on seed file
      assert.ok(
        count >= 15,
        `Expected at least 15 DOG trait definitions, found ${count}. Seed may be incomplete.`
      );
    });

    it("should have marketplaceVisibleDefault set to boolean for all trait definitions", async () => {
      // Verify all traits have marketplaceVisibleDefault as a boolean (not undefined)
      // Schema requires this field (non-nullable with default false)
      const allTraits = await prisma.traitDefinition.findMany({
        where: {
          species: Species.DOG,
          tenantId: null,
        },
        select: { key: true, marketplaceVisibleDefault: true },
      });

      for (const trait of allTraits) {
        assert.strictEqual(
          typeof trait.marketplaceVisibleDefault,
          "boolean",
          `Trait ${trait.key} has non-boolean marketplaceVisibleDefault: ${trait.marketplaceVisibleDefault}`
        );
      }
    });
  });
});
