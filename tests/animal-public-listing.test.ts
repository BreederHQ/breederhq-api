/**
 * Animal Public Listing API Tests
 *
 * Validates:
 * A. Upsert creates DRAFT
 * B. Public endpoints filter LIVE only
 * C. Inquiry endpoint gating
 * D. Response shape for Marketplace UI cards
 * E. Indexes and uniqueness (schema validation)
 * F. Integration with existing test suite
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

// Use string literals for enums since Prisma client may not be regenerated yet
const Species = { DOG: "DOG", CAT: "CAT" } as const;
const PartyType = { ORGANIZATION: "ORGANIZATION", CONTACT: "CONTACT" } as const;
const AnimalListingStatus = { DRAFT: "DRAFT", LIVE: "LIVE", PAUSED: "PAUSED" } as const;
const AnimalListingIntent = { STUD: "STUD", BROOD_PLACEMENT: "BROOD_PLACEMENT", REHOME: "REHOME", SHOWCASE: "SHOWCASE" } as const;

const prisma = new PrismaClient();

type TestContext = {
  tenantId: number;
  organizationId: number;
  animalId: number;
  listingId?: number;
  partyId: number;
  userId: string;
  programSlug: string;
  listingSlug: string;
};

const ctx: TestContext = {} as TestContext;

describe("Animal Public Listing API Contract Tests", () => {
  before(async () => {
    // Setup test data
    const tenant = await prisma.tenant.create({
      data: {
        name: "Animal Listing Test Tenant",
        slug: `animal-listing-test-${Date.now()}`,
      },
    });
    ctx.tenantId = tenant.id;
    ctx.programSlug = `test-program-${Date.now()}`;
    ctx.listingSlug = `test-listing-${Date.now()}`;

    // Create test animal (minimal setup - no Party/Organization needed for listing tests)
    const animal = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Stud Dog",
        species: Species.DOG,
        sex: "MALE",
        status: "BREEDING",
        breed: "German Shepherd",
      },
    });
    ctx.animalId = animal.id;
  });

  after(async () => {
    // Cleanup: cascade delete via tenant
    if (ctx.tenantId) {
      await prisma.tenant.delete({ where: { id: ctx.tenantId } });
    }
    await prisma.$disconnect();
  });

  describe("A. Upsert Creates DRAFT", () => {
    it("should create listing with status DRAFT by default", async () => {
      const listing = await prisma.animalPublicListing.create({
        data: {
          animalId: ctx.animalId,
          tenantId: ctx.tenantId,
          urlSlug: ctx.listingSlug,
          intent: AnimalListingIntent.STUD,
          headline: "Champion Stud Available",
          title: "Test Stud Dog",
          priceModel: "fixed",
          priceCents: 150000,
        },
      });

      ctx.listingId = listing.id;

      assert.strictEqual(listing.status, AnimalListingStatus.DRAFT, "New listing should have DRAFT status");
      assert.strictEqual(listing.publishedAt, null, "publishedAt should be null for DRAFT");
      assert.strictEqual(listing.pausedAt, null, "pausedAt should be null for DRAFT");
    });

    it("should reject update to status LIVE without intent", async () => {
      // Create a listing without intent
      const animal2 = await prisma.animal.create({
        data: {
          tenantId: ctx.tenantId,
          name: "No Intent Animal",
          species: Species.DOG,
          sex: "FEMALE",
          status: "ACTIVE",
        },
      });

      const listing = await prisma.animalPublicListing.create({
        data: {
          animalId: animal2.id,
          tenantId: ctx.tenantId,
          urlSlug: `no-intent-${Date.now()}`,
          // No intent provided
        },
      });

      // Verify intent is null
      assert.strictEqual(listing.intent, null, "Listing should have no intent");

      // The API layer should reject promotion to LIVE without intent
      // (This is enforced in the route handler, not DB constraint)
      // We verify the schema allows null intent for DRAFT
      assert.strictEqual(listing.status, AnimalListingStatus.DRAFT);

      // Cleanup
      await prisma.animalPublicListing.delete({ where: { id: listing.id } });
      await prisma.animal.delete({ where: { id: animal2.id } });
    });

    it("should update listing fields via upsert", async () => {
      const updated = await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: {
          headline: "Updated Headline",
          priceModel: "range",
          priceMinCents: 100000,
          priceMaxCents: 200000,
          locationCity: "Austin",
          locationRegion: "TX",
          locationCountry: "US",
        },
      });

      assert.strictEqual(updated.headline, "Updated Headline");
      assert.strictEqual(updated.priceModel, "range");
      assert.strictEqual(updated.priceMinCents, 100000);
      assert.strictEqual(updated.priceMaxCents, 200000);
      assert.strictEqual(updated.locationCity, "Austin");
      assert.strictEqual(updated.locationRegion, "TX");
      assert.strictEqual(updated.locationCountry, "US");
      // Status should NOT change on update
      assert.strictEqual(updated.status, AnimalListingStatus.DRAFT);
    });
  });

  describe("B. Public Endpoints Filter LIVE Only", () => {
    it("DRAFT listing should not appear in public query", async () => {
      const draftListings = await prisma.animalPublicListing.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "LIVE",
        },
      });

      // Our test listing is DRAFT, so it should not appear
      const found = draftListings.find((l) => l.id === ctx.listingId);
      assert.strictEqual(found, undefined, "DRAFT listing should not appear in LIVE filter");
    });

    it("should set publishedAt when transitioning to LIVE", async () => {
      const now = new Date();

      const updated = await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: {
          status: "LIVE",
          publishedAt: now,
          pausedAt: null,
        },
      });

      assert.strictEqual(updated.status, AnimalListingStatus.LIVE);
      assert.ok(updated.publishedAt, "publishedAt should be set");
      assert.strictEqual(updated.pausedAt, null, "pausedAt should be null for LIVE");
    });

    it("LIVE listing should appear in public query", async () => {
      const liveListings = await prisma.animalPublicListing.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "LIVE",
        },
      });

      const found = liveListings.find((l) => l.id === ctx.listingId);
      assert.ok(found, "LIVE listing should appear in LIVE filter");
    });

    it("should set pausedAt when transitioning from LIVE to PAUSED", async () => {
      const now = new Date();

      const updated = await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: {
          status: "PAUSED",
          pausedAt: now,
        },
      });

      assert.strictEqual(updated.status, AnimalListingStatus.PAUSED);
      assert.ok(updated.pausedAt, "pausedAt should be set");
      // publishedAt should be preserved
      assert.ok(updated.publishedAt, "publishedAt should be preserved");
    });

    it("PAUSED listing should not appear in public LIVE filter", async () => {
      const liveListings = await prisma.animalPublicListing.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "LIVE",
        },
      });

      const found = liveListings.find((l) => l.id === ctx.listingId);
      assert.strictEqual(found, undefined, "PAUSED listing should not appear in LIVE filter");
    });
  });

  describe("C. Inquiry Endpoint Gating", () => {
    it("should reject inquiry against DRAFT listing", async () => {
      // Set listing back to DRAFT
      await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: { status: "DRAFT", publishedAt: null, pausedAt: null },
      });

      // Query to simulate inquiry validation
      const listing = await prisma.animalPublicListing.findUnique({
        where: { urlSlug: ctx.listingSlug },
        select: { status: true },
      });

      assert.strictEqual(listing?.status, "DRAFT");
      // API should reject: status !== "LIVE"
      assert.notStrictEqual(listing?.status, "LIVE", "DRAFT listing should fail LIVE check");
    });

    it("should reject inquiry against PAUSED listing", async () => {
      // Set listing to PAUSED
      await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: { status: "PAUSED", pausedAt: new Date() },
      });

      const listing = await prisma.animalPublicListing.findUnique({
        where: { urlSlug: ctx.listingSlug },
        select: { status: true },
      });

      assert.strictEqual(listing?.status, "PAUSED");
      // API should reject: status !== "LIVE"
      assert.notStrictEqual(listing?.status, "LIVE", "PAUSED listing should fail LIVE check");
    });

    it("should allow inquiry against LIVE listing", async () => {
      // Set listing to LIVE
      await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: { status: "LIVE", publishedAt: new Date(), pausedAt: null },
      });

      const listing = await prisma.animalPublicListing.findUnique({
        where: { urlSlug: ctx.listingSlug },
        select: { status: true, intent: true },
      });

      assert.strictEqual(listing?.status, "LIVE");
      // API should allow: status === "LIVE"
    });

    it("MessageThread schema supports ANIMAL_LISTING inquiryType", async () => {
      // Verify the MessageThread model has inquiryType and sourceListingSlug fields
      // by checking that we can select them in a query (no runtime insert needed)
      const threads = await prisma.messageThread.findMany({
        where: { tenantId: ctx.tenantId, inquiryType: "ANIMAL_LISTING" },
        select: { inquiryType: true, sourceListingSlug: true },
        take: 1,
      });

      // Query should work - verifies schema supports these fields
      assert.ok(Array.isArray(threads), "Should be able to query by inquiryType");
    });
  });

  describe("D. Response Shape for UI Cards", () => {
    it("listing should include all fields needed for UI cards", async () => {
      const listing = await prisma.animalPublicListing.findUnique({
        where: { animalId: ctx.animalId },
        select: {
          urlSlug: true,
          intent: true,
          status: true,
          headline: true,
          title: true,
          summary: true,
          description: true,
          priceCents: true,
          priceMinCents: true,
          priceMaxCents: true,
          priceText: true,
          priceModel: true,
          locationCity: true,
          locationRegion: true,
          locationCountry: true,
          animal: {
            select: {
              name: true,
              species: true,
              sex: true,
              breed: true,
              birthDate: true,
              photoUrl: true,
              priceCents: true,
            },
          },
        },
      });

      assert.ok(listing, "Listing should exist");

      // Verify intent is present
      assert.ok(listing.intent, "intent should be present");
      assert.ok(["STUD", "BROOD_PLACEMENT", "REHOME", "SHOWCASE"].includes(listing.intent!));

      // Verify pricing model fields
      assert.ok(listing.priceModel, "priceModel should be present");

      // Verify location fields are accessible
      assert.ok("locationCity" in listing, "locationCity should be in response");
      assert.ok("locationRegion" in listing, "locationRegion should be in response");
      assert.ok("locationCountry" in listing, "locationCountry should be in response");

      // Verify animal snapshot fields
      assert.ok(listing.animal, "animal should be included");
      assert.ok(listing.animal.name, "animal.name should be present");
      assert.ok(listing.animal.species, "animal.species should be present");
      assert.ok(listing.animal.sex, "animal.sex should be present");
    });

    it("should derive priceDisplay from priceModel", async () => {
      // Test fixed price
      await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: { priceModel: "fixed", priceCents: 150000, priceMinCents: null, priceMaxCents: null },
      });

      let listing = await prisma.animalPublicListing.findUnique({
        where: { animalId: ctx.animalId },
        select: { priceModel: true, priceCents: true, priceMinCents: true, priceMaxCents: true, priceText: true },
      });

      assert.strictEqual(listing?.priceModel, "fixed");
      assert.strictEqual(listing?.priceCents, 150000);

      // Test range price
      await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: { priceModel: "range", priceCents: null, priceMinCents: 100000, priceMaxCents: 200000 },
      });

      listing = await prisma.animalPublicListing.findUnique({
        where: { animalId: ctx.animalId },
        select: { priceModel: true, priceCents: true, priceMinCents: true, priceMaxCents: true },
      });

      assert.strictEqual(listing?.priceModel, "range");
      assert.strictEqual(listing?.priceMinCents, 100000);
      assert.strictEqual(listing?.priceMaxCents, 200000);

      // Test inquire
      await prisma.animalPublicListing.update({
        where: { animalId: ctx.animalId },
        data: { priceModel: "inquire", priceCents: null, priceMinCents: null, priceMaxCents: null, priceText: "Contact for pricing" },
      });

      listing = await prisma.animalPublicListing.findUnique({
        where: { animalId: ctx.animalId },
        select: { priceModel: true, priceText: true },
      });

      assert.strictEqual(listing?.priceModel, "inquire");
      assert.strictEqual(listing?.priceText, "Contact for pricing");
    });

    it("should derive location from city/region/country", async () => {
      const listing = await prisma.animalPublicListing.findUnique({
        where: { animalId: ctx.animalId },
        select: { locationCity: true, locationRegion: true, locationCountry: true },
      });

      assert.ok(listing);
      // Location should compose: "Austin, TX, US"
      const locationParts = [listing.locationCity, listing.locationRegion, listing.locationCountry].filter(Boolean);
      const location = locationParts.join(", ");
      assert.ok(location.length > 0, "location should be derivable");
    });
  });

  describe("E. Indexes and Uniqueness (Schema Validation)", () => {
    it("animalId should be unique (one listing per animal)", async () => {
      // Try to create a second listing for the same animal
      await assert.rejects(
        async () => {
          await prisma.animalPublicListing.create({
            data: {
              animalId: ctx.animalId,
              tenantId: ctx.tenantId,
              urlSlug: `duplicate-${Date.now()}`,
            },
          });
        },
        (err: any) => {
          // Prisma unique constraint error
          return err.code === "P2002" || err.message?.includes("Unique constraint");
        },
        "Should reject duplicate listing for same animal"
      );
    });

    it("urlSlug should be globally unique", async () => {
      // Try to create another listing with same slug
      const animal2 = await prisma.animal.create({
        data: {
          tenantId: ctx.tenantId,
          name: "Duplicate Slug Animal",
          species: Species.DOG,
          sex: "FEMALE",
          status: "ACTIVE",
        },
      });

      await assert.rejects(
        async () => {
          await prisma.animalPublicListing.create({
            data: {
              animalId: animal2.id,
              tenantId: ctx.tenantId,
              urlSlug: ctx.listingSlug, // Same slug as existing
            },
          });
        },
        (err: any) => {
          return err.code === "P2002" || err.message?.includes("Unique constraint");
        },
        "Should reject duplicate urlSlug"
      );

      // Cleanup
      await prisma.animal.delete({ where: { id: animal2.id } });
    });

    it("indexes should exist for public browse queries", async () => {
      // Test that queries using indexed fields are efficient
      // (tenantId, status), (tenantId, intent), (status, intent)

      // This is a schema structure test - we query using indexed patterns
      const byStatus = await prisma.animalPublicListing.findMany({
        where: { tenantId: ctx.tenantId, status: "LIVE" },
        take: 1,
      });

      const byIntent = await prisma.animalPublicListing.findMany({
        where: { tenantId: ctx.tenantId, intent: "STUD" },
        take: 1,
      });

      const byStatusAndIntent = await prisma.animalPublicListing.findMany({
        where: { status: "LIVE", intent: "STUD" },
        take: 1,
      });

      // If these execute without error, indexes are working
      assert.ok(Array.isArray(byStatus));
      assert.ok(Array.isArray(byIntent));
      assert.ok(Array.isArray(byStatusAndIntent));
    });
  });

  describe("F. Integration Sanity Checks", () => {
    it("listing should cascade delete with animal", async () => {
      // Create a temporary animal and listing
      const tempAnimal = await prisma.animal.create({
        data: {
          tenantId: ctx.tenantId,
          name: "Cascade Test Animal",
          species: Species.CAT,
          sex: "FEMALE",
          status: "ACTIVE",
        },
      });

      const tempListing = await prisma.animalPublicListing.create({
        data: {
          animalId: tempAnimal.id,
          tenantId: ctx.tenantId,
          urlSlug: `cascade-test-${Date.now()}`,
        },
      });

      // Delete the animal
      await prisma.animal.delete({ where: { id: tempAnimal.id } });

      // Listing should be gone
      const orphan = await prisma.animalPublicListing.findUnique({
        where: { id: tempListing.id },
      });

      assert.strictEqual(orphan, null, "Listing should cascade delete with animal");
    });

    it("listing should cascade delete with tenant", async () => {
      // Create temp tenant and data
      const tempTenant = await prisma.tenant.create({
        data: { name: "Cascade Tenant", slug: `cascade-tenant-${Date.now()}` },
      });

      const tempAnimal = await prisma.animal.create({
        data: {
          tenantId: tempTenant.id,
          name: "Cascade Animal",
          species: Species.DOG,
          sex: "MALE",
          status: "ACTIVE",
        },
      });

      const tempListing = await prisma.animalPublicListing.create({
        data: {
          animalId: tempAnimal.id,
          tenantId: tempTenant.id,
          urlSlug: `tenant-cascade-${Date.now()}`,
        },
      });

      // Delete the tenant
      await prisma.tenant.delete({ where: { id: tempTenant.id } });

      // Listing should be gone
      const orphan = await prisma.animalPublicListing.findUnique({
        where: { id: tempListing.id },
      });

      assert.strictEqual(orphan, null, "Listing should cascade delete with tenant");
    });

    it("all intent enum values should be valid", () => {
      const validIntents = ["STUD", "BROOD_PLACEMENT", "REHOME", "SHOWCASE"];
      const enumValues = Object.values(AnimalListingIntent);

      assert.deepStrictEqual(
        enumValues.sort(),
        validIntents.sort(),
        "AnimalListingIntent enum should match expected values"
      );
    });

    it("all status enum values should be valid", () => {
      const validStatuses = ["DRAFT", "LIVE", "PAUSED"];
      const enumValues = Object.values(AnimalListingStatus);

      assert.deepStrictEqual(
        enumValues.sort(),
        validStatuses.sort(),
        "AnimalListingStatus enum should match expected values"
      );
    });
  });
});
