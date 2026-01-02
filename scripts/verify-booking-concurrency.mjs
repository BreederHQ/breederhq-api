#!/usr/bin/env node
// scripts/verify-booking-concurrency.mjs
// Verifies that concurrent booking attempts for the same (eventId, partyId)
// result in only one CONFIRMED booking due to database-level protection.
//
// Usage: npx dotenv -e .env.dev -- node scripts/verify-booking-concurrency.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_ID = parseInt(process.env.SEED_TENANT_ID || "1", 10);

async function main() {
  console.log("=== Booking Concurrency Verification ===\n");

  // 1. Find or create test data
  const template = await prisma.schedulingEventTemplate.findFirst({
    where: { tenantId: TENANT_ID },
  });

  if (!template) {
    console.error("No scheduling template found. Run seed-scheduling-dev.mjs first.");
    process.exit(1);
  }

  // Find an available slot
  const block = await prisma.schedulingAvailabilityBlock.findFirst({
    where: { tenantId: TENANT_ID, templateId: template.id, status: "OPEN" },
  });

  if (!block) {
    console.error("No availability block found.");
    process.exit(1);
  }

  // Find an available slot that isn't already booked
  const availableSlot = await prisma.schedulingSlot.findFirst({
    where: {
      tenantId: TENANT_ID,
      blockId: block.id,
      status: "AVAILABLE",
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: "asc" },
  });

  if (!availableSlot) {
    console.error("No available slot found for testing.");
    process.exit(1);
  }

  // Find a test party
  const party = await prisma.party.findFirst({
    where: { tenantId: TENANT_ID },
  });

  if (!party) {
    console.error("No party found for testing.");
    process.exit(1);
  }

  const eventId = `template:${template.id}`;
  console.log(`Test setup:`);
  console.log(`  Template ID: ${template.id}`);
  console.log(`  Block ID: ${block.id}`);
  console.log(`  Slot ID: ${availableSlot.id}`);
  console.log(`  Party ID: ${party.id} (${party.name})`);
  console.log(`  Event ID: ${eventId}`);

  // Clean up any existing test bookings for this party+event
  const cleanedUp = await prisma.schedulingBooking.deleteMany({
    where: {
      tenantId: TENANT_ID,
      partyId: party.id,
      eventId,
    },
  });
  console.log(`\nCleaned up ${cleanedUp.count} existing test bookings.`);

  // 2. Test concurrent booking attempts
  console.log("\n--- Concurrent Booking Test ---");
  console.log("Attempting 5 concurrent booking requests for the same party and event...\n");

  const bookingAttempt = async (attemptNum) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the slot
        const lockedSlots = await tx.$queryRaw`
          SELECT id, capacity, "bookedCount", status
          FROM "SchedulingSlot"
          WHERE id = ${availableSlot.id}
          FOR UPDATE
        `;

        const slot = lockedSlots[0];
        if (!slot) throw { code: "SLOT_NOT_FOUND" };
        if (slot.status !== "AVAILABLE") throw { code: "SLOT_NOT_AVAILABLE" };
        if (slot.bookedCount >= slot.capacity) throw { code: "SLOT_FULL" };

        // Check for existing CONFIRMED booking for this event+party
        const existing = await tx.schedulingBooking.findFirst({
          where: {
            tenantId: TENANT_ID,
            partyId: party.id,
            eventId,
            status: "CONFIRMED",
          },
        });

        if (existing) {
          throw { code: "ALREADY_BOOKED", bookingId: existing.id };
        }

        // Create booking
        const booking = await tx.schedulingBooking.create({
          data: {
            tenantId: TENANT_ID,
            slotId: availableSlot.id,
            partyId: party.id,
            eventId,
            status: "CONFIRMED",
            bookedAt: new Date(),
          },
        });

        // Update slot
        await tx.schedulingSlot.update({
          where: { id: availableSlot.id },
          data: {
            bookedCount: slot.bookedCount + 1,
            status: slot.bookedCount + 1 >= slot.capacity ? "FULL" : "AVAILABLE",
          },
        });

        return { success: true, bookingId: booking.id };
      });

      return { attempt: attemptNum, ...result };
    } catch (err) {
      return {
        attempt: attemptNum,
        success: false,
        error: err.code || err.message || "Unknown error",
        existingBookingId: err.bookingId,
      };
    }
  };

  // Run concurrent attempts
  const results = await Promise.all([
    bookingAttempt(1),
    bookingAttempt(2),
    bookingAttempt(3),
    bookingAttempt(4),
    bookingAttempt(5),
  ]);

  // Analyze results
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  console.log("Results:");
  for (const r of results) {
    if (r.success) {
      console.log(`  Attempt ${r.attempt}: SUCCESS - Booking ID ${r.bookingId}`);
    } else {
      console.log(`  Attempt ${r.attempt}: BLOCKED - ${r.error}${r.existingBookingId ? ` (existing: ${r.existingBookingId})` : ""}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Successful bookings: ${successes.length}`);
  console.log(`  Blocked attempts: ${failures.length}`);

  // Verify final state
  const confirmedBookings = await prisma.schedulingBooking.count({
    where: {
      tenantId: TENANT_ID,
      partyId: party.id,
      eventId,
      status: "CONFIRMED",
    },
  });

  console.log(`  Final CONFIRMED bookings for party+event: ${confirmedBookings}`);

  if (successes.length === 1 && confirmedBookings === 1) {
    console.log("\n✅ PASS: Concurrency protection working correctly!");
    console.log("   Only one booking was created despite concurrent attempts.");
  } else if (successes.length > 1) {
    console.log("\n❌ FAIL: Multiple bookings were created!");
    console.log("   Concurrency protection is NOT working.");
    process.exit(1);
  } else if (successes.length === 0) {
    console.log("\n⚠️  WARNING: No bookings created.");
    console.log("   This might indicate an issue with the test setup.");
  }

  // Cleanup
  console.log("\nCleaning up test booking...");
  await prisma.schedulingBooking.deleteMany({
    where: {
      tenantId: TENANT_ID,
      partyId: party.id,
      eventId,
    },
  });
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
