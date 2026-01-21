#!/usr/bin/env node
// scripts/verify-scheduling-endpoints.mjs
// Development script to verify scheduling endpoints work correctly
// Bypasses auth by directly calling Prisma to simulate portal client behavior
//
// Usage: npx dotenv -e .env.dev -- node scripts/verify-scheduling-endpoints.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = parseInt(process.env.SEED_TENANT_ID || "1", 10);

async function main() {
  console.log("=== Scheduling Endpoint Verification ===\n");

  // 1. Find a party with portal access
  const portalAccess = await prisma.portalAccess.findFirst({
    where: { tenantId: TENANT_ID, status: "ACTIVE" },
    select: { partyId: true, party: { select: { id: true, name: true } } },
  });

  let partyId;
  if (portalAccess) {
    partyId = portalAccess.partyId;
    console.log(`Using party: ${portalAccess.party.name} (ID: ${partyId})`);
  } else {
    // Use first party
    const party = await prisma.party.findFirst({
      where: { tenantId: TENANT_ID },
      select: { id: true, name: true },
    });
    if (!party) {
      console.error("No party found for testing");
      process.exit(1);
    }
    partyId = party.id;
    console.log(`Using party: ${party.name} (ID: ${partyId})`);
  }

  // 2. Get template
  const template = await prisma.schedulingEventTemplate.findFirst({
    where: { tenantId: TENANT_ID },
    include: {
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!template) {
    console.error("No scheduling template found. Run seed-scheduling-dev.mjs first.");
    process.exit(1);
  }

  const eventId = `template:${template.id}`;
  console.log(`\nEvent ID: ${eventId}`);

  // 3. Simulate GET /events/:eventId
  console.log("\n--- GET /events/:eventId ---");
  const existingBooking = await prisma.schedulingBooking.findFirst({
    where: { tenantId: TENANT_ID, partyId, eventId, status: "CONFIRMED" },
    include: { slot: true },
  });

  console.log(`  Event type: ${template.eventType}`);
  console.log(`  Breeder: ${template.tenant.name}`);
  console.log(`  Status: ${template.status}`);
  console.log(`  Can cancel: ${template.canCancel}`);
  console.log(`  Can reschedule: ${template.canReschedule}`);
  console.log(`  Has booking: ${!!existingBooking}`);

  // 4. Simulate GET /events/:eventId/slots
  console.log("\n--- GET /events/:eventId/slots ---");
  const blocks = await prisma.schedulingAvailabilityBlock.findMany({
    where: { tenantId: TENANT_ID, templateId: template.id, status: "OPEN" },
    select: { id: true },
  });

  const slots = await prisma.schedulingSlot.findMany({
    where: {
      tenantId: TENANT_ID,
      blockId: { in: blocks.map((b) => b.id) },
      status: "AVAILABLE",
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: 5,
  });

  console.log(`  Available slots: ${slots.length > 5 ? "5+ (showing first 5)" : slots.length}`);
  for (const slot of slots) {
    console.log(`    - Slot ${slot.id}: ${slot.startsAt.toISOString()} (${slot.mode || "unspecified"})`);
  }

  // 5. Simulate POST /events/:eventId/book (but don't actually book)
  if (slots.length > 0 && !existingBooking) {
    console.log("\n--- POST /events/:eventId/book (simulation) ---");
    const testSlot = slots[0];
    console.log(`  Would book slot ${testSlot.id} for party ${partyId}`);
    console.log(`  Slot time: ${testSlot.startsAt.toISOString()}`);
    console.log(`  Current capacity: ${testSlot.bookedCount}/${testSlot.capacity}`);

    // Actually book it for full test
    console.log("\n  Executing booking...");
    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Lock slot
        const lockedSlots = await tx.$queryRaw`
          SELECT id, capacity, "bookedCount", status
          FROM "SchedulingSlot"
          WHERE id = ${testSlot.id}
          FOR UPDATE
        `;

        const slot = lockedSlots[0];
        if (slot.bookedCount >= slot.capacity) {
          throw new Error("SLOT_FULL");
        }

        // Create booking
        const newBooking = await tx.schedulingBooking.create({
          data: {
            tenantId: TENANT_ID,
            slotId: testSlot.id,
            partyId,
            eventId,
            status: "CONFIRMED",
            bookedAt: new Date(),
            nextSteps: template.nextStepsText,
          },
          include: { slot: true },
        });

        // Update slot count
        await tx.schedulingSlot.update({
          where: { id: testSlot.id },
          data: {
            bookedCount: slot.bookedCount + 1,
            status: slot.bookedCount + 1 >= slot.capacity ? "FULL" : "AVAILABLE",
          },
        });

        return newBooking;
      });

      console.log(`  SUCCESS: Booking ID ${booking.id} created`);
      console.log(`  Slot: ${booking.slot.startsAt.toISOString()}`);

      // 6. Simulate POST /events/:eventId/cancel
      console.log("\n--- POST /events/:eventId/cancel ---");
      await prisma.$transaction(async (tx) => {
        await tx.schedulingBooking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });

        const slot = await tx.schedulingSlot.findUnique({
          where: { id: booking.slotId },
        });
        await tx.schedulingSlot.update({
          where: { id: booking.slotId },
          data: {
            bookedCount: Math.max(0, slot.bookedCount - 1),
            status: "AVAILABLE",
          },
        });
      });

      console.log(`  SUCCESS: Booking ${booking.id} cancelled`);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }

  console.log("\n=== Verification Complete ===");
  console.log("\nCurl commands for manual testing (requires valid portal session):");
  console.log(`  GET  http://localhost:6001/api/v1/portal/scheduling/events/${eventId}`);
  console.log(`  GET  http://localhost:6001/api/v1/portal/scheduling/events/${eventId}/slots`);
  console.log(`  POST http://localhost:6001/api/v1/portal/scheduling/events/${eventId}/book -d '{"slotId":"${slots[0]?.id || "1"}"}'`);
  console.log(`  POST http://localhost:6001/api/v1/portal/scheduling/events/${eventId}/cancel`);
  console.log(`  POST http://localhost:6001/api/v1/portal/scheduling/events/${eventId}/reschedule -d '{"slotId":"${slots[1]?.id || "2"}"}'`);
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
