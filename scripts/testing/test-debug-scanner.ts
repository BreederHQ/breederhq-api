// Debug script for notification scanner
import prisma from "./src/prisma.js";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function differenceInDays(dateA: Date, dateB: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function main() {
  console.log("=== Debugging Notification Scanner ===\n");

  // Get the test vaccination we just created
  const testVax = await prisma.vaccinationRecord.findFirst({
    where: {
      notes: { contains: "Test vaccination for notification system testing" },
    },
    include: {
      animal: true,
    },
  });

  if (!testVax) {
    console.log("❌ Test vaccination not found");
    return;
  }

  console.log(`Found test vaccination:`);
  console.log(`  ID: ${testVax.id}`);
  console.log(`  Animal: ${testVax.animal.name}`);
  console.log(`  Administered: ${testVax.administeredAt}`);
  console.log(`  Expires: ${testVax.expiresAt}`);
  console.log();

  const today = startOfDay(new Date());
  const expiresAt = testVax.expiresAt;

  if (!expiresAt) {
    console.log("❌ expiresAt is null");
    return;
  }

  console.log(`Today (start of day): ${today}`);
  console.log(`Expires at: ${expiresAt}`);
  console.log();

  const daysUntilExpiration = differenceInDays(expiresAt, today);
  console.log(`Days until expiration: ${daysUntilExpiration}`);
  console.log();

  // Check if it matches alert thresholds
  const shouldAlert =
    daysUntilExpiration === 7 ||
    daysUntilExpiration === 3 ||
    daysUntilExpiration === 1 ||
    daysUntilExpiration === 0 ||
    daysUntilExpiration === -7;

  console.log(`Should alert: ${shouldAlert}`);
  console.log();

  // Check the query range
  const sevenDaysFromNow = addDays(today, 7);
  const sevenDaysAgo = addDays(today, -7);

  console.log(`Query range:`);
  console.log(`  Start (7 days ago): ${sevenDaysAgo}`);
  console.log(`  End (7 days from now): ${sevenDaysFromNow}`);
  console.log();

  const inRange =
    (expiresAt >= today && expiresAt <= sevenDaysFromNow) ||
    (expiresAt >= sevenDaysAgo && expiresAt < today);

  console.log(`In query range: ${inRange}`);
  console.log();

  // Run the actual query from the scanner
  const vaccinations = await prisma.vaccinationRecord.findMany({
    where: {
      OR: [
        // Upcoming expirations (0-7 days from now)
        {
          expiresAt: {
            gte: today,
            lte: sevenDaysFromNow,
          },
        },
        // Recent expirations (expired up to 7 days ago)
        {
          expiresAt: {
            gte: sevenDaysAgo,
            lt: today,
          },
        },
      ],
    },
    include: {
      animal: {
        select: {
          id: true,
          name: true,
          tenantId: true,
          status: true,
        },
      },
    },
  });

  console.log(`Query found ${vaccinations.length} vaccinations`);
  vaccinations.forEach((v, idx) => {
    const days = differenceInDays(v.expiresAt!, today);
    console.log(`  ${idx + 1}. ${v.animal.name} - ${v.protocolKey} (expires in ${days} days)`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
