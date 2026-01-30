/**
 * Stud Service Integration Tests (P3.5)
 *
 * Tests for stud service listing creation with P1 Horse MVP fields:
 * - Season fields (name, dates, bookings)
 * - Breeding methods array
 * - Guarantee default
 * - horseServiceData JSON
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

const prisma = new PrismaClient();

interface TestContext {
  tenantId: number;
  stallionId: number;
  listingId: number;
}

const ctx: TestContext = {} as TestContext;

describe("Stud Service Integration Tests", () => {
  before(async () => {
    // Cleanup stale tenants from previous runs
    await cleanupStaleTenants(TENANT_PREFIXES.studService, 24, prisma);

    // Create test tenant
    const tenant = await createTestTenant(
      "Stud Service Test Tenant",
      TENANT_PREFIXES.studService
    );
    ctx.tenantId = tenant.id;

    // Create a stallion for testing
    const stallion = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Stallion",
        species: "HORSE",
        sex: "MALE",
        status: "BREEDING",
      },
    });
    ctx.stallionId = stallion.id;
  });

  after(async () => {
    if (ctx.tenantId) {
      await teardownTestTenant(ctx.tenantId, prisma);
    }
    await prisma.$disconnect();
  });

  describe("Create Stud Service Listing", () => {
    it("should create stud service listing with all P1 fields", async () => {
      const seasonStart = new Date("2026-02-01");
      const seasonEnd = new Date("2026-06-30");

      // Create the marketplace listing
      const listing = await prisma.mktListingBreederService.create({
        data: {
          tenantId: ctx.tenantId,
          listingType: "STUD_SERVICE",
          title: "Premium Stallion Service 2026",
          status: "LIVE",
          // Core fields
          description: "Premium stallion service for 2026 season",
          priceCents: 250000, // $2,500
          // Stallion link
          stallionId: ctx.stallionId,
          // Season fields (P1.1)
          seasonName: "2026 Breeding Season",
          seasonStart,
          seasonEnd,
          maxBookings: 25,
          bookingsReceived: 0,
          bookingsClosed: false,
          // Breeding methods (P1.2)
          breedingMethods: ["LIVE_COVER", "ARTIFICIAL_INSEMINATION"],
          // Guarantee (P1.3)
          defaultGuarantee: "LIVE_FOAL",
          // Horse-specific data (P1.4)
          horseServiceData: {
            mareRequirements: {
              minAge: 3,
              maxAge: 18,
              healthRequirements: ["Negative Coggins", "Current vaccinations"],
              registryRequirements: ["AQHA", "APHA"],
            },
            transportOptions: ["Shipped semen", "Mare boarding"],
            veterinarianInfo: "Dr. Smith on-site",
          },
        },
      });

      ctx.listingId = listing.id;

      // Verify all fields saved correctly
      assert.ok(listing.id, "Listing should be created with ID");
      assert.strictEqual(listing.listingType, "STUD_SERVICE");
      assert.strictEqual(listing.seasonName, "2026 Breeding Season");
      assert.strictEqual(
        listing.seasonStart?.toISOString(),
        seasonStart.toISOString()
      );
      assert.strictEqual(
        listing.seasonEnd?.toISOString(),
        seasonEnd.toISOString()
      );
      assert.strictEqual(listing.maxBookings, 25);
      assert.strictEqual(listing.bookingsReceived, 0);
      assert.strictEqual(listing.bookingsClosed, false);
      assert.deepStrictEqual(listing.breedingMethods, [
        "LIVE_COVER",
        "ARTIFICIAL_INSEMINATION",
      ]);
      assert.strictEqual(listing.defaultGuarantee, "LIVE_FOAL");
      assert.ok(listing.horseServiceData, "horseServiceData should be set");
    });

    it("should verify season fields persist on reload", async () => {
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });

      assert.ok(listing, "Listing should exist");
      assert.strictEqual(listing.seasonName, "2026 Breeding Season");
      assert.strictEqual(listing.maxBookings, 25);
      assert.strictEqual(listing.bookingsReceived, 0);
    });

    it("should verify breeding methods array saved correctly", async () => {
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });

      assert.ok(listing, "Listing should exist");
      assert.ok(Array.isArray(listing.breedingMethods), "breedingMethods should be array");
      assert.strictEqual(listing.breedingMethods?.length, 2);
      assert.ok(listing.breedingMethods?.includes("LIVE_COVER"));
      assert.ok(listing.breedingMethods?.includes("ARTIFICIAL_INSEMINATION"));
    });

    it("should verify guarantee default set correctly", async () => {
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });

      assert.ok(listing, "Listing should exist");
      assert.strictEqual(listing.defaultGuarantee, "LIVE_FOAL");
    });

    it("should verify horseServiceData JSON stored correctly", async () => {
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });

      assert.ok(listing, "Listing should exist");
      assert.ok(listing.horseServiceData, "horseServiceData should exist");

      const data = listing.horseServiceData as Record<string, unknown>;
      assert.ok(data.mareRequirements, "mareRequirements should exist");
      assert.ok(data.transportOptions, "transportOptions should exist");
      assert.strictEqual(data.veterinarianInfo, "Dr. Smith on-site");
    });
  });
});
