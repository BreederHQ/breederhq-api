/**
 * Buyer CRM Integration Tests (P4)
 *
 * Tests for Buyer CRM Phase 1 features:
 * - Buyer CRUD operations
 * - Buyer interests (link buyers to animals)
 * - Deal CRUD operations
 * - Deal stage transitions
 * - Deal activities
 * - Tenant isolation
 *
 * @see docs/planning/product/horse-mvp/specifications/BUYER-CRM-SPEC.md
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, BuyerStatus, InterestLevel, DealStage, DealOutcome } from "@prisma/client";
import {
  TENANT_PREFIXES,
  createTestTenant,
  teardownTestTenant,
  cleanupStaleTenants,
} from "../helpers/tenant-helpers.js";

const prisma = new PrismaClient();

interface TestContext {
  tenantId: number;
  tenantId2: number; // For tenant isolation tests
  partyId: number;
  partyId2: number;
  animalId: number;
  animalId2: number;
  buyerId: number;
  dealId: number;
  userId: number;
}

const ctx: TestContext = {} as TestContext;

describe("Buyer CRM Integration Tests", () => {
  before(async () => {
    // Cleanup stale tenants from previous runs
    await cleanupStaleTenants(TENANT_PREFIXES.buyerCrm, 24, prisma);

    // Create test tenant 1
    const tenant = await createTestTenant(
      "Buyer CRM Test Tenant",
      TENANT_PREFIXES.buyerCrm
    );
    ctx.tenantId = tenant.id;

    // Create test tenant 2 for isolation tests
    const tenant2 = await createTestTenant(
      "Buyer CRM Test Tenant 2",
      TENANT_PREFIXES.buyerCrm
    );
    ctx.tenantId2 = tenant2.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        firstName: "Test",
        lastName: "User",
      },
    });
    ctx.userId = user.id;

    // Create test party (buyer contact)
    const party = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: "CONTACT",
        name: "John Buyer",
      },
    });
    ctx.partyId = party.id;

    // Create second party
    const party2 = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: "CONTACT",
        name: "Jane Buyer",
      },
    });
    ctx.partyId2 = party2.id;

    // Create test animal
    const animal = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Horse",
        species: "HORSE",
        sex: "MALE",
        status: "ACTIVE",
        forSale: true,
        declaredValueCents: 5000000, // $50,000
        declaredValueCurrency: "USD",
      },
    });
    ctx.animalId = animal.id;

    // Create second animal
    const animal2 = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Another Horse",
        species: "HORSE",
        sex: "FEMALE",
        status: "ACTIVE",
        forSale: true,
      },
    });
    ctx.animalId2 = animal2.id;
  });

  after(async () => {
    // Clean up test user
    if (ctx.userId) {
      await prisma.user.delete({ where: { id: ctx.userId } }).catch(() => {});
    }

    // Clean up test tenants
    if (ctx.tenantId) {
      await teardownTestTenant(ctx.tenantId, prisma);
    }
    if (ctx.tenantId2) {
      await teardownTestTenant(ctx.tenantId2, prisma);
    }
    await prisma.$disconnect();
  });

  describe("Buyer CRUD Operations", () => {
    it("should create a buyer linked to a party", async () => {
      const buyer = await prisma.buyer.create({
        data: {
          tenantId: ctx.tenantId,
          partyId: ctx.partyId,
          status: "ACTIVE",
          source: "Website Inquiry",
          budget: 75000,
          budgetCurrency: "USD",
          notes: "Looking for a competition horse",
          preferredBreeds: ["Thoroughbred", "Warmblood"],
          preferredUses: ["Show Jumping", "Dressage"],
          preferredAgeMin: 4,
          preferredAgeMax: 10,
          preferredSex: "MALE",
        },
        include: {
          party: true,
        },
      });

      ctx.buyerId = buyer.id;

      assert.ok(buyer.id, "Buyer should be created with ID");
      assert.strictEqual(buyer.tenantId, ctx.tenantId);
      assert.strictEqual(buyer.partyId, ctx.partyId);
      assert.strictEqual(buyer.status, "ACTIVE");
      assert.strictEqual(buyer.source, "Website Inquiry");
      assert.strictEqual(Number(buyer.budget), 75000);
      assert.strictEqual(buyer.budgetCurrency, "USD");
      assert.ok(buyer.preferredBreeds.includes("Thoroughbred"));
      assert.strictEqual(buyer.party.name, "John Buyer");
    });

    it("should enforce unique partyId constraint", async () => {
      // Try to create another buyer with the same partyId
      await assert.rejects(
        async () => {
          await prisma.buyer.create({
            data: {
              tenantId: ctx.tenantId,
              partyId: ctx.partyId, // Same party as existing buyer
              status: "ACTIVE",
            },
          });
        },
        (err: Error) => {
          assert.ok(
            err.message.includes("Unique constraint"),
            "Should fail with unique constraint error"
          );
          return true;
        }
      );
    });

    it("should update buyer status", async () => {
      const updated = await prisma.buyer.update({
        where: { id: ctx.buyerId },
        data: {
          status: "HOT",
          notes: "Very interested, ready to buy",
        },
      });

      assert.strictEqual(updated.status, "HOT");
      assert.strictEqual(updated.notes, "Very interested, ready to buy");
    });

    it("should list buyers with counts", async () => {
      const buyers = await prisma.buyer.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          party: true,
          _count: {
            select: {
              interests: true,
              deals: true,
            },
          },
        },
      });

      assert.strictEqual(buyers.length, 1);
      assert.strictEqual(buyers[0]._count.interests, 0);
      assert.strictEqual(buyers[0]._count.deals, 0);
    });

    it("should archive a buyer", async () => {
      const archived = await prisma.buyer.update({
        where: { id: ctx.buyerId },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
        },
      });

      assert.strictEqual(archived.status, "ARCHIVED");
      assert.ok(archived.archivedAt, "archivedAt should be set");
    });

    it("should unarchive a buyer", async () => {
      const unarchived = await prisma.buyer.update({
        where: { id: ctx.buyerId },
        data: {
          status: "ACTIVE",
          archivedAt: null,
        },
      });

      assert.strictEqual(unarchived.status, "ACTIVE");
      assert.strictEqual(unarchived.archivedAt, null);
    });
  });

  describe("Buyer Interests", () => {
    it("should add interest in an animal", async () => {
      const interest = await prisma.buyerInterest.create({
        data: {
          buyerId: ctx.buyerId,
          animalId: ctx.animalId,
          level: "INTERESTED",
          notes: "Liked the horse at the show",
        },
        include: {
          animal: true,
        },
      });

      assert.ok(interest.id, "Interest should be created with ID");
      assert.strictEqual(interest.buyerId, ctx.buyerId);
      assert.strictEqual(interest.animalId, ctx.animalId);
      assert.strictEqual(interest.level, "INTERESTED");
      assert.strictEqual(interest.animal.name, "Test Horse");
    });

    it("should update interest level", async () => {
      const updated = await prisma.buyerInterest.updateMany({
        where: {
          buyerId: ctx.buyerId,
          animalId: ctx.animalId,
        },
        data: {
          level: "SERIOUS",
          notes: "Wants to schedule a viewing",
        },
      });

      assert.strictEqual(updated.count, 1);

      const interest = await prisma.buyerInterest.findFirst({
        where: {
          buyerId: ctx.buyerId,
          animalId: ctx.animalId,
        },
      });

      assert.strictEqual(interest?.level, "SERIOUS");
    });

    it("should list buyer interests", async () => {
      // Add another interest
      await prisma.buyerInterest.create({
        data: {
          buyerId: ctx.buyerId,
          animalId: ctx.animalId2,
          level: "BROWSING",
        },
      });

      const interests = await prisma.buyerInterest.findMany({
        where: { buyerId: ctx.buyerId },
        include: { animal: true },
      });

      assert.strictEqual(interests.length, 2);
    });

    it("should remove interest", async () => {
      const deleted = await prisma.buyerInterest.deleteMany({
        where: {
          buyerId: ctx.buyerId,
          animalId: ctx.animalId2,
        },
      });

      assert.strictEqual(deleted.count, 1);
    });
  });

  describe("Deal CRUD Operations", () => {
    it("should create a deal from buyer interest", async () => {
      const deal = await prisma.deal.create({
        data: {
          tenantId: ctx.tenantId,
          buyerId: ctx.buyerId,
          animalId: ctx.animalId,
          name: "Deal: Test Horse for John Buyer",
          stage: "INQUIRY",
          askingPrice: 50000,
          currency: "USD",
          notes: "Initial inquiry from website",
        },
        include: {
          buyer: {
            include: { party: true },
          },
          animal: true,
        },
      });

      ctx.dealId = deal.id;

      assert.ok(deal.id, "Deal should be created with ID");
      assert.strictEqual(deal.tenantId, ctx.tenantId);
      assert.strictEqual(deal.buyerId, ctx.buyerId);
      assert.strictEqual(deal.animalId, ctx.animalId);
      assert.strictEqual(deal.stage, "INQUIRY");
      assert.strictEqual(Number(deal.askingPrice), 50000);
      assert.strictEqual(deal.buyer.party.name, "John Buyer");
      assert.strictEqual(deal.animal?.name, "Test Horse");
    });

    it("should update deal stage", async () => {
      const updated = await prisma.deal.update({
        where: { id: ctx.dealId },
        data: {
          stage: "NEGOTIATION",
          offerPrice: 45000,
        },
      });

      assert.strictEqual(updated.stage, "NEGOTIATION");
      assert.strictEqual(Number(updated.offerPrice), 45000);
    });

    it("should update deal expected close date", async () => {
      const closeDate = new Date("2026-03-01");
      const updated = await prisma.deal.update({
        where: { id: ctx.dealId },
        data: {
          expectedCloseDate: closeDate,
        },
      });

      assert.strictEqual(
        updated.expectedCloseDate?.toISOString().split("T")[0],
        "2026-03-01"
      );
    });

    it("should get pipeline view grouped by stage", async () => {
      // Create additional deals in different stages
      await prisma.deal.create({
        data: {
          tenantId: ctx.tenantId,
          buyerId: ctx.buyerId,
          name: "General Inquiry",
          stage: "INQUIRY",
          currency: "USD",
        },
      });

      const stages: DealStage[] = [
        "INQUIRY",
        "QUALIFIED",
        "NEGOTIATION",
        "CONTRACT",
        "CLOSED_WON",
        "CLOSED_LOST",
      ];

      const pipeline: Record<DealStage, number> = {} as Record<DealStage, number>;

      for (const stage of stages) {
        const count = await prisma.deal.count({
          where: {
            tenantId: ctx.tenantId,
            stage,
          },
        });
        pipeline[stage] = count;
      }

      assert.strictEqual(pipeline.INQUIRY, 1);
      assert.strictEqual(pipeline.NEGOTIATION, 1);
      assert.strictEqual(pipeline.CLOSED_WON, 0);
    });
  });

  describe("Deal Stage Transitions", () => {
    it("should move deal through pipeline stages", async () => {
      // Move to QUALIFIED
      await prisma.deal.update({
        where: { id: ctx.dealId },
        data: { stage: "QUALIFIED" },
      });

      // Move to CONTRACT
      await prisma.deal.update({
        where: { id: ctx.dealId },
        data: { stage: "CONTRACT" },
      });

      const deal = await prisma.deal.findUnique({
        where: { id: ctx.dealId },
      });

      assert.strictEqual(deal?.stage, "CONTRACT");
    });

    it("should close deal as won", async () => {
      const closedAt = new Date();
      const closed = await prisma.deal.update({
        where: { id: ctx.dealId },
        data: {
          stage: "CLOSED_WON",
          outcome: "WON",
          finalPrice: 47500,
          closedAt,
        },
      });

      assert.strictEqual(closed.stage, "CLOSED_WON");
      assert.strictEqual(closed.outcome, "WON");
      assert.strictEqual(Number(closed.finalPrice), 47500);
      assert.ok(closed.closedAt, "closedAt should be set");
    });

    it("should close deal as lost", async () => {
      // Create and close a deal as lost
      const lostDeal = await prisma.deal.create({
        data: {
          tenantId: ctx.tenantId,
          buyerId: ctx.buyerId,
          name: "Lost Deal",
          stage: "NEGOTIATION",
          currency: "USD",
        },
      });

      const closed = await prisma.deal.update({
        where: { id: lostDeal.id },
        data: {
          stage: "CLOSED_LOST",
          outcome: "LOST",
          lostReason: "Price too high",
          closedAt: new Date(),
        },
      });

      assert.strictEqual(closed.stage, "CLOSED_LOST");
      assert.strictEqual(closed.outcome, "LOST");
      assert.strictEqual(closed.lostReason, "Price too high");
    });
  });

  describe("Deal Activities", () => {
    it("should log deal activity", async () => {
      const activity = await prisma.dealActivity.create({
        data: {
          dealId: ctx.dealId,
          type: "NOTE",
          content: "Called buyer to discuss pricing",
          userId: ctx.userId,
        },
        include: {
          user: true,
        },
      });

      assert.ok(activity.id, "Activity should be created with ID");
      assert.strictEqual(activity.dealId, ctx.dealId);
      assert.strictEqual(activity.type, "NOTE");
      assert.strictEqual(activity.content, "Called buyer to discuss pricing");
      assert.strictEqual(activity.user?.firstName, "Test");
    });

    it("should log stage change activity", async () => {
      const activity = await prisma.dealActivity.create({
        data: {
          dealId: ctx.dealId,
          type: "STAGE_CHANGE",
          content: "Stage changed from CONTRACT to CLOSED_WON",
          metadata: {
            fromStage: "CONTRACT",
            toStage: "CLOSED_WON",
          },
          userId: ctx.userId,
        },
      });

      assert.strictEqual(activity.type, "STAGE_CHANGE");
      const metadata = activity.metadata as Record<string, string>;
      assert.strictEqual(metadata.fromStage, "CONTRACT");
      assert.strictEqual(metadata.toStage, "CLOSED_WON");
    });

    it("should list deal activities in order", async () => {
      const activities = await prisma.dealActivity.findMany({
        where: { dealId: ctx.dealId },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(activities.length >= 2);
      // Most recent should be first
      assert.ok(
        activities[0].createdAt >= activities[1].createdAt,
        "Activities should be ordered by createdAt desc"
      );
    });
  });

  describe("Tenant Isolation", () => {
    it("should not see buyers from other tenants", async () => {
      // Create party in tenant 2
      const party = await prisma.party.create({
        data: {
          tenantId: ctx.tenantId2,
          type: "CONTACT",
          name: "Other Tenant Buyer",
        },
      });

      // Create buyer in tenant 2
      await prisma.buyer.create({
        data: {
          tenantId: ctx.tenantId2,
          partyId: party.id,
          status: "ACTIVE",
        },
      });

      // Query for buyers in tenant 1 only
      const tenant1Buyers = await prisma.buyer.findMany({
        where: { tenantId: ctx.tenantId },
      });

      // Should only see tenant 1 buyer
      assert.strictEqual(tenant1Buyers.length, 1);
      assert.strictEqual(tenant1Buyers[0].partyId, ctx.partyId);
    });

    it("should not see deals from other tenants", async () => {
      // Get all deals for tenant 1
      const tenant1Deals = await prisma.deal.findMany({
        where: { tenantId: ctx.tenantId },
      });

      // All deals should belong to tenant 1
      for (const deal of tenant1Deals) {
        assert.strictEqual(deal.tenantId, ctx.tenantId);
      }
    });
  });

  describe("Buyer with Counts", () => {
    it("should return correct interest and deal counts", async () => {
      const buyer = await prisma.buyer.findUnique({
        where: { id: ctx.buyerId },
        include: {
          _count: {
            select: {
              interests: true,
              deals: true,
            },
          },
        },
      });

      assert.ok(buyer, "Buyer should exist");
      assert.ok(buyer._count.interests >= 1, "Should have at least 1 interest");
      assert.ok(buyer._count.deals >= 1, "Should have at least 1 deal");
    });
  });

  describe("Deal without Animal", () => {
    it("should allow creating a deal without an animal", async () => {
      const deal = await prisma.deal.create({
        data: {
          tenantId: ctx.tenantId,
          buyerId: ctx.buyerId,
          name: "General Purchase Interest",
          stage: "INQUIRY",
          currency: "USD",
          notes: "Buyer interested in purchasing, no specific horse yet",
        },
      });

      assert.ok(deal.id, "Deal should be created");
      assert.strictEqual(deal.animalId, null, "animalId should be null");
    });
  });
});
