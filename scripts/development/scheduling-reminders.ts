#!/usr/bin/env npx ts-node
// scripts/scheduling-reminders.ts
// Scheduling reminder job - sends reminder emails 24 hours before appointments.
//
// Usage:
//   npx ts-node scripts/scheduling-reminders.ts
//   or via cron: 0 * * * * cd /path/to/api && npx ts-node scripts/scheduling-reminders.ts
//
// Idempotency:
//   Uses metadata in EmailSendLog to track sent reminders.
//   Template key: scheduling_reminder_{bookingId}
//
// This script is designed to be run hourly by a cron job.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Reminder window: 24 hours before, with 1 hour buffer for execution timing
const REMINDER_HOURS_BEFORE = 24;
const BUFFER_HOURS = 1;

interface BookingToRemind {
  id: number;
  tenantId: number;
  eventId: string;
  nextSteps: string | null;
  slot: {
    startsAt: Date;
    endsAt: Date;
    location: string | null;
    mode: string | null;
    block: {
      template: {
        eventType: string | null;
      } | null;
    } | null;
  };
  party: {
    id: number;
    name: string;
    email: string | null;
  };
  tenant: {
    name: string | null;
  };
}

async function main() {
  console.log("[scheduling-reminders] Starting reminder job...");

  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - BUFFER_HOURS) * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + (REMINDER_HOURS_BEFORE + BUFFER_HOURS) * 60 * 60 * 1000);

  console.log(`[scheduling-reminders] Looking for bookings starting between ${reminderWindowStart.toISOString()} and ${reminderWindowEnd.toISOString()}`);

  // Find confirmed bookings in the reminder window
  const bookings = await prisma.schedulingBooking.findMany({
    where: {
      status: "CONFIRMED",
      slot: {
        startsAt: {
          gte: reminderWindowStart,
          lte: reminderWindowEnd,
        },
      },
    },
    include: {
      slot: {
        include: {
          block: {
            include: { template: true },
          },
        },
      },
      party: true,
      tenant: true,
    },
  });

  console.log(`[scheduling-reminders] Found ${bookings.length} bookings in reminder window`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of bookings as BookingToRemind[]) {
    const templateKey = `scheduling_reminder_${booking.id}`;

    // Check if reminder already sent (idempotency)
    const existingReminder = await prisma.emailSendLog.findFirst({
      where: {
        tenantId: booking.tenantId,
        templateKey,
        status: "sent",
      },
    });

    if (existingReminder) {
      console.log(`[scheduling-reminders] Skipping booking ${booking.id} - reminder already sent`);
      skipped++;
      continue;
    }

    // Skip if no email
    if (!booking.party.email) {
      console.log(`[scheduling-reminders] Skipping booking ${booking.id} - no client email`);
      skipped++;
      continue;
    }

    // Build notification data
    const clientName = booking.party.name || "Client";
    const eventType = booking.slot.block?.template?.eventType || "Appointment";
    const breederName = booking.tenant.name || "Your Breeder";
    const tenantName = booking.tenant.name || "BreederHQ";

    let mode: "in_person" | "virtual" | null = null;
    if (booking.slot.mode === "IN_PERSON") mode = "in_person";
    else if (booking.slot.mode === "VIRTUAL") mode = "virtual";

    // Dynamically import the notification service to avoid ESM issues
    const { sendBookingReminderNotification } = await import("../src/services/scheduling-notifications.js");

    try {
      const result = await sendBookingReminderNotification({
        bookingId: booking.id,
        tenantId: booking.tenantId,
        eventType,
        startsAt: booking.slot.startsAt,
        endsAt: booking.slot.endsAt,
        location: booking.slot.location,
        mode,
        clientPartyId: booking.party.id,
        clientEmail: booking.party.email,
        clientName,
        breederName,
        tenantName,
        nextSteps: booking.nextSteps,
      });

      if (result.ok) {
        console.log(`[scheduling-reminders] Sent reminder for booking ${booking.id} to ${booking.party.email}`);
        sent++;
      } else {
        console.error(`[scheduling-reminders] Failed to send reminder for booking ${booking.id}: ${result.error}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`[scheduling-reminders] Error sending reminder for booking ${booking.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[scheduling-reminders] Complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[scheduling-reminders] Fatal error:", err);
  process.exit(1);
});
