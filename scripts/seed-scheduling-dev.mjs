#!/usr/bin/env node
// scripts/seed-scheduling-dev.mjs
// Development-only script to seed scheduling data for local verification
// Usage: npx dotenv -e .env.dev -- node scripts/seed-scheduling-dev.mjs
//
// Creates:
// - One SchedulingEventTemplate (Pickup Appointment)
// - One SchedulingAvailabilityBlock (next 7 days)
// - Multiple SchedulingSlots (3 per day for 7 days)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Default tenant and party IDs from dev data
const TENANT_ID = parseInt(process.env.SEED_TENANT_ID || "1", 10);

async function main() {
  console.log("Seeding scheduling data for development...\n");

  // Check tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    console.error(`Tenant ID ${TENANT_ID} not found. Set SEED_TENANT_ID env var.`);
    process.exit(1);
  }

  console.log(`Using tenant: ${tenant.name} (ID: ${tenant.id}, slug: ${tenant.slug})`);

  // Check if scheduling data already exists
  const existingTemplate = await prisma.schedulingEventTemplate.findFirst({
    where: { tenantId: TENANT_ID },
  });

  if (existingTemplate) {
    console.log("\nScheduling data already exists. Skipping seed.");
    console.log(`  Template ID: ${existingTemplate.id}`);
    console.log(`  Event ID: template:${existingTemplate.id}`);
    return;
  }

  // Create template
  const template = await prisma.schedulingEventTemplate.create({
    data: {
      tenantId: TENANT_ID,
      name: "Pickup Appointment",
      eventType: "pickup",
      description: "Schedule your puppy pickup appointment",
      status: "OPEN",
      defaultDurationMinutes: 60,
      defaultCapacity: 1,
      canCancel: true,
      canReschedule: true,
      cancellationDeadlineHours: 24,
      rescheduleDeadlineHours: 24,
      nextStepsText:
        "Please arrive 10 minutes early. Bring a secure carrier for safe transport. If you have any questions, contact us through the Messages page.",
    },
  });

  console.log(`\nCreated template: ${template.name} (ID: ${template.id})`);

  // Create availability block for next 7 days
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  startOfDay.setDate(startOfDay.getDate() + 1); // Start tomorrow

  const endOfPeriod = new Date(startOfDay);
  endOfPeriod.setDate(endOfPeriod.getDate() + 7);

  const block = await prisma.schedulingAvailabilityBlock.create({
    data: {
      tenantId: TENANT_ID,
      templateId: template.id,
      startAt: startOfDay,
      endAt: endOfPeriod,
      timezone: "America/New_York",
      status: "OPEN",
      location: "123 Breeder Lane, Springfield, IL",
    },
  });

  console.log(`Created availability block (ID: ${block.id})`);

  // Create slots: 3 per day for 7 days
  const slots = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(startOfDay);
    date.setDate(date.getDate() + dayOffset);

    // Morning slot: 10:00 AM
    const morning = new Date(date);
    morning.setHours(10, 0, 0, 0);
    slots.push({
      tenantId: TENANT_ID,
      blockId: block.id,
      startsAt: morning,
      endsAt: new Date(morning.getTime() + 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 0,
      status: "AVAILABLE",
      mode: "IN_PERSON",
      location: "123 Breeder Lane, Springfield, IL",
    });

    // Afternoon slot: 2:00 PM
    const afternoon = new Date(date);
    afternoon.setHours(14, 0, 0, 0);
    slots.push({
      tenantId: TENANT_ID,
      blockId: block.id,
      startsAt: afternoon,
      endsAt: new Date(afternoon.getTime() + 60 * 60 * 1000),
      capacity: 1,
      bookedCount: 0,
      status: "AVAILABLE",
      mode: "IN_PERSON",
      location: "123 Breeder Lane, Springfield, IL",
    });

    // Evening slot: 5:00 PM (virtual)
    const evening = new Date(date);
    evening.setHours(17, 0, 0, 0);
    slots.push({
      tenantId: TENANT_ID,
      blockId: block.id,
      startsAt: evening,
      endsAt: new Date(evening.getTime() + 30 * 60 * 1000),
      capacity: 2, // Virtual can handle 2 parties
      bookedCount: 0,
      status: "AVAILABLE",
      mode: "VIRTUAL",
      location: null,
    });
  }

  await prisma.schedulingSlot.createMany({ data: slots });

  console.log(`Created ${slots.length} slots`);

  // Summary
  console.log("\n=== Seed Complete ===");
  console.log(`Template ID: ${template.id}`);
  console.log(`Block ID: ${block.id}`);
  console.log(`Event ID for API: template:${template.id}`);
  console.log(`Alt Event ID: block:${block.id}`);
  console.log(`\nTest with:`);
  console.log(`  GET /api/v1/portal/scheduling/events/template:${template.id}`);
  console.log(`  GET /api/v1/portal/scheduling/events/template:${template.id}/slots`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
