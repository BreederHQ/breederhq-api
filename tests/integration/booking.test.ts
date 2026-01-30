/**
 * Booking Integration Tests (P3.5)
 *
 * Tests for stud service booking functionality:
 * - bookingsReceived increments on booking
 * - Booking blocked when slots full
 * - Booking blocked when bookingsClosed=true
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
  mareId: number;
  clientPartyId: number;
}

const ctx: TestContext = {} as TestContext;

/**
 * Simulates booking a stud service
 * In production this would be an API endpoint, but for integration tests
 * we directly manipulate the database
 */
async function bookStudService(
  listingId: number,
  clientPartyId: number,
  mareId: number
): Promise<{ success: boolean; error?: string; booking?: Record<string, unknown> }> {
  // Get current listing state
  const listing = await prisma.mktListingBreederService.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    return { success: false, error: "Listing not found" };
  }

  // Check if bookings are closed
  if (listing.bookingsClosed) {
    return { success: false, error: "Bookings are closed for this season" };
  }

  // Check if slots available
  const currentBookings = listing.bookingsReceived ?? 0;
  const maxBookings = listing.maxBookings ?? 0;

  if (maxBookings > 0 && currentBookings >= maxBookings) {
    return { success: false, error: "No slots available" };
  }

  // Increment bookingsReceived
  const updated = await prisma.mktListingBreederService.update({
    where: { id: listingId },
    data: { bookingsReceived: currentBookings + 1 },
  });

  return {
    success: true,
    booking: {
      listingId,
      clientPartyId,
      mareId,
      bookingNumber: updated.bookingsReceived,
    },
  };
}

describe("Booking Integration Tests", () => {
  before(async () => {
    // Cleanup stale tenants from previous runs
    await cleanupStaleTenants(TENANT_PREFIXES.booking, 24, prisma);

    // Create test tenant
    const tenant = await createTestTenant(
      "Booking Test Tenant",
      TENANT_PREFIXES.booking
    );
    ctx.tenantId = tenant.id;

    // Create a stallion
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

    // Create a mare for booking
    const mare = await prisma.animal.create({
      data: {
        tenantId: ctx.tenantId,
        name: "Test Mare",
        species: "HORSE",
        sex: "FEMALE",
        status: "BREEDING",
      },
    });
    ctx.mareId = mare.id;

    // Create a party for the client
    const party = await prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        type: "CONTACT",
        name: "Test Client",
              },
    });
    ctx.clientPartyId = party.id;

    // Create the stud service listing with limited slots
    const listing = await prisma.mktListingBreederService.create({
      data: {
        tenantId: ctx.tenantId,
        listingType: "STUD_SERVICE",
        title: "Test Stud Service",
        status: "LIVE",
        stallionId: ctx.stallionId,
        seasonName: "2026 Test Season",
        maxBookings: 3, // Limited to 3 bookings for testing
        bookingsReceived: 0,
        bookingsClosed: false,
        defaultGuarantee: "LIVE_FOAL",
      },
    });
    ctx.listingId = listing.id;
  });

  after(async () => {
    if (ctx.tenantId) {
      await teardownTestTenant(ctx.tenantId, prisma);
    }
    await prisma.$disconnect();
  });

  describe("Booking Count Increments", () => {
    it("should increment bookingsReceived on first booking", async () => {
      // Get initial state
      const before = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });
      assert.strictEqual(before?.bookingsReceived, 0);

      // Make first booking
      const result = await bookStudService(ctx.listingId, ctx.clientPartyId, ctx.mareId);
      assert.strictEqual(result.success, true);

      // Verify increment
      const after = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });
      assert.strictEqual(after?.bookingsReceived, 1);
    });

    it("should continue incrementing on subsequent bookings", async () => {
      // Second booking
      const result2 = await bookStudService(ctx.listingId, ctx.clientPartyId, ctx.mareId);
      assert.strictEqual(result2.success, true);

      const after2 = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });
      assert.strictEqual(after2?.bookingsReceived, 2);

      // Third booking
      const result3 = await bookStudService(ctx.listingId, ctx.clientPartyId, ctx.mareId);
      assert.strictEqual(result3.success, true);

      const after3 = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });
      assert.strictEqual(after3?.bookingsReceived, 3);
    });
  });

  describe("Booking Blocked When Slots Full", () => {
    it("should block booking when maxBookings reached", async () => {
      // Verify we're at max capacity
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });
      assert.strictEqual(listing?.bookingsReceived, 3);
      assert.strictEqual(listing?.maxBookings, 3);

      // Attempt fourth booking
      const result = await bookStudService(ctx.listingId, ctx.clientPartyId, ctx.mareId);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "No slots available");
    });

    it("should not increment bookingsReceived when blocked", async () => {
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });

      // Should still be at 3, not 4
      assert.strictEqual(listing?.bookingsReceived, 3);
    });
  });

  describe("Booking Blocked When Closed", () => {
    it("should block booking when bookingsClosed=true", async () => {
      // Create a new listing that's closed
      const closedListing = await prisma.mktListingBreederService.create({
        data: {
          tenantId: ctx.tenantId,
          listingType: "STUD_SERVICE",
          title: "Closed Season Listing",
          status: "LIVE",
          stallionId: ctx.stallionId,
          seasonName: "Closed Season",
          maxBookings: 10,
          bookingsReceived: 0,
          bookingsClosed: true, // Closed for bookings
          defaultGuarantee: "LIVE_FOAL",
        },
      });

      // Attempt booking
      const result = await bookStudService(closedListing.id, ctx.clientPartyId, ctx.mareId);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Bookings are closed for this season");

      // Cleanup
      await prisma.mktListingBreederService.delete({
        where: { id: closedListing.id },
      });
    });
  });

  describe("Available Slots Calculation", () => {
    it("should calculate available slots correctly", async () => {
      const listing = await prisma.mktListingBreederService.findUnique({
        where: { id: ctx.listingId },
      });

      const availableSlots = (listing?.maxBookings ?? 0) - (listing?.bookingsReceived ?? 0);
      assert.strictEqual(availableSlots, 0, "No slots should be available");
    });
  });
});
