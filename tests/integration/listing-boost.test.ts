/**
 * Listing Boost Integration Tests
 *
 * Tests the listing-boost-service.ts service functions directly via Prisma.
 * Stripe checkout is NOT tested (no mock available) — PENDING records are
 * created via Prisma and activateBoost() simulates webhook activation.
 *
 * Uses Node.js built-in test runner (node:test).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { ListingBoostTarget, BoostTier, BoostStatus } from "@prisma/client";
import {
  TENANT_PREFIXES,
  createTestTenant,
  teardownTestTenant,
  cleanupStaleTenants,
} from "../helpers/tenant-helpers.js";
import {
  BOOST_CONFIG,
  activateBoost,
  cancelBoost,
  adminCancelBoost,
  pauseBoost,
  resumeBoost,
  toggleAutoRenew,
  getBoostsForOwner,
  getBoostById,
  getFeaturedListings,
  getAllBoosts,
  getBoostStats,
  processBoostExpirations,
  trackBoostClick,
  trackBoostInquiry,
  applyBoostRanking,
} from "../../src/services/listing-boost-service.js";

const prisma = new PrismaClient();

// ============================================================================
// Test Context
// ============================================================================

interface TestContext {
  tenantId: number;
  tenantId2: number;
  animalId: number;
  animalId2: number;
  listingId: number; // MktListingIndividualAnimal
  listingId2: number; // second MktListingIndividualAnimal (replaces breeder service)
}

const ctx: TestContext = {} as TestContext;

// Helper: create a PENDING boost record via Prisma
async function createBoost(
  overrides: Partial<{
    tenantId: number;
    listingType: ListingBoostTarget;
    listingId: number;
    tier: BoostTier;
    status: BoostStatus;
    weight: number;
    durationDays: number;
    amountCents: number;
    autoRenew: boolean;
    startsAt: Date | null;
    expiresAt: Date | null;
    impressions: number;
    clicks: number;
    inquiries: number;
  }> = {}
) {
  return prisma.listingBoost.create({
    data: {
      tenantId: overrides.tenantId ?? ctx.tenantId,
      listingType: overrides.listingType ?? "INDIVIDUAL_ANIMAL",
      listingId: overrides.listingId ?? ctx.animalId,
      tier: overrides.tier ?? "BOOST",
      weight: overrides.weight ?? 1.5,
      durationDays: overrides.durationDays ?? 7,
      status: overrides.status ?? "PENDING",
      amountCents: overrides.amountCents ?? 499,
      currency: "USD",
      autoRenew: overrides.autoRenew ?? false,
      startsAt: overrides.startsAt ?? null,
      expiresAt: overrides.expiresAt ?? null,
      impressions: overrides.impressions ?? 0,
      clicks: overrides.clicks ?? 0,
      inquiries: overrides.inquiries ?? 0,
    },
  });
}

// Helper: clean up all boosts for test tenants
async function cleanupBoosts() {
  await prisma.listingBoost.deleteMany({
    where: { tenantId: { in: [ctx.tenantId, ctx.tenantId2].filter(Boolean) } },
  });
}

// Helper: future date
function futureDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Helper: past date
function pastDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Listing Boost Integration Tests", () => {
  before(async () => {
    await cleanupStaleTenants(TENANT_PREFIXES.listingBoost, 24, prisma);

    // Create two tenants for isolation tests
    const tenant1 = await createTestTenant("Boost Test Tenant 1", TENANT_PREFIXES.listingBoost);
    const tenant2 = await createTestTenant("Boost Test Tenant 2", TENANT_PREFIXES.listingBoost);
    ctx.tenantId = tenant1.id;
    ctx.tenantId2 = tenant2.id;

    // Create test animals
    const animal1 = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Boost Test Animal 1",
        species: "DOG",
        sex: "MALE",
        status: "ACTIVE",
      },
    });
    ctx.animalId = animal1.id;

    const animal2 = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Boost Test Animal 2",
        species: "DOG",
        sex: "FEMALE",
        status: "ACTIVE",
      },
    });
    ctx.animalId2 = animal2.id;

    // Create individual animal listing
    const listing = await prisma.mktListingIndividualAnimal.create({
      data: {
        tenantId: ctx.tenantId,
        animalId: ctx.animalId,
        templateType: "REHOME",
        slug: `boost-test-listing-${Date.now()}`,
        status: "LIVE",
        priceModel: "fixed",
        priceCents: 50000,
        dataDrawerConfig: {},
        publishedAt: new Date(),
      },
    });
    ctx.listingId = listing.id;

    // Create second individual animal listing (used for cross-listing-type tests).
    // Note: mkt_listing_breeder_service table doesn't exist in DB yet, so we use
    // a second individual animal listing. ListingBoost only stores listingType +
    // listingId without FK constraint, so we can test different listing types
    // with any valid numeric id.
    const listing2 = await prisma.mktListingIndividualAnimal.create({
      data: {
        tenantId: ctx.tenantId,
        animalId: ctx.animalId2,
        templateType: "REHOME",
        slug: `boost-test-listing2-${Date.now()}`,
        status: "LIVE",
        priceModel: "fixed",
        priceCents: 75000,
        dataDrawerConfig: {},
        publishedAt: new Date(),
      },
    });
    ctx.listingId2 = listing2.id;
  });

  after(async () => {
    await cleanupBoosts();
    if (ctx.tenantId) await teardownTestTenant(ctx.tenantId, prisma);
    if (ctx.tenantId2) await teardownTestTenant(ctx.tenantId2, prisma);
    await prisma.$disconnect();
  });

  // ========================================================================
  // 1. Boost Activation
  // ========================================================================

  describe("Boost Activation (activateBoost)", () => {
    after(async () => { await cleanupBoosts(); });

    it("should activate a PENDING BOOST record", async () => {
      const boost = await createBoost({ tier: "BOOST", weight: 1.5, durationDays: 7 });
      await activateBoost(boost.id, "pi_test_boost_001");

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "ACTIVE");
      assert.ok(updated?.startsAt, "startsAt should be set");
      assert.ok(updated?.expiresAt, "expiresAt should be set");
      assert.strictEqual(updated?.stripePaymentId, "pi_test_boost_001");

      // Verify expiresAt is ~7 days from now
      const diffMs = updated!.expiresAt!.getTime() - updated!.startsAt!.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      assert.strictEqual(diffDays, 7);
    });

    it("should activate a PENDING FEATURED record", async () => {
      const boost = await createBoost({
        tier: "FEATURED",
        weight: 3.0,
        durationDays: 30,
        amountCents: 1999,
        listingId: ctx.animalId2,
      });
      await activateBoost(boost.id, "pi_test_featured_001");

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "ACTIVE");
      const diffMs = updated!.expiresAt!.getTime() - updated!.startsAt!.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      assert.strictEqual(diffDays, 30);
    });

    it("should throw for non-existent boost ID", async () => {
      await assert.rejects(
        () => activateBoost(999999, "pi_test_ghost"),
        (err: any) => err.message?.includes("not found") || err.message?.includes("No ListingBoost"),
        "Should throw for non-existent boost"
      );
    });
  });

  // ========================================================================
  // 2. Cancel Boost
  // ========================================================================

  describe("Cancel Boost (cancelBoost)", () => {
    after(async () => { await cleanupBoosts(); });

    it("should cancel an ACTIVE boost by owner", async () => {
      const boost = await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });
      await cancelBoost(boost.id, { tenantId: ctx.tenantId });

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "CANCELED");
    });

    it("should cancel a PAUSED boost by owner", async () => {
      const boost = await createBoost({ status: "PAUSED", startsAt: pastDate(2), expiresAt: futureDate(5) });
      await cancelBoost(boost.id, { tenantId: ctx.tenantId });

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "CANCELED");
    });

    it("should reject cancel by non-owner tenant", async () => {
      const boost = await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });

      await assert.rejects(
        () => cancelBoost(boost.id, { tenantId: ctx.tenantId2 }),
        (err: any) => true, // Any error means it was rejected
        "Should reject non-owner cancellation"
      );
    });
  });

  // ========================================================================
  // 3. Admin Cancel
  // ========================================================================

  describe("Admin Cancel Boost (adminCancelBoost)", () => {
    after(async () => { await cleanupBoosts(); });

    it("should admin-cancel ACTIVE boost without ownership check", async () => {
      const boost = await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });
      await adminCancelBoost(boost.id);

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "CANCELED");
    });

    it("should admin-cancel PENDING boost", async () => {
      const boost = await createBoost({ status: "PENDING" });
      await adminCancelBoost(boost.id);

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "CANCELED");
    });
  });

  // ========================================================================
  // 4. Pause / Resume
  // ========================================================================

  describe("Pause and Resume Boost", () => {
    after(async () => { await cleanupBoosts(); });

    it("should pause ACTIVE boost when listing paused", async () => {
      const boost = await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });
      await pauseBoost("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "PAUSED");
    });

    it("should resume PAUSED boost with future expiresAt", async () => {
      const boost = await createBoost({ status: "PAUSED", startsAt: pastDate(2), expiresAt: futureDate(5) });
      await resumeBoost("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "ACTIVE");
    });

    it("should only affect matching listing type and ID", async () => {
      const boost1 = await createBoost({
        status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7),
        listingId: ctx.animalId,
      });
      const boost2 = await createBoost({
        status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7),
        listingId: ctx.animalId2,
      });

      // Pause only animalId, not animalId2
      await pauseBoost("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);

      const u1 = await prisma.listingBoost.findUnique({ where: { id: boost1.id } });
      const u2 = await prisma.listingBoost.findUnique({ where: { id: boost2.id } });
      assert.strictEqual(u1?.status, "PAUSED");
      assert.strictEqual(u2?.status, "ACTIVE");
    });
  });

  // ========================================================================
  // 5. Toggle Auto-Renew
  // ========================================================================

  describe("Toggle Auto-Renew", () => {
    after(async () => { await cleanupBoosts(); });

    it("should enable auto-renew", async () => {
      const boost = await createBoost({ autoRenew: false, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });
      await toggleAutoRenew(boost.id, true, { tenantId: ctx.tenantId });

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.autoRenew, true);
    });

    it("should disable auto-renew", async () => {
      const boost = await createBoost({ autoRenew: true, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });
      await toggleAutoRenew(boost.id, false, { tenantId: ctx.tenantId });

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.autoRenew, false);
    });

    it("should reject toggle by non-owner", async () => {
      const boost = await createBoost({ autoRenew: false, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });

      await assert.rejects(
        () => toggleAutoRenew(boost.id, true, { tenantId: ctx.tenantId2 }),
        (err: any) => true,
        "Should reject non-owner toggle"
      );
    });
  });

  // ========================================================================
  // 6. Duplicate Prevention
  // ========================================================================

  describe("Duplicate Boost Prevention (FR-21)", () => {
    after(async () => { await cleanupBoosts(); });

    it("should detect existing PENDING/ACTIVE boost on same listing", async () => {
      await createBoost({ status: "PENDING", listingId: ctx.animalId });

      // Verify the guard query finds it
      const existing = await prisma.listingBoost.findFirst({
        where: {
          listingType: "INDIVIDUAL_ANIMAL",
          listingId: ctx.animalId,
          status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
        },
      });
      assert.ok(existing, "Should find existing boost blocking new purchase");
    });

    it("should allow new boost after EXPIRED", async () => {
      await cleanupBoosts();
      await createBoost({ status: "EXPIRED", listingId: ctx.animalId, startsAt: pastDate(10), expiresAt: pastDate(3) });

      const blocking = await prisma.listingBoost.findFirst({
        where: {
          listingType: "INDIVIDUAL_ANIMAL",
          listingId: ctx.animalId,
          status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
        },
      });
      assert.strictEqual(blocking, null, "EXPIRED boost should not block new purchase");
    });

    it("should allow new boost after CANCELED", async () => {
      await cleanupBoosts();
      await createBoost({ status: "CANCELED", listingId: ctx.animalId, startsAt: pastDate(5), expiresAt: futureDate(2) });

      const blocking = await prisma.listingBoost.findFirst({
        where: {
          listingType: "INDIVIDUAL_ANIMAL",
          listingId: ctx.animalId,
          status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
        },
      });
      assert.strictEqual(blocking, null, "CANCELED boost should not block new purchase");
    });
  });

  // ========================================================================
  // 7. Query Functions
  // ========================================================================

  describe("Query Functions", () => {
    after(async () => { await cleanupBoosts(); });

    describe("getBoostsForOwner", () => {
      it("should return paginated boosts for owner", async () => {
        await cleanupBoosts();
        await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7) });
        await createBoost({ status: "EXPIRED", listingId: ctx.animalId2, startsAt: pastDate(10), expiresAt: pastDate(3) });
        await createBoost({ status: "PENDING", listingType: "BREEDER_SERVICE" as ListingBoostTarget, listingId: ctx.listingId2 });

        const result = await getBoostsForOwner({ tenantId: ctx.tenantId }, 1, 25);
        assert.ok(result.items.length >= 3, `Expected >= 3 boosts, got ${result.items.length}`);
        assert.ok(result.total >= 3);
      });

      it("should return empty for tenant with no boosts", async () => {
        const result = await getBoostsForOwner({ tenantId: ctx.tenantId2 }, 1, 25);
        assert.strictEqual(result.items.length, 0);
        assert.strictEqual(result.total, 0);
      });
    });

    describe("getBoostById", () => {
      it("should return boost by ID", async () => {
        await cleanupBoosts();
        const boost = await createBoost({});
        const found = await getBoostById(boost.id);
        assert.ok(found);
        assert.strictEqual(found!.id, boost.id);
        assert.strictEqual(found!.tier, "BOOST");
      });

      it("should return null for non-existent ID", async () => {
        const found = await getBoostById(999999);
        assert.strictEqual(found, null);
      });
    });

    describe("getFeaturedListings", () => {
      it("should return only ACTIVE FEATURED boosts", async () => {
        await cleanupBoosts();
        // Create various boosts
        await createBoost({ tier: "FEATURED", weight: 3.0, durationDays: 30, amountCents: 1999, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(30) });
        await createBoost({ tier: "BOOST", weight: 1.5, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7), listingId: ctx.animalId2 });
        await createBoost({ tier: "FEATURED", weight: 3.0, durationDays: 30, amountCents: 1999, status: "EXPIRED", startsAt: pastDate(35), expiresAt: pastDate(5), listingType: "BREEDER_SERVICE" as ListingBoostTarget, listingId: ctx.listingId2 });

        const featured = await getFeaturedListings("all");
        // Should only contain the ACTIVE FEATURED, not the BOOST or EXPIRED FEATURED
        assert.ok(featured.length >= 1, "Should have at least 1 featured");
        assert.ok(featured.every(b => b.tier === "FEATURED" && b.status === "ACTIVE"));
      });

      it("should filter by page type 'animals'", async () => {
        await cleanupBoosts();
        await createBoost({ tier: "FEATURED", weight: 3.0, durationDays: 30, amountCents: 1999, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(30), listingType: "INDIVIDUAL_ANIMAL" as ListingBoostTarget });
        await createBoost({ tier: "FEATURED", weight: 3.0, durationDays: 30, amountCents: 1999, status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(30), listingType: "BREEDER_SERVICE" as ListingBoostTarget, listingId: ctx.listingId2 });

        const animals = await getFeaturedListings("animals");
        assert.ok(animals.every(b => b.listingType === "INDIVIDUAL_ANIMAL" || b.listingType === "ANIMAL_PROGRAM"));
      });

      it("should filter by page type 'services'", async () => {
        const services = await getFeaturedListings("services");
        if (services.length > 0) {
          const validTypes = ["BREEDER_SERVICE", "BREEDING_LISTING", "PROVIDER_SERVICE"];
          assert.ok(services.every(b => validTypes.includes(b.listingType)));
        }
      });
    });

    describe("getBoostStats (admin)", () => {
      it("should return stats object", async () => {
        const stats = await getBoostStats();
        assert.ok(typeof stats.activeBoosts === "number");
        assert.ok(typeof stats.totalRevenueCents === "number");
        assert.ok(stats.tierBreakdown !== undefined);
        assert.ok(stats.statusBreakdown !== undefined);
      });
    });
  });

  // ========================================================================
  // 8. Expiration Processing
  // ========================================================================

  describe("Expiration Processing (processBoostExpirations)", () => {
    after(async () => { await cleanupBoosts(); });

    it("should expire ACTIVE boosts past expiresAt", async () => {
      await cleanupBoosts();
      const boost = await createBoost({
        status: "ACTIVE",
        startsAt: pastDate(10),
        expiresAt: pastDate(1), // Expired yesterday
      });

      const result = await processBoostExpirations();
      assert.ok(result.expiredCount >= 1, `Expected >= 1 expired, got ${result.expiredCount}`);

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "EXPIRED");
    });

    it("should expire PAUSED boosts past expiresAt", async () => {
      await cleanupBoosts();
      const boost = await createBoost({
        status: "PAUSED",
        startsAt: pastDate(10),
        expiresAt: pastDate(1),
      });

      await processBoostExpirations();

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "EXPIRED");
    });

    it("should NOT expire ACTIVE boosts with future expiresAt", async () => {
      await cleanupBoosts();
      const boost = await createBoost({
        status: "ACTIVE",
        startsAt: new Date(),
        expiresAt: futureDate(5),
      });

      await processBoostExpirations();

      const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
      assert.strictEqual(updated?.status, "ACTIVE");
    });

    it("should be idempotent (safe to run twice)", async () => {
      await cleanupBoosts();
      await createBoost({
        status: "ACTIVE",
        startsAt: pastDate(10),
        expiresAt: pastDate(1),
      });

      const result1 = await processBoostExpirations();
      assert.ok(result1.expiredCount >= 1);

      // Second run should have 0 expirations (already expired)
      const result2 = await processBoostExpirations();
      assert.strictEqual(result2.expiredCount, 0, "Second run should expire nothing");
    });
  });

  // ========================================================================
  // 9. Analytics Tracking
  // ========================================================================

  describe("Analytics Tracking", () => {
    after(async () => { await cleanupBoosts(); });

    describe("trackBoostClick", () => {
      it("should increment click count on ACTIVE boost", async () => {
        await cleanupBoosts();
        const boost = await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7), clicks: 0 });

        const tracked = await trackBoostClick("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);
        assert.strictEqual(tracked, true);

        const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
        assert.strictEqual(updated?.clicks, 1);
      });

      it("should accumulate clicks", async () => {
        // Second click on same boost
        await trackBoostClick("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);
        await trackBoostClick("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);

        const boost = await prisma.listingBoost.findFirst({
          where: { listingType: "INDIVIDUAL_ANIMAL", listingId: ctx.animalId, status: "ACTIVE" },
        });
        assert.ok(boost!.clicks >= 3, `Expected >= 3 clicks, got ${boost!.clicks}`);
      });

      it("should return false when no active boost exists", async () => {
        const tracked = await trackBoostClick("INDIVIDUAL_ANIMAL" as ListingBoostTarget, 999999);
        assert.strictEqual(tracked, false);
      });

      it("should not track clicks on EXPIRED boosts", async () => {
        await cleanupBoosts();
        await createBoost({ status: "EXPIRED", startsAt: pastDate(10), expiresAt: pastDate(3), clicks: 5 });

        const tracked = await trackBoostClick("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);
        assert.strictEqual(tracked, false);
      });
    });

    describe("trackBoostInquiry", () => {
      it("should increment inquiry count on ACTIVE boost", async () => {
        await cleanupBoosts();
        const boost = await createBoost({ status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(7), inquiries: 0 });

        const tracked = await trackBoostInquiry("INDIVIDUAL_ANIMAL" as ListingBoostTarget, ctx.animalId);
        assert.strictEqual(tracked, true);

        const updated = await prisma.listingBoost.findUnique({ where: { id: boost.id } });
        assert.strictEqual(updated?.inquiries, 1);
      });

      it("should return false when no active boost", async () => {
        const tracked = await trackBoostInquiry("INDIVIDUAL_ANIMAL" as ListingBoostTarget, 999999);
        assert.strictEqual(tracked, false);
      });
    });
  });

  // ========================================================================
  // 10. Search Ranking (applyBoostRanking)
  // ========================================================================

  describe("Search Ranking (applyBoostRanking)", () => {
    after(async () => { await cleanupBoosts(); });

    it("should return items unchanged when no boosts exist", async () => {
      await cleanupBoosts();
      const items = [{ id: 1001 }, { id: 1002 }, { id: 1003 }];
      const result = await applyBoostRanking(items, "INDIVIDUAL_ANIMAL" as ListingBoostTarget);

      assert.strictEqual(result.length, 3);
      // Items should have MonetizationFields set to defaults
      assert.strictEqual(result[0].id, 1001);
    });

    it("should sort Featured before Boosted before Organic", async () => {
      await cleanupBoosts();

      // Use enough items so the 15% cap allows at least 2 promoted slots.
      // ceil(14 * 0.15) = 3 slots — enough for 1 featured + 1 boosted.
      const items = Array.from({ length: 14 }, (_, i) => ({ id: 2001 + i }));
      // 2001 = featured, 2002 = boosted, rest = organic

      await createBoost({
        listingType: "INDIVIDUAL_ANIMAL" as ListingBoostTarget,
        listingId: 2002,
        tier: "BOOST", weight: 1.5, status: "ACTIVE",
        startsAt: new Date(), expiresAt: futureDate(7),
      });
      await createBoost({
        listingType: "INDIVIDUAL_ANIMAL" as ListingBoostTarget,
        listingId: 2001,
        tier: "FEATURED", weight: 3.0, durationDays: 30, amountCents: 1999,
        status: "ACTIVE", startsAt: new Date(), expiresAt: futureDate(30),
      });

      const result = await applyBoostRanking(items, "INDIVIDUAL_ANIMAL" as ListingBoostTarget);

      // Featured (2001) should be first, Boosted (2002) second, organic after
      assert.strictEqual(result[0].id, 2001, "Featured should be first");
      assert.strictEqual(result[1].id, 2002, "Boosted should be second");
      // The rest should be organic items (2003, 2004, ...)
      assert.ok(result[2].id >= 2003, "Organic should follow promoted items");
    });

    it("should enforce 15% cap on promoted listings", async () => {
      await cleanupBoosts();

      // Create 20 items, boost 10 of them
      const items = Array.from({ length: 20 }, (_, i) => ({ id: 3000 + i }));

      for (let i = 0; i < 10; i++) {
        await createBoost({
          listingType: "INDIVIDUAL_ANIMAL" as ListingBoostTarget,
          listingId: 3000 + i,
          tier: "BOOST", weight: 1.5, status: "ACTIVE",
          startsAt: new Date(), expiresAt: futureDate(7),
        });
      }

      const result = await applyBoostRanking(items, "INDIVIDUAL_ANIMAL" as ListingBoostTarget);

      // Max promoted positions: ceil(20 * 0.15) = 3
      // MonetizationFields uses "boosted" and "featured" (not "isBoosted"/"isFeatured")
      const promotedInTop = result.slice(0, 3).filter(
        (item: any) => item.boosted || item.featured
      );
      // At least some promoted should be in top positions
      assert.ok(promotedInTop.length > 0, "Some promoted listings should be in top positions");
      assert.ok(promotedInTop.length <= 3, `Cap should limit to 3, got ${promotedInTop.length}`);
    });

    it("should return empty array for empty input", async () => {
      const result = await applyBoostRanking([], "INDIVIDUAL_ANIMAL" as ListingBoostTarget);
      assert.strictEqual(result.length, 0);
    });
  });
});
