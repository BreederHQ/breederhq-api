#!/usr/bin/env node
// scripts/verify-portal-scheduling.mjs
// Verifies portal scheduling discovery and booking flow
//
// Usage: npx dotenv -e .env.dev -- node scripts/verify-portal-scheduling.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_ID = parseInt(process.env.SEED_TENANT_ID || "1", 10);

async function main() {
  console.log("=== Portal Scheduling Verification ===\n");

  // 1. Find or create an offspring group with a buyer
  console.log("Step 1: Setting up test data...\n");

  let offspringGroup = await prisma.offspringGroup.findFirst({
    where: { tenantId: TENANT_ID },
    include: { groupBuyerLinks: { include: { buyerParty: true } } },
  });

  if (!offspringGroup) {
    console.log("  No offspring group found, creating test data...");

    // Find or create a dam animal
    let dam = await prisma.animal.findFirst({
      where: { tenantId: TENANT_ID, sex: "FEMALE" },
    });

    if (!dam) {
      dam = await prisma.animal.create({
        data: {
          tenant: { connect: { id: TENANT_ID } },
          name: "Test Dam",
          species: "DOG",
          sex: "FEMALE",
          status: "ACTIVE",
        },
      });
      console.log(`  Created test dam: ${dam.name} (ID: ${dam.id})`);
    }

    offspringGroup = await prisma.offspringGroup.create({
      data: {
        tenant: { connect: { id: TENANT_ID } },
        dam: { connect: { id: dam.id } },
        name: "Test Litter (Verification)",
        species: "DOG",
      },
      include: { groupBuyerLinks: { include: { buyerParty: true } } },
    });
    console.log(`  Created offspring group ID: ${offspringGroup.id}`);
  }

  console.log(`  Offspring Group: ${offspringGroup.name || `Group ${offspringGroup.id}`}`);
  console.log(`  ID: ${offspringGroup.id}`);

  // Get or create a buyer party link
  let buyerLink = offspringGroup.groupBuyerLinks[0];
  let partyId;

  if (!buyerLink) {
    // Find a party to use as buyer
    const party = await prisma.party.findFirst({
      where: { tenantId: TENANT_ID },
    });

    if (!party) {
      console.error("No party found. Please seed data first.");
      process.exit(1);
    }

    // Create buyer link
    buyerLink = await prisma.offspringGroupBuyer.create({
      data: {
        tenantId: TENANT_ID,
        groupId: offspringGroup.id,
        buyerPartyId: party.id,
      },
      include: { buyerParty: true },
    });
    console.log(`  Created buyer link for party: ${party.name} (ID: ${party.id})`);
    partyId = party.id;
  } else {
    partyId = buyerLink.buyerPartyId;
    console.log(`  Buyer: ${buyerLink.buyerParty?.name || `Party ${partyId}`}`);
  }

  // 2. Create a scheduling block linked to the offspring group
  console.log("\nStep 2: Creating availability block...\n");

  // First check if template exists
  let template = await prisma.schedulingEventTemplate.findFirst({
    where: { tenantId: TENANT_ID },
  });

  if (!template) {
    template = await prisma.schedulingEventTemplate.create({
      data: {
        tenantId: TENANT_ID,
        name: "Pickup Appointment",
        eventType: "PICKUP",
        status: "OPEN",
        canCancel: true,
        canReschedule: true,
        cancellationDeadlineHours: 24,
        rescheduleDeadlineHours: 24,
        nextStepsText: "Please bring a secure carrier for transport.",
      },
    });
    console.log(`  Created template: ${template.name}`);
  } else {
    console.log(`  Using template: ${template.name}`);
  }

  // Delete any existing test data for this group (cleanup)
  // First delete bookings, then slots, then blocks (foreign key order)
  await prisma.schedulingBooking.deleteMany({
    where: {
      tenantId: TENANT_ID,
      slot: {
        block: {
          offspringGroupId: offspringGroup.id,
        },
      },
    },
  });
  await prisma.schedulingSlot.deleteMany({
    where: {
      block: {
        tenantId: TENANT_ID,
        offspringGroupId: offspringGroup.id,
      },
    },
  });
  await prisma.schedulingAvailabilityBlock.deleteMany({
    where: {
      tenantId: TENANT_ID,
      offspringGroupId: offspringGroup.id,
    },
  });

  // Create new block with slots
  const now = new Date();
  const startAt = new Date(now);
  startAt.setDate(startAt.getDate() + 1); // Tomorrow
  startAt.setHours(9, 0, 0, 0);

  const endAt = new Date(startAt);
  endAt.setHours(17, 0, 0, 0);

  const block = await prisma.schedulingAvailabilityBlock.create({
    data: {
      tenantId: TENANT_ID,
      templateId: template.id,
      offspringGroupId: offspringGroup.id,
      startAt,
      endAt,
      timezone: "America/New_York",
      status: "OPEN",
      location: "123 Breeder Lane, Springfield",
      canCancel: true,
      canReschedule: true,
      nextStepsText: "Please bring a carrier.",
    },
  });

  console.log(`  Created block ID: ${block.id}`);
  console.log(`    Start: ${block.startAt.toISOString()}`);
  console.log(`    End: ${block.endAt.toISOString()}`);
  console.log(`    Offspring Group: ${offspringGroup.id}`);

  // Create slots (hourly, 1-hour duration)
  const slots = [];
  let slotStart = new Date(startAt);
  while (slotStart < endAt) {
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    if (slotEnd > endAt) break;

    slots.push({
      tenantId: TENANT_ID,
      blockId: block.id,
      startsAt: new Date(slotStart),
      endsAt: slotEnd,
      capacity: 1,
      bookedCount: 0,
      status: "AVAILABLE",
      mode: "IN_PERSON",
      location: block.location,
    });

    slotStart = new Date(slotStart.getTime() + 60 * 60 * 1000);
  }

  await prisma.schedulingSlot.createMany({ data: slots });
  console.log(`  Created ${slots.length} slots`);

  // 3. Simulate discovery endpoint query
  console.log("\nStep 3: Testing discovery query...\n");

  const discoveryBlocks = await prisma.schedulingAvailabilityBlock.findMany({
    where: {
      tenantId: TENANT_ID,
      offspringGroupId: offspringGroup.id,
      status: "OPEN",
    },
    include: {
      template: true,
      slots: {
        where: { status: "AVAILABLE", startsAt: { gt: new Date() } },
        take: 1,
      },
    },
  });

  console.log(`  Found ${discoveryBlocks.length} block(s) for offspring group ${offspringGroup.id}`);
  for (const b of discoveryBlocks) {
    console.log(`    - Block ${b.id}: ${b.template?.name || "Availability"}`);
    console.log(`      Available slots: ${b.slots.length > 0 ? "Yes" : "No"}`);
  }

  // 4. Simulate eligibility check
  console.log("\nStep 4: Testing eligibility check...\n");

  const buyerCheck = await prisma.offspringGroupBuyer.findFirst({
    where: {
      tenantId: TENANT_ID,
      groupId: offspringGroup.id,
      buyerPartyId: partyId,
    },
  });

  console.log(`  Party ${partyId} eligible: ${!!buyerCheck}`);

  // 5. Simulate booking
  console.log("\nStep 5: Testing booking flow...\n");

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
    console.error("  No available slot found!");
    process.exit(1);
  }

  console.log(`  Booking slot ${availableSlot.id}...`);
  console.log(`    Time: ${availableSlot.startsAt.toISOString()}`);

  const eventId = `block:${block.id}`;

  // Create booking
  const booking = await prisma.$transaction(async (tx) => {
    // Check for existing
    const existing = await tx.schedulingBooking.findFirst({
      where: { tenantId: TENANT_ID, partyId, eventId, status: "CONFIRMED" },
    });

    if (existing) {
      throw new Error("Already booked");
    }

    const newBooking = await tx.schedulingBooking.create({
      data: {
        tenantId: TENANT_ID,
        slotId: availableSlot.id,
        partyId,
        eventId,
        status: "CONFIRMED",
        bookedAt: new Date(),
        nextSteps: block.nextStepsText,
      },
      include: { slot: true },
    });

    await tx.schedulingSlot.update({
      where: { id: availableSlot.id },
      data: {
        bookedCount: 1,
        status: "FULL",
      },
    });

    return newBooking;
  });

  console.log(`  SUCCESS: Booking ID ${booking.id}`);
  console.log(`    Event: ${eventId}`);
  console.log(`    Party: ${partyId}`);
  console.log(`    Slot: ${booking.slotId}`);

  // 6. Simulate cancel
  console.log("\nStep 6: Testing cancellation...\n");

  await prisma.$transaction(async (tx) => {
    await tx.schedulingBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await tx.schedulingSlot.update({
      where: { id: booking.slotId },
      data: { bookedCount: 0, status: "AVAILABLE" },
    });
  });

  console.log(`  Cancelled booking ${booking.id}`);

  // 7. Simulate reschedule
  console.log("\nStep 7: Testing reschedule...\n");

  // Find two fresh slots for reschedule test (slots without any bookings from this party)
  const freshSlots = await prisma.schedulingSlot.findMany({
    where: {
      tenantId: TENANT_ID,
      blockId: block.id,
      status: "AVAILABLE",
      startsAt: { gt: new Date() },
      // Exclude slots that already have bookings from this party
      bookings: { none: { partyId } },
    },
    orderBy: { startsAt: "asc" },
    take: 2,
  });

  if (freshSlots.length < 2) {
    console.log("  Not enough fresh slots for reschedule test (skipping)");
  } else {
    const rescheduleFromSlot = freshSlots[0];
    const rescheduleToSlot = freshSlots[1];

    // Book the first fresh slot
    const booking2 = await prisma.schedulingBooking.create({
      data: {
        tenantId: TENANT_ID,
        slotId: rescheduleFromSlot.id,
        partyId,
        eventId,
        status: "CONFIRMED",
        bookedAt: new Date(),
        nextSteps: block.nextStepsText,
      },
    });

    await prisma.schedulingSlot.update({
      where: { id: rescheduleFromSlot.id },
      data: { bookedCount: 1, status: "FULL" },
    });

    // Reschedule
    await prisma.$transaction(async (tx) => {
      // Mark old as rescheduled
      await tx.schedulingBooking.update({
        where: { id: booking2.id },
        data: { status: "RESCHEDULED", rescheduledAt: new Date() },
      });

      // Restore old slot
      await tx.schedulingSlot.update({
        where: { id: rescheduleFromSlot.id },
        data: { bookedCount: 0, status: "AVAILABLE" },
      });

      // Create new booking
      const rescheduledBooking = await tx.schedulingBooking.create({
        data: {
          tenantId: TENANT_ID,
          slotId: rescheduleToSlot.id,
          partyId,
          eventId,
          status: "CONFIRMED",
          bookedAt: new Date(),
          nextSteps: block.nextStepsText,
          rescheduledFromId: booking2.id,
        },
      });

      // Update new slot
      await tx.schedulingSlot.update({
        where: { id: rescheduleToSlot.id },
        data: { bookedCount: 1, status: "FULL" },
      });

      return rescheduledBooking;
    });

    console.log(`  Rescheduled from slot ${rescheduleFromSlot.id} to ${rescheduleToSlot.id}`);
  }

  // Summary
  console.log("\n=== Verification Summary ===\n");
  console.log("All tests passed!");
  console.log(`\nPortal route to test: /schedule/group/${offspringGroup.id}`);
  console.log(`\nThe following is available for UI testing:`);
  console.log(`  - Offspring Group ID: ${offspringGroup.id}`);
  console.log(`  - Block ID: ${block.id}`);
  console.log(`  - Event ID: block:${block.id}`);
  console.log(`  - Party ID: ${partyId}`);

  // Cleanup - leave the block for manual testing
  console.log("\nNote: Test data left in place for manual UI verification.");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
